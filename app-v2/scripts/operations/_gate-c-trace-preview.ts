/**
 * Gate C preview — trace ticket price/availability through pipeline stages (read-only).
 */
import './bootstrap-ops-supabase';

import { mapEventRowToAdminRecord } from '@/data/mappers/event-mapper';
import type { EventRow } from '@/data/mappers/event-mapper';
import type { AdminEventRecord } from '@/data/types/records';
import { parseTicketKingsEventDetailHtml } from '@/features/aggregation/connectors/ticket-platform/adapters/ticket-kings-adapter';
import {
  extractNativeEventCheckoutUrl,
  parseTicketKingsCheckoutHtml,
} from '@/features/aggregation/connectors/ticket-platform/ticket-kings-public-checkout';
import { toNormalizedTicketFields } from '@/features/aggregation/connectors/ticket-platform/normalize-ticket-event';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import { readCanonicalTicket } from '@/features/events/domain/canonical-ticket-read';
import { writeCanonicalTicketFields } from '@/features/events/domain/canonical-ticket-writer';
import { classifyTicketPriceFailure } from '@/features/events/domain/ticket-price-failure-classification';
import {
  deriveSummaryPriceTextFromPhases,
  normalizeTicketOffersFromCandidate,
} from '@/features/import/domain/canonical-ticket-phase';
import { buildImportPublishFieldPatch } from '@/features/import/services/import-event-field-mapper';
import { opsClient } from './ops-supabase-rows';

const REPRESENTATIVE = [
  /sommerfest.*elektroküche/i,
  /^mdma/i,
  /ship vol\. iii/i,
  /presents levi/i,
  /bc173.*let's get loco|pres\. bc173/i,
  /blacklist festival/i,
];

async function fetchHtml(url: string): Promise<string> {
  const r = await fetch(url, {
    headers: { 'User-Agent': 'EternalRave-SourceBot/1.0 (+https://eternalrave.app)' },
  });
  return r.text();
}

function asCandidate(payload: Record<string, unknown>): CanonicalImportEvent {
  return payload as unknown as CanonicalImportEvent;
}

async function traceEvent(event: AdminEventRecord) {
  const c = opsClient();
  const { data: imports } = await c
    .from('import_records')
    .select('normalized_payload, source_id')
    .eq('resulting_event_id', event.id)
    .limit(5);

  const payload = (imports?.[0]?.normalized_payload ?? {}) as Record<string, unknown>;
  const metadata = (payload.sourceMetadata ?? {}) as Record<string, unknown>;
  const candidate = asCandidate(payload);

  let connectorOutput: Record<string, unknown> = {};
  const ticketUrl = event.ticketUrl ?? '';
  if (/ticketkings\.de/i.test(ticketUrl)) {
    try {
      const html = await fetchHtml(ticketUrl);
      const checkoutUrl = extractNativeEventCheckoutUrl(html);
      const checkoutHtml = checkoutUrl ? await fetchHtml(checkoutUrl).catch(() => undefined) : undefined;
      const parsed = parseTicketKingsEventDetailHtml(html, {
        platform: 'ticket_king',
        shopSlug: 'ticketkings',
        listUrl: 'https://ticketkings.de/all-events/',
        timezone: 'Europe/Berlin',
      });
      const checkout = parseTicketKingsCheckoutHtml(checkoutHtml ?? html);
      connectorOutput = {
        priceAmount: parsed?.priceAmount ?? checkout.priceAmount,
        priceText: parsed?.priceText ?? checkout.priceText,
        ticketOffers: checkout.releases,
        soldOut: checkout.soldOut,
      };
    } catch (e) {
      connectorOutput = { error: String(e) };
    }
  } else {
    connectorOutput = {
      priceText: payload.priceText,
      priceAmount: payload.priceAmount,
      ticketOffers: metadata.ticketOffers,
      soldOut: metadata.soldOut,
      availability: metadata.availability,
    };
  }

  const normalized = toNormalizedTicketFields({
    externalId: String(payload.externalId ?? event.id),
    title: event.title,
    startDate: event.startDate,
    timezone: event.timezone,
    ticketUrl: ticketUrl,
    eventUrl: ticketUrl,
    priceAmount: connectorOutput.priceAmount as number | undefined,
    priceText: connectorOutput.priceText as string | undefined,
    ticketOffers: connectorOutput.ticketOffers as CanonicalImportEvent['sourceMetadata'],
    platform: /ticketkings/i.test(ticketUrl) ? 'ticket_king' : 'ticket_io',
    shopSlug: 'trace',
  } as never);

  const liveCandidate: CanonicalImportEvent = {
    ...candidate,
    ticketUrl,
    priceText: connectorOutput.priceText as string | undefined,
    priceAmount: connectorOutput.priceAmount as number | undefined,
    sourceMetadata: {
      ...metadata,
      ticketOffers: connectorOutput.ticketOffers,
      soldOut: connectorOutput.soldOut,
      availability: metadata.availability,
    },
  };

  const normalizedPhases = normalizeTicketOffersFromCandidate(liveCandidate);
  const normalizedPriceText =
    deriveSummaryPriceTextFromPhases(normalizedPhases) ?? liveCandidate.priceText;

  const writerInput = writeCanonicalTicketFields({
    existing: event,
    candidate: liveCandidate,
    fillOnly: false,
  });

  const canonicalRead = readCanonicalTicket({
    ticketUrl: event.ticketUrl,
    websiteUrl: event.websiteUrl,
    priceText: event.priceText,
    ticketStatus: event.ticketStatus,
    ticketPhases: event.ticketPhases,
  });

  const importPatch = buildImportPublishFieldPatch(liveCandidate, { existing: event, fillOnly: false });

  const fields = [
    'priceText',
    'minimumPrice',
    'maximumPrice',
    'currency',
    'availability',
    'ticketStatus',
    'ticketPhases',
  ] as const;

  const trace: Record<string, unknown> = {
    eventId: event.id,
    title: event.title,
    ticketUrl,
    stages: {} as Record<string, unknown>,
    firstFailures: {} as Record<string, string>,
  };

  for (const field of fields) {
    const stages: Record<string, unknown> = {
      source_connector: field === 'priceText' ? connectorOutput.priceText : connectorOutput,
      import_payload: {
        priceText: payload.priceText,
        priceAmount: payload.priceAmount,
        ticketOffers: metadata.ticketOffers,
      },
      normalized_phases: normalizedPhases,
      normalized_priceText: normalizedPriceText,
      writer_patch: writerInput.patch,
      persisted_db: {
        priceText: event.priceText,
        ticketStatus: event.ticketStatus,
        ticketPhases: event.ticketPhases,
      },
      canonical_read: {
        priceText: canonicalRead.priceText,
        minimumPrice: canonicalRead.minimumPrice,
        maximumPrice: canonicalRead.maximumPrice,
        currency: canonicalRead.currency,
        availability: canonicalRead.availability,
        ticketStatus: canonicalRead.ticketStatus,
        ticketPhases: canonicalRead.ticketPhases,
      },
      import_publish_patch: {
        priceText: importPatch.priceText,
        ticketStatus: importPatch.ticketStatus,
        ticketPhases: importPatch.ticketPhases,
      },
    };

    if (field === 'priceText') {
      const chain = [
        ['source_connector', connectorOutput.priceText],
        ['import_payload', payload.priceText],
        ['normalized', normalizedPriceText],
        ['writer_patch', writerInput.patch.priceText],
        ['persisted_db', event.priceText],
        ['canonical_read', canonicalRead.priceText],
        ['import_publish_patch', importPatch.priceText],
      ] as const;
      let prev = chain[0][1];
      for (let i = 1; i < chain.length; i++) {
        const [stage, val] = chain[i];
        if (prev && !val && stage === 'import_payload') {
          trace.firstFailures[field] = 'PRICE_LOST_BEFORE_IMPORT_PAYLOAD (never imported)';
          break;
        }
        if (prev && !val) {
          trace.firstFailures[field] = `LOST_AT_${stage}`;
          break;
        }
        if (val) prev = val;
      }
      if (!connectorOutput.priceText && !payload.priceText && !event.priceText) {
        trace.firstFailures[field] = 'PUBLIC_PRICE_NOT_EXTRACTED_AT_SOURCE';
      } else if (connectorOutput.priceText && !payload.priceText) {
        trace.firstFailures[field] = 'PRICE_NOT_PERSISTED_IN_IMPORT_PAYLOAD';
      } else if (normalizedPriceText && !writerInput.patch.priceText && !event.priceText) {
        trace.firstFailures[field] = 'PRICE_LOST_IN_CANONICAL_WRITER';
      } else if (writerInput.patch.priceText && !event.priceText) {
        trace.firstFailures[field] = 'PRICE_NOT_PERSISTED';
      } else if (event.priceText && !canonicalRead.priceText) {
        trace.firstFailures[field] = 'PRICE_MISSING_FROM_CANONICAL_READ';
      }
    }

    (trace.stages as Record<string, unknown>)[field] = stages;
  }

  return trace;
}

async function main() {
  const c = opsClient();
  const { data } = await c.from('events').select('*').eq('status', 'published');
  const events = (data ?? [])
    .map((row) => mapEventRowToAdminRecord(row as EventRow))
    .filter((e) => REPRESENTATIVE.some((p) => p.test(e.title)));

  for (const event of events) {
    const trace = await traceEvent(event);
    console.log(JSON.stringify(trace, null, 2));
  }
}

main().catch(console.error);
