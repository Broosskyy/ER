/**
 * Phase 4.5 — Detail extraction audit (read-only).
 * Run: npx tsx scripts/operations/_sprint45-detail-extraction-audit.ts
 */
import './bootstrap-ops-supabase';

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildConnectorCapabilityProfile,
  calculateEventDataCompleteness,
} from '@/features/aggregation/connectors/framework/detail-extraction';
import { projectCanonicalEventFields } from '@/features/events/formatting/canonical-event-projection';
import type { EventRow } from '@/data/mappers/event-mapper';
import { mapEventRowToAdminRecord } from '@/data/mappers/event-mapper';
import type { SourceRecord } from '@/data/types/records';
import type { ParserType, SourceType } from '@/features/sources/domain/source-types';
import type { SourceIntegritySnippet } from './ops-supabase-rows';
import { opsClient } from './ops-supabase-rows';
import type { WebsiteConnectorConfig } from '@/features/aggregation/connectors/website/config';
import type { TicketPlatformConnectorConfig } from '@/features/aggregation/connectors/ticket-platform/types';

const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../docs/real-data/_sprint45_detail_extraction_audit.json',
);

const VALIDATION_NEEDLES = [
  'PLAY!',
  'Sommerfest',
  'Elektroküche',
  'Musik die mich antreibt',
  'WESTBAM',
  'TECHNO DAMPFER',
  'Lehmann',
  'Area51',
  'Area 51',
  'Affenkäfig',
  'Bootshaus',
  'SHOCKONE',
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

function mapRowToSourceRecord(row: SourceIntegritySnippet): SourceRecord {
  return {
    id: row.id,
    slug: row.slug ?? row.id,
    displayName: row.display_name ?? row.id,
    sourceType: (row.source_type ?? 'manual') as SourceType,
    parserType: (row.parser_type ?? 'unknown') as ParserType,
    acquisitionStrategy: 'manual',
    priority: 50,
    trustScore: 50,
    requiresAuthentication: false,
    enabled: Boolean(row.enabled),
    archived: Boolean(row.archived),
    reviewRequired: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sourceConfig: row.source_config ?? undefined,
    connectorKey: row.source_config?.reference?.connectorKey,
  };
}

async function main(): Promise<void> {
  const client = opsClient();

  const { data: sourceRows } = await client
    .from('sources')
    .select('id,display_name,source_type,enabled,archived,source_config,slug,parser_type')
    .in('id', ACTIVE_SOURCE_IDS);

  const connectorMatrix = ((sourceRows ?? []) as SourceIntegritySnippet[]).map((row) => {
    const source = mapRowToSourceRecord(row);
    const profile = buildConnectorCapabilityProfile(source);
    const website = source.sourceConfig?.website as WebsiteConnectorConfig | undefined;
    const ticketPlatform = source.sourceConfig?.ticketPlatform as TicketPlatformConnectorConfig | undefined;
    const maxDetailPages =
      website?.limits?.maxDetailPages ?? ticketPlatform?.limits?.maxDetailPages ?? 0;

    return {
      sourceId: source.id,
      displayName: source.displayName,
      connectorKey: source.connectorKey,
      sourceType: source.sourceType,
      maxDetailPages,
      detailCapability: profile.detailCapability,
      fieldCoverage: profile.fieldCoverage,
      listFields: profile.listFields,
      detailFields: profile.detailFields,
      importedFields: profile.importedFields,
      lostFields: profile.lostFields,
      preferredStrategy: website?.preferredStrategy,
      detailStrategy: website?.eventDetailPage?.detailStrategy ?? 'og_meta',
    };
  });

  const { data: events } = await client.from('events').select('*').eq('status', 'published');
  const published = ((events ?? []) as EventRow[]).map((row) => {
    const admin = mapEventRowToAdminRecord(row);
    const canonical = projectCanonicalEventFields({
      title: admin.title,
      description: admin.description,
      venue: admin.venueName ?? '',
      city: admin.venueCity ?? '',
      artists: [],
      genres: [],
      ticketUrl: admin.ticketUrl,
      priceText: admin.priceText,
      source: admin.sourceId ?? '',
    });
    const completeness = calculateEventDataCompleteness({
      title: admin.title,
      startDate: admin.startDate,
      venue: admin.venueName,
      organizer: admin.organizerName,
      description: admin.description,
      artists: [],
      genres: [],
      ticketUrl: admin.ticketUrl,
      priceText: admin.priceText,
      imageUrl: admin.imageUrl,
      city: admin.venueCity,
    });
    return {
      id: admin.id,
      title: admin.title,
      sourceId: admin.sourceId,
      completeness,
    };
  });

  const validationEvents = published.filter((event) =>
    VALIDATION_NEEDLES.some((needle) => event.title.toLowerCase().includes(needle.toLowerCase())),
  );

  const bootshausInvestigation = {
    currentMaxDetailPages:
      connectorMatrix.find((entry) => entry.sourceId === 'source-bootshaus-koeln')?.maxDetailPages ?? null,
    origin: 'Set to 0 in 20260744000000_sprint13_production_integration.sql (initial production seed).',
    restoredIn: '20260801000000_sprint45_bootshaus_detail_extraction.sql + BOOTSHAUS_WEBSITE_CONFIG factory',
    detailDataAvailable: true,
    detailStrategy: 'html_selector list + post-list og:description merge via list-detail-enrichment',
    reasonPreviouslyDisabled:
      'Sprint 13 shipped list-only html_selector for stability; detail pages were never wired for Bootshaus.',
  };

  const ticketIoInvestigation = {
    infoTabFields: ['description', 'lineup', 'ticketPhases', 'genres'],
    availableVia: {
      html: 'Info tab content in detail HTML when PoW challenge absent',
      jsonLd: 'Event JSON-LD on detail pages (fixtures: SHOCKONE)',
      embeddedJson: 'Limited; shop list uses JSON-LD with description N/A',
      xhr: 'Not used — public HTML only',
    },
    productionLimit:
      'maxDetailPages configurable per source; PoW may block live detail fetch (best-effort enrichment).',
    legalNote: 'Only publicly accessible shop pages; no protection bypass.',
  };

  const artifact = {
    generatedAt: new Date().toISOString(),
    phase: '4.5',
    connectorCapabilityMatrix: connectorMatrix,
    bootshausInvestigation,
    ticketIoInvestigation,
    genericDetailLifecycle: {
      levels: [
        { level: 1, label: 'list_only' },
        { level: 2, label: 'list_plus_detail' },
        { level: 3, label: 'list_detail_structured' },
        { level: 4, label: 'official_api' },
      ],
      websiteFlow: [
        'discover list',
        'extract event URLs',
        'fetch detail pages',
        'extract structured fields',
        'merge with list fields',
        'CanonicalImportEvent',
      ],
      implementation: 'website/list-detail-enrichment.ts + processor hook for html_selector',
    },
    connectorQualityScores: connectorMatrix.map((entry) => ({
      sourceId: entry.sourceId,
      detailLevel: entry.detailCapability.level,
      averageFieldRating:
        entry.fieldCoverage.reduce((sum, field) => sum + field.rating, 0) / entry.fieldCoverage.length,
    })),
    eventCompleteness: {
      sampleCount: published.length,
      averagePercentage:
        published.length > 0
          ? Math.round(
              published.reduce((sum, event) => sum + event.completeness.percentage, 0) / published.length,
            )
          : 0,
    },
    productionValidation: validationEvents.map((event) => ({
      id: event.id,
      title: event.title,
      sourceId: event.sourceId,
      completenessPercentage: event.completeness.percentage,
      missingFields: event.completeness.fields.filter((field) => !field.present).map((field) => field.field),
    })),
    fieldsRecoverableAfterRepair: [
      'Bootshaus descriptions via re-import after maxDetailPages=50',
      'Affenkäfig descriptions already recoverable from import records (Phase 4.4)',
      'Ticket.io lineup/description when detail fetch succeeds and PoW absent',
    ],
    remainingLimitations: [
      'Ticket.io list JSON-LD description remains N/A without successful detail fetch',
      'Bootshaus artists/genres not structured on public pages — description only via og:description',
      'Ticket Kings remains list-only (deprecated)',
      'Production repair apply not enabled — use repair plan + controlled re-import',
    ],
  };

  writeFileSync(OUT, JSON.stringify(artifact, null, 2));
  console.log(`Wrote ${OUT}`);
  console.log(`Connectors audited: ${connectorMatrix.length}`);
  console.log(`Validation events: ${validationEvents.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
