/**
 * Phase 4.6.3 — Import coverage audit (read-only).
 * Run: npx tsx scripts/operations/_phase463-import-coverage-audit.ts
 */
import './bootstrap-ops-supabase';

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapEventRowToAdminRecord } from '@/data/mappers/event-mapper';
import type { EventRow } from '@/data/mappers/event-mapper';
import { opsClient } from './ops-supabase-rows';

const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../docs/real-data/_phase463_import_coverage_audit.json',
);

const FIELDS = [
  'title',
  'description',
  'lineup',
  'genres',
  'coordinates',
  'venue',
  'organizer',
  'ticketUrl',
  'images',
  'availability',
  'price',
] as const;

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function coverageFromPayload(payload: Record<string, unknown> | null | undefined) {
  const meta = (payload?.sourceMetadata ?? {}) as Record<string, unknown>;
  const lineupEntries = meta.lineupEntries;
  const artistNames = payload?.artistNames;
  return {
    title: hasText(payload?.title),
    description: hasText(payload?.description),
    lineup:
      (Array.isArray(lineupEntries) && lineupEntries.length > 0) ||
      (Array.isArray(artistNames) && artistNames.length > 0),
    genres: Array.isArray(payload?.genreNames) && (payload.genreNames as unknown[]).length > 0,
    coordinates: payload?.latitude != null && payload?.longitude != null,
    venue: hasText(payload?.venueName) || hasText(payload?.venueAddress),
    organizer: hasText(payload?.organizerName),
    ticketUrl: hasText(payload?.ticketUrl),
    images: hasText(payload?.imageUrl),
    availability: meta.soldOut === true || hasText(payload?.priceText as string),
    price: hasText(payload?.priceText),
  };
}

function coverageFromEvent(event: ReturnType<typeof mapEventRowToAdminRecord>) {
  return {
    title: hasText(event.title),
    description: hasText(event.description) && event.description.length > 20,
    lineup: (event.lineup?.length ?? 0) > 0 || (event.artists?.length ?? 0) > 0,
    genres: (event.genreLabels?.length ?? 0) > 0,
    coordinates: event.latitude != null && event.longitude != null,
    venue: hasText(event.venueAddress) || hasText(event.venueName),
    organizer: hasText(event.organizerName),
    ticketUrl: hasText(event.ticketUrl),
    images: hasText(event.imageUrl),
    availability: event.ticketStatus != null,
    price: hasText(event.priceText),
  };
}

async function main(): Promise<void> {
  const client = opsClient();
  const { data: sources, error: sourceError } = await client
    .from('sources')
    .select('id,display_name,source_type,enabled,adapter_key,publish_mode')
    .eq('enabled', true);

  if (sourceError) {
    throw new Error(sourceError.message);
  }

  const report: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    sources: [] as unknown[],
  };

  for (const source of sources ?? []) {
    const { data: records } = await client
      .from('import_records')
      .select('id,normalized_payload,resulting_event_id,external_id')
      .eq('source_id', source.id)
      .order('updated_at', { ascending: false })
      .limit(25);

    const payloadCoverage = { counts: Object.fromEntries(FIELDS.map((f) => [f, 0])) as Record<string, number> };
    let canonicalCoverage = { counts: Object.fromEntries(FIELDS.map((f) => [f, 0])) as Record<string, number> };
    let canonicalSamples = 0;

    for (const record of records ?? []) {
      const payload = record.normalized_payload as Record<string, unknown> | null;
      const cov = coverageFromPayload(payload);
      for (const field of FIELDS) {
        if (cov[field]) {
          payloadCoverage.counts[field] += 1;
        }
      }

      if (record.resulting_event_id) {
        const { data: eventRow } = await client
          .from('events')
          .select('*')
          .eq('id', record.resulting_event_id)
          .maybeSingle();
        if (eventRow) {
          const event = mapEventRowToAdminRecord(eventRow as EventRow);
          const eventCov = coverageFromEvent(event);
          canonicalSamples += 1;
          for (const field of FIELDS) {
            if (eventCov[field]) {
              canonicalCoverage.counts[field] += 1;
            }
          }
        }
      }
    }

    const recordCount = records?.length ?? 0;
    (report.sources as unknown[]).push({
      sourceId: source.id,
      displayName: source.display_name,
      sourceType: source.source_type,
      publishMode: source.publish_mode,
      adapterKey: source.adapter_key,
      importRecordsSampled: recordCount,
      canonicalEventsSampled: canonicalSamples,
      importPayloadCoveragePct: Object.fromEntries(
        FIELDS.map((field) => [
          field,
          recordCount > 0 ? Math.round((payloadCoverage.counts[field] / recordCount) * 100) : 0,
        ]),
      ),
      canonicalCoveragePct: Object.fromEntries(
        FIELDS.map((field) => [
          field,
          canonicalSamples > 0
            ? Math.round((canonicalCoverage.counts[field] / canonicalSamples) * 100)
            : 0,
        ]),
      ),
    });
  }

  writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(`Coverage audit written: ${OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
