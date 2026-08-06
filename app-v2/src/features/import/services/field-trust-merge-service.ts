import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import type { FieldProvenance } from '@/features/aggregation/merge/event-conflict';
import type { AdminEventRecord, SourceRecord } from '@/data/types/records';
import type { SourcePublishBehavior } from '@/features/import/domain/publish-behavior';
import {
  canTierWriteField,
  resolveSourcePriorityTier,
  type SourcePriorityTier,
} from '@/features/events/domain/field-ownership-policy';
import { hasMeaningfulEventValue } from '@/features/events/domain/event-field-value';
import {
  applyImportPublishFieldPatch,
  buildImportPublishFieldPatch,
  PUBLISH_FIELD_MAPPINGS,
  type ImportPublishFieldPatch,
} from '@/features/import/services/import-event-field-mapper';
import { applyExplicitEventGeographyFields } from '@/features/import/services/historical-data-repair';
import { evaluatePublishQualityGate } from '@/features/events/quality/publish-quality-gate';
import { isFieldSupportedBySource } from '@/features/sources/domain/source-reliability-service';

export type FieldMergeDecision =
  | 'accepted'
  | 'rejected_tier'
  | 'rejected_quality_gate'
  | 'rejected_blocked_origin'
  | 'skipped_locked'
  | 'skipped_empty'
  | 'unchanged';

export interface FieldMergeResult {
  field: string;
  decision: FieldMergeDecision;
  previousValue?: unknown;
  nextValue?: unknown;
  incomingTier: SourcePriorityTier;
  existingTier?: SourcePriorityTier;
  qualityGateReason?: string;
}

export interface AdminEventMergeResult {
  event: AdminEventRecord;
  decisions: FieldMergeResult[];
  isEnrichment: boolean;
}

const ENRICHMENT_FILL_PATCH_KEYS: Array<keyof ImportPublishFieldPatch> = [
  'description',
  'priceText',
  'ticketUrl',
  'imageUrl',
  'organizerName',
  'venueName',
  'ticketPhases',
  'ticketStatus',
];

const ADMIN_PATCH_KEY_MAP: Record<keyof ImportPublishFieldPatch, keyof AdminEventRecord> = {
  title: 'title',
  subtitle: 'subtitle',
  description: 'description',
  startDate: 'startDate',
  endDate: 'endDate',
  timezone: 'timezone',
  doorsOpenAt: 'doorsOpenAt',
  venueName: 'venueName',
  venueCity: 'venueCity',
  venueAddress: 'venueAddress',
  venuePostalCode: 'venuePostalCode',
  venueCountryCode: 'venueCountryCode',
  latitude: 'latitude',
  longitude: 'longitude',
  organizerName: 'organizerName',
  ticketUrl: 'ticketUrl',
  priceText: 'priceText',
  imageUrl: 'imageUrl',
  websiteUrl: 'websiteUrl',
  ageRestriction: 'ageRestriction',
  ticketStatus: 'ticketStatus',
  ticketPhases: 'ticketPhases',
  genreLabels: 'genreLabels',
  eventAttributes: 'eventAttributes',
  floorCount: 'floorCount',
  stageCount: 'stageCount',
  venueEnvironment: 'venueEnvironment',
  lastEntryAt: 'lastEntryAt',
  dressCode: 'dressCode',
  accessibilityNotes: 'accessibilityNotes',
  attributeReviewRequired: 'attributeReviewRequired',
};

function isEmptyValue(value: unknown): boolean {
  return !hasMeaningfulEventValue(value);
}

function resolveIncomingTier(source: SourceRecord): SourcePriorityTier {
  return resolveSourcePriorityTier({
    sourceType: source.sourceType,
    sourceRoles: source.sourceRoles,
    connectorKey: source.connectorKey,
  });
}

function extractConfidence(candidate: CanonicalImportEvent): number | undefined {
  const metadata = candidate.sourceMetadata as Record<string, unknown> | undefined;
  const raw = metadata?.extractionConfidence ?? metadata?.confidence;
  return typeof raw === 'number' ? raw : undefined;
}

function valuesEqual(left: unknown, right: unknown): boolean {
  if (left === right) {
    return true;
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    return JSON.stringify(left) === JSON.stringify(right);
  }
  return false;
}

export class FieldTrustMergeService {
  mergeAdminEvent(input: {
    existing: AdminEventRecord | null;
    candidate: CanonicalImportEvent;
    source: SourceRecord;
    behavior: SourcePublishBehavior;
    provenanceByField?: Map<string, FieldProvenance>;
    now?: string;
  }): AdminEventMergeResult {
    const now = input.now ?? new Date().toISOString();
    const incomingTier = resolveIncomingTier(input.source);
    const isEnrichment = input.behavior === 'enrichment' && Boolean(input.existing);
    const decisions: FieldMergeResult[] = [];

    if (!input.existing) {
      return {
        event: this.candidateToAdminEvent(input.candidate, input.source.id, now),
        decisions,
        isEnrichment: false,
      };
    }

    const fullPatch = buildImportPublishFieldPatch(input.candidate, {
      existing: input.existing,
      fillOnly: isEnrichment,
    });
    const allowedPatchKeys = new Set<keyof ImportPublishFieldPatch>(
      isEnrichment
        ? ENRICHMENT_FILL_PATCH_KEYS
        : PUBLISH_FIELD_MAPPINGS.map((entry) => entry.patchKey),
    );

    const appliedPatch: ImportPublishFieldPatch = {};
    const ownershipByPatchKey = new Map(
      PUBLISH_FIELD_MAPPINGS.map((entry) => [entry.patchKey, entry.ownershipField]),
    );

    const sourceMetadata = input.candidate.sourceMetadata as Record<string, unknown> | undefined;

    for (const patchKey of allowedPatchKeys) {
      const ownershipField = ownershipByPatchKey.get(patchKey) ?? patchKey;
      const adminKey = ADMIN_PATCH_KEY_MAP[patchKey];
      const incomingValue = fullPatch[patchKey];
      const existingValue = input.existing[adminKey];

      const provenance = input.provenanceByField?.get(ownershipField);
      if (provenance?.selectedSourceId === 'manual_override') {
        decisions.push({
          field: ownershipField,
          decision: 'skipped_locked',
          previousValue: existingValue,
          incomingTier,
        });
        continue;
      }

      if (isEmptyValue(incomingValue)) {
        if (!isFieldSupportedBySource(input.source, ownershipField)) {
          decisions.push({
            field: ownershipField,
            decision: 'skipped_empty',
            incomingTier,
            previousValue: existingValue,
          });
          continue;
        }
        decisions.push({ field: ownershipField, decision: 'skipped_empty', incomingTier });
        continue;
      }

      const existingTier =
        provenance?.selectedTier ??
        (provenance?.selectedSourceId && provenance.selectedSourceId !== 'manual_override'
          ? 'official_organizer'
          : resolveSourcePriorityTier({
              sourceType: 'website',
              sourceRoles: ['organizer'],
            }));

      if (valuesEqual(existingValue, incomingValue)) {
        decisions.push({
          field: ownershipField,
          decision: 'unchanged',
          previousValue: existingValue,
          incomingTier,
          existingTier,
        });
        continue;
      }

      if (!isEnrichment && !canTierWriteField(ownershipField, incomingTier, existingTier)) {
        decisions.push({
          field: ownershipField,
          decision: 'rejected_tier',
          previousValue: existingValue,
          nextValue: incomingValue,
          incomingTier,
          existingTier,
        });
        continue;
      }

      const qualityGate = evaluatePublishQualityGate({
        field: ownershipField,
        existingValue,
        incomingValue,
        incomingTier,
        existingTier,
        isEnrichment,
        sourceMetadata,
      });
      if (!qualityGate.allowed) {
        decisions.push({
          field: ownershipField,
          decision:
            qualityGate.reason === 'blocked_origin_clear'
              ? 'rejected_blocked_origin'
              : 'rejected_quality_gate',
          previousValue: existingValue,
          nextValue: incomingValue,
          incomingTier,
          existingTier,
          qualityGateReason: qualityGate.detail ?? qualityGate.reason,
        });
        continue;
      }

      appliedPatch[patchKey] = incomingValue as never;
      decisions.push({
        field: ownershipField,
        decision: 'accepted',
        previousValue: existingValue,
        nextValue: incomingValue,
        incomingTier,
        existingTier,
      });
    }

    const next = applyImportPublishFieldPatch(
      { ...input.existing, updatedAt: now },
      appliedPatch,
    );

    if (isEnrichment) {
      next.sourceId = input.existing.sourceId;
    } else {
      next.sourceId = input.source.id;
    }

    const geographyPatch = applyExplicitEventGeographyFields(input.existing, input.candidate);
    Object.assign(next, geographyPatch);

    return { event: next, decisions, isEnrichment };
  }

  candidateToAdminEvent(candidate: CanonicalImportEvent, sourceId: string, now: string): AdminEventRecord {
    const patch = buildImportPublishFieldPatch(candidate);
    return applyImportPublishFieldPatch(
      {
        id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        title: candidate.title,
        description: patch.description ?? '',
        startDate: candidate.startDate,
        sourceId,
        status: 'published',
        createdAt: now,
        updatedAt: now,
      },
      patch,
    );
  }

  static confidenceFromCandidate(candidate: CanonicalImportEvent): number | undefined {
    return extractConfidence(candidate);
  }
}

export const fieldTrustMergeService = new FieldTrustMergeService();
