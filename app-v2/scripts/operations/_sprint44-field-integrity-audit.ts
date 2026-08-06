/**
 * Phase 4.4 — Field integrity audit (read-only).
 * Run: npx tsx scripts/operations/_sprint44-field-integrity-audit.ts
 */
import './bootstrap-ops-supabase';

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { projectCanonicalEventFields } from '@/features/events/formatting/canonical-event-projection';
import { getSourceDisplayLabel } from '@/features/events/formatting/source-display-labels';
import type { EventRow } from '@/data/mappers/event-mapper';
import type {
  EventArtistCountRow,
  ImportRecordReviewSnippet,
  SourceIntegritySnippet,
} from './ops-supabase-rows';
import { opsClient } from './ops-supabase-rows';
import { mapEventRowToAdminRecord } from '@/data/mappers/event-mapper';
import { isMeaningfulEventText } from '@/features/events/domain/event-field-value';
import { isTicketIoPlaceholderDescription } from '@/features/aggregation/connectors/ticket-platform/ticket-io-field-quality';

const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../docs/real-data/_sprint44_field_integrity_audit.json',
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
  'TECHNO DAMPFER',
  'Affenkäfig',
  'LEHMANN',
  'Area51',
  'Area 51',
];

const ACTIVE_SOURCE_IDS = [
  'source-bootshaus-koeln',
  'source-bootshaus-ticket-io',
  'source-affenkaefig',
  'source-ticket-io-protontheclub',
  'source-ticket-io-lehmannclub',
  'source-ticket-io-area51events',
  'source-ticket-io-technodampfer',
  'source-ticket-io-hmg-concerts',
];

function summarizeText(value: string | null | undefined): {
  length: number;
  meaningful: boolean;
  placeholder: boolean;
  preview?: string;
} {
  const text = value ?? '';
  return {
    length: text.length,
    meaningful: isMeaningfulEventText(text),
    placeholder: isTicketIoPlaceholderDescription(text) || !text.trim(),
    preview: text.trim() ? text.trim().slice(0, 120) : undefined,
  };
}

async function main(): Promise<void> {
  const client = opsClient();

  const { data: sources } = await client
    .from('sources')
    .select('id,display_name,source_type,enabled,archived,source_config')
    .in('id', ACTIVE_SOURCE_IDS);

  const sourceRows = (sources ?? []) as SourceIntegritySnippet[];

  const { data: events } = await client.from('events').select('*').eq('status', 'published');
  const rows = (events ?? []) as EventRow[];

  const eventIds = rows.map((row) => row.id);
  const { data: importRecords } = await client
    .from('import_records')
    .select('id,source_id,resulting_event_id,normalized_payload,raw_payload,updated_at,external_id')
    .in('resulting_event_id', eventIds.length > 0 ? eventIds : ['__none__']);

  const importsByEvent = new Map<string, ImportRecordReviewSnippet[]>();
  for (const record of (importRecords ?? []) as ImportRecordReviewSnippet[]) {
    if (!record.resulting_event_id) continue;
    const list = importsByEvent.get(record.resulting_event_id) ?? [];
    list.push(record);
    importsByEvent.set(record.resulting_event_id, list);
  }

  const { data: lineupRows } = await client
    .from('event_artists')
    .select('event_id')
    .in('event_id', eventIds.length > 0 ? eventIds : ['__none__']);
  const lineupCountByEvent = new Map<string, number>();
  for (const row of (lineupRows ?? []) as EventArtistCountRow[]) {
    lineupCountByEvent.set(row.event_id, (lineupCountByEvent.get(row.event_id) ?? 0) + 1);
  }

  const published = rows.map((row) => {
    const admin = mapEventRowToAdminRecord(row);
    return {
      id: admin.id,
      title: admin.title,
      description: admin.description,
      venue: admin.venueName ?? '',
      city: admin.venueCity ?? '',
      artists: [] as string[],
      lineup: [] as string[],
      priceText: admin.priceText,
      source: admin.sourceId ?? '',
      ticketUrl: admin.ticketUrl,
      genres: [] as string[],
    };
  });

  const descriptionStats = {
    publishedEmpty: 0,
    publishedPlaceholder: 0,
    publishedMeaningful: 0,
    importRecoverable: 0,
    importPlaceholderOnly: 0,
    projectionHidden: 0,
  };

  const traces = [];

  for (const needle of SAMPLE_NEEDLES) {
    const matches = published.filter((event) =>
      event.title.toLowerCase().includes(needle.toLowerCase()),
    );
    for (const event of matches.slice(0, 2)) {
      const row = rows.find((entry) => entry.id === event.id);
      const admin = row ? mapEventRowToAdminRecord(row) : null;
      const imports = importsByEvent.get(event.id) ?? [];
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
        genres: event.genres,
      });

      const importDescriptions = imports.map((record) => {
        const normalized = (record.normalized_payload ?? {}) as Record<string, unknown>;
        const raw = (record.raw_payload ?? {}) as Record<string, unknown>;
        return {
          importRecordId: record.id,
          sourceId: record.source_id,
          externalId: record.external_id,
          updatedAt: record.updated_at,
          normalized: summarizeText(
            typeof normalized.description === 'string' ? normalized.description : undefined,
          ),
          raw: summarizeText(typeof raw.description === 'string' ? raw.description : undefined),
        };
      });

      const dbDescription = summarizeText(admin?.description);
      const projectionDescription = summarizeText(projection.sanitizedDescription);
      const frontendDescription = summarizeText(projection.sanitizedDescription);

      if (!dbDescription.meaningful) {
        if (dbDescription.placeholder) descriptionStats.publishedPlaceholder += 1;
        else descriptionStats.publishedEmpty += 1;
      } else {
        descriptionStats.publishedMeaningful += 1;
      }

      if (importDescriptions.some((entry) => entry.normalized.meaningful)) {
        descriptionStats.importRecoverable += 1;
      } else if (importDescriptions.length > 0) {
        descriptionStats.importPlaceholderOnly += 1;
      }

      if (dbDescription.meaningful && !projectionDescription.meaningful) {
        descriptionStats.projectionHidden += 1;
      }

      traces.push({
        id: event.id,
        title: event.title,
        sourceId: event.source,
        providerLabel: getSourceDisplayLabel(event.source, event.ticketUrl),
        lineupCount: lineupCountByEvent.get(event.id) ?? 0,
        trace: {
          canonical: {
            description: dbDescription,
            venue: admin?.venueName,
            city: admin?.venueCity,
            priceText: admin?.priceText,
            ticketUrl: admin?.ticketUrl,
            genres: row?.genre_id ?? null,
          },
          importRecords: importDescriptions,
          projection: {
            description: projectionDescription,
            knownArtistNames: projection.knownArtistNames,
            lineupCompleteness: projection.lineupCompleteness,
            lineupSectionTitle: projection.lineupSectionTitle,
            displayPriceText: projection.displayPriceText,
            ticketProviderLabel: projection.ticketProviderLabel,
          },
          frontend: {
            description: frontendDescription,
            knownArtistNames: projection.knownArtistNames,
            lineupCompleteness: projection.lineupCompleteness,
            venueLabel: projection.venueLabel,
            cityLabel: projection.cityLabel,
          },
        },
      });
    }
  }

  const sourceAudit = sourceRows.map((source) => {
    const config = (source.source_config ?? {}) as Record<string, unknown>;
    const website = config.website as Record<string, unknown> | undefined;
    const limits = website?.limits as Record<string, unknown> | undefined;
    const publishPolicy = config.publishPolicy as Record<string, unknown> | undefined;
    return {
      id: source.id,
      displayName: source.display_name,
      sourceType: source.source_type,
      enabled: source.enabled,
      archived: source.archived,
      maxDetailPages: limits?.maxDetailPages,
      publishBehavior: publishPolicy?.behavior,
      publishMode: publishPolicy?.mode,
    };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    rootCauseHypotheses: [
      {
        id: 'bootshaus_website_no_detail_fetch',
        evidence:
          'Production source-bootshaus-koeln has maxDetailPages: 0 and no descriptionSelector since Sprint 13 seed.',
        impact: 'Website import never supplies descriptions at connector level.',
      },
      {
        id: 'ticket_io_list_placeholder',
        evidence: 'Ticket.io list JSON-LD uses description N/A; detail fetch required for real copy.',
        impact: 'Enrichment without detail HTML cannot improve descriptions.',
      },
      {
        id: 'enrichment_placeholder_clear_removed_phase44',
        evidence: 'resolveFillOnlyText previously cleared N/A to empty string on enrichment republish.',
        impact: 'Historical repair runs could erase visible placeholder text without replacement.',
      },
    ],
    descriptionStats,
    sourceAudit,
    sampleTraces: traces,
    totals: {
      publishedEvents: rows.length,
      tracedSamples: traces.length,
      activeSourcesAudited: sourceAudit.length,
    },
  };

  writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(`Wrote ${OUT}`);
  console.log(JSON.stringify(report.totals, null, 2));
  console.log(JSON.stringify(report.descriptionStats, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
