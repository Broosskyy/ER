import { parseTicketIoShopHtml } from '@/features/aggregation/connectors/ticket-platform/adapters/ticket-io-adapter';
import { discoverTicketIoPriceEvidence } from '@/features/aggregation/connectors/ticket-platform/ticket-io-price-evidence';
import { extractTicketIoEventSlug } from '@/features/aggregation/connectors/ticket-platform/ticket-io-url';
import { findCompositeIdentityCollisions } from '@/features/import/ticket-platform-identity';

import {
  PHASE4864_BOOTSHAUS_ADDRESS,
  PHASE4864_R3HAB_EVENT_ID,
  PHASE4864_R3HAB_TICKET_URL,
  PHASE4864_SOMMERFEST_EVENT_ID,
  PHASE4864_SOMMERFEST_TICKET_URL,
  PHASE4864_UNDERLAND_EVENT_ID,
  PHASE4864_UNDERLAND_TICKET_URL,
} from './constants';
import type { PreflightEvidence } from './types';

const FETCH_HEADERS = {
  'User-Agent': 'EternalRave-SourceBot/1.0 (+https://eternalrave.app)',
  Accept: 'text/html',
};

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: FETCH_HEADERS, redirect: 'follow' });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return res.text();
}

function extractJsonLdVenue(html: string, slug: string): { venueName?: string; address?: string } | undefined {
  const blocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const block of blocks) {
    const raw = block[1]?.trim();
    if (!raw || !raw.includes(slug)) {
      continue;
    }
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const location = parsed.location as Record<string, unknown> | undefined;
      if (location) {
        return {
          venueName: String(location.name ?? ''),
          address: JSON.stringify(location.address ?? ''),
        };
      }
    } catch {
      // skip
    }
  }
  return undefined;
}

export async function runFinalPreflight(input: {
  catalog: Array<{ eventId: string; title: string; ticketUrl?: string; startDate?: string; venueName?: string }>;
}): Promise<{
  passed: boolean;
  events: PreflightEvidence[];
  collisionActive: boolean;
}> {
  const listHtml = await fetchHtml('https://bootshaus-club.ticket.io/');
  const r3habSlug = extractTicketIoEventSlug(PHASE4864_R3HAB_TICKET_URL)!;
  const sommerfestSlug = extractTicketIoEventSlug(PHASE4864_SOMMERFEST_TICKET_URL)!;

  const r3habDiscovery = discoverTicketIoPriceEvidence({
    shopSlug: 'bootshaus-club',
    listUrl: 'https://bootshaus-club.ticket.io/',
    listHtml,
    eventUrl: PHASE4864_R3HAB_TICKET_URL,
  });
  const sommerfestParsed = parseTicketIoShopHtml(listHtml, {
    shopSlug: 'bootshaus-club',
    listUrl: 'https://bootshaus-club.ticket.io/',
    platform: 'ticket_io',
  });
  const sommerfestMatch = sommerfestParsed.events.find(
    (e) => extractTicketIoEventSlug(e.ticketUrl) === sommerfestSlug,
  );
  const sommerfestJsonLd = extractJsonLdVenue(listHtml, sommerfestSlug);

  const underlandHtml = await fetchHtml(PHASE4864_UNDERLAND_TICKET_URL);
  const underlandTitle = underlandHtml.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? '';

  const collisions = findCompositeIdentityCollisions(
    input.catalog.map((e) => ({
      eventId: e.eventId,
      title: e.title,
      startDate: e.startDate,
      venueName: e.venueName,
      ticketUrl: e.ticketUrl,
    })),
  );
  const r3habCollision = collisions.some(
    (c) => c.externalId === r3habSlug && c.eventIds.includes(PHASE4864_R3HAB_EVENT_ID),
  );

  const underland: PreflightEvidence = {
    eventId: PHASE4864_UNDERLAND_EVENT_ID,
    title: 'Underland Essigfabrik 05.09.2026',
    passed: /underland/i.test(underlandTitle) && /ticketkings/i.test(PHASE4864_UNDERLAND_TICKET_URL),
    evidence: {
      ticketKingsUrl: PHASE4864_UNDERLAND_TICKET_URL,
      pageTitle: underlandTitle,
    },
  };

  const r3hab: PreflightEvidence = {
    eventId: PHASE4864_R3HAB_EVENT_ID,
    title: 'R3HAB pres. by BOOTSHAUS',
    passed:
      r3habDiscovery.bestHit?.priceText === 'ab 23,90 €' &&
      r3habDiscovery.bestHit?.priceAmount === 23.9,
    evidence: {
      ticketUrl: PHASE4864_R3HAB_TICKET_URL,
      priceText: r3habDiscovery.bestHit?.priceText,
      priceAmount: r3habDiscovery.bestHit?.priceAmount,
      collisionActive: r3habCollision,
    },
    abortReason: r3habCollision ? 'composite_collision_still_active_for_gate_c' : undefined,
  };

  const sommerfest: PreflightEvidence = {
    eventId: PHASE4864_SOMMERFEST_EVENT_ID,
    title: 'Bootshaus Sommerfest',
    passed:
      sommerfestMatch?.title === 'Bootshaus Sommerfest' &&
      (sommerfestMatch?.venueName === 'Bootshaus' || sommerfestJsonLd?.venueName === 'Bootshaus'),
    evidence: {
      listRowTitle: sommerfestMatch?.title,
      venueName: sommerfestMatch?.venueName ?? sommerfestJsonLd?.venueName,
      venueAddress: sommerfestMatch?.venueAddress ?? sommerfestJsonLd?.address,
      addressContainsBootshaus: String(sommerfestMatch?.venueAddress ?? sommerfestJsonLd?.address ?? '').includes(
        PHASE4864_BOOTSHAUS_ADDRESS,
      ),
    },
  };

  const events = [underland, r3hab, sommerfest];
  return {
    passed: events.every((e) => e.passed),
    events,
    collisionActive: r3habCollision,
  };
}
