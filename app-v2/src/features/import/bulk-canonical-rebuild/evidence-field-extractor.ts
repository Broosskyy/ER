import type { AdminEventRecord } from '@/data/types/records';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import { projectCanonicalEventFields } from '@/features/events/formatting/canonical-event-projection';
import type { SourceEvidenceBundle } from '@/features/import/generic-truth-pipeline/source-evidence-contract';

import type { RebuiltCanonicalEvent } from './types';

const OFFICIAL_ROLES = new Set([
  'official_website_source',
  'organizer',
  'promoter',
  'venue',
  'club_website',
]);

const TICKET_ROLES = new Set(['ticket_platform', 'nachtmanager', 'checkout_provider']);

export function isOfficialEvidenceRole(role: string): boolean {
  return OFFICIAL_ROLES.has(role);
}

export function isTicketEvidenceRole(role: string): boolean {
  return TICKET_ROLES.has(role) || role === 'ticket_platform';
}

export function extractRebuiltFieldsFromEvidence(
  candidate: CanonicalImportEvent,
  bundle: SourceEvidenceBundle,
): Partial<RebuiltCanonicalEvent> {
  const role = bundle.sourceRole;
  const patch: Partial<RebuiltCanonicalEvent> = {
    verifiedAt: bundle.verifiedAt ?? null,
    evidenceByFieldGroup: {},
  };

  if (isOfficialEvidenceRole(role) || bundle.content?.description) {
    patch.title = candidate.title ?? bundle.identity.pageTitle ?? bundle.identity.listRowTitle;
    patch.startDate = candidate.startDate;
    patch.endDate = candidate.endDate;
    patch.timezone = candidate.timezone;
    patch.venueName = candidate.venueName ?? bundle.identity.venueName;
    patch.venueCity = candidate.cityName;
    patch.cityName = candidate.cityName;
    patch.countryCode = candidate.countryCode;
    patch.organizerName = candidate.organizerName;
    patch.websiteUrl = candidate.eventUrl ?? bundle.sourceUrl;
    patch.description = bundle.content?.description ?? candidate.description;
    patch.genreLabels = bundle.content?.genreLabels ?? candidate.genreNames;
    patch.imageUrl = candidate.imageUrl;
    if (candidate.minimumAge !== undefined) {
      patch.ageRestriction = String(candidate.minimumAge);
    }
    const meta = candidate.sourceMetadata as Record<string, unknown> | undefined;
    if (typeof meta?.venueEnvironment === 'string') {
      patch.venueEnvironment = meta.venueEnvironment;
    }
    if (bundle.content?.structuredLineup?.length) {
      patch.lineupArtistNames = bundle.content.structuredLineup
        .map((entry) => entry.displayName)
        .filter(Boolean);
    } else if (candidate.artistNames?.length) {
      patch.lineupArtistNames = [...candidate.artistNames];
    } else if (candidate.lineupEntries?.length) {
      patch.lineupArtistNames = candidate.lineupEntries.flatMap((entry) => entry.artists).filter(Boolean);
    }
    patch.evidenceByFieldGroup!.identity = [bundle.evidenceOrigin];
    patch.evidenceByFieldGroup!.content = [bundle.evidenceOrigin];
  }

  if (isTicketEvidenceRole(role) || bundle.tickets) {
    if (bundle.identity.pageTitle || bundle.identity.listRowTitle) {
      patch.title = bundle.identity.pageTitle ?? bundle.identity.listRowTitle;
      patch.evidenceByFieldGroup!.identity = [
        ...(patch.evidenceByFieldGroup!.identity ?? []),
        bundle.evidenceOrigin,
      ];
    }
    if (bundle.identity.venueName) {
      patch.venueName = bundle.identity.venueName;
      patch.evidenceByFieldGroup!.identity = [
        ...(patch.evidenceByFieldGroup!.identity ?? []),
        bundle.evidenceOrigin,
      ];
    }
    if (bundle.identity.eventDate && !patch.startDate) {
      patch.startDate = candidate.startDate;
    }
    patch.ticketUrl = bundle.tickets?.publicCtaCandidateUrl ?? candidate.ticketUrl;
    patch.checkoutEvidenceUrl = bundle.tickets?.checkoutEvidenceUrl;
    patch.priceText = bundle.tickets?.priceText ?? candidate.priceText;
    const meta = candidate.sourceMetadata as Record<string, unknown> | undefined;
    if (typeof meta?.ticketStatus === 'string') {
      patch.ticketStatus = meta.ticketStatus as RebuiltCanonicalEvent['ticketStatus'];
    }
    if (Array.isArray(meta?.ticketPhases)) {
      patch.ticketPhases = meta.ticketPhases as RebuiltCanonicalEvent['ticketPhases'];
    }
    patch.evidenceByFieldGroup!.tickets = [bundle.evidenceOrigin];
  }

  return patch;
}

export function mergeRebuiltFieldGroups(
  contributions: Array<{ patch: Partial<RebuiltCanonicalEvent>; role: string }>,
): RebuiltCanonicalEvent {
  const merged: RebuiltCanonicalEvent = {
    evidenceByFieldGroup: {},
  };

  for (const entry of contributions) {
    const patch = entry.patch;
    const assign = (key: keyof RebuiltCanonicalEvent, group: string) => {
      const value = patch[key];
      if (value === undefined || value === null) return;
      (merged as unknown as Record<string, unknown>)[key as string] = value;
      merged.evidenceByFieldGroup[group] = [
        ...(merged.evidenceByFieldGroup[group] ?? []),
        ...(patch.evidenceByFieldGroup?.[group] ?? []),
      ];
    };

    if (isOfficialEvidenceRole(entry.role)) {
      assign('title', 'identity');
      assign('startDate', 'identity');
      assign('endDate', 'identity');
      assign('timezone', 'identity');
      assign('venueName', 'identity');
      assign('venueCity', 'identity');
      assign('cityName', 'identity');
      assign('countryCode', 'identity');
      assign('organizerName', 'identity');
      assign('websiteUrl', 'identity');
      assign('description', 'content');
      assign('genreLabels', 'content');
      assign('lineupArtistNames', 'content');
      assign('ageRestriction', 'content');
      assign('venueEnvironment', 'content');
      assign('imageUrl', 'content');
    }

    if (isTicketEvidenceRole(entry.role)) {
      assign('title', 'identity');
      assign('startDate', 'identity');
      assign('endDate', 'identity');
      assign('timezone', 'identity');
      assign('venueName', 'identity');
      assign('venueCity', 'identity');
      assign('cityName', 'identity');
      assign('countryCode', 'identity');
      assign('organizerName', 'identity');
      assign('ticketUrl', 'tickets');
      assign('checkoutEvidenceUrl', 'tickets');
      assign('priceText', 'tickets');
      assign('ticketStatus', 'tickets');
      assign('ticketPhases', 'tickets');
    }

    if (patch.verifiedAt) {
      merged.verifiedAt = patch.verifiedAt;
    }
  }

  return merged;
}

export function rebuiltToAdminShape(
  rebuilt: RebuiltCanonicalEvent,
  seed: { id: string; status?: AdminEventRecord['status'] },
): AdminEventRecord {
  return {
    id: seed.id,
    title: rebuilt.title ?? 'unknown',
    description: rebuilt.description ?? '',
    startDate: rebuilt.startDate ?? '1970-01-01T00:00:00.000Z',
    endDate: rebuilt.endDate,
    timezone: rebuilt.timezone,
    venueName: rebuilt.venueName,
    venueCity: rebuilt.venueCity ?? rebuilt.cityName,
    venueAddress: rebuilt.venueAddress,
    venueCountryCode: rebuilt.venueCountryCode ?? rebuilt.countryCode,
    organizerName: rebuilt.organizerName,
    websiteUrl: rebuilt.websiteUrl,
    priceText: rebuilt.priceText,
    ticketUrl: rebuilt.ticketUrl,
    ticketStatus: rebuilt.ticketStatus,
    ticketPhases: rebuilt.ticketPhases,
    genreLabels: rebuilt.genreLabels,
    ageRestriction: rebuilt.ageRestriction,
    imageUrl: rebuilt.imageUrl,
    status: seed.status ?? 'published',
    createdAt: '1970-01-01T00:00:00.000Z',
    updatedAt: '1970-01-01T00:00:00.000Z',
  };
}

export function buildConsumerProjection(
  event: AdminEventRecord,
  lineupArtistNames: string[] = [],
): Record<string, unknown> {
  const projection = projectCanonicalEventFields({
    title: event.title,
    description: event.description ?? '',
    venue: event.venueName ?? '',
    city: event.venueCity ?? '',
    artists: lineupArtistNames,
    priceText: event.priceText,
    source: event.sourceId ?? '',
    ticketUrl: event.ticketUrl,
    imageUrl: event.imageUrl,
    genres: event.genreLabels,
    ticketStatus: event.ticketStatus,
    ticketPhases: event.ticketPhases,
    latitude: event.latitude,
    longitude: event.longitude,
  });
  return projection as unknown as Record<string, unknown>;
}
