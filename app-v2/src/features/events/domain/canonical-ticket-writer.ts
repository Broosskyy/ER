import type { AdminEventRecord } from '@/data/types/records';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import {
  normalizeTicketOffersFromCandidate,
} from '@/features/import/domain/canonical-ticket-phase';
import { readCanonicalTicket, type CanonicalTicketReadResult } from '@/features/events/domain/canonical-ticket-read';
import { classifyTicketDestination } from '@/features/events/domain/ticket-destination-classification';
import {
  TICKET_DESTINATION_PRIORITY,
  isPublicConsumerCtaDestinationClass,
} from '@/features/events/domain/canonical-ticket-domain';
import { meaningfulEventText } from '@/features/events/domain/event-field-value';
import { resolveBetterTicketUrl } from '@/features/events/domain/ticket-url-quality';
import type { TicketUrlCandidate } from '@/features/events/domain/canonical-ticket-selection';
import { evaluateEventEvidenceIdentityGate } from '@/features/import/domain/event-evidence-identity-gate';
import {
  buildAtomicAdmissionSnapshot,
  evaluateTicketEvidenceFreshness,
  replaceAdmissionSnapshotForSource,
  resolveSourceRank,
  type FreshnessMergeDecision,
} from '@/features/import/domain/ticket-evidence-freshness-merge';
import type { EventEvidenceIdentityGateResult } from '@/features/import/domain/event-evidence-identity-gate';

export interface CanonicalTicketWriteInput {
  existing: AdminEventRecord | null;
  candidate?: CanonicalImportEvent;
  extraCandidates?: TicketUrlCandidate[];
  fillOnly?: boolean;
  detailBlocked?: boolean;
  manualLocks?: Set<string>;
  now?: string;
}

export interface CanonicalTicketWritePatch {
  ticketUrl?: string;
  websiteUrl?: string;
  priceText?: string;
  ticketStatus?: AdminEventRecord['ticketStatus'];
  ticketPhases?: AdminEventRecord['ticketPhases'];
}

export interface CanonicalTicketWriteAudit {
  identityVerdict: string;
  identityReason: string;
  freshnessDecision: string;
  freshnessFallbackRule: string;
  checkoutEvidenceUrl?: string;
  publicCtaCandidateUrl?: string;
  blockedCriticalFields: string[];
  diagnostics: string[];
}

export interface CanonicalTicketWriteResult {
  patch: CanonicalTicketWritePatch;
  snapshot: CanonicalTicketReadResult;
  changed: boolean;
  fieldChanges: string[];
  audit: CanonicalTicketWriteAudit;
}

function isLocked(field: string, locks?: Set<string>): boolean {
  return locks?.has(field) ?? false;
}

function shouldKeepExistingUrl(
  existingUrl: string | undefined,
  selectedUrl: string | undefined,
  detailBlocked: boolean,
): boolean {
  if (!meaningfulEventText(existingUrl)) {
    return false;
  }
  if (!meaningfulEventText(selectedUrl)) {
    return detailBlocked || true;
  }
  const resolution = resolveBetterTicketUrl(existingUrl, selectedUrl);
  return resolution.decision === 'kept_existing';
}

function readCandidateMetadata(candidate?: CanonicalImportEvent): Record<string, unknown> | undefined {
  return candidate?.sourceMetadata as Record<string, unknown> | undefined;
}

function readVerifiedAt(metadata: Record<string, unknown> | undefined): string | undefined {
  const raw = metadata?.verifiedAt ?? metadata?.observedAt ?? metadata?.freshnessAt;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : undefined;
}

function readOfficialOutboundTicketUrls(metadata: Record<string, unknown> | undefined): string[] | undefined {
  const raw = metadata?.officialOutboundTicketUrls ?? metadata?.officialTicketUrls;
  if (!Array.isArray(raw)) {
    return undefined;
  }
  return raw.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
}

function readEvidenceIdentityUrl(
  metadata: Record<string, unknown> | undefined,
  candidate?: CanonicalImportEvent,
): string | undefined {
  // Checkout embeds are evidence-only — never the identity anchor for critical field writes.
  return (
    (typeof metadata?.publicCtaCandidateUrl === 'string' && metadata.publicCtaCandidateUrl) ||
    (typeof metadata?.publicTicketPageUrl === 'string' && metadata.publicTicketPageUrl) ||
    candidate?.ticketUrl ||
    (typeof metadata?.ticketUrl === 'string' && metadata.ticketUrl) ||
    undefined
  );
}

function readEvidenceIdentityInput(
  existing: AdminEventRecord | null,
  candidate?: CanonicalImportEvent,
): {
  gate: EventEvidenceIdentityGateResult;
  evidenceUrl?: string;
  checkoutEvidenceUrl?: string;
  publicCtaCandidateUrl?: string;
} {
  const metadata = readCandidateMetadata(candidate);
  const evidenceUrl = readEvidenceIdentityUrl(metadata, candidate);

  const publicCtaCandidateUrl =
    (typeof metadata?.publicCtaCandidateUrl === 'string' && metadata.publicCtaCandidateUrl) ||
    (typeof metadata?.publicTicketPageUrl === 'string' && metadata.publicTicketPageUrl) ||
    undefined;

  const gate = evaluateEventEvidenceIdentityGate({
    event: {
      eventId: existing?.id ?? candidate?.externalId ?? 'unknown',
      title: existing?.title ?? candidate?.title ?? '',
      startDate: existing?.startDate ?? candidate?.startDate,
      venueName: existing?.venueName ?? candidate?.venueName,
      venueCity: existing?.venueCity ?? candidate?.cityName,
      ticketUrl: existing?.ticketUrl,
      websiteUrl: existing?.websiteUrl ?? candidate?.eventUrl ?? candidate?.originalLink,
      sourceId: candidate?.sourceId,
    },
    evidence: {
      pageTitle: typeof metadata?.pageTitle === 'string' ? metadata.pageTitle : undefined,
      listRowTitle: typeof metadata?.listRowTitle === 'string' ? metadata.listRowTitle : undefined,
      eventDate: typeof metadata?.eventDate === 'string' ? metadata.eventDate : undefined,
      venueName: typeof metadata?.venueName === 'string' ? metadata.venueName : undefined,
    },
    officialEventUrl: existing?.websiteUrl ?? candidate?.eventUrl ?? candidate?.originalLink,
    officialOutboundTicketUrls: readOfficialOutboundTicketUrls(metadata),
    evidenceUrl,
  });

  return {
    gate,
    evidenceUrl,
    checkoutEvidenceUrl:
      typeof metadata?.checkoutEvidenceUrl === 'string' ? metadata.checkoutEvidenceUrl : undefined,
    publicCtaCandidateUrl,
  };
}

function partitionUrlCandidates(candidates: TicketUrlCandidate[]): {
  publicCta: TicketUrlCandidate[];
  checkoutEvidence: TicketUrlCandidate[];
} {
  const publicCta: TicketUrlCandidate[] = [];
  const checkoutEvidence: TicketUrlCandidate[] = [];
  for (const candidate of candidates) {
    const classified = classifyTicketDestination(candidate.url);
    if (classified.destinationClass === 'embedded_checkout_evidence') {
      checkoutEvidence.push(candidate);
      continue;
    }
    if (isPublicConsumerCtaDestinationClass(classified.destinationClass)) {
      publicCta.push(candidate);
    }
  }
  return { publicCta, checkoutEvidence };
}

export function writeCanonicalTicketFields(input: CanonicalTicketWriteInput): CanonicalTicketWriteResult {
  const existing = input.existing;
  const now = input.now ?? new Date().toISOString();
  const metadata = readCandidateMetadata(input.candidate);
  const sourceKey = input.candidate?.sourceId ?? 'unknown';
  const existingSourceKey =
    typeof metadata?.existingTicketSourceKey === 'string'
      ? metadata.existingTicketSourceKey
      : sourceKey;

  const identity = readEvidenceIdentityInput(existing, input.candidate);
  const incomingPhases = input.candidate
    ? normalizeTicketOffersFromCandidate(input.candidate)
    : undefined;

  const incomingSnapshot =
    incomingPhases?.length && identity.gate.criticalFieldsPublishAllowed
      ? buildAtomicAdmissionSnapshot({
          phases: incomingPhases,
          sourceKey,
          verifiedAt: readVerifiedAt(metadata),
          checkoutEvidenceUrl: identity.checkoutEvidenceUrl,
          publicCtaCandidateUrl: identity.publicCtaCandidateUrl,
          soldOut: metadata?.soldOut === true,
          fallbackTicketStatus: existing?.ticketStatus,
        })
      : undefined;

  const freshnessDecision: FreshnessMergeDecision = evaluateTicketEvidenceFreshness({
    existingVerifiedAt:
      typeof metadata?.existingVerifiedAt === 'string' ? metadata.existingVerifiedAt : undefined,
    incomingVerifiedAt: incomingSnapshot?.verifiedAt,
    identityVerdict: identity.gate.verdict,
    manualLocked: isLocked('ticketPhases', input.manualLocks) || isLocked('priceText', input.manualLocks),
    hasIncomingSnapshot: Boolean(incomingSnapshot?.phases.length),
  });

  const mergedPhases = replaceAdmissionSnapshotForSource({
    existingPhases: existing?.ticketPhases,
    existingSourceKey,
    incoming: incomingSnapshot ?? {
      phases: [],
      sourceKey,
    },
    decision: freshnessDecision,
    incomingDominatesExistingSource:
      resolveSourceRank(sourceKey) >= resolveSourceRank(existingSourceKey),
  });

  const incomingCandidates: TicketUrlCandidate[] = [
    ...(input.extraCandidates ?? []),
    input.candidate?.ticketUrl
      ? { url: input.candidate.ticketUrl, field: 'candidate.ticketUrl', confidence: 1 }
      : undefined,
    identity.publicCtaCandidateUrl
      ? {
          url: identity.publicCtaCandidateUrl,
          field: 'metadata.publicCtaCandidateUrl',
          confidence: 0.95,
        }
      : undefined,
    identity.checkoutEvidenceUrl
      ? {
          url: identity.checkoutEvidenceUrl,
          field: 'metadata.checkoutEvidenceUrl',
          confidence: 0.9,
        }
      : undefined,
    typeof metadata?.ticketUrl === 'string'
      ? { url: metadata.ticketUrl, field: 'metadata.ticketUrl', confidence: 0.9 }
      : undefined,
  ].filter((entry): entry is TicketUrlCandidate => Boolean(entry));

  const { publicCta, checkoutEvidence } = partitionUrlCandidates(incomingCandidates);

  const snapshot = readCanonicalTicket({
    ticketUrl: existing?.ticketUrl,
    websiteUrl: existing?.websiteUrl,
    priceText:
      freshnessDecision.apply && incomingSnapshot?.priceText
        ? incomingSnapshot.priceText
        : existing?.priceText,
    ticketStatus:
      freshnessDecision.apply && incomingSnapshot?.ticketStatus
        ? incomingSnapshot.ticketStatus
        : existing?.ticketStatus,
    ticketPhases: mergedPhases,
    salesStartAt: existing?.salesStartAt,
    salesEndAt: existing?.salesEndAt,
    extraUrlCandidates: [...publicCta, ...checkoutEvidence],
    detailBlocked: input.detailBlocked,
  });

  const selectedPublicUrl = snapshot.publicCtaUrl;
  const selectedOfficialUrl = snapshot.officialEventUrl;
  const checkoutEvidenceUrl = snapshot.checkoutEvidenceUrl ?? identity.checkoutEvidenceUrl;

  const patch: CanonicalTicketWritePatch = {};
  const fieldChanges: string[] = [];
  const blockedCriticalFields: string[] = [];

  if (!identity.gate.criticalFieldsPublishAllowed) {
    blockedCriticalFields.push('priceText', 'ticketPhases', 'ticketStatus', 'ticketUrl');
  }

  if (!isLocked('websiteUrl', input.manualLocks)) {
    const nextWebsite = selectedOfficialUrl ?? existing?.websiteUrl;
    if (nextWebsite !== existing?.websiteUrl) {
      patch.websiteUrl = nextWebsite;
      fieldChanges.push('websiteUrl');
    }
  }

  if (!isLocked('ticketUrl', input.manualLocks) && identity.gate.criticalFieldsPublishAllowed) {
    const incomingAuthoritative =
      freshnessDecision.apply &&
      Boolean(identity.publicCtaCandidateUrl ?? input.candidate?.ticketUrl);

    let nextTicketUrl = incomingAuthoritative
      ? identity.publicCtaCandidateUrl ?? input.candidate?.ticketUrl
      : selectedPublicUrl;

    if (
      nextTicketUrl &&
      classifyTicketDestination(nextTicketUrl).destinationClass === 'embedded_checkout_evidence'
    ) {
      nextTicketUrl = undefined;
      blockedCriticalFields.push('ticketUrl:embedded_checkout_rejected');
    }

    if (!incomingAuthoritative) {
      if (shouldKeepExistingUrl(existing?.ticketUrl, nextTicketUrl, Boolean(input.detailBlocked))) {
        nextTicketUrl = existing?.ticketUrl;
      } else if (
        existing?.ticketUrl &&
        nextTicketUrl &&
        TICKET_DESTINATION_PRIORITY[classifyTicketDestination(existing.ticketUrl).destinationClass] >
          TICKET_DESTINATION_PRIORITY[classifyTicketDestination(nextTicketUrl).destinationClass]
      ) {
        nextTicketUrl = existing.ticketUrl;
      }
    }

    if (nextTicketUrl !== existing?.ticketUrl) {
      patch.ticketUrl = nextTicketUrl;
      fieldChanges.push('ticketUrl');
    }
  }

  if (
    !isLocked('priceText', input.manualLocks) &&
    identity.gate.criticalFieldsPublishAllowed &&
    freshnessDecision.apply
  ) {
    const nextPrice = incomingSnapshot?.priceText;
    if (input.detailBlocked && !meaningfulEventText(nextPrice) && meaningfulEventText(existing?.priceText)) {
      // preserve
    } else if (nextPrice !== existing?.priceText) {
      patch.priceText = nextPrice;
      fieldChanges.push('priceText');
    }
  }

  if (
    !isLocked('ticketPhases', input.manualLocks) &&
    identity.gate.criticalFieldsPublishAllowed &&
    freshnessDecision.apply
  ) {
    if (input.detailBlocked && !incomingPhases?.length && existing?.ticketPhases?.length) {
      // preserve phases
    } else if (JSON.stringify(mergedPhases) !== JSON.stringify(existing?.ticketPhases)) {
      patch.ticketPhases = mergedPhases;
      fieldChanges.push('ticketPhases');
    }
  }

  if (
    !isLocked('ticketStatus', input.manualLocks) &&
    identity.gate.criticalFieldsPublishAllowed &&
    freshnessDecision.apply
  ) {
    const nextStatus = incomingSnapshot?.ticketStatus;
    if (input.detailBlocked && !incomingPhases?.length && existing?.ticketStatus) {
      // preserve status
    } else if (nextStatus && nextStatus !== existing?.ticketStatus) {
      patch.ticketStatus = nextStatus;
      fieldChanges.push('ticketStatus');
    }
  }

  const finalSnapshot = readCanonicalTicket({
    ticketUrl: patch.ticketUrl ?? existing?.ticketUrl,
    websiteUrl: patch.websiteUrl ?? existing?.websiteUrl,
    priceText: patch.priceText ?? existing?.priceText,
    ticketStatus: patch.ticketStatus ?? existing?.ticketStatus,
    ticketPhases: patch.ticketPhases ?? mergedPhases,
    salesStartAt: existing?.salesStartAt,
    salesEndAt: existing?.salesEndAt,
    detailBlocked: input.detailBlocked,
  });

  const audit: CanonicalTicketWriteAudit = {
    identityVerdict: identity.gate.verdict,
    identityReason: identity.gate.reason,
    freshnessDecision: freshnessDecision.reason,
    freshnessFallbackRule: freshnessDecision.fallbackRule,
    checkoutEvidenceUrl,
    publicCtaCandidateUrl: identity.publicCtaCandidateUrl ?? selectedPublicUrl,
    blockedCriticalFields,
    diagnostics: [...identity.gate.diagnostics, `freshness:${freshnessDecision.reason}`],
  };

  return {
    patch,
    snapshot: finalSnapshot,
    changed: fieldChanges.length > 0,
    fieldChanges,
    audit,
  };
}
