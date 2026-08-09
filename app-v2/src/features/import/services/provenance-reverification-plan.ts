import type { AdminEventRecord } from '@/data/types/records';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import type { IdentityPublishVerdict } from '@/features/import/domain/event-evidence-identity-gate';
import { readWebsiteTextualEnrichmentMetadata } from '@/features/aggregation/connectors/website/website-textual-enrichment';
import type { SourceEvidenceBundle } from '@/features/import/generic-truth-pipeline/source-evidence-contract';
import {
  deduplicateAlternatives,
  fingerprintFromSnapshot,
  REPAIR_APPLY_SELECTED_AT_SENTINEL,
  type ProvenancePlanEntry,
  type ProvenanceRepairKind,
  type ProvenanceRollbackSnapshot,
} from '@/features/import/services/provenance-repair-manifest';

export const OFFICIAL_BOOTSHAUS_SOURCE_ID = 'source-bootshaus-koeln';
export const TICKET_IO_SOURCE_ID = 'source-bootshaus-ticket-io';
export const CANARY_TICKET_EVIDENCE_VERIFIED_AT = '2026-08-09T19:21:16.347Z';

export interface OfficialFieldAssessment {
  fieldPath: string;
  liveValue: unknown;
  eventValue: unknown;
  identityVerdict: IdentityPublishVerdict;
  nativeEvidencePresent: boolean;
  verifiedAt: string | null;
  normalizedMatch: boolean;
  sourceRoleAllowed: boolean;
  reverificationPossible: boolean;
  repairKind: ProvenanceRepairKind;
  reviewReasons: string[];
}

export interface TicketFreshnessAssessment {
  fieldPath: 'priceText' | 'ticketStatus' | 'ticketUrl';
  confirmedByLiveEvidence: boolean;
  liveValue: unknown;
  eventValue: unknown;
  evidenceUrl: string;
  evidenceVerifiedAt: string;
  repairKind: ProvenanceRepairKind;
  reviewReasons: string[];
}

function hasExplicitFieldEvidence(candidate: CanonicalImportEvent, fieldName: string): boolean {
  const fieldEvidence = candidate.sourceMetadata?.fieldEvidence;
  if (!Array.isArray(fieldEvidence)) return false;
  return fieldEvidence.some(
    (entry) =>
      typeof entry === 'object'
      && entry !== null
      && String((entry as Record<string, unknown>).field) === fieldName,
  );
}

function geographyIsExplicit(
  candidate: CanonicalImportEvent,
  key: 'venue' | 'city' | 'address' | 'country',
): boolean {
  const geography = candidate.sourceMetadata?.eventGeography;
  if (!geography || typeof geography !== 'object') return false;
  const value = (geography as Record<string, unknown>)[key];
  return typeof value === 'string' && value === 'explicit';
}

function normalizeComparable(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  return JSON.stringify(value);
}

function normalizeDateComparable(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return normalizeComparable(value);
  return parsed.toISOString();
}

function readMinimumAgeText(candidate: CanonicalImportEvent): string | undefined {
  const metadata = candidate.sourceMetadata ?? {};
  const textual = readWebsiteTextualEnrichmentMetadata({
    rawDescription: candidate.description,
    warnings: [],
    extractionStrategy: 'unknown',
    externalId: candidate.externalId,
    sourceMetadata: metadata,
  } as never);
  return textual.minimumAge?.trim() || undefined;
}

export function assessOfficialField(
  fieldPath: string,
  input: {
    candidate: CanonicalImportEvent;
    bundle: SourceEvidenceBundle;
    event: AdminEventRecord;
    identityVerdict: IdentityPublishVerdict;
    officialUrl: string;
    manualLocked: boolean;
  },
): OfficialFieldAssessment {
  const reviewReasons: string[] = [];
  const identityOk = ['exact', 'corroborated'].includes(input.identityVerdict);
  if (!identityOk) {
    reviewReasons.push(`identity_verdict_${input.identityVerdict}`);
  }
  if (input.manualLocked) {
    reviewReasons.push('manual_lock');
  }

  let liveValue: unknown;
  let eventValue: unknown;
  let nativeEvidencePresent = false;

  switch (fieldPath) {
    case 'title':
      liveValue = input.bundle.identity.pageTitle ?? input.candidate.title;
      eventValue = input.event.title;
      nativeEvidencePresent = Boolean(input.bundle.identity.pageTitle?.trim());
      break;
    case 'description':
      liveValue = input.bundle.content?.description ?? input.candidate.description;
      eventValue = input.event.description;
      nativeEvidencePresent = Boolean(input.bundle.content?.description?.trim());
      break;
    case 'startDate':
      liveValue = input.bundle.identity.eventDate ?? input.candidate.startDate;
      eventValue = input.event.startDate;
      nativeEvidencePresent = Boolean(input.bundle.identity.eventDate?.trim());
      break;
    case 'venueName':
      liveValue = input.bundle.identity.venueName ?? input.candidate.venueName;
      eventValue = input.event.venueName;
      nativeEvidencePresent = Boolean(input.bundle.identity.venueName?.trim());
      break;
    case 'venueCity':
      liveValue = input.candidate.cityName;
      eventValue = input.event.venueCity;
      nativeEvidencePresent = geographyIsExplicit(input.candidate, 'city');
      if (!nativeEvidencePresent) reviewReasons.push('no_native_venue_city_evidence');
      break;
    case 'venueAddress':
      liveValue = input.candidate.venueAddress;
      eventValue = input.event.venueAddress;
      nativeEvidencePresent = geographyIsExplicit(input.candidate, 'address');
      if (!nativeEvidencePresent) reviewReasons.push('no_native_venue_address_evidence');
      break;
    case 'cityName':
      liveValue = input.candidate.cityName;
      eventValue = input.event.venueCity;
      nativeEvidencePresent = geographyIsExplicit(input.candidate, 'city');
      if (!nativeEvidencePresent) reviewReasons.push('no_native_city_name_evidence');
      break;
    case 'countryCode':
      liveValue = input.candidate.countryCode;
      eventValue = input.event.venueCountryCode;
      nativeEvidencePresent = geographyIsExplicit(input.candidate, 'country');
      if (!nativeEvidencePresent) reviewReasons.push('no_native_country_code_evidence');
      break;
    case 'organizerName':
      liveValue = input.bundle.identity.organizerName ?? input.candidate.organizerName;
      eventValue = input.event.organizerName;
      nativeEvidencePresent = Boolean(
        input.bundle.identity.organizerName?.trim()
        || hasExplicitFieldEvidence(input.candidate, 'rawOrganizer'),
      );
      if (!nativeEvidencePresent) reviewReasons.push('no_native_organizer_evidence');
      break;
    case 'websiteUrl':
      liveValue = input.officialUrl;
      eventValue = input.event.websiteUrl;
      nativeEvidencePresent = true;
      break;
    case 'ageRestriction':
      liveValue = readMinimumAgeText(input.candidate);
      eventValue = input.event.ageRestriction;
      nativeEvidencePresent = Boolean(readMinimumAgeText(input.candidate));
      if (!nativeEvidencePresent) reviewReasons.push('no_explicit_age_restriction_evidence');
      break;
    default:
      reviewReasons.push('unsupported_official_field');
      liveValue = undefined;
      eventValue = undefined;
  }

  const normalizedMatch =
    fieldPath === 'startDate'
      ? normalizeDateComparable(liveValue) === normalizeDateComparable(eventValue)
      : normalizeComparable(liveValue) === normalizeComparable(eventValue);

  if (!normalizedMatch && nativeEvidencePresent) {
    reviewReasons.push('live_event_value_mismatch');
  }

  const sourceRoleAllowed = input.bundle.sourceRole === 'official_website_source';
  if (!sourceRoleAllowed) {
    reviewReasons.push(`source_role_${input.bundle.sourceRole}`);
  }

  const reverificationPossible =
    identityOk
    && nativeEvidencePresent
    && normalizedMatch
    && sourceRoleAllowed
    && !input.manualLocked
    && reviewReasons.length === 0;

  const repairKind: ProvenanceRepairKind = reverificationPossible
    ? 'live_source_reverification'
    : 'review_only';

  return {
    fieldPath,
    liveValue,
    eventValue,
    identityVerdict: input.identityVerdict,
    nativeEvidencePresent,
    verifiedAt: input.bundle.verifiedAt || null,
    normalizedMatch,
    sourceRoleAllowed,
    reverificationPossible,
    repairKind,
    reviewReasons,
  };
}

export function assessTicketFreshnessField(
  fieldPath: 'priceText' | 'ticketStatus' | 'ticketUrl',
  input: {
    event: AdminEventRecord;
    ticketEvidenceUrl: string;
    ticketEvidenceVerifiedAt: string;
    liveTicketUrl?: string;
    livePriceText?: string;
    liveTicketStatus?: string;
  },
): TicketFreshnessAssessment {
  const reviewReasons: string[] = [];
  let liveValue: unknown;
  let eventValue: unknown;
  let confirmedByLiveEvidence = false;

  switch (fieldPath) {
    case 'priceText':
      liveValue = input.livePriceText ?? input.event.priceText;
      eventValue = input.event.priceText;
      confirmedByLiveEvidence = Boolean(input.livePriceText?.trim());
      break;
    case 'ticketStatus':
      liveValue = input.liveTicketStatus ?? input.event.ticketStatus;
      eventValue = input.event.ticketStatus;
      confirmedByLiveEvidence = Boolean(input.liveTicketStatus?.trim());
      break;
    case 'ticketUrl':
      liveValue = input.liveTicketUrl;
      eventValue = input.event.ticketUrl;
      confirmedByLiveEvidence =
        Boolean(input.liveTicketUrl?.trim())
        && normalizeComparable(input.liveTicketUrl) === normalizeComparable(input.event.ticketUrl);
      if (!confirmedByLiveEvidence) {
        reviewReasons.push('ticket_url_not_confirmed_by_live_evidence');
      }
      break;
  }

  const repairKind: ProvenanceRepairKind =
  fieldPath === 'ticketUrl' && !confirmedByLiveEvidence
    ? 'review_only'
    : 'freshness_only_known_evidence';

  return {
    fieldPath,
    confirmedByLiveEvidence,
    liveValue,
    eventValue,
    evidenceUrl: input.ticketEvidenceUrl,
    evidenceVerifiedAt: input.ticketEvidenceVerifiedAt,
    repairKind,
    reviewReasons,
  };
}

export function snapshotFromDbRow(row: Record<string, unknown>): ProvenanceRollbackSnapshot {
  return {
    id: String(row.id),
    selectedValue: row.selected_value,
    selectedSourceId: row.selected_source_id ? String(row.selected_source_id) : null,
    manuallyOverridden: Boolean(row.manually_overridden),
    alternatives: Array.isArray(row.alternatives) ? row.alternatives : [],
    updatedAt: String(row.updated_at),
    selectedAt: String(row.selected_at ?? row.updated_at),
    selectionReason: String(row.selection_reason),
    confidence: row.confidence === null || row.confidence === undefined ? null : Number(row.confidence),
    freshnessAt: row.freshness_at ? String(row.freshness_at) : null,
    originExternalId: row.origin_external_id ? String(row.origin_external_id) : null,
    mergeDecision: row.merge_decision ? String(row.merge_decision) : null,
    selectedTier: row.selected_tier ? String(row.selected_tier) : null,
  };
}

export function buildFreshnessOnlyAfterSnapshot(
  current: ProvenanceRollbackSnapshot,
  correctedFreshnessAt: string,
): ProvenanceRollbackSnapshot {
  return {
    ...current,
    freshnessAt: correctedFreshnessAt,
  };
}

export function buildLiveReverificationAfterSnapshot(input: {
  current: ProvenanceRollbackSnapshot;
  officialSourceId: string;
  confirmedEventValue: unknown;
  evidenceVerifiedAt: string;
  evidenceUrl: string;
  officialTier?: string | null;
}): ProvenanceRollbackSnapshot {
  const officialAlternative = {
    value: input.confirmedEventValue,
    sourceId: input.officialSourceId,
    confidence: 0.9,
    freshnessAt: input.evidenceVerifiedAt,
    originExternalId: input.evidenceUrl,
  };
  const ticketIoAlternatives = input.current.alternatives.filter(
    (entry) =>
      typeof entry === 'object'
      && entry !== null
      && String((entry as Record<string, unknown>).sourceId) === TICKET_IO_SOURCE_ID,
  );
  const otherAlternatives = input.current.alternatives.filter(
    (entry) =>
      typeof entry === 'object'
      && entry !== null
      && String((entry as Record<string, unknown>).sourceId) !== TICKET_IO_SOURCE_ID
      && String((entry as Record<string, unknown>).sourceId) !== input.officialSourceId,
  );

  let alternatives = deduplicateAlternatives(otherAlternatives, officialAlternative as Record<string, unknown>);
  for (const ticketAlt of ticketIoAlternatives) {
    alternatives = deduplicateAlternatives(
      alternatives,
      ticketAlt as Record<string, unknown>,
    );
  }

  return {
    ...input.current,
    selectedValue: input.confirmedEventValue,
    selectedSourceId: input.officialSourceId,
    selectionReason: 'phase48664d_live_official_reverification',
    freshnessAt: input.evidenceVerifiedAt,
    originExternalId: input.evidenceUrl,
    selectedAt: REPAIR_APPLY_SELECTED_AT_SENTINEL,
    updatedAt: REPAIR_APPLY_SELECTED_AT_SENTINEL,
    selectedTier: input.officialTier ?? 'official_website',
    alternatives,
  };
}

export function buildProvenancePlanEntry(input: {
  group: 'A' | 'B' | 'C';
  fieldPath: string;
  canonicalEventId: string;
  current: ProvenanceRollbackSnapshot;
  after: ProvenanceRollbackSnapshot;
  repairKind: ProvenanceRepairKind;
  evidenceUrl: string | null;
  evidenceVerifiedAt: string | null;
  repairReason: string;
}): ProvenancePlanEntry {
  return {
    group: input.group,
    fieldPath: input.fieldPath,
    provenanceId: input.current.id,
    repairKind: input.repairKind,
    rollbackSnapshot: input.current,
    afterSnapshot: input.after,
    evidenceUrl: input.evidenceUrl,
    evidenceVerifiedAt: input.evidenceVerifiedAt,
    repairReason: input.repairReason,
    rowFingerprint: fingerprintFromSnapshot(
      input.current.id,
      input.canonicalEventId,
      input.fieldPath,
      input.current,
    ),
  };
}

export const OFFICIAL_REVERIFICATION_FIELD_PATHS = [
  'title',
  'description',
  'startDate',
  'venueName',
  'venueCity',
  'venueAddress',
  'cityName',
  'countryCode',
  'organizerName',
  'websiteUrl',
  'ageRestriction',
] as const;
