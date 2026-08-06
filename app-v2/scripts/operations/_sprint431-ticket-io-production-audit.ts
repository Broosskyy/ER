/**
 * Phase 4.3.1 — Production baseline audit for Ticket.io data quality.
 * Run: npx tsx scripts/operations/_sprint431-ticket-io-production-audit.ts
 */
import './bootstrap-ops-supabase';

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defaultHttpClient } from '@/features/endpoints/http/default-http-client';
import { isTicketIoPowChallengePage } from '@/features/aggregation/connectors/ticket-platform/ticket-io-field-quality';
import { parseTicketIoShopHtml } from '@/features/aggregation/connectors/ticket-platform/adapters/ticket-io-adapter';
import type { EventArtistCountRow, EventProductionAuditSnippet, EventSourceReferenceRow } from './ops-supabase-rows';
import { opsClient } from './ops-supabase-rows';

const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../docs/real-data/_sprint431_ticket_io_production_audit.json',
);

const TICKET_IO_SOURCES = [
  'source-ticket-io-protontheclub',
  'source-ticket-io-lehmannclub',
  'source-ticket-io-area51events',
  'source-ticket-io-technodampfer',
  'source-ticket-io-hmg-concerts',
  'source-bootshaus-ticket-io',
];

const SAMPLE_TITLES = [
  'DNB CONNECTION pres. SHOCKONE',
  'TECHNO DAMPFER Köln w/ Saltysis',
  'WESTBAM - SAVE THE RAVE 2027',
];

function isNaDescription(value: string | null | undefined): boolean {
  return !value?.trim() || /^n\/a$/i.test(value.trim());
}

async function checkPriceTextColumn(): Promise<{ exists: boolean; error?: string }> {
  const client = opsClient();
  const { data, error } = await client.from('events').select('id, price_text').limit(1);
  if (error) {
    if (/price_text|column/i.test(error.message)) {
      return { exists: false, error: error.message };
    }
    return { exists: false, error: error.message };
  }
  return { exists: true };
}

async function countEventArtists(eventIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (eventIds.length === 0) {
    return counts;
  }
  const client = opsClient();
  const { data, error } = await client
    .from('event_artists')
    .select('event_id')
    .in('event_id', eventIds);
  if (error) {
    throw new Error(error.message);
  }
  for (const row of (data ?? []) as EventArtistCountRow[]) {
    counts.set(row.event_id, (counts.get(row.event_id) ?? 0) + 1);
  }
  return counts;
}

async function auditSource(sourceId: string) {
  const client = opsClient();
  const { data: refs, error: refError } = await client
    .from('event_source_references')
    .select('canonical_event_id, external_event_id, original_url')
    .eq('source_id', sourceId);
  if (refError) {
    throw new Error(refError.message);
  }

  const refRows = (refs ?? []) as EventSourceReferenceRow[];
  const eventIds = [...new Set(refRows.map((r) => r.canonical_event_id).filter(Boolean))];
  if (eventIds.length === 0) {
    return {
      sourceId,
      originCount: 0,
      canonicalCount: 0,
      metrics: {},
      samples: [],
    };
  }

  const { data: events, error: eventError } = await client
    .from('events')
    .select(
      'id,title,description,price_text,ticket_url,image_url,status,venue_name,organizer,genre_id,published_at',
    )
    .in('id', eventIds);
  if (eventError) {
    throw new Error(eventError.message);
  }

  const lineupCounts = await countEventArtists(eventIds);
  const rows = (events ?? []) as EventProductionAuditSnippet[];

  const metrics = {
    total: rows.length,
    published: rows.filter((e) => e.status === 'published').length,
    realDescription: rows.filter((e) => e.description?.trim() && !isNaDescription(e.description)).length,
    naDescription: rows.filter((e) => isNaDescription(e.description)).length,
    emptyDescription: rows.filter((e) => !e.description?.trim()).length,
    withPriceText: rows.filter((e) => Boolean(e.price_text?.trim())).length,
    withLineup: rows.filter((e) => (lineupCounts.get(e.id) ?? 0) > 0).length,
    withGenre: rows.filter((e) => Boolean(e.genre_id)).length,
    withTicketUrl: rows.filter((e) => Boolean(e.ticket_url?.includes('.ticket.io/'))).length,
    withImage: rows.filter((e) => Boolean(e.image_url?.trim())).length,
  };

  const samples = rows
    .filter((e) => SAMPLE_TITLES.some((title) => e.title?.includes(title.split(' ')[0] ?? '')))
    .slice(0, 5)
    .map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      priceText: e.price_text,
      ticketUrl: e.ticket_url,
      imageUrl: e.image_url,
      lineupCount: lineupCounts.get(e.id) ?? 0,
      genreId: e.genre_id,
      status: e.status,
    }));

  return {
    sourceId,
    originCount: refs?.length ?? 0,
    canonicalCount: rows.length,
    metrics,
    samples,
  };
}

async function probeLiveTicketIo(shopSlug: string, eventSlug?: string) {
  const listUrl = `https://${shopSlug}.ticket.io/`;
  const listResponse = await defaultHttpClient.fetch(listUrl, {
    headers: {
      'User-Agent': 'EternalRave-SourceBot/1.0 (+https://eternalrave.app; event-import)',
      Accept: 'text/html',
    },
  });
  const listHtml = await listResponse.text();
  const listPow = isTicketIoPowChallengePage(listHtml);
  const parsed = parseTicketIoShopHtml(listHtml, {
    platform: 'ticket_io',
    shopSlug,
    timezone: 'Europe/Berlin',
  });

  let detail: Record<string, unknown> | undefined;
  if (eventSlug) {
    const detailUrl = `${listUrl.replace(/\/?$/, '')}/${eventSlug}/`;
    const detailResponse = await defaultHttpClient.fetch(detailUrl, {
      headers: {
        'User-Agent': 'EternalRave-SourceBot/1.0 (+https://eternalrave.app; event-import)',
        Accept: 'text/html',
      },
    });
    const detailHtml = await detailResponse.text();
    detail = {
      url: detailUrl,
      status: detailResponse.status,
      blockedByPow: isTicketIoPowChallengePage(detailHtml),
      title: detailHtml.match(/<title>([^<]+)<\/title>/i)?.[1],
    };
  }

  const shockone = parsed.events.find((e) => e.title.includes('SHOCKONE'));

  return {
    shopSlug,
    listUrl,
    listStatus: listResponse.status,
    listBlockedByPow: listPow,
    listEventCount: parsed.events.length,
    sampleEvent: shockone
      ? {
          title: shockone.title,
          priceText: shockone.priceText,
          description: shockone.description,
          artistNames: shockone.artistNames,
          genreNames: shockone.genreNames,
          ticketUrl: shockone.ticketUrl,
        }
      : parsed.events[0]
        ? {
            title: parsed.events[0].title,
            priceText: parsed.events[0].priceText,
            description: parsed.events[0].description,
            artistNames: parsed.events[0].artistNames,
            genreNames: parsed.events[0].genreNames,
            ticketUrl: parsed.events[0].ticketUrl,
          }
        : null,
    detail,
  };
}

async function main(): Promise<void> {
  const client = opsClient();
  const { data: projectRow } = await client.from('events').select('id').limit(1);
  void projectRow;

  const migration = await checkPriceTextColumn();
  const perSource = [];
  for (const sourceId of TICKET_IO_SOURCES) {
    perSource.push(await auditSource(sourceId));
  }

  const liveProbes = await Promise.all([
    probeLiveTicketIo('proton-the-club', 'hyHJr2xd'),
    probeLiveTicketIo('technodampfer'),
    probeLiveTicketIo('lehmannclub'),
    probeLiveTicketIo('area51events'),
  ]);

  const report = {
    generatedAt: new Date().toISOString(),
    supabaseUrlHost: (process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? '')
      .replace(/^https?:\/\//, '')
      .split('/')[0],
    migration700: migration,
    perSource,
    liveProbes,
    capabilityMatrix: {
      listPage: {
        description: 'Usually N/A in JSON-LD — must sanitize',
        priceText: 'Available via tio-overview-tickets-from row',
        genres: 'Available on some shops in info row',
        titleArtists: 'Available via pres./w/ parsing',
        image: 'Available in JSON-LD',
        ticketUrl: 'Available in JSON-LD offers.url',
      },
      detailPage: {
        fullLineup: 'Blocked by Altcha for bot user-agent',
        fullDescription: 'Blocked by Altcha for bot user-agent',
        ticketPhases: 'Blocked by Altcha for bot user-agent',
      },
    },
  };

  writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(`Wrote ${OUT}`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
