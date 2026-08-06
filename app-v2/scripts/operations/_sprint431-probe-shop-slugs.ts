import './bootstrap-ops-supabase';

import { defaultHttpClient } from '@/features/endpoints/http/default-http-client';
import { parseTicketIoShopHtml } from '@/features/aggregation/connectors/ticket-platform/adapters/ticket-io-adapter';
import type { TicketPlatformSourceConfig } from '@/features/aggregation/connectors/ticket-platform/types';

async function probe(slug: string): Promise<void> {
  const url = `https://${slug}.ticket.io/`;
  const response = await defaultHttpClient.fetch(url, {
    headers: {
      'User-Agent': 'EternalRave-SourceBot/1.0 (+https://eternalrave.app; event-import)',
      Accept: 'text/html',
    },
  });
  const html = await response.text();
  const config: TicketPlatformSourceConfig = {
    platform: 'ticket_io',
    shopSlug: slug,
    listUrl: url,
  };
  const parsed = parseTicketIoShopHtml(html, config, {});
  console.log(
    JSON.stringify({
      slug,
      status: response.status,
      htmlLength: html.length,
      eventCount: parsed.events.length,
      firstTitle: parsed.events[0]?.title,
      firstTicketUrl: parsed.events[0]?.ticketUrl,
    }),
  );
}

async function main(): Promise<void> {
  for (const slug of ['protontheclub', 'proton-the-club']) {
    await probe(slug);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
