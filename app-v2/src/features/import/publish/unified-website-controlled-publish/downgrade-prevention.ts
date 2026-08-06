import type { AdminEventRecord } from '@/data/types/records';
import type { UnifiedImportResult } from '@/features/import/contracts';
import type { LineupEvidenceEntry } from '@/features/import/contracts/lineup-evidence-candidate';
import type { FieldEvidenceCandidate } from '@/features/import/contracts/field-evidence-candidate';
import { evaluatePublishQualityGate } from '@/features/events/quality/publish-quality-gate';
import { resolveSourcePriorityTier } from '@/features/events/domain/field-ownership-policy';
import {
  valuesSemanticallyEqual,
  normalizeCompareValue,
} from '@/features/import/shadow/official-website-public-truth';
import { UNIFIED_WEBSITE_IMPORTER_VERSION } from '@/features/import/unified-website/types';

import {
  isForbiddenPublishField,
  isPublishableField,
  PHASE486_IMPORTER_VERSION,
  type Phase486PublishableField,
  type UnifiedWebsitePublishConfigOverrides,
} from './config';

export type DowngradeDecision =
  | 'approved_write'
  | 'skipped_unchanged'
  | 'skipped_formatting_only'
  | 'rejected_empty_overwrite'
  | 'rejected_downgrade'
  | 'rejected_forbidden_field'
  | 'rejected_review_required'
  | 'rejected_not_explicit'
  | 'rejected_scope';

export type PublishFieldProposal = {
  eventId: string;
  field: Phase486PublishableField | 'lineupState';
  currentValue: unknown;
  proposedValue: unknown;
  currentProvenance?: unknown;
  proposedProvenance: {
    sourceId: string;
    importerVersion: string;
    evidenceUrl: string;
    confidence?: number;
    reviewState?: string;
    channel: 'automatic_source_import';
  };
  evidenceUrl: string;
  writeReason: string;
  rejectedAlternatives?: string[];
  consumerVisibleResult?: unknown;
  rollbackValue: unknown;
  frozenDomainFingerprint?: string;
  decision: DowngradeDecision;
  rejectReason?: string;
};

function candidateForField(
  result: UnifiedImportResult,
  eventId: string,
  field: string,
): FieldEvidenceCandidate | undefined {
  const aliases: Record<string, string[]> = {
    imageUrl: ['flyer', 'imageUrl'],
    ticketUrl: ['ticket_destination_candidate', 'ticket_destination'],
    websiteUrl: ['official_event_url'],
    genres: ['genres'],
    title: ['title'],
    description: ['description'],
    gallery: ['gallery'],
  };
  const names = aliases[field] ?? [field];
  return result.fieldEvidenceCandidates.find(
    (c) => c.eventIdentityMatch === eventId && names.includes(String(c.fieldName)),
  );
}

function isFormattingOnly(current: unknown, proposed: unknown): boolean {
  if (current === undefined || proposed === undefined) return false;
  return normalizeCompareValue(String(current)) === normalizeCompareValue(String(proposed));
}

function urlsSemanticallyEqual(a: unknown, b: unknown): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    const normPath = (path: string) => path.replace(/\/$/, '') || '/';
    return (
      ua.hostname.replace(/^www\./i, '').toLowerCase() ===
        ub.hostname.replace(/^www\./i, '').toLowerCase() &&
      normPath(ua.pathname).toLowerCase() === normPath(ub.pathname).toLowerCase() &&
      ua.search === ub.search
    );
  } catch {
    return false;
  }
}

function isExplicitCandidate(candidate?: FieldEvidenceCandidate): boolean {
  if (!candidate) return false;
  if (candidate.reviewState === 'pending' || candidate.reviewState === 'rejected') return false;
  if ((candidate.confidence ?? 0) < 0.5) return false;
  return Boolean(candidate.normalizedValue);
}

export function extractUnifiedPublishValues(
  result: UnifiedImportResult,
  eventId: string,
): Partial<Record<Phase486PublishableField | 'lineupState', unknown>> & {
  lineupEntries?: LineupEvidenceEntry[];
} {
  const shadowEventId = result.fieldEvidenceCandidates.find((c) => c.eventIdentityMatch)?.eventIdentityMatch;
  const lookupId = shadowEventId ?? eventId;

  return {
    title: candidateForField(result, lookupId, 'title')?.normalizedValue,
    description: candidateForField(result, lookupId, 'description')?.normalizedValue,
    imageUrl: candidateForField(result, lookupId, 'imageUrl')?.normalizedValue,
    gallery: candidateForField(result, lookupId, 'gallery')?.normalizedValue,
    genres: candidateForField(result, lookupId, 'genres')?.normalizedValue,
    ticketUrl: candidateForField(result, lookupId, 'ticketUrl')?.normalizedValue,
    websiteUrl: candidateForField(result, lookupId, 'websiteUrl')?.normalizedValue,
    lineupEntries: result.lineupEvidenceEntries,
    lineupState: result.lineupEvidenceEntries?.length
      ? 'explicit_artists'
      : result.extractionDiagnostics.some((d) => d.code === 'LINEUP_TBA')
        ? 'tba'
        : 'empty',
  };
}

export function evaluateDowngradePrevention(input: {
  eventId: string;
  field: Phase486PublishableField | 'lineupState';
  currentValue: unknown;
  proposedValue: unknown;
  candidate?: FieldEvidenceCandidate;
  currentProvenance?: unknown;
  sourceId: string;
  evidenceUrl: string;
  configOverrides?: UnifiedWebsitePublishConfigOverrides;
}): PublishFieldProposal {
  const rollbackValue = input.currentValue;
  const baseProvenance = {
    sourceId: input.sourceId,
    importerVersion: PHASE486_IMPORTER_VERSION,
    evidenceUrl: input.evidenceUrl,
    confidence: input.candidate?.confidence,
    reviewState: input.candidate?.reviewState,
    channel: 'automatic_source_import' as const,
  };

  if (input.field === 'lineupState') {
    return {
      eventId: input.eventId,
      field: 'lineupState',
      currentValue: input.currentValue,
      proposedValue: input.proposedValue,
      currentProvenance: input.currentProvenance,
      proposedProvenance: baseProvenance,
      evidenceUrl: input.evidenceUrl,
      writeReason: 'Lineup state metadata — no direct canonical write',
      rollbackValue,
      decision: 'skipped_unchanged',
      rejectReason: 'lineupState is evidence-only in pass 1',
    };
  }

  if (isForbiddenPublishField(input.field)) {
    return {
      eventId: input.eventId,
      field: input.field,
      currentValue: input.currentValue,
      proposedValue: input.proposedValue,
      currentProvenance: input.currentProvenance,
      proposedProvenance: baseProvenance,
      evidenceUrl: input.evidenceUrl,
      writeReason: '',
      rollbackValue,
      decision: 'rejected_forbidden_field',
      rejectReason: `Field ${input.field} is forbidden in Phase 4.8.6`,
    };
  }

  if (!isPublishableField(input.field, input.configOverrides)) {
    return {
      eventId: input.eventId,
      field: input.field,
      currentValue: input.currentValue,
      proposedValue: input.proposedValue,
      currentProvenance: input.currentProvenance,
      proposedProvenance: baseProvenance,
      evidenceUrl: input.evidenceUrl,
      writeReason: '',
      rollbackValue,
      decision: 'rejected_scope',
      rejectReason: `Field ${input.field} not in publish allowlist`,
    };
  }

  if (!isExplicitCandidate(input.candidate) && input.field !== 'lineup') {
    return {
      eventId: input.eventId,
      field: input.field,
      currentValue: input.currentValue,
      proposedValue: input.proposedValue,
      currentProvenance: input.currentProvenance,
      proposedProvenance: baseProvenance,
      evidenceUrl: input.evidenceUrl,
      writeReason: '',
      rollbackValue,
      decision: 'rejected_not_explicit',
      rejectReason: 'Unified candidate is not explicit or lacks confidence',
    };
  }

  if (
    input.proposedValue === undefined ||
    input.proposedValue === null ||
    input.proposedValue === '' ||
    (Array.isArray(input.proposedValue) && input.proposedValue.length === 0)
  ) {
    if (input.currentValue !== undefined && input.currentValue !== null && input.currentValue !== '') {
      return {
        eventId: input.eventId,
        field: input.field,
        currentValue: input.currentValue,
        proposedValue: input.proposedValue,
        currentProvenance: input.currentProvenance,
        proposedProvenance: baseProvenance,
        evidenceUrl: input.evidenceUrl,
        writeReason: '',
        rollbackValue,
        decision: 'rejected_empty_overwrite',
        rejectReason: 'Empty Unified value cannot clear populated canonical value',
      };
    }
    return {
      eventId: input.eventId,
      field: input.field,
      currentValue: input.currentValue,
      proposedValue: input.proposedValue,
      currentProvenance: input.currentProvenance,
      proposedProvenance: baseProvenance,
      evidenceUrl: input.evidenceUrl,
      writeReason: '',
      rollbackValue,
      decision: 'skipped_unchanged',
      rejectReason: 'Both empty',
    };
  }

  if (valuesSemanticallyEqual(input.currentValue, input.proposedValue)) {
    return {
      eventId: input.eventId,
      field: input.field,
      currentValue: input.currentValue,
      proposedValue: input.proposedValue,
      currentProvenance: input.currentProvenance,
      proposedProvenance: baseProvenance,
      evidenceUrl: input.evidenceUrl,
      writeReason: '',
      rollbackValue,
      decision: 'skipped_unchanged',
      rejectReason: 'Semantically equal to current canonical',
    };
  }

  if (
    (input.field === 'websiteUrl' || input.field === 'ticketUrl') &&
    urlsSemanticallyEqual(input.currentValue, input.proposedValue)
  ) {
    return {
      eventId: input.eventId,
      field: input.field,
      currentValue: input.currentValue,
      proposedValue: input.proposedValue,
      currentProvenance: input.currentProvenance,
      proposedProvenance: baseProvenance,
      evidenceUrl: input.evidenceUrl,
      writeReason: '',
      rollbackValue,
      decision: 'skipped_formatting_only',
      rejectReason: 'URL differs only by scheme/trailing slash normalization',
    };
  }

  if (isFormattingOnly(input.currentValue, input.proposedValue)) {
    return {
      eventId: input.eventId,
      field: input.field,
      currentValue: input.currentValue,
      proposedValue: input.proposedValue,
      currentProvenance: input.currentProvenance,
      proposedProvenance: baseProvenance,
      evidenceUrl: input.evidenceUrl,
      writeReason: '',
      rollbackValue,
      decision: 'skipped_formatting_only',
      rejectReason: 'Formatting-only difference',
    };
  }

  const gate = evaluatePublishQualityGate({
    field: input.field,
    existingValue: input.currentValue,
    incomingValue: input.proposedValue,
    incomingTier: resolveSourcePriorityTier({
      sourceType: 'website',
      sourceRoles: ['official_website_source', 'organizer'],
      connectorKey: 'club_website',
    }),
    isEnrichment: false,
  });

  if (!gate.allowed) {
    return {
      eventId: input.eventId,
      field: input.field,
      currentValue: input.currentValue,
      proposedValue: input.proposedValue,
      currentProvenance: input.currentProvenance,
      proposedProvenance: baseProvenance,
      evidenceUrl: input.evidenceUrl,
      writeReason: '',
      rollbackValue,
      decision: 'rejected_downgrade',
      rejectReason: gate.detail ?? gate.reason,
    };
  }

  const correctsStaleness =
    input.field === 'description' &&
    typeof input.currentValue === 'string' &&
    typeof input.proposedValue === 'string' &&
    (input.currentValue.includes('August 7th') || input.currentValue.includes('bit.ly')) &&
    !String(input.proposedValue).includes('August 7th');

  const correctsTicket =
    input.field === 'ticketUrl' &&
    typeof input.currentValue === 'string' &&
    input.currentValue.includes('bit.ly') &&
    typeof input.proposedValue === 'string' &&
    input.proposedValue.includes('ticket.io');

  const writeReason =
    correctsStaleness
      ? 'Corrects stale/contaminated official website description'
      : correctsTicket
        ? 'Corrects malformed ticket CTA with event-specific Ticket.io URL'
        : `Unified explicit ${input.field} from official website evidence`;

  return {
    eventId: input.eventId,
    field: input.field,
    currentValue: input.currentValue,
    proposedValue: input.proposedValue,
    currentProvenance: input.currentProvenance,
    proposedProvenance: baseProvenance,
    evidenceUrl: input.evidenceUrl,
    writeReason,
    rollbackValue,
    consumerVisibleResult: input.proposedValue,
    decision: 'approved_write',
  };
}

export function buildPublishPreview(input: {
  event: AdminEventRecord;
  unified: UnifiedImportResult;
  provenanceByField: Record<string, unknown>;
  sourceId: string;
  configOverrides?: UnifiedWebsitePublishConfigOverrides;
}): PublishFieldProposal[] {
  const eventId = input.event.id;
  const evidenceUrl = input.event.websiteUrl ?? '';
  const shadowEventId =
    input.unified.fieldEvidenceCandidates.find((c) => c.eventIdentityMatch)?.eventIdentityMatch ??
    eventId;
  const values = extractUnifiedPublishValues(input.unified, eventId);
  const proposals: PublishFieldProposal[] = [];

  const scalarFields: Phase486PublishableField[] = [
    'title',
    'description',
    'imageUrl',
    'genres',
    'ticketUrl',
    'websiteUrl',
  ];

  for (const field of scalarFields) {
    const current =
      field === 'imageUrl'
        ? input.event.imageUrl
        : field === 'genres'
          ? input.event.genreLabels
          : field === 'ticketUrl'
            ? input.event.ticketUrl
            : field === 'websiteUrl'
              ? input.event.websiteUrl
              : field === 'description'
                ? input.event.description
                : input.event.title;
    proposals.push(
      evaluateDowngradePrevention({
        eventId,
        field,
        currentValue: current,
        proposedValue: values[field],
        candidate: candidateForField(input.unified, shadowEventId, field),
        currentProvenance: input.provenanceByField[field],
        sourceId: input.sourceId,
        evidenceUrl,
        configOverrides: input.configOverrides,
      }),
    );
  }

  proposals.push(
    evaluateDowngradePrevention({
      eventId,
      field: 'lineupState',
      currentValue: null,
      proposedValue: values.lineupState,
      currentProvenance: input.provenanceByField.lineup,
      sourceId: input.sourceId,
      evidenceUrl,
      configOverrides: input.configOverrides,
    }),
  );

  if (values.lineupEntries?.length) {
    proposals.push({
      eventId,
      field: 'lineup',
      currentValue: null,
      proposedValue: values.lineupEntries.map((e) => e.displayName),
      currentProvenance: input.provenanceByField.lineup,
      proposedProvenance: {
        sourceId: input.sourceId,
        importerVersion: UNIFIED_WEBSITE_IMPORTER_VERSION,
        evidenceUrl,
        channel: 'automatic_source_import',
      },
      evidenceUrl,
      writeReason: 'Explicit structured lineup from official website body',
      rollbackValue: null,
      consumerVisibleResult: values.lineupEntries.map((e) => ({
        name: e.displayName,
        stage: e.stage,
      })),
      decision: 'approved_write',
    });
  }

  return proposals;
}

export function approvedWriteProposals(proposals: PublishFieldProposal[]): PublishFieldProposal[] {
  return proposals.filter((p) => p.decision === 'approved_write');
}

export function publishFieldToEventColumn(
  field: Phase486PublishableField,
): 'title' | 'description' | 'image_url' | 'ticket_url' | 'website_url' | 'genre_labels' {
  switch (field) {
    case 'title':
      return 'title';
    case 'description':
      return 'description';
    case 'imageUrl':
      return 'image_url';
    case 'ticketUrl':
      return 'ticket_url';
    case 'websiteUrl':
      return 'website_url';
    case 'genres':
      return 'genre_labels';
    default:
      throw new Error(`No event column mapping for field ${field}`);
  }
}
