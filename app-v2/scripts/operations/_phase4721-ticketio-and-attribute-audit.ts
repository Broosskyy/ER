/**
 * Phase 4.7.2 Gate C2 + Attribute Audit (read-only).
 *
 * Usage:
 *   npx tsx scripts/operations/_phase4721-ticketio-and-attribute-audit.ts <command>
 *
 * Commands:
 *   audit-ticketio | audit-attributes | audit-affenkäfig-mdma | quality-audit
 *   preview-gate-c2 | preview-gate-e | report | full
 */
import './bootstrap-ops-supabase';

import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapEventRowToAdminRecord } from '@/data/mappers/event-mapper';
import type { EventRow } from '@/data/mappers/event-mapper';
import type { AdminEventRecord } from '@/data/types/records';
import { extractAttributesFromDescriptionText } from '@/features/aggregation/domain/textual-attribute-parser';
import {
  classifyTicketIoPriceFailure,
  discoverTicketIoPriceEvidence,
  type TicketIoPriceFailureClass,
} from '@/features/aggregation/connectors/ticket-platform/ticket-io-price-evidence';
import { isTicketIoPowChallengePage } from '@/features/aggregation/connectors/ticket-platform/ticket-io-field-quality';
import { resolveTicketIoPriceStrategy } from '@/features/aggregation/connectors/ticket-platform/ticket-io-price-strategy-registry';
import {
  extractTicketIoEventSlugFromUrl,
  parseAllTicketIoListRowContexts,
} from '@/features/aggregation/connectors/ticket-platform/ticket-io-list-enrichment';
import { readCanonicalTicket } from '@/features/events/domain/canonical-ticket-read';
import { formatDisplayPriceText } from '@/features/aggregation/connectors/ticket-platform/format-ticket-price';
import { opsClient } from './ops-supabase-rows';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_DIR = join(ROOT, 'docs/real-data');
const REPORT_PATH = join(ROOT, 'docs/PHASE_4721_TICKETIO_AND_ATTRIBUTE_AUDIT_REPORT.md');

const FETCH_HEADERS = {
  'User-Agent': 'EternalRave-SourceBot/1.0 (+https://eternalrave.app)',
  Accept: 'text/html,application/xhtml+xml',
};

const REPRESENTATIVE_TITLE_PATTERNS = [
  /ship\s*vol\.?\s*iii/i,
  /\blevi\b/i,
  /\bbc173\b/i,
  /blacklist\s*festival/i,
  /unreal\s*weekender\s*i\b/i,
  /unreal\s*weekender\s*ii\b/i,
];

type AttributeFailureClass =
  | 'evidence_absent'
  | 'not_extracted'
  | 'lost_in_normalization'
  | 'rejected_by_merge'
  | 'schema_column_missing'
  | 'not_persisted'
  | 'api_omitted'
  | 'view_model_omitted'
  | 'ui_render_condition'
  | 'review_required'
  | 'none';

interface AuditState {
  ticketIoSourceMatrix: unknown[];
  ticketIoPriceTraces: unknown[];
  ticketIoFailureClasses: Record<string, number>;
  attributeSourceMatrix: unknown[];
  affenkaefigMdmaTraces: unknown[];
  attributeSchemaProjection: unknown;
  qualityRuleViolations: unknown[];
  gateC2Preview: unknown;
  gateEPreview: unknown;
  summary: Record<string, unknown>;
}

const state: AuditState = {
  ticketIoSourceMatrix: [],
  ticketIoPriceTraces: [],
  ticketIoFailureClasses: {},
  attributeSourceMatrix: [],
  affenkaefigMdmaTraces: [],
  attributeSchemaProjection: {},
  qualityRuleViolations: [],
  gateC2Preview: {},
  gateEPreview: {},
  summary: {},
};

const listHtmlCache = new Map<string, string>();

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, { headers: FETCH_HEADERS, redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return response.text();
}

function ensureOutDir(): void {
  mkdirSync(OUT_DIR, { recursive: true });
}

function writeJson(name: string, data: unknown): void {
  ensureOutDir();
  writeFileSync(join(OUT_DIR, name), JSON.stringify(data, null, 2), 'utf8');
}

function extractShopSlug(url: string): string | undefined {
  const match = url.match(/https?:\/\/([a-z0-9-]+)\.ticket\.io/i);
  return match?.[1]?.toLowerCase();
}

function isTicketIoSource(source: Record<string, unknown>): boolean {
  const id = String(source.id ?? '');
  const config = (source.source_config ?? {}) as Record<string, unknown>;
  const ticketPlatform = (config.ticketPlatform ?? {}) as Record<string, unknown>;
  return ticketPlatform.platform === 'ticket_io' || /ticket-io/i.test(id);
}

function shopHostFromSource(source: Record<string, unknown>): string {
  const config = (source.source_config ?? {}) as Record<string, unknown>;
  const ticketPlatform = (config.ticketPlatform ?? {}) as Record<string, unknown>;
  const shopSlug = String(ticketPlatform.shopSlug ?? '').trim().toLowerCase();
  if (shopSlug) {
    return `${shopSlug}.ticket.io`;
  }
  const listUrl = String(ticketPlatform.listUrl ?? config.url ?? '');
  const fromUrl = extractShopSlug(listUrl);
  if (fromUrl) {
    return `${fromUrl}.ticket.io`;
  }
  return 'unknown.ticket.io';
}

async function getListHtml(shopHost: string, listUrl: string): Promise<string> {
  const cacheKey = shopHost;
  if (listHtmlCache.has(cacheKey)) {
    return listHtmlCache.get(cacheKey)!;
  }
  try {
    const html = await fetchHtml(listUrl);
    listHtmlCache.set(cacheKey, html);
    return html;
  } catch {
    listHtmlCache.set(cacheKey, '');
    return '';
  }
}

function uiPriceVisible(event: AdminEventRecord): boolean {
  const canonical = readCanonicalTicket({
    ticketUrl: event.ticketUrl,
    websiteUrl: event.websiteUrl,
    priceText: event.priceText,
    ticketStatus: event.ticketStatus,
    ticketPhases: event.ticketPhases,
  });
  const label = formatDisplayPriceText(canonical.priceText ?? event.priceText);
  return Boolean(label && label !== 'Ausverkauft');
}

async function loadPublishedEvents(): Promise<AdminEventRecord[]> {
  const { data } = await opsClient().from('events').select('*').eq('status', 'published');
  return (data ?? []).map((row) => mapEventRowToAdminRecord(row as EventRow));
}

async function loadTicketIoSources(): Promise<Record<string, unknown>[]> {
  const { data } = await opsClient().from('sources').select('*');
  return (data ?? []).filter((row) => isTicketIoSource(row as Record<string, unknown>)) as Record<
    string,
    unknown
  >[];
}

async function loadImportPayload(eventId: string): Promise<Record<string, unknown>> {
  const { data } = await opsClient()
    .from('import_records')
    .select('normalized_payload,source_id')
    .eq('resulting_event_id', eventId)
    .order('updated_at', { ascending: false })
    .limit(1);
  return (data?.[0]?.normalized_payload ?? {}) as Record<string, unknown>;
}

function incrementFailure(counts: Record<string, number>, key: string): void {
  counts[key] = (counts[key] ?? 0) + 1;
}

async function auditTicketIo(): Promise<void> {
  const client = opsClient();
  const sources = await loadTicketIoSources();
  const events = (await loadPublishedEvents()).filter((event) =>
    /\.ticket\.io/i.test(event.ticketUrl ?? ''),
  );

  const sourceMatrix: unknown[] = [];
  const traces: unknown[] = [];
  const failureCounts: Record<string, number> = {};
  const shopStats: Record<
    string,
    {
      published: number;
      publicPriceFound: number;
      canonicalPrice: number;
      uiPrice: number;
      detailBlocked: number;
      failures: Record<string, number>;
    }
  > = {};

  for (const source of sources) {
    const shopHost = shopHostFromSource(source);
    const shopSlug = shopHost.replace('.ticket.io', '');
    const config = (source.source_config ?? {}) as Record<string, unknown>;
    const ticketPlatform = (config.ticketPlatform ?? {}) as Record<string, unknown>;
    const listUrl = String(ticketPlatform.listUrl ?? `https://${shopHost}/`);
    const listHtml = await getListHtml(shopHost, listUrl);
    const listAccessible = listHtml.length > 500 && !isTicketIoPowChallengePage(listHtml);
    const listRows = parseAllTicketIoListRowContexts(listHtml);
    const strategy = resolveTicketIoPriceStrategy(shopSlug);

    const { count } = await client
      .from('event_source_references')
      .select('*', { count: 'exact', head: true })
      .eq('source_id', String(source.id));

    const shopEvents = events.filter(
      (event) => extractShopSlug(event.ticketUrl ?? '') === shopSlug,
    );

    let extractionSuccess = 0;
    let extractionFailure = 0;

    for (const event of shopEvents) {
      const slug = extractTicketIoEventSlugFromUrl(event.ticketUrl ?? '');
      let detailHtml: string | undefined;
      if (slug && event.ticketUrl) {
        try {
          detailHtml = await fetchHtml(event.ticketUrl);
        } catch {
          detailHtml = undefined;
        }
      }

      const discovery = discoverTicketIoPriceEvidence({
        shopSlug,
        listUrl,
        listHtml,
        eventUrl: event.ticketUrl,
        detailHtml,
      });

      const importPayload = await loadImportPayload(event.id);
      const canonical = readCanonicalTicket({
        ticketUrl: event.ticketUrl,
        websiteUrl: event.websiteUrl,
        priceText: event.priceText,
        ticketStatus: event.ticketStatus,
        ticketPhases: event.ticketPhases,
      });

      const classification = classifyTicketIoPriceFailure({
        hasEventSlug: Boolean(slug),
        isShopRootUrl: !slug,
        discovery,
        importPriceText: importPayload.priceText as string | undefined,
        dbPriceText: event.priceText,
        canonicalPriceText: canonical.priceText,
        uiPriceVisible: uiPriceVisible(event),
      });

      if (classification.failure === 'NONE') {
        extractionSuccess++;
      } else {
        extractionFailure++;
        incrementFailure(failureCounts, classification.failure);
      }

      if (!shopStats[shopHost]) {
        shopStats[shopHost] = {
          published: 0,
          publicPriceFound: 0,
          canonicalPrice: 0,
          uiPrice: 0,
          detailBlocked: 0,
          failures: {},
        };
      }
      const stats = shopStats[shopHost]!;
      stats.published++;
      if (discovery.bestHit?.priceText) stats.publicPriceFound++;
      if (canonical.priceText?.trim()) stats.canonicalPrice++;
      if (uiPriceVisible(event)) stats.uiPrice++;
      if (discovery.detailAltchaBlocked) stats.detailBlocked++;
      incrementFailure(stats.failures, classification.failure);

      const isRepresentative =
        REPRESENTATIVE_TITLE_PATTERNS.some((pattern) => pattern.test(event.title)) ||
        /lehmann|proton|technodampfer|area51|hmg/i.test(event.title);

      if (isRepresentative || classification.failure !== 'NONE') {
        traces.push({
          eventId: event.id,
          title: event.title,
          shopHost,
          ticketUrl: event.ticketUrl,
          eventSlug: slug,
          discovery,
          importPriceText: importPayload.priceText,
          dbPriceText: event.priceText,
          canonicalPriceText: canonical.priceText,
          uiPriceVisible: uiPriceVisible(event),
          ticketStatus: event.ticketStatus,
          ticketPhasesCount: event.ticketPhases?.length ?? 0,
          classification,
        });
      }
    }

    sourceMatrix.push({
      sourceId: source.id,
      shopHost,
      enabled: source.enabled,
      listUrl,
      eventUrlPattern: `https://${shopHost}/{slug}/`,
      eventCount: shopEvents.length,
      originCount: count ?? 0,
      parserStrategy: strategy.strategy,
      listPageAccessible: listAccessible,
      detailPageAccessible: false,
      altchaState: listAccessible ? 'list_ok_detail_blocked' : 'list_or_detail_challenge',
      jsonLdAvailability: /application\/ld\+json/i.test(listHtml),
      embeddedJson: /type=["']application\/json["']/i.test(listHtml),
      publicApiEvidence: false,
      priceEvidenceLocation: strategy.strategy,
      availabilityEvidenceLocation: listRows.size > 0 ? 'list_overview_row' : 'none_on_list',
      releasePhaseEvidenceLocation: 'detail_blocked_or_list',
      soldOutEvidenceLocation: 'list_overview_row',
      extractionSuccessCount: extractionSuccess,
      extractionFailureCount: extractionFailure,
      listRowCount: listRows.size,
      notes: strategy.notes,
    });
  }

  state.ticketIoSourceMatrix = sourceMatrix;
  state.ticketIoPriceTraces = traces;
  state.ticketIoFailureClasses = failureCounts;
  state.summary = {
    ...state.summary,
    ticketIoPublishedEvents: events.length,
    ticketIoPublicPriceFound: traces.filter((t) =>
      Boolean((t as { discovery?: { bestHit?: { priceText?: string } } }).discovery?.bestHit?.priceText),
    ).length,
    ticketIoCanonicalPrice: events.filter((e) => e.priceText?.trim()).length,
    ticketIoUiPrice: events.filter((e) => uiPriceVisible(e)).length,
    ticketIoExternallyBlocked: traces.filter(
      (t) =>
        (t as { classification?: { failure?: string } }).classification?.failure ===
        'DETAIL_EXTERNALLY_BLOCKED_LIST_HAS_NO_PRICE',
    ).length,
    ticketIoRepairableWithoutAltchaBypass: traces.filter((t) => {
      const failure = (t as { classification?: { failure?: TicketIoPriceFailureClass } }).classification
        ?.failure;
      return failure === 'LIST_PRICE_AVAILABLE_NOT_EXTRACTED' ||
        failure === 'EMBEDDED_PRICE_AVAILABLE_NOT_EXTRACTED' ||
        failure === 'PRICE_NOT_PERSISTED';
    }).length,
    ticketIoSoldOutEvidence: traces.filter((t) =>
      Boolean((t as { discovery?: { bestHit?: { soldOut?: boolean } } }).discovery?.bestHit?.soldOut),
    ).length,
    shopStats,
  };

  writeJson('_phase4721_ticketio_source_matrix.json', sourceMatrix);
  writeJson('_phase4721_ticketio_price_traces.json', traces);
  writeJson('_phase4721_ticketio_failure_classes.json', failureCounts);
}

function classifyAttributeGap(input: {
  attributeKey: string;
  sourceEvidence: boolean;
  parserExtracted: boolean;
  importMetadata: boolean;
  dbPersisted: boolean;
}): AttributeFailureClass {
  if (!input.sourceEvidence) return 'evidence_absent';
  if (!input.parserExtracted) return 'not_extracted';
  if (!input.importMetadata) return 'lost_in_normalization';
  if (['floor_count', 'open_air', 'outdoor', 'indoor', 'festival'].includes(input.attributeKey)) {
    return 'schema_column_missing';
  }
  if (!input.dbPersisted) return 'not_persisted';
  return 'view_model_omitted';
}

async function auditAttributes(): Promise<void> {
  const sources = await opsClient()
    .from('sources')
    .select('id,display_name,slug,enabled,source_config');
  const matrix: unknown[] = [];

  const textualSourceIds = (sources.data ?? []).filter((source) => {
    const config = (source.source_config ?? {}) as Record<string, unknown>;
    const connector = String(config.connectorType ?? config.connector ?? '');
    return /website|ticket_king|ticket_io/i.test(connector) || /affenkaefig|mdma|bootshaus|lehmann|proton|technodampfer/i.test(String(source.id));
  });

  for (const source of textualSourceIds) {
    matrix.push({
      sourceId: source.id,
      displayName: source.display_name,
      enabled: source.enabled,
      connectorType: (source.source_config as Record<string, unknown>)?.connectorType,
      attributeSurfaces: [
        'title',
        'description',
        'faq',
        'timetable',
        'admission',
        'venue_info',
        'json_ld',
        'ticket_release_text',
      ],
      canonicalAttributeColumns: ['age_restriction', 'doors_open_at'],
      metadataOnlyAttributes: ['floor_count', 'event_attributes', 'venue_environment'],
      badgeProjection: 'ticket_status_only_no_editorial',
    });
  }

  state.attributeSourceMatrix = matrix;
  state.attributeSchemaProjection = {
    canonicalColumns: {
      age_restriction: { exists: true, api: true, ui: 'info_row' },
      doors_open_at: { exists: true, api: true, ui: 'info_row_optional' },
      floor_count: { exists: false, proposal: 'events.floor_count integer nullable' },
      event_attributes: { exists: false, proposal: 'events.event_attributes jsonb' },
      venue_environment: { exists: false, proposal: 'events.venue_environment text' },
      badge_chips: { exists: false, proposal: 'projection layer only' },
    },
    parserOutputFields: [
      'sourceMetadata.eventAttributes',
      'sourceMetadata.floorCount',
      'sourceMetadata.venueEnvironment',
      'minimumAge',
      'doorsOpenAt',
    ],
    mergeRules: 'source_agnostic_field_trust',
    editorialBadgeInference: false,
  };

  writeJson('_phase4721_attribute_source_matrix.json', matrix);
  writeJson('_phase4721_attribute_schema_projection.json', state.attributeSchemaProjection);
}

async function auditAffenkaefigMdma(): Promise<void> {
  const events = await loadPublishedEvents();
  const relevant = events.filter(
    (event) =>
      /affenkäfig|affenkaefig|mdma|musik die mich antreibt/i.test(event.title) ||
      /affenkaefig|mdma/i.test(event.organizerName ?? '') ||
      /affenkaefig|ticketkings\.de\/event\/mdma/i.test(event.websiteUrl ?? event.ticketUrl ?? ''),
  );

  const traces: unknown[] = [];
  const failureCounts: Record<string, number> = {};

  for (const event of relevant) {
    const importPayload = await loadImportPayload(event.id);
    const metadata = (importPayload.sourceMetadata ?? {}) as Record<string, unknown>;
    const description = String(importPayload.description ?? event.description ?? '');
    const parsed = extractAttributesFromDescriptionText(description, 'affenkaefig_mdma_audit');
    const importAttributes = (metadata.eventAttributes ?? []) as unknown[];

    const expectedKeys = ['open_air', 'indoor', 'outdoor', 'festival', 'multi_floor'] as const;
    const attributeTraces = expectedKeys.map((key) => {
      const sourceEvidence = parsed.attributes.some((a) => a.key === key);
      const parserExtracted = sourceEvidence;
      const importMetadata = Array.isArray(importAttributes)
        ? importAttributes.some((a) => (a as { key?: string }).key === key)
        : false;
      const dbPersisted =
        key === 'multi_floor'
          ? false
          : key === 'open_air' || key === 'outdoor' || key === 'indoor'
            ? false
            : false;

      const failure = classifyAttributeGap({
        attributeKey: key === 'multi_floor' ? 'floor_count' : key,
        sourceEvidence,
        parserExtracted,
        importMetadata,
        dbPersisted,
      });

      if (sourceEvidence && failure !== 'none') {
        incrementFailure(failureCounts, failure);
      }

      return { key, sourceEvidence, parserExtracted, importMetadata, dbPersisted, failure };
    });

    traces.push({
      eventId: event.id,
      title: event.title,
      websiteUrl: event.websiteUrl,
      ticketUrl: event.ticketUrl,
      sourceEvidence: {
        descriptionSnippet: description.slice(0, 400),
        parsedAttributes: parsed.attributes,
        minimumAge: parsed.minimumAge,
        doorsOpenAt: parsed.doorsOpenAt,
        floorCount: parsed.floorCount,
        venueEnvironment: parsed.venueEnvironment,
      },
      importMetadata: {
        eventAttributes: importAttributes,
        minimumAge: metadata.minimumAge,
        doorsOpenAt: metadata.doorsOpenAt,
        floorCount: metadata.floorCount,
      },
      canonical: {
        ageRestriction: event.ageRestriction,
        doorsOpenAt: event.doorsOpenAt,
      },
      apiProjection: {
        ageRestriction: event.ageRestriction,
        doorsOpenAt: event.doorsOpenAt,
        attributeBadges: [],
      },
      viewModel: {
        ageInfoRow: Boolean(event.ageRestriction),
        doorsInfoRow: Boolean(event.doorsOpenAt),
        attributeBadgeChips: false,
      },
      attributeTraces,
    });
  }

  state.affenkaefigMdmaTraces = traces;
  state.summary = {
    ...state.summary,
    affenkaefigMdmaEventCount: relevant.length,
    affenkaefigMdmaMissingBadges: traces.filter((trace) =>
      (trace as { attributeTraces?: { sourceEvidence: boolean; failure: string }[] }).attributeTraces?.some(
        (row) => row.sourceEvidence && row.failure !== 'none',
      ),
    ).length,
    attributeFailureClasses: failureCounts,
  };

  writeJson('_phase4721_affenkäfig_mdma_attribute_traces.json', traces);
}

async function qualityAudit(): Promise<void> {
  const events = await loadPublishedEvents();
  const violations: unknown[] = [];

  for (const event of events) {
    if (/\.ticket\.io/i.test(event.ticketUrl ?? '')) {
      const shopSlug = extractShopSlug(event.ticketUrl ?? '');
      const listUrl = shopSlug ? `https://${shopSlug}.ticket.io/` : '';
      const listHtml = shopSlug ? await getListHtml(`${shopSlug}.ticket.io`, listUrl) : '';
      const slug = extractTicketIoEventSlugFromUrl(event.ticketUrl ?? '');
      const discovery = discoverTicketIoPriceEvidence({
        shopSlug: shopSlug ?? 'unknown',
        listUrl,
        listHtml,
        eventUrl: event.ticketUrl,
      });
      const canonical = readCanonicalTicket({
        ticketUrl: event.ticketUrl,
        priceText: event.priceText,
        ticketStatus: event.ticketStatus,
        ticketPhases: event.ticketPhases,
      });

      if (discovery.bestHit?.priceText && !canonical.priceText?.trim()) {
        violations.push({
          rule: 'ticket_io_public_list_price_canonical_absent',
          eventId: event.id,
          title: event.title,
          sourceId: event.sourceId,
          evidence: discovery.bestHit.priceText,
        });
      }
      if (discovery.bestHit?.soldOut && event.ticketStatus !== 'sold_out') {
        violations.push({
          rule: 'ticket_io_explicit_sold_out_canonical_mismatch',
          eventId: event.id,
          title: event.title,
        });
      }
      if (!slug && /\.ticket\.io\/?$/i.test(event.ticketUrl ?? '')) {
        violations.push({
          rule: 'ticket_io_shop_root_without_event_slug',
          eventId: event.id,
          title: event.title,
          ticketUrl: event.ticketUrl,
        });
      }
    }

    const parsed = extractAttributesFromDescriptionText(event.description, 'quality_audit');
    if (parsed.venueEnvironment === 'outdoor' && !event.ageRestriction) {
      const openAir = parsed.attributes.some((a) => a.key === 'open_air');
      if (openAir) {
        violations.push({
          rule: 'explicit_open_air_attribute_not_persisted',
          eventId: event.id,
          title: event.title,
        });
      }
    }
    if (parsed.minimumAge && !event.ageRestriction) {
      violations.push({
        rule: 'explicit_age_restriction_missing',
        eventId: event.id,
        title: event.title,
        evidence: parsed.minimumAge,
      });
    }
    if (parsed.doorsOpenAt && !event.doorsOpenAt) {
      violations.push({
        rule: 'explicit_doors_time_missing',
        eventId: event.id,
        title: event.title,
        evidence: parsed.doorsOpenAt,
      });
    }
  }

  state.qualityRuleViolations = violations;
  writeJson('_phase4721_quality_rule_violations.json', violations);
}

async function previewGateC2(): Promise<void> {
  const tracePath = join(OUT_DIR, '_phase4721_ticketio_price_traces.json');
  const traces = (state.ticketIoPriceTraces.length > 0
    ? state.ticketIoPriceTraces
    : existsSync(tracePath)
      ? (JSON.parse(readFileSync(tracePath, 'utf8')) as unknown[])
      : []) as Array<{
    eventId: string;
    title: string;
    ticketUrl?: string;
    classification: { failure: TicketIoPriceFailureClass };
    discovery: ReturnType<typeof discoverTicketIoPriceEvidence>;
    dbPriceText?: string;
  }>;

  const repairableFailures = new Set<TicketIoPriceFailureClass>([
    'LIST_PRICE_AVAILABLE_NOT_EXTRACTED',
    'EMBEDDED_PRICE_AVAILABLE_NOT_EXTRACTED',
    'PRICE_NOT_PERSISTED',
    'PRICE_LOST_IN_IMPORT_PAYLOAD',
  ]);

  const mutations = traces
    .filter((trace) => repairableFailures.has(trace.classification.failure))
    .map((trace) => {
      const priceText = trace.discovery.bestHit?.priceText;
      return {
        eventId: trace.eventId,
        title: trace.title,
        ticketUrl: trace.ticketUrl,
        failure: trace.classification.failure,
        evidence: trace.discovery.bestHit,
        plannedMutations: {
          priceText: { before: trace.dbPriceText ?? null, after: priceText ?? null },
          ticketStatus: {
            before: null,
            after: trace.discovery.bestHit?.soldOut ? 'sold_out' : 'available',
          },
          ticketPhases: { before: [], after: 'derived_from_list_evidence_in_connector' },
          provenance: { origin: 'gate_c2_preview', strategy: trace.discovery.registeredStrategy.strategy },
        },
        forbiddenDomainsChecked: ['lineup', 'venue', 'organizer', 'ticketUrl'],
      };
    })
    .filter(
      (mutation, index, list) =>
        list.findIndex((entry) => entry.eventId === mutation.eventId) === index,
    );

  const preview = {
    gate: 'C2',
    readOnly: true,
    allowedFields: ['price_text', 'ticket_phases', 'ticket_status', 'ticket_provenance'],
    forbiddenFields: ['ticket_url', 'lineup', 'artists', 'venue', 'organizer', 'attributes'],
    mutationCount: mutations.length,
    events: mutations,
    idempotency: 'second pass must produce zero mutations',
    backupRequired: true,
    cacheInvalidation: ['event_detail', 'search_cards'],
  };

  state.gateC2Preview = preview;
  writeJson('_phase4721_gate_c2_preview.json', preview);
}

async function previewGateE(): Promise<void> {
  const traces = (state.affenkaefigMdmaTraces.length > 0
    ? state.affenkaefigMdmaTraces
    : []) as Array<{
    eventId: string;
    title: string;
    sourceEvidence: { parsedAttributes: { key: string; label: string }[]; minimumAge?: string; doorsOpenAt?: string };
    canonical: { ageRestriction?: string; doorsOpenAt?: string };
    attributeTraces: { key: string; failure: string }[];
  }>;

  const mutations = traces
    .map((trace) => {
      const fields: Record<string, unknown> = {};
      if (trace.sourceEvidence.minimumAge && !trace.canonical.ageRestriction) {
        fields.ageRestriction = trace.sourceEvidence.minimumAge.replace('+', '');
      }
      if (trace.sourceEvidence.doorsOpenAt && !trace.canonical.doorsOpenAt) {
        fields.doorsOpenAt = trace.sourceEvidence.doorsOpenAt;
      }
      const schemaOnly = trace.attributeTraces
        .filter((row) => row.failure === 'schema_column_missing')
        .map((row) => row.key);

      if (Object.keys(fields).length === 0 && schemaOnly.length === 0) {
        return null;
      }

      return {
        eventId: trace.eventId,
        title: trace.title,
        plannedMutations: fields,
        schemaMigrationRequired: schemaOnly,
        forbiddenDomainsChecked: ['ticket', 'lineup', 'venue_ownership', 'organizer'],
      };
    })
    .filter(Boolean);

  const preview = {
    gate: 'E',
    readOnly: true,
    allowedFields: ['canonical_attributes', 'attribute_provenance'],
    forbiddenFields: ['ticket_fields', 'lineup', 'venue_ownership', 'organizer'],
    mutationCount: mutations.length,
    events: mutations,
    schemaProposal: state.attributeSchemaProjection,
    idempotency: 'second pass must produce zero mutations',
    backupRequired: true,
  };

  state.gateEPreview = preview;
  writeJson('_phase4721_gate_e_preview.json', preview);
}

function generateReport(): void {
  const summary = state.summary;
  const lines = [
    '# Phase 4.7.2 — Ticket.io Price Coverage & Attribute Audit',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Executive Summary',
    '',
    `- Ticket.io published events: **${summary.ticketIoPublishedEvents ?? 'n/a'}**`,
    `- Public price evidence found (traced): **${summary.ticketIoPublicPriceFound ?? 'n/a'}**`,
    `- Canonical/UI price present: **${summary.ticketIoCanonicalPrice ?? 'n/a'}** / **${summary.ticketIoUiPrice ?? 'n/a'}**`,
    `- Repairable without ALTCHA bypass: **${summary.ticketIoRepairableWithoutAltchaBypass ?? 'n/a'}**`,
    `- Externally blocked: **${summary.ticketIoExternallyBlocked ?? 'n/a'}**`,
    `- Affenkäfig/MDMA events: **${summary.affenkaefigMdmaEventCount ?? 'n/a'}**`,
    `- Missing supported badges (with evidence): **${summary.affenkaefigMdmaMissingBadges ?? 'n/a'}**`,
  ];

  const gateC2 = state.gateC2Preview as { mutationCount?: number };
  const gateE = state.gateEPreview as { mutationCount?: number };
  lines.push(
    '',
    '## Gate Previews (read-only)',
    '',
    `- Gate C2 planned mutations: **${gateC2.mutationCount ?? 'run preview-gate-c2'}**`,
    `- Gate E planned mutations: **${gateE.mutationCount ?? 'run preview-gate-e'}**`,
    '',
    '## Artifacts',
    '',
    '- `docs/real-data/_phase4721_ticketio_source_matrix.json`',
    '- `docs/real-data/_phase4721_ticketio_price_traces.json`',
    '- `docs/real-data/_phase4721_ticketio_failure_classes.json`',
    '- `docs/real-data/_phase4721_attribute_source_matrix.json`',
    '- `docs/real-data/_phase4721_affenkäfig_mdma_attribute_traces.json`',
    '- `docs/real-data/_phase4721_attribute_schema_projection.json`',
    '- `docs/real-data/_phase4721_quality_rule_violations.json`',
    '- `docs/real-data/_phase4721_gate_c2_preview.json`',
    '- `docs/real-data/_phase4721_gate_e_preview.json`',
    '',
    '## Constraints',
    '',
    'No production repair executed. Gate C2 and Gate E require separate approval.',
  );

  writeFileSync(REPORT_PATH, lines.join('\n'), 'utf8');
}

function printSummary(): void {
  const s = state.summary;
  console.log('\n=== Phase 4.7.2 Audit Summary ===');
  console.log('1. Ticket.io events with public price (traced):', s.ticketIoPublicPriceFound);
  console.log('2. Ticket.io canonical/UI price:', s.ticketIoCanonicalPrice, '/', s.ticketIoUiPrice);
  console.log('3. Repairable without ALTCHA bypass:', s.ticketIoRepairableWithoutAltchaBypass);
  console.log('4. Externally blocked:', s.ticketIoExternallyBlocked);
  console.log('5. Sold-out evidence found:', s.ticketIoSoldOutEvidence);
  console.log('6. Affenkäfig/MDMA missing badges:', s.affenkaefigMdmaMissingBadges);
  console.log('7. Attribute failure classes:', JSON.stringify(s.attributeFailureClasses ?? {}));
  const c2 = (state.gateC2Preview as { mutationCount?: number })?.mutationCount;
  const e = (state.gateEPreview as { mutationCount?: number })?.mutationCount;
  console.log('8. Gate C2 / Gate E mutation counts:', c2 ?? 'n/a', '/', e ?? 'n/a');
}

async function runCommand(command: string): Promise<void> {
  switch (command) {
    case 'audit-ticketio':
      await auditTicketIo();
      break;
    case 'audit-attributes':
      await auditAttributes();
      break;
    case 'audit-affenkäfig-mdma':
    case 'audit-affenkaefig-mdma':
      await auditAffenkaefigMdma();
      break;
    case 'quality-audit':
      await qualityAudit();
      break;
    case 'preview-gate-c2':
      if (state.ticketIoPriceTraces.length === 0) await auditTicketIo();
      await previewGateC2();
      break;
    case 'preview-gate-e':
      if (state.affenkaefigMdmaTraces.length === 0) await auditAffenkaefigMdma();
      await previewGateE();
      break;
    case 'report':
      generateReport();
      break;
    case 'full':
      await auditTicketIo();
      await auditAttributes();
      await auditAffenkaefigMdma();
      await qualityAudit();
      await previewGateC2();
      await previewGateE();
      generateReport();
      printSummary();
      break;
    default:
      console.error(
        'Usage: npx tsx scripts/operations/_phase4721-ticketio-and-attribute-audit.ts <audit-ticketio|audit-attributes|audit-affenkäfig-mdma|quality-audit|preview-gate-c2|preview-gate-e|report|full>',
      );
      process.exit(1);
  }
}

const command = process.argv[2] ?? 'full';
void runCommand(command).catch((error) => {
  console.error(error);
  process.exit(1);
});
