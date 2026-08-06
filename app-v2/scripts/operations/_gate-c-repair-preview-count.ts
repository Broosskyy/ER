/**
 * Gate C repair preview — count events repairable via live evidence (read-only).
 */
import './bootstrap-ops-supabase';

import { mapEventRowToAdminRecord } from '@/data/mappers/event-mapper';
import type { EventRow } from '@/data/mappers/event-mapper';
import { parseTicketIoListRowContexts } from '@/features/aggregation/connectors/ticket-platform/ticket-io-list-enrichment';
import {
  extractNativeEventCheckoutUrl,
  parseTicketKingsCheckoutHtml,
} from '@/features/aggregation/connectors/ticket-platform/ticket-kings-public-checkout';
import { writeCanonicalTicketFields } from '@/features/events/domain/canonical-ticket-writer';
import { opsClient } from './ops-supabase-rows';

function shopRoot(url: string): string | null {
  const match = url.match(/^(https?:\/\/[^/]+\.ticket\.io)\//i);
  return match ? `${match[1]}/` : null;
}

function eventSlug(url: string): string | null {
  const match = url.match(/\.ticket\.io\/([^/?#]+)/i);
  if (!match || match[1].length < 6) {
    return null;
  }
  return match[1];
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'EternalRave-SourceBot/1.0 (+https://eternalrave.app)' },
  });
  return response.text();
}

async function liveTkPrice(ticketUrl: string): Promise<string | undefined> {
  const html = await fetchHtml(ticketUrl);
  const checkoutUrl = extractNativeEventCheckoutUrl(html);
  const checkoutHtml = checkoutUrl ? await fetchHtml(checkoutUrl).catch(() => undefined) : undefined;
  return parseTicketKingsCheckoutHtml(checkoutHtml ?? html).priceText;
}

async function main() {
  const client = opsClient();
  const { data } = await client.from('events').select('*').eq('status', 'published');
  const events = (data ?? []).map((row) => mapEventRowToAdminRecord(row as EventRow));

  const listCache = new Map<string, ReturnType<typeof parseTicketIoListRowContexts>>();
  let tkWouldRepair = 0;
  let tioListWouldRepair = 0;
  let stillMissing = 0;
  const samples: Array<{ title: string; platform: string; price: string }> = [];

  for (const event of events) {
    const ticketUrl = event.ticketUrl ?? '';
    if (!ticketUrl || event.priceText?.trim()) {
      continue;
    }

    if (/ticketkings\.de\/event\//i.test(ticketUrl)) {
      const priceText = await liveTkPrice(ticketUrl).catch(() => undefined);
      const writer = writeCanonicalTicketFields({
        existing: event,
        candidate: { ticketUrl, priceText },
        fillOnly: false,
      });
      if (writer.patch.priceText) {
        tkWouldRepair++;
        samples.push({ title: event.title, platform: 'ticket_kings', price: writer.patch.priceText });
      } else {
        stillMissing++;
      }
      continue;
    }

    if (!/\.ticket\.io/i.test(ticketUrl)) {
      stillMissing++;
      continue;
    }

    const root = shopRoot(ticketUrl);
    const slug = eventSlug(ticketUrl);
    if (!root || !slug) {
      stillMissing++;
      continue;
    }

    if (!listCache.has(root)) {
      try {
        const html = await fetchHtml(root);
        listCache.set(root, parseTicketIoListRowContexts(html));
      } catch {
        listCache.set(root, new Map());
      }
    }

    const row = listCache.get(root)?.get(slug);
    const writer = writeCanonicalTicketFields({
      existing: event,
      candidate: {
        ticketUrl,
        priceText: row?.priceText,
        sourceMetadata: { soldOut: row?.soldOut },
      },
      fillOnly: false,
    });

    if (writer.patch.priceText) {
      tioListWouldRepair++;
      samples.push({ title: event.title, platform: 'ticket_io', price: writer.patch.priceText });
    } else {
      stillMissing++;
    }
  }

  const currentlyWithPrice = events.filter((event) => event.ticketUrl && event.priceText?.trim()).length;
  const totalRepairable = tkWouldRepair + tioListWouldRepair;

  console.log(
    JSON.stringify(
      {
        currentlyWithPrice,
        tkWouldRepair,
        tioListWouldRepair,
        totalRepairable,
        stillMissingPrice: stillMissing,
        afterRepairWouldHavePrice: currentlyWithPrice + totalRepairable,
        samples,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
