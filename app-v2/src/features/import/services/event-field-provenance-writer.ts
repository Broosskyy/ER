import type { AdminEventRecord, SourceRecord } from '@/data/types/records';
import type { FieldProvenance } from '@/features/aggregation/merge/event-conflict';
import type { FieldProvenanceRepository } from '@/features/aggregation/repositories/multi-source-repositories';
import type { FieldMergeResult } from '@/features/import/services/field-trust-merge-service';
import { resolveSourcePriorityTier } from '@/features/events/domain/field-ownership-policy';

/** Canonical event fields tracked for provenance and field-trust merge. */
export const PUBLISH_TRACKED_FIELDS = [
  'title',
  'subtitle',
  'description',
  'startDate',
  'endDate',
  'timezone',
  'doorsOpenAt',
  'venueName',
  'venueCity',
  'venueAddress',
  'cityName',
  'countryCode',
  'coordinates',
  'organizerName',
  'ticketUrl',
  'priceText',
  'ticketStatus',
  'imageUrl',
  'websiteUrl',
  'ageRestriction',
  'genres',
] as const;

export type PublishTrackedField = (typeof PUBLISH_TRACKED_FIELDS)[number];

const ADMIN_FIELD_MAP: Record<PublishTrackedField, keyof AdminEventRecord> = {
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
  cityName: 'venueCity',
  countryCode: 'venueCountryCode',
  coordinates: 'latitude',
  organizerName: 'organizerName',
  ticketUrl: 'ticketUrl',
  priceText: 'priceText',
  ticketStatus: 'ticketStatus',
  imageUrl: 'imageUrl',
  websiteUrl: 'websiteUrl',
  ageRestriction: 'ageRestriction',
  genres: 'genreLabels',
};

function resolvePublishTrackedValue(event: AdminEventRecord, field: PublishTrackedField): unknown {
  if (field === 'coordinates') {
    if (event.latitude !== undefined || event.longitude !== undefined) {
      return { latitude: event.latitude, longitude: event.longitude };
    }
    return undefined;
  }
  const adminKey = ADMIN_FIELD_MAP[field];
  return event[adminKey];
}

export class EventFieldProvenanceWriter {
  constructor(private readonly fieldProvenance: FieldProvenanceRepository) {}

  async writeFromPublish(
    canonicalEventId: string,
    source: SourceRecord,
    event: AdminEventRecord,
    options: {
      publishedAt?: string;
      originExternalId?: string;
      confidence?: number;
      mergeDecisions?: FieldMergeResult[];
    } = {},
  ): Promise<void> {
    const publishedAt = options.publishedAt ?? new Date().toISOString();
    const incomingTier = resolveSourcePriorityTier({
      sourceType: source.sourceType,
      sourceRoles: source.sourceRoles,
      connectorKey: source.connectorKey,
    });
    const decisionByField = new Map(
      (options.mergeDecisions ?? []).map((entry) => [entry.field, entry]),
    );

    for (const field of PUBLISH_TRACKED_FIELDS) {
      const value = resolvePublishTrackedValue(event, field);
      if (value === undefined || value === null || value === '') {
        continue;
      }

      const existing = await this.fieldProvenance.findByFieldPath(canonicalEventId, field);
      if (existing?.selectedSourceId === 'manual_override') {
        continue;
      }

      const mergeDecision = decisionByField.get(field);
      if (mergeDecision?.decision === 'rejected_tier' || mergeDecision?.decision === 'skipped_locked') {
        continue;
      }

      const alternatives = this.buildAlternatives(existing, source.id, value, publishedAt, {
        confidence: options.confidence,
        originExternalId: options.originExternalId,
        mergeDecision: mergeDecision?.decision,
      });

      await this.fieldProvenance.upsertFieldSelection({
        id: `provenance-${canonicalEventId}-${field}`,
        canonicalEventId,
        fieldPath: field,
        value,
        selectedSourceId: source.id,
        selectionReason: mergeDecision ? `import_publish_${mergeDecision.decision}` : 'import_publish',
        alternatives,
        lastChangedAt: publishedAt,
        confidence: options.confidence,
        freshnessAt: publishedAt,
        originExternalId: options.originExternalId,
        mergeDecision: mergeDecision?.decision,
        selectedTier: incomingTier,
      });
    }
  }

  private buildAlternatives(
    existing: FieldProvenance | null,
    sourceId: string,
    value: unknown,
    freshnessAt: string,
    meta: { confidence?: number; originExternalId?: string; mergeDecision?: string },
  ): FieldProvenance['alternatives'] {
    const prior = existing?.alternatives ?? [];
    const withoutDuplicate = prior.filter((entry) => entry.sourceId !== sourceId);
    return [
      ...withoutDuplicate,
      {
        sourceId,
        value,
        confidence: meta.confidence,
        freshnessAt,
        originExternalId: meta.originExternalId,
        mergeDecision: meta.mergeDecision,
      },
    ];
  }

  async loadProvenanceByField(canonicalEventId: string): Promise<Map<string, FieldProvenance>> {
    const map = new Map<string, FieldProvenance>();
    for (const field of PUBLISH_TRACKED_FIELDS) {
      const row = await this.fieldProvenance.findByFieldPath(canonicalEventId, field);
      if (row) {
        map.set(field, row);
      }
    }
    return map;
  }

  async writePhase486UnifiedWebsitePublish(input: {
    canonicalEventId: string;
    fieldPath: PublishTrackedField;
    value: unknown;
    source: SourceRecord;
    publicEvidenceUrl: string;
    capturedEvidenceValue: unknown;
    previousValue?: unknown;
    previousSourceId?: string;
    importerVersion: string;
    writeReason: string;
    observedAt?: string;
  }): Promise<void> {
    const observedAt = input.observedAt ?? new Date().toISOString();
    const existing = await this.fieldProvenance.findByFieldPath(input.canonicalEventId, input.fieldPath);
    const alternatives = [...(existing?.alternatives ?? [])];
    if (input.previousValue !== undefined && input.previousSourceId) {
      const withoutDup = alternatives.filter((entry) => entry.sourceId !== input.previousSourceId);
      alternatives.length = 0;
      alternatives.push(
        ...withoutDup,
        {
          sourceId: input.previousSourceId,
          value: input.previousValue,
          freshnessAt: observedAt,
          originExternalId: input.publicEvidenceUrl,
        },
      );
    }
    alternatives.push({
      sourceId: input.source.id,
      value: input.capturedEvidenceValue,
      confidence: 0.9,
      freshnessAt: observedAt,
      originExternalId: input.publicEvidenceUrl,
      mergeDecision: 'accepted',
    });

    await this.fieldProvenance.upsertFieldSelection({
      id: `provenance-${input.canonicalEventId}-${input.fieldPath}`,
      canonicalEventId: input.canonicalEventId,
      fieldPath: input.fieldPath,
      value: input.value,
      selectedSourceId: input.source.id,
      selectionReason: `phase486_unified_website_controlled_publish:${input.writeReason}:importer=${input.importerVersion}`,
      alternatives,
      lastChangedAt: observedAt,
      confidence: 0.9,
      freshnessAt: observedAt,
      originExternalId: input.publicEvidenceUrl,
      mergeDecision: 'accepted',
      selectedTier: resolveSourcePriorityTier({
        sourceType: input.source.sourceType,
        sourceRoles: input.source.sourceRoles,
        connectorKey: input.source.connectorKey,
      }),
    });
  }

  async writePhase4822ApprovedCorrection(input: {
    canonicalEventId: string;
    fieldPath: PublishTrackedField;
    value: unknown;
    source: SourceRecord;
    publicEvidenceUrl: string;
    capturedEvidenceValue: unknown;
    previousValue?: unknown;
    previousSourceId?: string;
    importerVersion: string;
    observedAt?: string;
  }): Promise<void> {
    const observedAt = input.observedAt ?? new Date().toISOString();
    const existing = await this.fieldProvenance.findByFieldPath(input.canonicalEventId, input.fieldPath);
    const alternatives = [...(existing?.alternatives ?? [])];
    if (input.previousValue !== undefined && input.previousSourceId) {
      const withoutDup = alternatives.filter((entry) => entry.sourceId !== input.previousSourceId);
      alternatives.length = 0;
      alternatives.push(
        ...withoutDup,
        {
          sourceId: input.previousSourceId,
          value: input.previousValue,
          freshnessAt: observedAt,
          originExternalId: input.publicEvidenceUrl,
        },
      );
    }
    alternatives.push({
      sourceId: input.source.id,
      value: input.capturedEvidenceValue,
      confidence: 0.9,
      freshnessAt: observedAt,
      originExternalId: input.publicEvidenceUrl,
      mergeDecision: 'accepted',
    });

    await this.fieldProvenance.upsertFieldSelection({
      id: `provenance-${input.canonicalEventId}-${input.fieldPath}`,
      canonicalEventId: input.canonicalEventId,
      fieldPath: input.fieldPath,
      value: input.value,
      selectedSourceId: input.source.id,
      selectionReason: `phase4822_approved_official_website_correction:importer=${input.importerVersion}`,
      alternatives,
      lastChangedAt: observedAt,
      confidence: 0.9,
      freshnessAt: observedAt,
      originExternalId: input.publicEvidenceUrl,
      mergeDecision: 'accepted',
      selectedTier: resolveSourcePriorityTier({
        sourceType: input.source.sourceType,
        sourceRoles: input.source.sourceRoles,
        connectorKey: input.source.connectorKey,
      }),
    });
  }

  async writeTicketUrlCorrection(input: {
    canonicalEventId: string;
    ticketUrl: string;
    source: SourceRecord;
    originExternalId: string;
    previousValue?: string;
    previousSourceId?: string;
    publishedAt?: string;
  }): Promise<void> {
    const publishedAt = input.publishedAt ?? new Date().toISOString();
    const existing = await this.fieldProvenance.findByFieldPath(input.canonicalEventId, 'ticketUrl');
    const alternatives = [...(existing?.alternatives ?? [])];
    if (input.previousValue && input.previousSourceId) {
      const withoutDup = alternatives.filter((entry) => entry.sourceId !== input.previousSourceId);
      alternatives.length = 0;
      alternatives.push(
        ...withoutDup,
        {
          sourceId: input.previousSourceId,
          value: input.previousValue,
          freshnessAt: publishedAt,
        },
      );
    }

    await this.fieldProvenance.upsertFieldSelection({
      id: `provenance-${input.canonicalEventId}-ticketUrl`,
      canonicalEventId: input.canonicalEventId,
      fieldPath: 'ticketUrl',
      value: input.ticketUrl,
      selectedSourceId: input.source.id,
      selectionReason: 'correction_accepted_higher_quality_url',
      alternatives,
      lastChangedAt: publishedAt,
      originExternalId: input.originExternalId,
      mergeDecision: 'accepted',
      selectedTier: resolveSourcePriorityTier({
        sourceType: input.source.sourceType,
        sourceRoles: input.source.sourceRoles,
        connectorKey: input.source.connectorKey,
      }),
    });
  }

  async writeFromPublishBySourceId(
    canonicalEventId: string,
    sourceId: string,
    event: AdminEventRecord,
    publishedAt = new Date().toISOString(),
  ): Promise<void> {
    const stubSource: SourceRecord = {
      id: sourceId,
      slug: sourceId,
      stableKey: sourceId,
      displayName: sourceId,
      sourceType: 'website',
      parserType: 'unknown',
      acquisitionStrategy: 'manual',
      status: 'active',
      enabled: true,
      archived: false,
      reviewRequired: false,
      priority: 50,
      trustScore: 50,
      requiresAuthentication: false,
      createdAt: publishedAt,
      updatedAt: publishedAt,
    };
    await this.writeFromPublish(canonicalEventId, stubSource, event, { publishedAt });
  }

  /** Contributor moderation publish — locks approved values against lower-trust imports. */
  async writeFromModerationPublish(
    canonicalEventId: string,
    event: AdminEventRecord,
    options: {
      moderatorId: string;
      contributorId?: string;
      publishedAt?: string;
    },
  ): Promise<void> {
    const publishedAt = options.publishedAt ?? new Date().toISOString();
    const contributorId = options.contributorId ?? event.createdBy ?? 'contributor';
    const contributorSourceId = `contributor:${contributorId}`;

    for (const field of PUBLISH_TRACKED_FIELDS) {
      const value = resolvePublishTrackedValue(event, field);
      if (value === undefined || value === null || value === '') {
        continue;
      }

      const existing = await this.fieldProvenance.findByFieldPath(canonicalEventId, field);
      const alternatives = this.buildAlternatives(existing, contributorSourceId, value, publishedAt, {
        confidence: 1,
        originExternalId: event.id,
        mergeDecision: 'accepted',
      });

      await this.fieldProvenance.upsertFieldSelection({
        id: `provenance-${canonicalEventId}-${field}`,
        canonicalEventId,
        fieldPath: field,
        value,
        selectedSourceId: 'manual_override',
        selectionReason: `moderation_publish_approved:moderator=${options.moderatorId}:contributor=${contributorId}`,
        alternatives,
        lastChangedAt: publishedAt,
        confidence: 1,
        freshnessAt: publishedAt,
        originExternalId: event.id,
        mergeDecision: 'accepted',
        selectedTier: 'community',
      });
    }
  }
}
