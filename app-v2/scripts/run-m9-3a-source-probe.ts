#!/usr/bin/env tsx
/**
 * M9.3A — Read-only high-coverage source qualification probe.
 * No DB writes, no staging mutations.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = '.tmp/m9-3a-probe';
const USER_AGENT = 'EternalRave-M9.3A-Audit/1.0 (+research; no-automation)';

interface ProbeResult {
  id: string;
  category: string;
  url: string;
  ok: boolean;
  status?: number;
  finalUrl?: string;
  contentType?: string;
  bytes?: number;
  title?: string;
  jsonLdCount?: number;
  eventLinkCount?: number;
  ticketLinkCount?: number;
  imageCount?: number;
  hasEmbeddedJson?: boolean;
  hasNextData?: boolean;
  hasReactRoot?: boolean;
  sampleLinks?: string[];
  notes?: string[];
  error?: string;
}

async function fetchProbe(id: string, category: string, url: string): Promise<ProbeResult> {
  const notes: string[] = [];
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/json' },
      redirect: 'follow',
      signal: AbortSignal.timeout(20000),
    });
    const contentType = response.headers.get('content-type') ?? undefined;
    const text = await response.text();
    const finalUrl = response.url;
    const isJson = contentType?.includes('application/json');

    let title: string | undefined;
    let jsonLdCount = 0;
    let eventLinkCount = 0;
    let ticketLinkCount = 0;
    let imageCount = 0;
    let hasEmbeddedJson = false;
    let hasNextData = false;
    let hasReactRoot = false;

    if (isJson) {
      hasEmbeddedJson = true;
      notes.push('json_response');
      if (Array.isArray(text)) {
        eventLinkCount = 0;
      } else {
        try {
          const parsed = JSON.parse(text) as unknown;
          if (Array.isArray(parsed)) {
            eventLinkCount = parsed.length;
            notes.push(`json_array_length=${parsed.length}`);
          } else if (parsed && typeof parsed === 'object') {
            const obj = parsed as Record<string, unknown>;
            if (Array.isArray(obj.data)) eventLinkCount = obj.data.length;
            if (Array.isArray(obj.events)) eventLinkCount = obj.events.length;
            if (obj.meta && typeof obj.meta === 'object') notes.push('json_meta_present');
          }
        } catch {
          notes.push('json_parse_failed');
        }
      }
    } else {
      const titleMatch = text.match(/<title[^>]*>([^<]+)<\/title>/i);
      title = titleMatch?.[1]?.trim();
      jsonLdCount = (text.match(/application\/ld\+json/gi) ?? []).length;
      hasNextData = text.includes('__NEXT_DATA__');
      hasReactRoot = /id="__nuxt"|id="root"|data-reactroot/i.test(text);
      hasEmbeddedJson = /window\.__INITIAL_STATE__|window\.__NUXT__|application\/json/.test(text);

      const hrefs = [...text.matchAll(/href=["']([^"']+)["']/gi)].map((m) => m[1] ?? '');
      const eventPatterns = [
        /\/event[s]?\//i,
        /\/programm\//i,
        /\/events\//i,
        /ticket\.io\/[A-Za-z0-9]{6,}/i,
        /rausgegangen\.de\/.*\/events\//i,
        /ra\.co\/events\//i,
      ];
      const ticketPatterns = [/ticket\.io/i, /ticketkings/i, /eventim/i, /paylogic/i, /fourvenues/i, /rausgegangen/i];

      for (const href of hrefs) {
        if (eventPatterns.some((p) => p.test(href))) eventLinkCount += 1;
        if (ticketPatterns.some((p) => p.test(href))) ticketLinkCount += 1;
      }
      imageCount = (text.match(/<img\b/gi) ?? []).length;
    }

    const sampleLinks = isJson
      ? []
      : [...new Set((text.match(/https?:\/\/[^\s"'<>]+/g) ?? []).filter((u) => /event|ticket|programm|rausgegangen|ticket\.io|ra\.co/i.test(u)).slice(0, 8))];

    return {
      id,
      category,
      url,
      ok: response.ok,
      status: response.status,
      finalUrl,
      contentType,
      bytes: text.length,
      title,
      jsonLdCount,
      eventLinkCount,
      ticketLinkCount,
      imageCount,
      hasEmbeddedJson,
      hasNextData,
      hasReactRoot,
      sampleLinks,
      notes,
    };
  } catch (error) {
    return {
      id,
      category,
      url,
      ok: false,
      notes,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

const TARGETS: Array<{ id: string; category: string; url: string }> = [
  // A — Ticket networks
  { id: 'ticketio-bootshaus-shop', category: 'ticket_network', url: 'https://bootshaus-club.ticket.io/' },
  { id: 'ticketio-stadtgarten-shop', category: 'ticket_network', url: 'https://stadtgarten.ticket.io/' },
  { id: 'ticketio-portal-srvded', category: 'ticket_network', url: 'https://portal.srvded.ticket.io/' },
  { id: 'ticketkings-home', category: 'ticket_network', url: 'https://ticketkings.de/' },
  { id: 'eventim-search-techno-koeln', category: 'ticket_network', url: 'https://www.eventim.de/events/techno-104/koeln-12/' },

  // B — Aggregators
  { id: 'rausgegangen-koeln', category: 'aggregator', url: 'https://rausgegangen.de/koeln/' },
  { id: 'rausgegangen-koeln-techno', category: 'aggregator', url: 'https://rausgegangen.de/koeln/tags/techno/' },
  { id: 'rausgegangen-duesseldorf', category: 'aggregator', url: 'https://rausgegangen.de/duesseldorf/' },
  { id: 'rausgegangen-bonn', category: 'aggregator', url: 'https://rausgegangen.de/bonn/' },
  { id: 'rausgegangen-dortmund', category: 'aggregator', url: 'https://rausgegangen.de/dortmund/' },
  { id: 'rausgegangen-essen', category: 'aggregator', url: 'https://rausgegangen.de/essen/' },
  { id: 'rausgegangen-bochum', category: 'aggregator', url: 'https://rausgegangen.de/bochum/' },
  { id: 'rausgegangen-muenster', category: 'aggregator', url: 'https://rausgegangen.de/muenster/' },
  { id: 'rausgegangen-aachen', category: 'aggregator', url: 'https://rausgegangen.de/aachen/' },

  // C — Electronic-specific
  { id: 'raves-of-germany', category: 'electronic_specific', url: 'https://ravesofgermany.com/' },
  { id: 'resident-advisor-koeln', category: 'electronic_specific', url: 'https://de.ra.co/events/de/cologne' },
  { id: 'goout-koeln-techno', category: 'electronic_specific', url: 'https://goout.net/de/koeln/techno/ttbpl/' },
  { id: 'dice-koeln', category: 'electronic_specific', url: 'https://dice.fm/browse/koeln-28c1' },

  // D/E — Organizer / festival networks
  { id: 'odonien-club', category: 'organizer_network', url: 'https://odonien.de/club' },
  { id: 'odonien-api-events', category: 'organizer_network', url: 'https://cms.odonien.de/api/events?pagination[page]=1&pagination[pageSize]=25&filters[Date][$gte]=2026-08-29' },
  { id: 'nibirii-events', category: 'festival_network', url: 'https://www.nibirii.com/events/' },

  // F — High-value official (inactive but probed)
  { id: 'nachtresidenz-events', category: 'official_source', url: 'https://nachtresidenz.de/events/' },
  { id: 'stadtgarten-programm', category: 'official_source', url: 'https://www.stadtgarten.de/programm/' },
  { id: 'zakk-party', category: 'official_source', url: 'https://www.zakk.de/programm/party' },
];

async function main() {
  mkdirSync(OUT, { recursive: true });
  const results: ProbeResult[] = [];
  for (const target of TARGETS) {
    const result = await fetchProbe(target.id, target.category, target.url);
    results.push(result);
    process.stdout.write(`${result.ok ? 'OK' : 'FAIL'} ${target.id} (${result.status ?? 'err'})\n`);
    await new Promise((r) => setTimeout(r, 400));
  }

  const summary = {
    probedAt: new Date().toISOString(),
    totalTargets: results.length,
    okCount: results.filter((r) => r.ok).length,
    failCount: results.filter((r) => !r.ok).length,
    byCategory: Object.fromEntries(
      [...new Set(results.map((r) => r.category))].map((cat) => [
        cat,
        {
          count: results.filter((r) => r.category === cat).length,
          ok: results.filter((r) => r.category === cat && r.ok).length,
        },
      ]),
    ),
    results,
  };

  writeFileSync(join(OUT, 'probe-results.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ ok: summary.okCount, fail: summary.failCount, out: OUT }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
