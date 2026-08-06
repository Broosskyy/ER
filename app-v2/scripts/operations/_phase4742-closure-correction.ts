/**
 * Phase 4.7.4.2 closure correction — Palma availability revert, Ticket Kings admission
 * re-verification, and Nacht-Manager purchase URL integrity.
 *
 * Usage:
 *   npx tsx scripts/operations/_phase4742-closure-correction.ts <command>
 *
 * Commands:
 *   audit-palma | audit-admission | audit-urls | audit-e2e | audit
 *   backup | preflight | repair [--pass=1|2] | verify | report | full
 */
import './bootstrap-ops-supabase';

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapEventRowToAdminRecord } from '@/data/mappers/event-mapper';
import type { EventRow } from '@/data/mappers/event-mapper';
import type { AdminEventRecord } from '@/data/types/records';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import {
  enrichTicketKingsDetailFromPublicCheckout,
  parseTicketKingsCheckoutHtml,
} from '@/features/aggregation/connectors/ticket-platform/ticket-kings-public-checkout';
import {
  classifyPersistedNachtManagerUrl,
  extractTicketKingsCheckoutEmbedEvidence,
  isBrokenTicketKingsCheckoutClass,
  resolveTicketKingsOfficialFallbackUrl,
  validateNachtManagerCheckoutUrl,
  type TicketKingsCheckoutUrlClass,
} from '@/features/aggregation/connectors/ticket-platform/ticket-kings-checkout-url-integrity';
import { auditTicketIoShopAvailabilityEvidence } from '@/features/aggregation/connectors/ticket-platform/ticket-io-shop-availability-evidence';
import { discoverTicketIoPriceEvidence } from '@/features/aggregation/connectors/ticket-platform/ticket-io-price-evidence';
import { extractTicketIoShopSlug } from '@/features/aggregation/connectors/ticket-platform/ticket-io-url';
import { readCanonicalTicket } from '@/features/events/domain/canonical-ticket-read';
import { writeCanonicalTicketFields } from '@/features/events/domain/canonical-ticket-writer';
import { projectCanonicalEventFields } from '@/features/events/formatting/canonical-event-projection';
import { mapCanonicalAvailabilityToTicketBadge } from '@/features/events/formatting/ticket-badge-projection';
import { invalidateConsumerEventCaches } from '@/features/events/formatting/consumer-cache-invalidation';
import { opsClient } from './ops-supabase-rows';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'docs/real-data');
const REPORT = join(ROOT, 'docs/PHASE_4742_CLOSURE_CORRECTION_REPORT.md');
const GATE_C1_BACKUP = join(OUT, '_gate_c1_admission_repair_backup.json');

const PALMA_SHOP_ROOT_IDS = [
  'evt-1785339424521-tn10siz',
  'evt-1785339413919-ix5umo9',
  'evt-1785339377456-7miaf2o',
  'evt-1785339409363-puvo8be',
  'evt-1785339388133-sq2ykbm',
  'evt-1785339407876-uqm3mz0',
] as const;

const FETCH_HEADERS = {
  'User-Agent': 'EternalRave-SourceBot/1.0 (+https://eternalrave.app)',
  Accept: 'text/html,application/xhtml+xml',
};

const URL_LOCKS = new Set(['ticketUrl', 'websiteUrl']);

type RepairRun = {
  pass: number;
  generatedAt: string;
  mutations: number;
  events: unknown[];
};

let beforeSnapshot: Record<string, unknown> | null = null;

function writeJson(name: string, data: unknown): void {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, name), JSON.stringify(data, null, 2));
}

function hashValue(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value ?? null)).digest('hex').slice(0, 16);
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, { headers: FETCH_HEADERS, redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return response.text();
}

async function fetchHtmlWithStatus(url: string): Promise<{ status: number; html: string }> {
  const response = await fetch(url, { headers: FETCH_HEADERS, redirect: 'follow' });
  const html = await response.text();
  return { status: response.status, html };
}

async function loadPublishedEvents(): Promise<AdminEventRecord[]> {
  const { data, error } = await opsClient().from('events').select('*').eq('status', 'published');
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => mapEventRowToAdminRecord(row as EventRow));
}

function isTicketKingsEvent(event: AdminEventRecord): boolean {
  return /ticketkings\.de\/event\//i.test(event.ticketUrl ?? event.websiteUrl ?? '');
}

async function lineupFingerprint(eventId: string) {
  const client = opsClient();
  const [{ count: structuredCount }, { count: legacyCount }, { data: legacy }] = await Promise.all([
    client.from('event_lineup_entries').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
    client.from('event_artists').select('artist_id', { count: 'exact', head: true }).eq('event_id', eventId),
    client.from('event_artists').select('artists(name)').eq('event_id', eventId).order('sort_order'),
  ]);
  const names = (legacy ?? [])
    .map((row) => (row.artists as { name?: string } | null)?.name)
    .filter((name): name is string => Boolean(name));
  return {
    structuredCount: structuredCount ?? 0,
    legacyCount: legacyCount ?? 0,
    artistNamesHash: createHash('sha256').update(names.sort().join('|')).digest('hex').slice(0, 16),
  };
}

function forbiddenFingerprint(event: AdminEventRecord, lineup: Awaited<ReturnType<typeof lineupFingerprint>>) {
  return {
    ticketUrl: event.ticketUrl ?? '',
    websiteUrl: event.websiteUrl ?? '',
    descriptionHash: hashValue(event.description),
    genreLabelsHash: hashValue(event.genreLabels),
    venueId: event.venueId ?? '',
    organizerId: event.organizerId ?? '',
    imageUrl: event.imageUrl ?? '',
    flyerUrl: event.flyerUrl ?? '',
    sourceId: event.sourceId ?? '',
    eventAttributesHash: hashValue(event.eventAttributes),
    lineup,
  };
}

function projectConsumer(event: AdminEventRecord) {
  const canonicalTicket = readCanonicalTicket({
    ticketUrl: event.ticketUrl,
    websiteUrl: event.websiteUrl,
    priceText: event.priceText,
    ticketStatus: event.ticketStatus,
    ticketPhases: event.ticketPhases,
  });
  const canonical = projectCanonicalEventFields({
    title: event.title,
    description: event.description ?? '',
    venue: event.venueName ?? '',
    city: event.venueCity ?? '',
    artists: [],
    priceText: canonicalTicket.priceText ?? event.priceText,
    source: event.sourceId ?? 'supabase',
    ticketUrl: canonicalTicket.publicCtaUrl ?? event.ticketUrl,
    ticketPlatform: canonicalTicket.ticketPlatform,
    ticketDestinationClass: canonicalTicket.destinationClass,
    ticketStatus: canonicalTicket.ticketStatus ?? event.ticketStatus,
    ticketPhases: event.ticketPhases?.map((phase) => ({
      soldOut: phase.soldOut,
      available: phase.available,
      label: phase.name,
    })),
    imageUrl: event.imageUrl,
  });
  const ticketBadge = mapCanonicalAvailabilityToTicketBadge(
    canonicalTicket.availability,
    canonicalTicket.ticketStatus,
  );
  return { canonicalTicket, canonical, ticketBadge };
}

function loadGateC1Price(eventId: string): string | undefined {
  if (!existsSync(GATE_C1_BACKUP)) {
    return undefined;
  }
  const backup = JSON.parse(readFileSync(GATE_C1_BACKUP, 'utf8')) as {
    events: Array<{ id: string; priceText?: string }>;
  };
  return backup.events.find((row) => row.id === eventId)?.priceText;
}

async function auditPalmaAvailability(): Promise<void> {
  const events = await loadPublishedEvents();
  const listHtml = await fetchHtml('https://bootshaus.ticket.io/');
  const audits = [];

  for (const eventId of PALMA_SHOP_ROOT_IDS) {
    const event = events.find((row) => row.id === eventId);
    if (!event) {
      audits.push({ eventId, missing: true });
      continue;
    }
    const shopSlug = extractTicketIoShopSlug(event.ticketUrl ?? '');
    const discovery = discoverTicketIoPriceEvidence({
      shopSlug: shopSlug ?? 'bootshaus',
      listUrl: 'https://bootshaus.ticket.io/',
      listHtml,
      eventUrl: event.ticketUrl,
    });
    const audit = auditTicketIoShopAvailabilityEvidence({
      eventId: event.id,
      title: event.title,
      ticketUrl: event.ticketUrl ?? '',
      listHtml,
      venueName: event.venueName,
      startAt: event.startAt,
      discovery,
    });
    audits.push({
      ...audit,
      currentTicketStatus: event.ticketStatus,
      canonicalAvailability: readCanonicalTicket({
        ticketUrl: event.ticketUrl,
        websiteUrl: event.websiteUrl,
        ticketStatus: event.ticketStatus,
        ticketPhases: event.ticketPhases,
      }).availability,
      plannedRevert: audit.eventSpecific
        ? null
        : {
            ticket_status: null,
            reason: 'shop_level_signal_not_event_specific',
            review_required: true,
          },
    });
  }

  writeJson('_phase4742_palma_availability_correction.json', {
    generatedAt: new Date().toISOString(),
    shopUrl: 'https://bootshaus.ticket.io/',
    count: audits.length,
    eventSpecificCount: audits.filter((row) => 'eventSpecific' in row && row.eventSpecific).length,
    revertCandidates: audits.filter((row) => 'eventSpecific' in row && !row.eventSpecific).length,
    events: audits,
  });
}

async function fetchTicketKingsAdmission(event: AdminEventRecord) {
  const ticketUrl = event.ticketUrl ?? '';
  const detailHtml = await fetchHtml(ticketUrl);
  const embed = extractTicketKingsCheckoutEmbedEvidence(detailHtml);
  const checkout =
    (await enrichTicketKingsDetailFromPublicCheckout(detailHtml, fetchHtml)) ??
    parseTicketKingsCheckoutHtml(detailHtml);

  const products = [...checkout.products, ...checkout.excludedProducts].map((product) => ({
    rawProductName: product.rawProductName,
    sectionHeading: product.sectionHeading,
    rawPhaseName: product.rawPhaseName,
    price: product.priceAmount,
    currency: product.priceCurrency,
    classification: product.classification,
    admissionOrAddOn: product.classification === 'admission_ticket' ? 'admission' : 'add_on',
    availability: product.availabilityText,
    remainingQuantity: product.remainingQuantity,
    includedInCanonicalSummary: product.includedInEventSummary,
    exclusionReason: product.exclusionReason,
    structuralSignals: product.structuralSignals,
  }));

  const gateC1Price = loadGateC1Price(event.id);
  const priceChangedSinceGateC1 =
    gateC1Price && checkout.priceText && gateC1Price !== checkout.priceText
      ? { gateC1Price, freshPrice: checkout.priceText }
      : undefined;

  return {
    eventId: event.id,
    title: event.title,
    ticketUrl,
    checkoutUrl: checkout.checkoutUrl ?? embed.checkoutUrl,
    nativeEventId: embed.nativeEventId,
    currentPriceText: event.priceText,
    freshAdmissionPriceText: checkout.priceText,
    freshMinimumPrice: checkout.priceAmount,
    freshMaximumPrice: checkout.maximumPrice,
    currency: checkout.priceCurrency ?? 'EUR',
    availability: checkout.availability,
    ticketStatus: checkout.soldOut ? 'sold_out' : checkout.availability === 'available' ? 'on_sale' : undefined,
    admissionReleases: checkout.releases,
    products,
    excludedCount: checkout.excludedProducts.length,
    priceChangedSinceGateC1,
    priceSupportedByFreshEvidence: Boolean(checkout.priceText) && checkout.releases.length > 0,
    needsPriceRepair:
      Boolean(checkout.priceText) &&
      event.priceText !== checkout.priceText &&
      checkout.releases.length > 0 &&
      !checkout.reviewRequired,
  };
}

async function auditTicketKingsAdmission(): Promise<void> {
  const events = (await loadPublishedEvents()).filter(isTicketKingsEvent);
  const reports = [];
  for (const event of events) {
    try {
      reports.push(await fetchTicketKingsAdmission(event));
    } catch (error) {
      reports.push({
        eventId: event.id,
        title: event.title,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  writeJson('_phase4742_ticketkings_admission_audit.json', {
    generatedAt: new Date().toISOString(),
    publishedTicketKingsCount: events.length,
    reports,
  });
}

async function auditTicketKingsUrls(): Promise<void> {
  const events = (await loadPublishedEvents()).filter(isTicketKingsEvent);
  const reports = [];

  for (const event of events) {
    const canonical = readCanonicalTicket({
      ticketUrl: event.ticketUrl,
      websiteUrl: event.websiteUrl,
      priceText: event.priceText,
      ticketStatus: event.ticketStatus,
      ticketPhases: event.ticketPhases,
    });
    const consumer = projectConsumer(event);

    let detailHtml = '';
    let embedEvidence = extractTicketKingsCheckoutEmbedEvidence('');
    try {
      detailHtml = await fetchHtml(event.ticketUrl ?? '');
      embedEvidence = extractTicketKingsCheckoutEmbedEvidence(detailHtml);
    } catch (error) {
      reports.push({
        eventId: event.id,
        title: event.title,
        error: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

    const persistedUrls = [
      { field: 'ticketUrl', url: event.ticketUrl },
      { field: 'websiteUrl', url: event.websiteUrl },
      ...(event.ticketPhases ?? []).map((phase, index) => ({
        field: `ticketPhases[${index}].purchaseUrl`,
        url: phase.purchaseUrl,
      })),
    ].filter((row) => row.url?.trim());

    const urlValidations = [];
    for (const row of persistedUrls) {
      const structural = classifyPersistedNachtManagerUrl(row.url);
      const validation =
        row.url && /nacht-manager\.de/i.test(row.url)
          ? await validateNachtManagerCheckoutUrl(row.url, fetchHtmlWithStatus)
          : {
              url: row.url ?? '',
              classification: structural,
              eventNotFound: false,
              preservedQueryParameters: [],
              missingQueryParameters: [],
            };
      urlValidations.push({ ...row, ...validation });
    }

    const officialFallback = resolveTicketKingsOfficialFallbackUrl(event.ticketUrl, event.websiteUrl);
    const brokenPhaseUrls = urlValidations.filter(
      (row) =>
        row.field.startsWith('ticketPhases') && isBrokenTicketKingsCheckoutClass(row.classification),
    );
    const proposedCorrection =
      brokenPhaseUrls.length > 0 && officialFallback
        ? { ticketUrl: officialFallback, reason: 'official_ticket_kings_event_page_fallback' }
        : undefined;

    reports.push({
      eventId: event.id,
      title: event.title,
      persistedPurchaseUrl: canonical.purchaseUrl,
      publicCtaUrl: canonical.publicCtaUrl,
      officialTicketKingsEventUrl: event.ticketUrl,
      websiteUrl: event.websiteUrl,
      discoveredCheckoutUrl: embedEvidence.checkoutUrl,
      requiredEventIdentifier: embedEvidence.nativeEventId,
      embedParams: embedEvidence.embedParams,
      iframeSrcs: embedEvidence.iframeSrcs,
      persistedUrlAudits: urlValidations,
      freshCtaClassification: classifyPersistedNachtManagerUrl(canonical.publicCtaUrl),
      consumerCtaUrl: consumer.canonical.ticketUrl,
      consumerPriceText: consumer.canonical.displayPriceText,
      consumerBadge: consumer.ticketBadge,
      proposedCorrection,
    });
  }

  writeJson('_phase4742_ticketkings_url_integrity.json', {
    generatedAt: new Date().toISOString(),
    audited: reports.length,
    validCheckoutDestinations: reports.filter((row) =>
      row.persistedUrlAudits?.some(
        (audit: { classification: TicketKingsCheckoutUrlClass }) =>
          audit.classification === 'valid_event_checkout' ||
          audit.classification === 'valid_embedded_checkout',
      ),
    ).length,
    brokenCheckoutDestinations: reports.filter((row) =>
      row.persistedUrlAudits?.some((audit: { classification: TicketKingsCheckoutUrlClass }) =>
        isBrokenTicketKingsCheckoutClass(audit.classification),
      ),
    ).length,
    reports,
  });
}

async function auditEndToEndTraces(): Promise<void> {
  const events = (await loadPublishedEvents()).filter(isTicketKingsEvent);
  const traces = [];

  for (const event of events) {
    const stages: Array<{ stage: string; status: 'ok' | 'mismatch' | 'failure'; detail?: unknown }> = [];
    let firstFailureStage: string | undefined;

    const mark = (stage: string, status: 'ok' | 'mismatch' | 'failure', detail?: unknown) => {
      stages.push({ stage, status, detail });
      if (!firstFailureStage && status !== 'ok') {
        firstFailureStage = stage;
      }
    };

    try {
      const detailHtml = await fetchHtml(event.ticketUrl ?? '');
      const embed = extractTicketKingsCheckoutEmbedEvidence(detailHtml);
      mark('official_ticket_kings_event_page', 'ok', { url: event.ticketUrl });

      if (embed.checkoutUrl) {
        mark('discovered_checkout_embed', 'ok', embed);
      } else {
        mark('discovered_checkout_embed', 'failure', { reason: 'iframe_not_found' });
      }

      const checkoutValidation = embed.checkoutUrl
        ? await validateNachtManagerCheckoutUrl(embed.checkoutUrl, fetchHtmlWithStatus)
        : undefined;
      if (checkoutValidation) {
        mark(
          'fresh_checkout_validation',
          checkoutValidation.eventNotFound ? 'failure' : 'ok',
          checkoutValidation,
        );
      }

      const admission = await fetchTicketKingsAdmission(event);
      mark('admission_product_extraction', admission.freshAdmissionPriceText ? 'ok' : 'mismatch', {
        priceText: admission.freshAdmissionPriceText,
        products: admission.products.length,
      });

      const canonical = readCanonicalTicket({
        ticketUrl: event.ticketUrl,
        websiteUrl: event.websiteUrl,
        priceText: event.priceText,
        ticketStatus: event.ticketStatus,
        ticketPhases: event.ticketPhases,
      });
      mark('canonical_ticket_reader', 'ok', {
        priceText: canonical.priceText,
        availability: canonical.availability,
        publicCtaUrl: canonical.publicCtaUrl,
      });

      const consumer = projectConsumer(event);
      const priceAligned =
        !admission.freshAdmissionPriceText ||
        consumer.canonical.displayPriceText?.includes(
          admission.freshMinimumPrice?.toFixed(2).replace('.', ',') ?? '___',
        ) ||
        consumer.canonical.displayPriceText === admission.freshAdmissionPriceText?.replace(/^ab\s+/, '');
      mark('api_mobile_projection', priceAligned ? 'ok' : 'mismatch', {
        displayPriceText: consumer.canonical.displayPriceText,
        ticketBadge: consumer.ticketBadge,
        ctaUrl: consumer.canonical.ticketUrl,
      });

      if (canonical.publicCtaUrl) {
        const ctaClass = classifyPersistedNachtManagerUrl(canonical.publicCtaUrl);
        const ctaValid =
          ctaClass === 'valid_event_checkout' ||
          ctaClass === 'valid_embedded_checkout' ||
          /ticketkings\.de\/event\//i.test(canonical.publicCtaUrl);
        mark('rendered_cta_destination', ctaValid ? 'ok' : 'mismatch', {
          url: canonical.publicCtaUrl,
          classification: ctaClass,
        });
      }
    } catch (error) {
      mark('trace_error', 'failure', { message: error instanceof Error ? error.message : String(error) });
    }

    traces.push({
      eventId: event.id,
      title: event.title,
      firstFailureStage,
      stages,
    });
  }

  writeJson('_phase4742_ticketkings_end_to_end_traces.json', {
    generatedAt: new Date().toISOString(),
    traces,
  });
}

async function runAudit(): Promise<void> {
  await auditPalmaAvailability();
  await auditTicketKingsAdmission();
  await auditTicketKingsUrls();
  await auditEndToEndTraces();
  const events = await loadPublishedEvents();
  beforeSnapshot = {
    generatedAt: new Date().toISOString(),
    palmaOnSale: events.filter((event) => PALMA_SHOP_ROOT_IDS.includes(event.id as (typeof PALMA_SHOP_ROOT_IDS)[number]))
      .filter((event) => event.ticketStatus === 'on_sale').length,
    ticketKingsCount: events.filter(isTicketKingsEvent).length,
  };
  writeJson('_phase4742_closure_before_after.json', { before: beforeSnapshot });
}

async function runBackup(): Promise<void> {
  const events = await loadPublishedEvents();
  const targetIds = new Set<string>([...PALMA_SHOP_ROOT_IDS]);
  for (const event of events.filter(isTicketKingsEvent)) {
    targetIds.add(event.id);
  }

  const backup = [];
  for (const event of events.filter((row) => targetIds.has(row.id))) {
    backup.push({
      eventId: event.id,
      title: event.title,
      ticketUrl: event.ticketUrl,
      websiteUrl: event.websiteUrl,
      priceText: event.priceText,
      ticketStatus: event.ticketStatus,
      ticketPhases: event.ticketPhases,
      lineupFingerprint: await lineupFingerprint(event.id),
      forbiddenFingerprint: forbiddenFingerprint(event, await lineupFingerprint(event.id)),
    });
  }

  writeJson('_phase4742_closure_repair_backup.json', {
    generatedAt: new Date().toISOString(),
    events: backup,
  });
}

function loadPlannedMutations(): Array<Record<string, unknown>> {
  const palma = existsSync(join(OUT, '_phase4742_palma_availability_correction.json'))
    ? (JSON.parse(readFileSync(join(OUT, '_phase4742_palma_availability_correction.json'), 'utf8')) as {
        events: Array<{ eventId: string; plannedRevert: unknown }>;
      }).events
        .filter((row) => row.plannedRevert)
        .map((row) => ({ eventId: row.eventId, domain: 'palma_availability', patch: row.plannedRevert }))
    : [];

  const admission = existsSync(join(OUT, '_phase4742_ticketkings_admission_audit.json'))
    ? (JSON.parse(readFileSync(join(OUT, '_phase4742_ticketkings_admission_audit.json'), 'utf8')) as {
        reports: Array<{ eventId: string; needsPriceRepair?: boolean; freshAdmissionPriceText?: string }>;
      }).reports
        .filter((row) => row.needsPriceRepair)
        .map((row) => ({
          eventId: row.eventId,
          domain: 'ticket_kings_admission',
          patch: { priceText: row.freshAdmissionPriceText },
        }))
    : [];

  return [...palma, ...admission];
}

async function runPreflight(): Promise<void> {
  const planned = loadPlannedMutations();
  writeJson('_phase4742_closure_preflight.json', {
    generatedAt: new Date().toISOString(),
    plannedMutations: planned,
    mutationCount: planned.length,
  });
  console.log(`Preflight: ${planned.length} planned mutations`);
}

async function persistTicketProvenance(
  event: AdminEventRecord,
  patches: Array<{ field: string; value: unknown; reason: string }>,
): Promise<void> {
  const now = new Date().toISOString();
  const rows = patches.map((patch) => ({
    id: `provenance-${event.id}-${patch.field}`,
    canonical_event_id: event.id,
    field_path: patch.field,
    selected_value: patch.value,
    selected_source_id: event.sourceId,
    selected_at: now,
    selection_reason: patch.reason,
    alternatives: [],
    manually_overridden: false,
    updated_at: now,
  }));
  if (rows.length === 0) {
    return;
  }
  const { error } = await opsClient().from('event_field_provenance').upsert(rows as never, {
    onConflict: 'canonical_event_id,field_path',
  });
  if (error) {
    throw new Error(error.message);
  }
}

async function repairPalmaAvailability(): Promise<number> {
  const events = await loadPublishedEvents();
  const listHtml = await fetchHtml('https://bootshaus.ticket.io/');
  let mutations = 0;

  for (const eventId of PALMA_SHOP_ROOT_IDS) {
    const event = events.find((row) => row.id === eventId);
    if (!event) {
      continue;
    }
    const audit = auditTicketIoShopAvailabilityEvidence({
      eventId: event.id,
      title: event.title,
      ticketUrl: event.ticketUrl ?? '',
      listHtml,
      venueName: event.venueName,
      startAt: event.startAt,
    });
    if (audit.eventSpecific) {
      continue;
    }
    if (!event.ticketStatus) {
      continue;
    }

    const beforeLineup = await lineupFingerprint(event.id);
    const beforeForbidden = forbiddenFingerprint(event, beforeLineup);

    const { error } = await opsClient()
      .from('events')
      .update({ ticket_status: null, updated_at: new Date().toISOString() } as never)
      .eq('id', event.id);
    if (error) {
      throw new Error(error.message);
    }
    mutations += 1;

    await persistTicketProvenance(event, [
      {
        field: 'ticketStatus',
        value: null,
        reason: 'shop_level_signal_not_event_specific',
      },
    ]);

    const afterRow = (await opsClient().from('events').select('*').eq('id', event.id).single()).data as EventRow;
    const afterEvent = mapEventRowToAdminRecord(afterRow);
    const afterForbidden = forbiddenFingerprint(afterEvent, await lineupFingerprint(event.id));
    if (JSON.stringify(beforeForbidden) !== JSON.stringify(afterForbidden)) {
      throw new Error(`Forbidden domain mutation on Palma revert: ${eventId}`);
    }
  }

  return mutations;
}

function shouldReplaceCorruptPhases(
  event: AdminEventRecord,
  evidence: NonNullable<Awaited<ReturnType<typeof enrichTicketKingsDetailFromPublicCheckout>>>,
): boolean {
  const dbAmount = event.ticketPhases?.[0]?.priceAmount ?? Number.parseFloat(event.priceText?.replace(/[^\d,]/g, '').replace(',', '.') ?? '');
  if (!Number.isFinite(dbAmount) || evidence.priceAmount === undefined) {
    return false;
  }
  if (Math.abs(dbAmount - evidence.priceAmount) < 0.01) {
    return false;
  }
  return evidence.excludedProducts.some(
    (product) => product.priceAmount !== undefined && Math.abs(product.priceAmount - dbAmount) < 0.01,
  );
}

async function repairTicketKingsAdmission(): Promise<number> {
  const events = (await loadPublishedEvents()).filter(isTicketKingsEvent);
  let mutations = 0;

  for (const event of events) {
    const detailHtml = await fetchHtml(event.ticketUrl ?? '');
    const evidence =
      (await enrichTicketKingsDetailFromPublicCheckout(detailHtml, fetchHtml)) ??
      parseTicketKingsCheckoutHtml(detailHtml);
    if (!evidence.priceText || evidence.reviewRequired || evidence.releases.length === 0) {
      continue;
    }

    const candidate: CanonicalImportEvent = {
      ticketUrl: event.ticketUrl,
      eventUrl: event.ticketUrl,
      priceText: evidence.priceText,
      priceAmount: evidence.priceAmount,
      sourceMetadata: {
        platform: 'ticket_king',
        evidenceSource: 'phase4742_closure_admission_refresh',
        ticketOffers: evidence.releases.map((release) => ({
          name: release.name,
          priceAmount: release.priceAmount,
          priceCurrency: release.priceCurrency ?? 'EUR',
          priceText: release.priceText,
          soldOut: release.soldOut ?? false,
          purchaseUrl: release.purchaseUrl ?? evidence.checkoutUrl,
        })),
        soldOut: evidence.soldOut,
        excludedProducts: evidence.excludedProducts,
      },
    };

    const existingForWrite = shouldReplaceCorruptPhases(event, evidence)
      ? { ...event, ticketPhases: [], priceText: undefined }
      : event;
    const write = writeCanonicalTicketFields({
      existing: existingForWrite,
      candidate,
      fillOnly: false,
      manualLocks: URL_LOCKS,
    });
    const allowed = write.fieldChanges.filter(
      (field) => field === 'priceText' || field === 'ticketPhases' || field === 'ticketStatus',
    );
    if (allowed.length === 0) {
      continue;
    }

    const beforeForbidden = forbiddenFingerprint(event, await lineupFingerprint(event.id));
    const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (allowed.includes('priceText') && write.patch.priceText !== undefined) {
      dbPatch.price_text = write.patch.priceText;
    }
    if (allowed.includes('ticketPhases') && write.patch.ticketPhases !== undefined) {
      dbPatch.ticket_phases = write.patch.ticketPhases;
    }
    if (allowed.includes('ticketStatus') && write.patch.ticketStatus !== undefined) {
      dbPatch.ticket_status = write.patch.ticketStatus;
    }

    const { error } = await opsClient().from('events').update(dbPatch).eq('id', event.id);
    if (error) {
      throw new Error(error.message);
    }
    mutations += allowed.length;

    await persistTicketProvenance(event, [
      {
        field: 'priceText',
        value: write.patch.priceText,
        reason: 'phase4742_closure_admission_refresh',
      },
      {
        field: 'ticketStatus',
        value: write.patch.ticketStatus,
        reason: 'phase4742_closure_admission_refresh',
      },
    ]);

    const afterRow = (await opsClient().from('events').select('*').eq('id', event.id).single()).data as EventRow;
    const afterForbidden = forbiddenFingerprint(mapEventRowToAdminRecord(afterRow), await lineupFingerprint(event.id));
    if (JSON.stringify(beforeForbidden) !== JSON.stringify(afterForbidden)) {
      throw new Error(`Forbidden domain mutation on Ticket Kings admission repair: ${event.id}`);
    }
  }

  return mutations;
}

async function runRepair(pass: number): Promise<RepairRun> {
  const run: RepairRun = {
    pass,
    generatedAt: new Date().toISOString(),
    mutations: 0,
    events: [],
  };

  const palmaMutations = await repairPalmaAvailability();
  const admissionMutations = await repairTicketKingsAdmission();
  run.mutations = palmaMutations + admissionMutations;
  run.events.push({ palmaMutations, admissionMutations });

  await invalidateConsumerEventCaches();
  appendRepairRun(run);
  return run;
}

function appendRepairRun(run: RepairRun): void {
  const path = join(OUT, '_phase4742_closure_repair_runs.json');
  const existing = existsSync(path)
    ? (JSON.parse(readFileSync(path, 'utf8')) as { runs: RepairRun[] }).runs
    : [];
  existing.push(run);
  writeJson('_phase4742_closure_repair_runs.json', { runs: existing });
}

async function runVerify(): Promise<void> {
  const events = await loadPublishedEvents();
  const palma = events.filter((event) => PALMA_SHOP_ROOT_IDS.includes(event.id as (typeof PALMA_SHOP_ROOT_IDS)[number]));
  const ticketKings = events.filter(isTicketKingsEvent);
  const consumerIssues: Array<{ eventId: string; issue: string }> = [];

  for (const event of [...palma, ...ticketKings]) {
    const consumer = projectConsumer(event);
    if (consumer.canonicalTicket.priceText && !consumer.canonical.displayPriceText) {
      consumerIssues.push({ eventId: event.id, issue: 'price_not_projected' });
    }
    const cta = consumer.canonical.ticketUrl ?? '';
    if (/nacht-manager\.de\/ticketing\/native_event\.php\/?$/i.test(cta)) {
      consumerIssues.push({ eventId: event.id, issue: 'bare_native_event_cta' });
    }
  }

  writeJson('_phase4742_closure_before_after.json', {
    before: beforeSnapshot,
    after: {
      generatedAt: new Date().toISOString(),
      palmaOnSale: palma.filter((event) => event.ticketStatus === 'on_sale').length,
      palmaUnknown: palma.filter((event) => !event.ticketStatus).length,
      ticketKingsCount: ticketKings.length,
      consumerIssues,
    },
  });
}

async function runReport(): Promise<void> {
  const palma = existsSync(join(OUT, '_phase4742_palma_availability_correction.json'))
    ? JSON.parse(readFileSync(join(OUT, '_phase4742_palma_availability_correction.json'), 'utf8'))
    : null;
  const admission = existsSync(join(OUT, '_phase4742_ticketkings_admission_audit.json'))
    ? JSON.parse(readFileSync(join(OUT, '_phase4742_ticketkings_admission_audit.json'), 'utf8'))
    : null;
  const urls = existsSync(join(OUT, '_phase4742_ticketkings_url_integrity.json'))
    ? JSON.parse(readFileSync(join(OUT, '_phase4742_ticketkings_url_integrity.json'), 'utf8'))
    : null;
  const runs = existsSync(join(OUT, '_phase4742_closure_repair_runs.json'))
    ? JSON.parse(readFileSync(join(OUT, '_phase4742_closure_repair_runs.json'), 'utf8'))
    : { runs: [] };
  const beforeAfter = existsSync(join(OUT, '_phase4742_closure_before_after.json'))
    ? JSON.parse(readFileSync(join(OUT, '_phase4742_closure_before_after.json'), 'utf8'))
    : null;

  const lines = [
    '# Phase 4.7.4.2 — Closure Correction Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Palma/JUNO shop-root availability',
    '',
    `- Audited: **${palma?.count ?? 'n/a'}**`,
    `- Revert candidates: **${palma?.revertCandidates ?? 'n/a'}**`,
    '',
    '## Ticket Kings admission refresh',
    '',
    `- Published Ticket Kings events: **${admission?.publishedTicketKingsCount ?? 'n/a'}**`,
    '',
    '## Ticket Kings URL integrity',
    '',
    `- Audited destinations: **${urls?.audited ?? 'n/a'}**`,
    `- Valid checkout/embed: **${urls?.validCheckoutDestinations ?? 'n/a'}**`,
    `- Broken destinations: **${urls?.brokenCheckoutDestinations ?? 'n/a'}**`,
    '',
    '## Repair runs',
    '',
    ...runs.runs.map(
      (run: RepairRun) =>
        `- Pass ${run.pass}: **${run.mutations}** mutations at ${run.generatedAt}`,
    ),
    '',
    '## Before / after',
    '',
    '```json',
    JSON.stringify(beforeAfter, null, 2),
    '```',
    '',
    '## Artifacts',
    '',
    '- `docs/real-data/_phase4742_palma_availability_correction.json`',
    '- `docs/real-data/_phase4742_ticketkings_admission_audit.json`',
    '- `docs/real-data/_phase4742_ticketkings_url_integrity.json`',
    '- `docs/real-data/_phase4742_ticketkings_end_to_end_traces.json`',
    '- `docs/real-data/_phase4742_closure_repair_backup.json`',
    '- `docs/real-data/_phase4742_closure_repair_runs.json`',
    '- `docs/real-data/_phase4742_closure_before_after.json`',
  ];

  writeFileSync(REPORT, lines.join('\n'));
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  switch (command) {
    case 'audit-palma':
      await auditPalmaAvailability();
      break;
    case 'audit-admission':
      await auditTicketKingsAdmission();
      break;
    case 'audit-urls':
      await auditTicketKingsUrls();
      break;
    case 'audit-e2e':
      await auditEndToEndTraces();
      break;
    case 'audit':
      await runAudit();
      break;
    case 'backup':
      await runBackup();
      break;
    case 'preflight':
      await runPreflight();
      break;
    case 'repair': {
      const passArg = args.find((arg) => arg.startsWith('--pass='));
      const pass = passArg ? Number.parseInt(passArg.split('=')[1] ?? '1', 10) : 1;
      const run = await runRepair(pass);
      console.log(`Repair pass ${pass}: ${run.mutations} mutations`);
      break;
    }
    case 'verify':
      await runVerify();
      break;
    case 'report':
      await runReport();
      break;
    case 'full':
      await runAudit();
      await runBackup();
      await runPreflight();
      await runRepair(1);
      await runVerify();
      await runRepair(2);
      await runVerify();
      await runReport();
      break;
    default:
      console.error(
        'Usage: audit-palma | audit-admission | audit-urls | audit-e2e | audit | backup | preflight | repair [--pass=1] | verify | report | full',
      );
      process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
