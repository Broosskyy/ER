import type { AdminEventRecord } from '@/data/types/records';
import type { FieldProvenanceRepository } from '@/features/aggregation/repositories/multi-source-repositories';

const PUBLISH_TRACKED_FIELDS = [
  'description',
  'ticketUrl',
  'imageUrl',
  'venueName',
  'organizerName',
] as const;

type PublishTrackedField = (typeof PUBLISH_TRACKED_FIELDS)[number];

export class EventFieldProvenanceWriter {
  constructor(private readonly fieldProvenance: FieldProvenanceRepository) {}

  async writeFromPublish(
    canonicalEventId: string,
    sourceId: string,
    event: AdminEventRecord,
    publishedAt = new Date().toISOString(),
  ): Promise<void> {
    for (const field of PUBLISH_TRACKED_FIELDS) {
      const value = event[field as PublishTrackedField];
      if (value === undefined || value === null || value === '') {
        continue;
      }

      const existing = await this.fieldProvenance.findByFieldPath(canonicalEventId, field);
      if (existing?.selectedSourceId === 'manual_override') {
        continue;
      }

      await this.fieldProvenance.upsertFieldSelection({
        id: `provenance-${canonicalEventId}-${field}`,
        canonicalEventId,
        fieldPath: field,
        value,
        selectedSourceId: sourceId,
        selectionReason: 'import_publish',
        alternatives: existing?.alternatives ?? [],
        lastChangedAt: publishedAt,
      });
    }
  }
}
