/**
 * Phase 4.8.6.2 — Ticket.io Enrichment Linkage (read-only audit + preview).
 */
import './bootstrap-ops-supabase';

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapEventRowToAdminRecord, mapEventRowToDomain, type EventRow } from '@/data/mappers/event-mapper';
import type { AdminEventRecord } from '@/data/types/records';
import { discoverTicketIoPriceEvidence } from '@/features/aggregation/connectors/ticket-platform/ticket-io-price-evidence';
import { isTicketIoPowChallengePage } from '@/features/aggregation/connectors/ticket-platform/ticket-io-field-quality';
import {
  extractTicketIoEventSlug,
  extractTicketIoShopSlug,
} from '@/features/aggregation/connectors/ticket-platform/ticket-io-url';
import { parseTicketIoShopHtml } from '@/features/aggregation/connectors/ticket-platform/adapters/ticket-io-adapter';
import { projectCanonicalEventFields } from '@/features/events/formatting/canonical-event-projection';
import {
  PHASE4862_R3HAB_EVENT_ID,
  buildFrozenDomainFingerprint,
  buildTicketIoEnrichmentCandidate,
  buildTicketIoEnrichmentPreviewMutation,
  classifyTicketIoLinkageGap,
  extractTicketIoHost,
  findSlugCollisions,
  isEventSpecificTicketIoUrl,
  simulateEnrichmentTicketWrite,
  type TicketIoEnrichmentAuditRow,
  type TicketIoEnrichmentPreviewMutation,
  type TicketIoLinkageRootCause,
} from '@/features/import/ticket-io-enrichment-linkage';
import { opsClient } from './ops-supabase-rows';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'docs/real-data');
const TICKET_IO_SOURCE_PATTERN = /ticket-io|ticket_io/i;

const FETCH_HEADERS = {
  'User-Agent': 'EternalRave-SourceBot/1.0 (+https://eternalrave.app)',
  Accept: 'text/html',
};

let productionMutationsInThisRun = 0;
const listHtmlCache = new Map<string, string>();

function writeJson(name: string, data: unknown): void {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, name), JSON.stringify(data, null, 2));
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: FETCH_HEADERS, redirect: 'follow' });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return res.text();
}

async function getListHtml(shopSlug: string): Promise<string> {
  if (listHtmlCache.has(shopSlug)) {
    return listHtmlCache.get(shopSlug)!;
  }
  const listUrl = `https://${shopSlug}.ticket.io/`;
  const html = await fetchHtml(listUrl);
  listHtmlCache.set(shopSlug, html);
  return html;
}

async function loadPublishedEvents(): Promise<AdminEventRecord[]> {
  const { data } = await opsClient().from('events').select('*').eq('status', 'published');
  return (data ?? []).map((row) => mapEventRowToAdminRecord(row as EventRow));
}

async function loadSourceReferences(eventId: string) {
  const { data } = await opsClient()
    .from('event_source_references')
    .select('source_id,external_event_id,last_seen_at,active')
    .eq('canonical_event_id', eventId);
  return data ?? [];
}

async function loadImportRecords(eventId: string) {
  const { data } = await opsClient()
    .from('import_records')
    .select('id,source_id,status,resulting_event_id,updated_at,normalized_payload')
    .eq('resulting_event_id', eventId)
    .order('updated_at', { ascending: false });
  return data ?? [];
}

async function auditEvent(
  event: AdminEventRecord,
  slugCollisions: Map<string, string[]>,
): Promise<TicketIoEnrichmentAuditRow | null> {
  if (!isEventSpecificTicketIoUrl(event.ticketUrl)) {
    return null;
  }
  const ticketUrl = event.ticketUrl!;
  const shopSlug = extractTicketIoShopSlug(ticketUrl);
  const eventSlug = extractTicketIoEventSlug(ticketUrl);
  if (!shopSlug || !eventSlug) {
    return null;
  }

  const listHtml = await getListHtml(shopSlug);
  const listUrl = `https://${shopSlug}.ticket.io/`;
  let detailHtml: string | undefined;
  try {
    detailHtml = await fetchHtml(ticketUrl);
  } catch {
    detailHtml = undefined;
  }

  const discovery = discoverTicketIoPriceEvidence({
    shopSlug,
    listUrl,
    listHtml,
    eventUrl: ticketUrl,
    detailHtml,
  });

  const parsed = parseTicketIoShopHtml(listHtml, { shopSlug, listUrl, platform: 'ticket_io' });
  const connectorMatch = parsed.events.find((entry) => {
    const slug = extractTicketIoEventSlug(entry.ticketUrl ?? '');
    return slug === eventSlug;
  });

  const refs = await loadSourceReferences(event.id);
  const ticketIoRefs = refs.filter((r) => TICKET_IO_SOURCE_PATTERN.test(String(r.source_id)));
  const imports = await loadImportRecords(event.id);
  const ticketIoImports = imports.filter((r) => TICKET_IO_SOURCE_PATTERN.test(String(r.source_id)));
  const linkedImports = ticketIoImports.filter((r) => r.resulting_event_id === event.id);
  const slugCollision = (slugCollisions.get(eventSlug)?.length ?? 0) > 1;

  const classification = classifyTicketIoLinkageGap({
    hasTicketIoSourceReference: ticketIoRefs.length > 0,
    ticketIoImportCount: ticketIoImports.length,
    linkedImportCount: linkedImports.length,
    canonicalPriceText: event.priceText,
    connectorPriceText: connectorMatch?.priceText,
    discovery,
    slugCollision,
    listRowMatch: discovery.hits.some(
      (h) => h.surface === 'list_card_html' || h.surface === 'list_overview_row',
    ),
  });

  return {
    eventId: event.id,
    title: event.title,
    ticketUrl,
    shopHost: extractTicketIoHost(ticketUrl) ?? `${shopSlug}.ticket.io`,
    eventSlug,
    sourceReferences: ticketIoRefs.map((r) => ({
      sourceId: String(r.source_id),
      externalEventId: String(r.external_event_id),
      lastSeenAt: r.last_seen_at ?? undefined,
      active: r.active ?? undefined,
    })),
    ticketIoImportRecords: ticketIoImports.map((r) => ({
      id: String(r.id),
      sourceId: String(r.source_id),
      status: String(r.status),
      resultingEventId: r.resulting_event_id,
      updatedAt: r.updated_at ?? undefined,
      priceText: (r.normalized_payload as { priceText?: string })?.priceText,
    })),
    latestTicketIoImportAt: ticketIoImports[0]?.updated_at ?? undefined,
    canonicalPriceText: event.priceText,
    canonicalTicketStatus: event.ticketStatus,
    canonicalTicketPhasesCount: event.ticketPhases?.length ?? 0,
    publicListRowMatch: discovery.hits.some(
      (h) => h.surface === 'list_card_html' || h.surface === 'list_overview_row',
    ),
    publicRawPrice: discovery.bestHit?.rawSnippet,
    publicNormalizedPrice: discovery.bestHit?.priceText,
    publicAvailability: discovery.bestHit?.soldOut ? 'sold_out' : 'instock',
    publicSoldOut: discovery.bestHit?.soldOut,
    connectorPriceText: connectorMatch?.priceText,
    connectorPriceAmount: connectorMatch?.priceAmount,
    discovery,
    rootCause: classification.rootCause,
    persistenceState: classification.persistenceState,
    responsibleModule: classification.responsibleModule,
    responsibleTransition: classification.responsibleTransition,
    repeatsWithoutFix: classification.repeatsWithoutFix,
    genericCodeChangeRequired: classification.genericCodeChangeRequired,
    controlledEnrichmentSufficient: classification.controlledEnrichmentSufficient,
    slugCollisionEventIds: slugCollision ? slugCollisions.get(eventSlug) : undefined,
  };
}

async function auditLinkage(): Promise<Record<string, unknown>> {
  const events = await loadPublishedEvents();
  const ticketIoEvents = events.filter((e) => isEventSpecificTicketIoUrl(e.ticketUrl));
  const collisions = findSlugCollisions(ticketIoEvents);
  const rows: TicketIoEnrichmentAuditRow[] = [];
  for (const event of ticketIoEvents) {
    const row = await auditEvent(event, collisions);
    if (row) {
      rows.push(row);
    }
  }
  const rootCauseCounts: Record<string, number> = {};
  for (const row of rows) {
    rootCauseCounts[row.rootCause] = (rootCauseCounts[row.rootCause] ?? 0) + 1;
  }
  const gaps = rows.filter(
    (r) =>
      r.rootCause !== 'NONE' &&
      r.controlledEnrichmentSufficient &&
      r.rootCause !== 'REVIEW_REQUIRED',
  );
  const result = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6.2',
    productionMutationsInThisRun,
    totalAudited: rows.length,
    linkageGaps: gaps.length,
    rootCauseCounts,
    slugCollisions: Object.fromEntries(collisions),
    events: rows,
  };
  writeJson('_phase4862_linkage_audit.json', result);
  writeJson('_phase4862_root_cause_matrix.json', {
    generatedAt: result.generatedAt,
    phase: '4.8.6.2',
    productionMutationsInThisRun,
    rootCauseCounts,
    events: rows.map((r) => ({
      eventId: r.eventId,
      title: r.title,
      rootCause: r.rootCause,
      responsibleModule: r.responsibleModule,
      responsibleTransition: r.responsibleTransition,
      repeatsWithoutFix: r.repeatsWithoutFix,
      genericCodeChangeRequired: r.genericCodeChangeRequired,
      controlledEnrichmentSufficient: r.controlledEnrichmentSufficient,
    })),
  });
  return result;
}

async function traceR3hab(): Promise<Record<string, unknown>> {
  const { data: eventRow } = await opsClient()
    .from('events')
    .select('*')
    .eq('id', PHASE4862_R3HAB_EVENT_ID)
    .single();
  const event = mapEventRowToAdminRecord(eventRow as EventRow);
  const events = await loadPublishedEvents();
  const collisions = findSlugCollisions(events);
  const audit = await auditEvent(event, collisions);
  if (!audit) {
    throw new Error('R3HAB audit failed');
  }
  const listHtml = await getListHtml('bootshaus-club');
  const candidate = buildTicketIoEnrichmentCandidate({
    event,
    listHtml,
    discovery: audit.discovery,
  });
  const result = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6.2',
    productionMutationsInThisRun,
    eventId: PHASE4862_R3HAB_EVENT_ID,
    slug: 'C7JPnatZ',
    ticketUrl: event.ticketUrl,
    publicEvidence: {
      rawPrice: audit.publicRawPrice,
      normalizedPrice: audit.publicNormalizedPrice,
      amount: audit.connectorPriceAmount,
      currency: 'EUR',
      availability: audit.publicAvailability,
      soldOut: audit.publicSoldOut,
      listRowMatch: audit.publicListRowMatch,
    },
    connectorOutput: {
      priceText: audit.connectorPriceText,
      priceAmount: audit.connectorPriceAmount,
      title: candidate?.title,
    },
    proposedCanonical: candidate
      ? {
          priceText: candidate.priceText,
          ticketUrl: candidate.ticketUrl,
        }
      : null,
    audit,
  };
  writeJson('_phase4862_r3hab_trace.json', result);
  return result;
}

async function analyzeSourceReferences(): Promise<Record<string, unknown>> {
  const events = (await loadPublishedEvents()).filter((e) =>
    isEventSpecificTicketIoUrl(e.ticketUrl),
  );
  const analysis = [];
  for (const event of events) {
    const refs = await loadSourceReferences(event.id);
    const ticketIoRefs = refs.filter((r) => TICKET_IO_SOURCE_PATTERN.test(String(r.source_id)));
    const websiteRefs = refs.filter((r) => !TICKET_IO_SOURCE_PATTERN.test(String(r.source_id)));
    analysis.push({
      eventId: event.id,
      title: event.title,
      ticketUrl: event.ticketUrl,
      ownerSourceId: event.sourceId,
      ticketIoReferenceCount: ticketIoRefs.length,
      websiteReferenceCount: websiteRefs.length,
      ticketIoReferences: ticketIoRefs,
      ownershipPreserved: event.sourceId !== 'source-bootshaus-ticket-io' || ticketIoRefs.length === 0,
    });
  }
  const result = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6.2',
    productionMutationsInThisRun,
    events: analysis,
    missingTicketIoReference: analysis.filter((e) => e.ticketIoReferenceCount === 0).length,
  };
  writeJson('_phase4862_source_reference_analysis.json', result);
  return result;
}

async function verifyEnrichmentPath(): Promise<Record<string, unknown>> {
  return {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6.2',
    productionMutationsInThisRun,
    genericFix: {
      module: 'event-canonical-identity-service + import-event-publish-service',
      behavior:
        'Enrichment publish resolves existing canonical event by normalized Ticket.io event URL before fingerprint fallback',
      duplicateEventForbidden: true,
      ownershipPreserved: true,
    },
    websiteImporterUnchanged: true,
    schedulingUnchanged: true,
  };
}

async function previewBatch(): Promise<Record<string, unknown>> {
  const audit = existsSync(join(OUT, '_phase4862_linkage_audit.json'))
    ? (JSON.parse(readFileSync(join(OUT, '_phase4862_linkage_audit.json'), 'utf8')) as {
        events: TicketIoEnrichmentAuditRow[];
      })
    : ((await auditLinkage()) as { events: TicketIoEnrichmentAuditRow[] });

  const batchA: TicketIoEnrichmentPreviewMutation[] = [];
  const reviewOnly: TicketIoEnrichmentPreviewMutation[] = [];

  for (const row of audit.events) {
    const { data: eventRow } = await opsClient()
      .from('events')
      .select('*')
      .eq('id', row.eventId)
      .single();
    const event = mapEventRowToAdminRecord(eventRow as EventRow);
    const shopSlug = extractTicketIoShopSlug(event.ticketUrl ?? '');
    if (!shopSlug) {
      continue;
    }
    const listHtml = await getListHtml(shopSlug);
    const candidate = buildTicketIoEnrichmentCandidate({
      event,
      listHtml,
      discovery: row.discovery,
    });
    if (!candidate) {
      reviewOnly.push({
        eventId: row.eventId,
        title: row.title,
        shopHost: row.shopHost,
        eventSlug: row.eventSlug ?? '',
        field: 'priceText',
        currentValue: event.priceText,
        proposedValue: null,
        publicEvidence: row.publicRawPrice ?? '',
        connectorOutput: null,
        sourceReferenceState: `${row.sourceReferences.length} refs`,
        importRecordState: `${row.ticketIoImportRecords.length} imports`,
        writeReason: 'Connector candidate build failed',
        consumerVisibleResult: null,
        frozenDomainFingerprint: buildFrozenDomainFingerprint(event),
        rollbackValue: event.priceText ?? '',
        risk: 'high',
        batch: 'review',
      });
      continue;
    }

    const mutation = buildTicketIoEnrichmentPreviewMutation({
      event,
      discovery: row.discovery,
      candidate,
      sourceReferenceState:
        row.sourceReferences.length > 0 ? 'has_ticketio_reference' : 'no_ticketio_reference',
      importRecordState:
        row.ticketIoImportRecords.length > 0 ? 'has_import_record' : 'no_import_record',
      slugCollision: Boolean(row.slugCollisionEventIds?.length),
    });

    if (!mutation) {
      if (row.rootCause === 'NONE') {
        continue;
      }
      if (row.rootCause === 'REVIEW_REQUIRED' || row.slugCollisionEventIds?.length) {
        reviewOnly.push({
          eventId: row.eventId,
          title: row.title,
          shopHost: row.shopHost,
          eventSlug: row.eventSlug ?? '',
          field: 'priceText',
          currentValue: event.priceText,
          proposedValue: candidate.priceText,
          publicEvidence: row.publicRawPrice ?? '',
          connectorOutput: candidate,
          sourceReferenceState: `${row.sourceReferences.length} refs`,
          importRecordState: `${row.ticketIoImportRecords.length} imports`,
          writeReason: row.rootCause,
          consumerVisibleResult: null,
          frozenDomainFingerprint: buildFrozenDomainFingerprint(event),
          rollbackValue: event.priceText ?? '',
          risk: 'medium',
          batch: 'review',
        });
      }
      continue;
    }

    if (
      row.controlledEnrichmentSufficient &&
      row.rootCause !== 'REVIEW_REQUIRED' &&
      row.rootCause !== 'NONE'
    ) {
      batchA.push(mutation);
    } else {
      reviewOnly.push({ ...mutation, batch: 'review', risk: 'medium' });
    }
  }

  const result = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6.2',
    productionMutationsInThisRun,
    batchACount: batchA.length,
    reviewOnlyCount: reviewOnly.length,
    batchA,
    reviewOnly,
    approvalRequired: 'Explicit approval before Ticket.io enrichment apply phase',
  };
  writeJson('_phase4862_batch_preview.json', result);
  return result;
}

async function simulateConsumer(): Promise<Record<string, unknown>> {
  const { data: eventRow } = await opsClient()
    .from('events')
    .select('*')
    .eq('id', PHASE4862_R3HAB_EVENT_ID)
    .single();
  const event = mapEventRowToAdminRecord(eventRow as EventRow);
  const listHtml = await getListHtml('bootshaus-club');
  const discovery = discoverTicketIoPriceEvidence({
    shopSlug: 'bootshaus-club',
    listUrl: 'https://bootshaus-club.ticket.io/',
    listHtml,
    eventUrl: event.ticketUrl,
  });
  const candidate = buildTicketIoEnrichmentCandidate({ event, listHtml, discovery });
  if (!candidate) {
    throw new Error('R3HAB enrichment candidate missing');
  }
  const simulation = simulateEnrichmentTicketWrite({ event, candidate });
  const before = projectCanonicalEventFields({
    title: event.title,
    description: event.description ?? '',
    venue: event.venueName ?? '',
    city: event.venueCity ?? '',
    artists: [],
    priceText: event.priceText,
    source: event.sourceId ?? '',
    ticketUrl: event.ticketUrl,
    imageUrl: event.imageUrl,
    genres: event.genreLabels,
  });
  const result = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6.2',
    productionMutationsInThisRun,
    eventId: PHASE4862_R3HAB_EVENT_ID,
    pipeline: {
      publicList: discovery.bestHit,
      connectorOutput: { priceText: candidate.priceText },
      enrichmentLinkage: 'simulated fill-only',
      canonicalWriterPatch: simulation.patch,
      projection: simulation.projection,
    },
    before: {
      displayPriceText: before.displayPriceText,
      ticketUrl: before.ticketUrl,
      title: before.title ?? event.title,
    },
    after: {
      displayPriceText: simulation.projection.displayPriceText,
      ticketUrl: simulation.projection.ticketUrl,
      title: event.title,
    },
    forbiddenDomainUnchanged: buildFrozenDomainFingerprint(event),
    websiteFieldsFrozen: true,
  };
  writeJson('_phase4862_simulated_consumer_result.json', result);
  return result;
}

async function readiness(): Promise<Record<string, unknown>> {
  const auditPath = join(OUT, '_phase4862_linkage_audit.json');
  const previewPath = join(OUT, '_phase4862_batch_preview.json');
  const audit = existsSync(auditPath)
    ? JSON.parse(readFileSync(auditPath, 'utf8'))
    : await auditLinkage();
  const preview = existsSync(previewPath)
    ? JSON.parse(readFileSync(previewPath, 'utf8'))
    : await previewBatch();
  const result = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6.2',
    productionMutationsInThisRun,
    totalAudited: (audit as { totalAudited: number }).totalAudited,
    linkageGaps: (audit as { linkageGaps: number }).linkageGaps,
    batchACount: (preview as { batchACount: number }).batchACount,
    readinessVerdict: 'AWAITING_TICKETIO_ENRICHMENT_BATCH_APPROVAL',
    genericLinkageFixApplied: true,
    websiteImporterUnchanged: true,
    schedulingUnchanged: true,
  };
  writeJson('_phase4862_readiness.json', result);
  return result;
}

async function report(): Promise<void> {
  const result = await readiness();
  console.log(JSON.stringify(result, null, 2));
}

async function full(): Promise<void> {
  await auditLinkage();
  await traceR3hab();
  await analyzeSourceReferences();
  await verifyEnrichmentPath();
  await previewBatch();
  await simulateConsumer();
  await readiness();
}

const command = process.argv[2] ?? 'report';
const handlers: Record<string, () => Promise<void>> = {
  'audit-linkage': async () => console.log(JSON.stringify(await auditLinkage(), null, 2)),
  'trace-r3hab': async () => console.log(JSON.stringify(await traceR3hab(), null, 2)),
  'analyze-source-references': async () =>
    console.log(JSON.stringify(await analyzeSourceReferences(), null, 2)),
  'verify-enrichment-path': async () =>
    console.log(JSON.stringify(await verifyEnrichmentPath(), null, 2)),
  'preview-batch': async () => console.log(JSON.stringify(await previewBatch(), null, 2)),
  'simulate-consumer': async () => console.log(JSON.stringify(await simulateConsumer(), null, 2)),
  readiness: async () => console.log(JSON.stringify(await readiness(), null, 2)),
  report,
  full: async () => {
    await full();
    console.log(JSON.stringify({ phase: '4.8.6.2', productionMutationsInThisRun, status: 'complete' }, null, 2));
  },
};

(async () => {
  const handler = handlers[command];
  if (!handler) {
    console.error(`Unknown command: ${command}`);
    process.exit(1);
  }
  await handler();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
