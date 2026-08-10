import type { AdminEventRecord } from '@/data/types/records';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import { writeCanonicalTicketFields } from '@/features/events/domain/canonical-ticket-writer';
import { resolveDescriptionGenrePublish } from '@/features/import/domain/description-genre-publish-resolver';
import { evaluateLineupPublishGate } from '@/features/import/domain/lineup-publish-gate';
import { adminEventToIdentitySnapshot } from '@/features/import/generic-truth-pipeline/evidence-from-canonical';

import { isTicketContributionBlocked } from './contribution-collision';
import {
  extractRebuiltFieldsFromEvidence,
  isOfficialEvidenceRole,
  isTicketEvidenceRole,
  mergeRebuiltFieldGroups,
} from './evidence-field-extractor';
import type { RebuiltCanonicalEvent, SourceEvidenceContribution } from './types';

function readString(meta: Record<string, unknown>, key: string): string | undefined {
  const value = meta[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function buildIdentityShellFromMerged(merged: Partial<RebuiltCanonicalEvent>, eventId: string): AdminEventRecord {
  return {
    id: eventId,
    title: merged.title ?? 'unknown',
    description: '',
    startDate: merged.startDate ?? '1970-01-01T00:00:00.000Z',
    endDate: merged.endDate,
    timezone: merged.timezone,
    venueName: merged.venueName,
    venueCity: merged.venueCity ?? merged.cityName,
    venueAddress: merged.venueAddress,
    venueCountryCode: merged.venueCountryCode ?? merged.countryCode,
    organizerName: merged.organizerName,
    websiteUrl: merged.websiteUrl,
    status: 'published',
    createdAt: '1970-01-01T00:00:00.000Z',
    updatedAt: '1970-01-01T00:00:00.000Z',
  };
}

function pickTicketContribution(
  contributions: SourceEvidenceContribution[],
  collisionKeys: string[],
): SourceEvidenceContribution | undefined {
  const candidates = contributions.filter(
    (entry) =>
      isTicketEvidenceRole(entry.bundle.sourceRole) &&
      !isTicketContributionBlocked(entry, collisionKeys),
  );
  const priority = (entry: SourceEvidenceContribution): number => {
    const meta = (entry.candidate.sourceMetadata as Record<string, unknown> | undefined) ?? {};
    const platform = String(meta.platform ?? '');
    if (platform.includes('ticket_king') || entry.bundle.sourceRole === 'ticket_platform') {
      if (entry.candidate.ticketUrl?.includes('ticketkings.de')) return 3;
      return 2;
    }
    return 1;
  };
  return candidates.sort((left, right) => priority(right) - priority(left))[0];
}

function pickOfficialContribution(
  contributions: SourceEvidenceContribution[],
  contentBlockedKeys: string[] = [],
): SourceEvidenceContribution | undefined {
  return contributions.find(
    (entry) =>
      !contentBlockedKeys.includes(`${entry.sourceId}:${entry.externalId}`) &&
      (isOfficialEvidenceRole(entry.bundle.sourceRole) ||
        Boolean(entry.bundle.content?.description) ||
        Boolean(entry.candidate.description)),
  );
}

export function assembleRebuiltCanonicalEvent(input: {
  contributions: SourceEvidenceContribution[];
  collisionContributionKeys: string[];
  contentBlockedContributionKeys?: string[];
  eventId: string;
  manualLocks?: string[];
}): RebuiltCanonicalEvent {
  const contentBlocked = input.contentBlockedContributionKeys ?? [];
  const identityPatches = input.contributions
    .filter((contribution) => !isTicketContributionBlocked(contribution, input.collisionContributionKeys))
    .map((contribution) => {
      const patch = extractRebuiltFieldsFromEvidence(contribution.candidate, contribution.bundle);
      if (contribution.bundle.identity.pageTitle || contribution.bundle.identity.listRowTitle) {
        patch.title =
          contribution.bundle.identity.pageTitle ??
          contribution.bundle.identity.listRowTitle ??
          patch.title;
      }
      if (contribution.bundle.identity.venueName) {
        patch.venueName = contribution.bundle.identity.venueName;
      }
      if (contribution.bundle.identity.eventDate && !patch.startDate) {
        patch.startDate = contribution.candidate.startDate;
      }
      patch.evidenceByFieldGroup = {
        ...(patch.evidenceByFieldGroup ?? {}),
        identity: [contribution.bundle.evidenceOrigin],
      };
      return { patch, role: contribution.bundle.sourceRole };
    });

  const mergedIdentity = mergeRebuiltFieldGroups(identityPatches);
  const identityShell = buildIdentityShellFromMerged(mergedIdentity, input.eventId);
  const manualLockSet = new Set(input.manualLocks ?? []);

  const official = pickOfficialContribution(input.contributions, contentBlocked);
  if (official) {
    if (official.candidate.eventUrl) {
      mergedIdentity.websiteUrl = official.candidate.eventUrl;
    }
    if (official.bundle.content?.description) {
      mergedIdentity.description = official.bundle.content.description;
    }
    if (official.bundle.content?.genreLabels?.length) {
      mergedIdentity.genreLabels = official.bundle.content.genreLabels;
    }
    const meta = (official.candidate.sourceMetadata as Record<string, unknown>) ?? {};
    const descriptionGenre = resolveDescriptionGenrePublish({
      officialDescription: official.bundle.content?.description ?? official.candidate.description,
      officialHtml: readString(meta, 'officialHtml'),
      ticketPlatformDescription: readString(meta, 'ticketPlatformDescription'),
      ticketPlatformGenres: official.bundle.content?.genreLabels,
      event: adminEventToIdentitySnapshot(identityShell),
      ticketEvidence: {
        pageTitle: official.bundle.identity.pageTitle,
        listRowTitle: official.bundle.identity.listRowTitle,
        eventDate: official.bundle.identity.eventDate,
        venueName: official.bundle.identity.venueName,
      },
      sourceId: official.sourceId,
      observedAt: official.bundle.observedAt,
    });

    if (descriptionGenre.description) {
      mergedIdentity.description = descriptionGenre.description;
      mergedIdentity.evidenceByFieldGroup.content = [
        ...(mergedIdentity.evidenceByFieldGroup.content ?? []),
        'official_body_boundaries',
      ];
    }
    if (descriptionGenre.genreLabels?.length && !mergedIdentity.genreLabels?.length) {
      mergedIdentity.genreLabels = descriptionGenre.genreLabels;
    }

    const lineupGate = evaluateLineupPublishGate({
      event: adminEventToIdentitySnapshot(identityShell),
      contentBlocks: descriptionGenre.description ? [descriptionGenre.description] : [],
      identityEvidence: {
        evidence: {
          pageTitle: official.bundle.identity.pageTitle,
          listRowTitle: official.bundle.identity.listRowTitle,
          eventDate: official.bundle.identity.eventDate,
          venueName: official.bundle.identity.venueName,
        },
        verifiedAt: official.bundle.verifiedAt,
        evidenceUrl: official.bundle.sourceUrl,
      },
      contaminationDetected: false,
    });

    if (lineupGate.allowed && lineupGate.extraction.entries?.length) {
      mergedIdentity.lineupArtistNames = lineupGate.extraction.entries
        .map((entry) => entry.displayName)
        .filter(Boolean);
    } else if (official.bundle.content?.structuredLineup?.length) {
      mergedIdentity.lineupArtistNames = official.bundle.content.structuredLineup
        .map((entry) => entry.displayName)
        .filter(Boolean);
    }

    if (official.candidate.minimumAge !== undefined) {
      mergedIdentity.ageRestriction = String(official.candidate.minimumAge);
    }
    if (typeof meta.venueEnvironment === 'string') {
      mergedIdentity.venueEnvironment = meta.venueEnvironment;
    }
    if (official.candidate.imageUrl) {
      mergedIdentity.imageUrl = official.candidate.imageUrl;
    }
    if (!mergedIdentity.genreLabels?.length && official.candidate.genreNames?.length) {
      mergedIdentity.genreLabels = official.candidate.genreNames;
    }
  }

  const ticketContribution = pickTicketContribution(input.contributions, input.collisionContributionKeys);
  if (ticketContribution) {
    const ticketWrite = writeCanonicalTicketFields({
      existing: identityShell,
      candidate: ticketContribution.candidate,
      manualLocks: manualLockSet,
      fillOnly: false,
    });

    if (ticketWrite.patch.ticketUrl) {
      mergedIdentity.ticketUrl = ticketWrite.patch.ticketUrl;
    }
    if (ticketWrite.patch.priceText) {
      mergedIdentity.priceText = ticketWrite.patch.priceText;
    }
    if (ticketWrite.patch.ticketStatus) {
      mergedIdentity.ticketStatus = ticketWrite.patch.ticketStatus;
    }
    if (ticketWrite.patch.ticketPhases?.length) {
      mergedIdentity.ticketPhases = ticketWrite.patch.ticketPhases;
    }
    mergedIdentity.checkoutEvidenceUrl =
      ticketWrite.audit.checkoutEvidenceUrl ?? ticketContribution.bundle.tickets?.checkoutEvidenceUrl;
    if (!mergedIdentity.ticketUrl) {
      const meta = (ticketContribution.candidate.sourceMetadata as Record<string, unknown>) ?? {};
      const fallbackUrl =
        (typeof meta.publicCtaCandidateUrl === 'string' && meta.publicCtaCandidateUrl) ||
        ticketContribution.candidate.ticketUrl;
      if (
        fallbackUrl &&
        (ticketContribution.identityVerdict === 'exact' ||
          ticketContribution.identityVerdict === 'corroborated')
      ) {
        mergedIdentity.ticketUrl = fallbackUrl;
      }
    }
    mergedIdentity.evidenceByFieldGroup.tickets = [
      ...(mergedIdentity.evidenceByFieldGroup.tickets ?? []),
      ticketContribution.bundle.evidenceOrigin,
    ];
  }

  mergedIdentity.evidenceByFieldGroup = mergedIdentity.evidenceByFieldGroup ?? {};
  mergedIdentity.verifiedAt =
    mergedIdentity.verifiedAt ?? ticketContribution?.bundle.verifiedAt ?? null;

  return {
    ...mergedIdentity,
    evidenceByFieldGroup: mergedIdentity.evidenceByFieldGroup,
  };
}

export function enrichCandidateTicketMetadata(
  candidate: CanonicalImportEvent,
  ticketCandidate?: CanonicalImportEvent,
): CanonicalImportEvent {
  if (!ticketCandidate) return candidate;
  const meta = {
    ...(candidate.sourceMetadata as Record<string, unknown> | undefined),
    ...(ticketCandidate.sourceMetadata as Record<string, unknown> | undefined),
  };
  return {
    ...candidate,
    sourceMetadata: meta,
  };
}
