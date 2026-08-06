/**
 * Gate C1 — Global Ticket Kings admission checkout audit (read-only preview).
 *
 * Usage:
 *   npx tsx scripts/operations/_gate-c1-tk-global-admission-audit.ts
 */
import './bootstrap-ops-supabase';

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapEventRowToAdminRecord } from '@/data/mappers/event-mapper';
import type { EventRow } from '@/data/mappers/event-mapper';
import type { AdminEventRecord } from '@/data/types/records';
import {
  enrichTicketKingsDetailFromPublicCheckout,
  extractNativeEventCheckoutUrl,
  type TicketKingsCheckoutProductRecord,
  type TicketKingsPublicCheckoutEvidence,
} from '@/features/aggregation/connectors/ticket-platform/ticket-kings-public-checkout';
import { readCanonicalTicket } from '@/features/events/domain/canonical-ticket-read';
import { writeCanonicalTicketFields } from '@/features/events/domain/canonical-ticket-writer';
import { opsClient } from './ops-supabase-rows';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'docs/real-data/_gate_c1_tk_global_admission_audit.json');

const FETCH_HEADERS = {
  'User-Agent': 'EternalRave-SourceBot/1.0 (+https://eternalrave.app)',
  Accept: 'text/html,application/xhtml+xml',
};

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, { headers: FETCH_HEADERS, redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return response.text();
}

async function discoverTicketKingsEventUrls(): Promise<string[]> {
  const urls = new Set<string>();
  try {
    const html = await fetchHtml('https://ticketkings.de/all-events/');
    const pattern = /href="(https:\/\/ticketkings\.de\/event\/[^"]+)"/gi;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html)) !== null) {
      urls.add(match[1].replace(/\/$/, '') + '/');
    }
  } catch (error) {
    console.warn('Shop list fetch failed:', error);
  }

  const client = opsClient();
  const { data } = await client.from('events').select('ticket_url').eq('status', 'published');
  for (const row of data ?? []) {
    const ticketUrl = row.ticket_url as string | null;
    if (ticketUrl && /ticketkings\.de\/event\//i.test(ticketUrl)) {
      urls.add(ticketUrl);
    }
  }

  return [...urls].sort();
}

function mapDbEventByUrl(events: AdminEventRecord[]): Map<string, AdminEventRecord> {
  const map = new Map<string, AdminEventRecord>();
  for (const event of events) {
    if (event.ticketUrl) {
      map.set(event.ticketUrl.replace(/\/$/, '') + '/', event);
    }
  }
  return map;
}

function usesAddonAsCanonicalPrice(
  dbPriceText: string | undefined,
  evidence: TicketKingsPublicCheckoutEvidence,
): boolean {
  if (!dbPriceText?.trim() || evidence.releases.length === 0) {
    return false;
  }
  const dbAmount = Number.parseFloat(dbPriceText.replace(/[^\d,.-]/g, '').replace(',', '.'));
  if (!Number.isFinite(dbAmount)) {
    return false;
  }
  const admissionAmount = evidence.priceAmount;
  if (admissionAmount === undefined) {
    return false;
  }
  if (Math.abs(dbAmount - admissionAmount) < 0.01) {
    return false;
  }
  return evidence.excludedProducts.some(
    (product) =>
      product.priceAmount !== undefined && Math.abs(product.priceAmount - dbAmount) < 0.01,
  );
}

function buildPlannedMutations(
  event: AdminEventRecord | undefined,
  evidence: TicketKingsPublicCheckoutEvidence,
) {
  if (!event || evidence.reviewRequired || !evidence.priceText) {
    return { changed: false, patch: {}, fieldChanges: [] as string[] };
  }

  const candidate = {
    ticketUrl: event.ticketUrl,
    priceText: evidence.priceText,
    priceAmount: evidence.priceAmount,
    sourceMetadata: {
      platform: 'ticket_king',
      evidenceSource: 'gate_c1_admission_audit',
      ticketOffers: evidence.releases.map((release) => ({
        name: release.name,
        priceAmount: release.priceAmount,
        priceCurrency: release.priceCurrency,
        soldOut: release.soldOut,
        availability: release.availabilityText,
      })),
      soldOut: evidence.soldOut,
      excludedProducts: evidence.excludedProducts,
    },
  };

  const write = writeCanonicalTicketFields({
    existing:
      event && usesAddonAsCanonicalPrice(event.priceText, evidence)
        ? { ...event, ticketPhases: [], priceText: undefined }
        : event,
    candidate,
    fillOnly: false,
    manualLocks: new Set(['ticketUrl', 'websiteUrl']),
  });

  const allowed = write.fieldChanges.filter((field) =>
    ['priceText', 'ticketPhases', 'ticketStatus'].includes(field),
  );

  return {
    changed: allowed.length > 0,
    patch: {
      priceText: write.patch.priceText,
      ticketPhases: write.patch.ticketPhases,
      ticketStatus: write.patch.ticketStatus,
    },
    fieldChanges: allowed,
  };
}

function serializeProduct(product: TicketKingsCheckoutProductRecord) {
  return {
    rawProductName: product.rawProductName,
    rawPhaseName: product.rawPhaseName,
    rawPrice: product.rawPriceText,
    priceAmount: product.priceAmount,
    currency: product.priceCurrency,
    availabilityText: product.availabilityText,
    remainingQuantity: product.remainingQuantity,
    optionalState: product.optionalState,
    sectionHeading: product.sectionHeading,
    classification: product.classification,
    includedInEventSummary: product.includedInEventSummary,
    exclusionReason: product.exclusionReason,
    structuralSignals: product.structuralSignals,
  };
}

async function main(): Promise<void> {
  const eventUrls = await discoverTicketKingsEventUrls();
  const published = (await opsClient().from('events').select('*').eq('status', 'published')).data ?? [];
  const publishedEvents = published.map((row) => mapEventRowToAdminRecord(row as EventRow));
  const dbByUrl = mapDbEventByUrl(publishedEvents);

  const rows = [];
  let addonPriceMisclassified = 0;
  let reviewRequired = 0;
  let plannedMutationEvents = 0;

  for (const ticketUrl of eventUrls) {
    let evidence: TicketKingsPublicCheckoutEvidence | undefined;
    let fetchError: string | undefined;
    try {
      const detailHtml = await fetchHtml(ticketUrl);
      const checkoutUrl = extractNativeEventCheckoutUrl(detailHtml);
      evidence = await enrichTicketKingsDetailFromPublicCheckout(detailHtml, fetchHtml);
      if (!evidence && checkoutUrl) {
        fetchError = 'checkout_fetch_failed';
      }
    } catch (error) {
      fetchError = String(error);
    }

    const event = dbByUrl.get(ticketUrl.replace(/\/$/, '') + '/');
    const canonical = event
      ? readCanonicalTicket({
          ticketUrl: event.ticketUrl,
          websiteUrl: event.websiteUrl,
          priceText: event.priceText,
          ticketStatus: event.ticketStatus,
          ticketPhases: event.ticketPhases,
        })
      : undefined;

    const misclassified = evidence ? usesAddonAsCanonicalPrice(event?.priceText, evidence) : false;
    if (misclassified) addonPriceMisclassified++;
    if (evidence?.reviewRequired) reviewRequired++;

    const planned = evidence && event ? buildPlannedMutations(event, evidence) : { changed: false, patch: {}, fieldChanges: [] };
    if (planned.changed) plannedMutationEvents++;

    rows.push({
      eventId: event?.id,
      title: event?.title,
      ticketUrl,
      fetchError,
      checkoutUrl: evidence?.checkoutUrl,
      dbPriceText: event?.priceText,
      dbMinimumPrice: canonical?.minimumPrice,
      dbAvailability: canonical?.availability,
      dbTicketStatus: event?.ticketStatus,
      dbPhaseCount: event?.ticketPhases?.length ?? 0,
      admissionPriceText: evidence?.priceText,
      admissionMinimumPrice: evidence?.priceAmount,
      admissionMaximumPrice: evidence?.maximumPrice,
      admissionAvailability: evidence?.availability,
      admissionPhaseCount: evidence?.releases.length ?? 0,
      admissionPhases: evidence?.releases.map((release) => ({
        ticketType: release.ticketType,
        phaseName: release.phaseName,
        priceAmount: release.priceAmount,
        currency: release.priceCurrency,
        availabilityText: release.availabilityText,
        remainingQuantity: release.remainingQuantity,
        soldOut: release.soldOut,
      })),
      excludedProducts: evidence?.excludedProducts.map(serializeProduct) ?? [],
      allProducts: evidence?.products.map(serializeProduct) ?? [],
      usesAddonPriceAsCanonical: misclassified,
      reviewRequired: evidence?.reviewRequired ?? true,
      plannedMutations: planned,
    });
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    totalTicketKingsEventsAudited: rows.length,
    eventsWithDbRecord: rows.filter((row) => row.eventId).length,
    eventsUsingAddonPriceAsCanonical: addonPriceMisclassified,
    eventsRequiringReview: reviewRequired,
    eventsWithPlannedMutations: plannedMutationEvents,
    eventsWithAdmissionPrice: rows.filter((row) => row.admissionMinimumPrice !== undefined).length,
    eventsSoldOut: rows.filter((row) => row.admissionAvailability === 'sold_out').length,
    eventsAvailable: rows.filter((row) => row.admissionAvailability === 'available').length,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ summary, events: rows }, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
