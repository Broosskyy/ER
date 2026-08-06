/**
 * Phase 4.5.3 — Read-only legacy vs field-trust comparison for published events.
 *
 * Usage:
 *   npx tsx scripts/operations/_sprint453-field-trust-comparison.ts
 */
import './bootstrap-ops-supabase';

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { adminSourceRepository } from '@/data/repositories/registry';
import type { ImportRecordResultingSnippet } from './ops-supabase-rows';
import { opsClient } from './ops-supabase-rows';
import { EventFieldProvenanceWriter } from '@/features/import/services/event-field-provenance-writer';
import { multiSourceRepositories } from '@/data/repositories/registry';
import {
  compareLegacyAndFieldTrustAdminEvent,
  summarizeFieldTrustComparisons,
  type FieldTrustEventComparison,
} from '@/features/import/services/field-trust-comparison-service';
import { mapEventRowToAdminRecord, type EventRow } from '@/data/mappers/event-mapper';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import type { RawSourceType } from '@/features/import/models/normalized-event-candidate';
import type { AdminEventRecord } from '@/data/types/records';

const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../docs/real-data/_sprint453_field_trust_comparison.json',
);

type ImportRow = ImportRecordResultingSnippet & { updated_at: string };

function payloadToCandidate(
  payload: Record<string, unknown>,
  sourceId: string,
  externalId: string,
): CanonicalImportEvent {
  return {
    title: String(payload.title ?? ''),
    startDate: String(payload.startDate ?? payload.start_date ?? ''),
    endDate: payload.endDate ? String(payload.endDate) : payload.end_date ? String(payload.end_date) : undefined,
    description: payload.description ? String(payload.description) : undefined,
    venueName: payload.venueName ? String(payload.venueName) : payload.venue_name ? String(payload.venue_name) : undefined,
    cityName: payload.cityName ? String(payload.cityName) : payload.city_name ? String(payload.city_name) : undefined,
    ticketUrl: payload.ticketUrl ? String(payload.ticketUrl) : payload.ticket_url ? String(payload.ticket_url) : undefined,
    priceText: payload.priceText ? String(payload.priceText) : payload.price_text ? String(payload.price_text) : undefined,
    imageUrl: payload.imageUrl ? String(payload.imageUrl) : payload.image_url ? String(payload.image_url) : undefined,
    organizerName: payload.organizerName
      ? String(payload.organizerName)
      : payload.organizer_name
        ? String(payload.organizer_name)
        : undefined,
    eventUrl: payload.eventUrl ? String(payload.eventUrl) : payload.event_url ? String(payload.event_url) : undefined,
    originalLink: payload.originalLink ? String(payload.originalLink) : undefined,
    sourceId,
    sourceName: sourceId,
    externalId,
    rawSourceType: 'unknown' as RawSourceType,
  };
}

async function main(): Promise<void> {
  const client = opsClient();
  const provenanceWriter = new EventFieldProvenanceWriter(multiSourceRepositories.fieldProvenance);

  const { data: eventRows, error } = await client
    .from('events')
    .select('*')
    .eq('status', 'published');

  if (error) {
    throw error;
  }

  const comparisons: Array<FieldTrustEventComparison | { eventId: string; eventTitle: string; skipped: boolean; reason: string }> = [];

  for (const row of (eventRows ?? []) as EventRow[]) {
    const event = mapEventRowToAdminRecord(row);
    const canonicalId = event.canonicalEventId ?? event.id;

    const { data: importRows } = await client
      .from('import_records')
      .select('source_id,external_id,normalized_payload,updated_at')
      .eq('resulting_event_id', event.id)
      .order('updated_at', { ascending: false });

    const rows = (importRows ?? []) as ImportRow[];
    const latest =
      rows.find((row) => row.source_id === event.sourceId) ??
      rows[0] ??
      null;
    if (!latest?.normalized_payload) {
      comparisons.push({
        eventId: event.id,
        eventTitle: event.title,
        skipped: true,
        reason: 'no_import_candidate',
      });
      continue;
    }

    const source = await adminSourceRepository.getById(latest.source_id);
    if (!source) {
      comparisons.push({
        eventId: event.id,
        eventTitle: event.title,
        skipped: true,
        reason: `missing_source:${latest.source_id}`,
      });
      continue;
    }

    const candidate = payloadToCandidate(
      latest.normalized_payload,
      latest.source_id,
      latest.external_id,
    );
    const provenanceByField = await provenanceWriter.loadProvenanceByField(canonicalId);

    comparisons.push(
      compareLegacyAndFieldTrustAdminEvent({
        existing: event,
        candidate,
        source,
        provenanceByField,
      }),
    );
  }

  const compared = comparisons.filter(
    (entry): entry is FieldTrustEventComparison => !('skipped' in entry),
  );
  const summary = summarizeFieldTrustComparisons(compared);
  const artifact = {
    generatedAt: new Date().toISOString(),
    summary,
    comparisons,
    recommendedFlagValue: summary.safeToEnable ? 'true' : 'false',
  };

  writeFileSync(OUT, JSON.stringify(artifact, null, 2));
  console.log(JSON.stringify(artifact, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
