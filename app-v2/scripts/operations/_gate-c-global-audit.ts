/**
 * Gate C global audit — classify first failure stage per event (read-only).
 */
import './bootstrap-ops-supabase';

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapEventRowToAdminRecord } from '@/data/mappers/event-mapper';
import type { EventRow } from '@/data/mappers/event-mapper';
import {
  extractNativeEventCheckoutUrl,
  parseTicketKingsCheckoutHtml,
} from '@/features/aggregation/connectors/ticket-platform/ticket-kings-public-checkout';
import { readCanonicalTicket } from '@/features/events/domain/canonical-ticket-read';
import { writeCanonicalTicketFields } from '@/features/events/domain/canonical-ticket-writer';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import {
  deriveSummaryPriceTextFromPhases,
  normalizeTicketOffersFromCandidate,
} from '@/features/import/domain/canonical-ticket-phase';
import { opsClient } from './ops-supabase-rows';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'docs/real-data/_phase472_gate_c_global_audit.json');

type FailureClass =
  | 'NONE'
  | 'PUBLIC_PRICE_NOT_EXTRACTED'
  | 'PRICE_NOT_IN_IMPORT_PAYLOAD'
  | 'PRICE_LOST_IN_NORMALIZATION'
  | 'PRICE_LOST_IN_CANONICAL_WRITER'
  | 'PRICE_NOT_PERSISTED'
  | 'PRICE_MISSING_FROM_CANONICAL_READ'
  | 'PRICE_MISSING_FROM_UI'
  | 'PUBLIC_PAGE_CONFIRMED_NO_PRICE';

async function fetchHtml(url: string): Promise<string> {
  const r = await fetch(url, {
    headers: { 'User-Agent': 'EternalRave-SourceBot/1.0 (+https://eternalrave.app)' },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

async function liveSourcePrice(ticketUrl: string): Promise<{
  priceText?: string;
  priceAmount?: number;
  ticketOffers?: unknown[];
  inspected: boolean;
  confirmedNoPrice: boolean;
}> {
  if (/ticketkings\.de\/event\//i.test(ticketUrl)) {
    try {
      const html = await fetchHtml(ticketUrl);
      const checkoutUrl = extractNativeEventCheckoutUrl(html);
      const checkoutHtml = checkoutUrl ? await fetchHtml(checkoutUrl).catch(() => undefined) : undefined;
      const evidence = parseTicketKingsCheckoutHtml(checkoutHtml ?? html);
      return {
        priceText: evidence.priceText,
        priceAmount: evidence.priceAmount,
        ticketOffers: evidence.releases,
        inspected: true,
        confirmedNoPrice: !evidence.priceText && evidence.priceAmount === undefined,
      };
    } catch {
      return { inspected: false, confirmedNoPrice: false };
    }
  }
  return { inspected: false, confirmedNoPrice: false };
}

function classifyPriceFailure(input: {
  hasTicketUrl: boolean;
  sourcePriceText?: string;
  importPriceText?: string;
  normalizedPriceText?: string;
  writerPriceText?: string;
  dbPriceText?: string;
  canonicalPriceText?: string;
  inspected: boolean;
  confirmedNoPrice: boolean;
}): FailureClass {
  if (!input.hasTicketUrl) return 'NONE';
  if (input.canonicalPriceText?.trim()) return 'NONE';
  if (input.confirmedNoPrice && input.inspected) return 'PUBLIC_PAGE_CONFIRMED_NO_PRICE';
  if (!input.sourcePriceText?.trim() && input.inspected) return 'PUBLIC_PRICE_NOT_EXTRACTED';
  if (!input.sourcePriceText?.trim() && !input.inspected) return 'PUBLIC_PRICE_NOT_EXTRACTED';
  if (input.sourcePriceText?.trim() && !input.importPriceText?.trim()) return 'PRICE_NOT_IN_IMPORT_PAYLOAD';
  if (input.normalizedPriceText?.trim() && !input.writerPriceText?.trim()) return 'PRICE_LOST_IN_CANONICAL_WRITER';
  if (input.writerPriceText?.trim() && !input.dbPriceText?.trim()) return 'PRICE_NOT_PERSISTED';
  if (input.dbPriceText?.trim() && !input.canonicalPriceText?.trim()) return 'PRICE_MISSING_FROM_CANONICAL_READ';
  if (input.sourcePriceText?.trim() && !input.normalizedPriceText?.trim()) return 'PRICE_LOST_IN_NORMALIZATION';
  return 'PRICE_MISSING_FROM_UI';
}

async function main() {
  const c = opsClient();
  const { data } = await c.from('events').select('*').eq('status', 'published');
  const events = (data ?? []).map((row) => mapEventRowToAdminRecord(row as EventRow));

  const rows = [];
  const counts: Record<FailureClass, number> = {
    NONE: 0,
    PUBLIC_PRICE_NOT_EXTRACTED: 0,
    PRICE_NOT_IN_IMPORT_PAYLOAD: 0,
    PRICE_LOST_IN_NORMALIZATION: 0,
    PRICE_LOST_IN_CANONICAL_WRITER: 0,
    PRICE_NOT_PERSISTED: 0,
    PRICE_MISSING_FROM_CANONICAL_READ: 0,
    PRICE_MISSING_FROM_UI: 0,
    PUBLIC_PAGE_CONFIRMED_NO_PRICE: 0,
  };

  const platformCounts: Record<string, Record<FailureClass, number>> = {
    ticket_kings: { ...counts },
    ticket_io: { ...counts },
    other: { ...counts },
  };

  for (const event of events) {
    const ticketUrl = event.ticketUrl ?? '';
    if (!ticketUrl) {
      counts.NONE++;
      continue;
    }

    const platform = /ticketkings/i.test(ticketUrl)
      ? 'ticket_kings'
      : /\.ticket\.io/i.test(ticketUrl)
        ? 'ticket_io'
        : 'other';

    const { data: imports } = await c
      .from('import_records')
      .select('normalized_payload')
      .eq('resulting_event_id', event.id)
      .limit(1);
    const payload = (imports?.[0]?.normalized_payload ?? {}) as Record<string, unknown>;
    const metadata = (payload.sourceMetadata ?? {}) as Record<string, unknown>;

    const live = await liveSourcePrice(ticketUrl);
    const candidate = {
      ...(payload as CanonicalImportEvent),
      priceText: live.priceText ?? (payload.priceText as string | undefined),
      priceAmount: live.priceAmount ?? (payload.priceAmount as number | undefined),
      sourceMetadata: { ...metadata, ticketOffers: live.ticketOffers ?? metadata.ticketOffers },
    } as CanonicalImportEvent;

    const phases = normalizeTicketOffersFromCandidate(candidate);
    const normalizedPriceText = deriveSummaryPriceTextFromPhases(phases) ?? candidate.priceText;
    const writer = writeCanonicalTicketFields({ existing: event, candidate, fillOnly: false });
    const canonical = readCanonicalTicket({
      ticketUrl: event.ticketUrl,
      websiteUrl: event.websiteUrl,
      priceText: event.priceText,
      ticketStatus: event.ticketStatus,
      ticketPhases: event.ticketPhases,
    });

    const failure = classifyPriceFailure({
      hasTicketUrl: true,
      sourcePriceText: live.priceText,
      importPriceText: payload.priceText as string | undefined,
      normalizedPriceText,
      writerPriceText: writer.patch.priceText,
      dbPriceText: event.priceText,
      canonicalPriceText: canonical.priceText,
      inspected: live.inspected,
      confirmedNoPrice: live.confirmedNoPrice,
    });

    counts[failure]++;
    platformCounts[platform][failure]++;

    rows.push({
      eventId: event.id,
      title: event.title,
      platform,
      ticketUrl,
      failure,
      sourcePriceText: live.priceText,
      importPriceText: payload.priceText,
      dbPriceText: event.priceText,
      writerWouldSet: writer.patch.priceText,
      phaseCount: phases?.length ?? 0,
      availability: canonical.availability,
    });
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    totalWithTicketUrl: rows.length,
    failureCounts: counts,
    byPlatform: platformCounts,
    wouldGainPrice: rows.filter((r) => r.failure === 'PRICE_NOT_PERSISTED' || r.failure === 'PRICE_NOT_IN_IMPORT_PAYLOAD').length,
    currentlyWithPrice: rows.filter((r) => r.dbPriceText?.trim()).length,
    afterRepairWouldHavePrice: rows.filter((r) => r.writerWouldSet?.trim() || r.dbPriceText?.trim()).length,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ summary, events: rows }, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
