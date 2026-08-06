/**
 * Phase 4.3.4 — Historical production audit (read-only).
 * Run: npx tsx scripts/operations/_sprint434-historical-production-audit.ts
 */
import './bootstrap-ops-supabase';

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { projectCanonicalEventFields } from '@/features/events/formatting/canonical-event-projection';
import { getSourceDisplayLabel } from '@/features/events/formatting/source-display-labels';
import { formatDisplayPriceText } from '@/features/aggregation/connectors/ticket-platform/format-ticket-price';
import { eventNeedsHistoricalRepair } from '@/features/import/services/historical-data-repair';
import { eventHasWrongBootshausExternalVenue } from '@/features/import/services/historical-data-repair';
import { isExternalLocationTitle } from '@/features/import/normalization/external-location-from-title';
import { extractArtistsFromEventTitle } from '@/features/aggregation/connectors/ticket-platform/ticket-io-title-artists';
import { eventRepository } from '@/data/repositories/registry';
import type { EventRow } from '@/data/mappers/event-mapper';
import type { EventArtistCountRow, ImportRecordResultingSnippet } from './ops-supabase-rows';
import { opsClient } from './ops-supabase-rows';
import { mapEventRowToAdminRecord } from '@/data/mappers/event-mapper';

const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../docs/real-data/_sprint434_historical_production_audit.json',
);

const SAMPLE_NEEDLES = [
  'PLAY! Open Air',
  'Sommerfest',
  'Elektroküche',
  'Musik die mich antreibt',
  'SHOCKONE',
  'WESTBAM',
  '122',
  'Mallorca',
  'Saltysis',
  'TECHNO DAMPFER',
  'Affenkäfig',
  'LEHMANN',
];

function isNaDescription(value: string | null | undefined): boolean {
  return !value?.trim() || /^n\/a$/i.test(value.trim());
}

async function main(): Promise<void> {
  const client = opsClient();

  const { data: events, error } = await client
    .from('events')
    .select('*')
    .eq('status', 'published');
  if (error) {
    throw new Error(error.message);
  }

  const rows = (events ?? []) as EventRow[];
  const eventIds = rows.map((row) => row.id);

  const { data: lineupRows } = await client
    .from('event_artists')
    .select('event_id')
    .in('event_id', eventIds.length > 0 ? eventIds : ['__none__']);

  const lineupByEvent = new Map<string, number>();
  for (const row of (lineupRows ?? []) as EventArtistCountRow[]) {
    lineupByEvent.set(row.event_id, (lineupByEvent.get(row.event_id) ?? 0) + 1);
  }

  const { data: importRecords } = await client
    .from('import_records')
    .select('id,resulting_event_id,normalized_payload,source_id')
    .in('resulting_event_id', eventIds.length > 0 ? eventIds : ['__none__']);

  const importByEvent = new Map<string, ImportRecordResultingSnippet>();
  for (const record of (importRecords ?? []) as ImportRecordResultingSnippet[]) {
    if (record.resulting_event_id) {
      importByEvent.set(record.resulting_event_id, record);
    }
  }

  const staleEvents = [];
  for (const row of rows) {
    const admin = mapEventRowToAdminRecord(row);
    const reasons: string[] = [];
    if (eventNeedsHistoricalRepair(admin)) {
      reasons.push('needs_historical_repair');
    }
    if (eventHasWrongBootshausExternalVenue(admin)) {
      reasons.push('wrong_bootshaus_external_venue');
    }
    const titleArtists = extractArtistsFromEventTitle(row.title ?? '') ?? [];
    const lineupCount = lineupByEvent.get(row.id) ?? 0;
    if (titleArtists.length > 0 && lineupCount === 0) {
      reasons.push('missing_title_lineup');
    }
    if (isNaDescription(row.description)) {
      const importRecord = importByEvent.get(row.id);
      const importDesc = (importRecord?.normalized_payload as { description?: string } | undefined)
        ?.description;
      if (importDesc?.trim() && !isNaDescription(importDesc)) {
        reasons.push('recoverable_description_in_import_record');
      } else {
        reasons.push('empty_description');
      }
    }
    const provider = getSourceDisplayLabel(row.source_id ?? '', row.ticket_url ?? undefined);
    if (provider === 'Externe Quelle' && row.ticket_url) {
      reasons.push('unknown_provider_label');
    }
    if (reasons.length > 0) {
      staleEvents.push({
        id: row.id,
        title: row.title,
        sourceId: row.source_id,
        reasons,
        venueId: row.venue_id,
        venueName: row.venue_name,
        venueCity: row.venue_city,
        lineupCount,
        titleArtists,
        externalLocationTitle: isExternalLocationTitle(row.title),
      });
    }
  }

  await eventRepository.refresh();
  const published = eventRepository.getPublishedEvents();

  const parityIssues = [];
  for (const event of published) {
    const projection = projectCanonicalEventFields({
      title: event.title,
      description: event.description,
      venue: event.venue,
      city: event.city,
      artists: event.artists,
      lineup: event.lineup,
      priceText: event.priceText,
      source: event.source,
      ticketUrl: event.ticketUrl,
    });
    const cardTicketLabel = projection.displayPriceText ?? event.priceText;
    const formattedPrice = formatDisplayPriceText(event.priceText) ?? event.priceText;
    if ((cardTicketLabel ?? '') !== (formattedPrice ?? '')) {
      parityIssues.push({
        id: event.id,
        field: 'price',
        card: cardTicketLabel,
        formatted: formattedPrice,
      });
    }
    if (projection.ticketProviderLabel === 'Externe Quelle' && event.ticketUrl) {
      parityIssues.push({ id: event.id, field: 'provider', value: projection.ticketProviderLabel });
    }
  }

  const samples = SAMPLE_NEEDLES.flatMap((needle) => {
    const matches = published.filter((event) =>
      event.title.toLowerCase().includes(needle.toLowerCase()),
    );
    return matches.slice(0, 2).map((event) => {
      const projection = projectCanonicalEventFields({
        title: event.title,
        description: event.description,
        venue: event.venue,
        city: event.city,
        artists: event.artists,
        lineup: event.lineup,
        priceText: event.priceText,
        source: event.source,
        ticketUrl: event.ticketUrl,
      });
      return {
        id: event.id,
        title: event.title,
        source: event.source,
        db: {
          description: event.description,
          priceText: event.priceText,
          venue: event.venue,
          city: event.city,
          artists: event.artists,
          lineup: event.lineup,
          ticketUrl: event.ticketUrl,
        },
        projection: {
          displayPriceText: projection.displayPriceText,
          ticketProviderLabel: projection.ticketProviderLabel,
          knownArtistNames: projection.knownArtistNames,
          lineupCompleteness: projection.lineupCompleteness,
          lineupSectionTitle: projection.lineupSectionTitle,
          locationLabelComma: projection.locationLabelComma,
          sanitizedDescription: projection.sanitizedDescription,
        },
      };
    });
  });

  const report = {
    generatedAt: new Date().toISOString(),
    totals: {
      publishedEvents: rows.length,
      staleEvents: staleEvents.length,
      wrongBootshausExternalVenue: staleEvents.filter((row) =>
        row.reasons.includes('wrong_bootshaus_external_venue'),
      ).length,
      missingTitleLineup: staleEvents.filter((row) => row.reasons.includes('missing_title_lineup')).length,
      recoverableDescriptions: staleEvents.filter((row) =>
        row.reasons.includes('recoverable_description_in_import_record'),
      ).length,
      unknownProviderLabels: staleEvents.filter((row) =>
        row.reasons.includes('unknown_provider_label'),
      ).length,
      totalLineupRows: lineupRows?.length ?? 0,
      parityIssues: parityIssues.length,
    },
    staleEvents,
    parityIssues: parityIssues.slice(0, 50),
    samples,
  };

  writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(`Wrote ${OUT}`);
  console.log(JSON.stringify(report.totals, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
