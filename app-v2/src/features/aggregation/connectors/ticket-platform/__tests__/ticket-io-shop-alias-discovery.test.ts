import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  buildTicketIoListCardEvidence,
  buildListCardAdmissionOffers,
} from '@/features/aggregation/connectors/ticket-platform/ticket-io-list-card-evidence';
import { classifyTicketIoDetailHtml } from '@/features/aggregation/connectors/ticket-platform/ticket-io-detail-classification';
import { parseAllTicketIoListRowContexts } from '@/features/aggregation/connectors/ticket-platform/ticket-io-list-enrichment';
import {
  discoverTicketIoShopRoot,
  proveTicketIoHostAlias,
  resolveTicketAdmissionSnapshot,
} from '@/features/aggregation/connectors/ticket-platform/ticket-io-shop-alias-discovery';
import { validateTicketIoEventUrl } from '@/features/aggregation/connectors/ticket-platform/ticket-io-url';
import { writeCanonicalTicketFields } from '@/features/events/domain/canonical-ticket-writer';
import { evaluateEventEvidenceIdentityGate } from '@/features/import/domain/event-evidence-identity-gate';

const BOOTSHAUS_SHOP = join(
  process.cwd(),
  'src/features/aggregation/connectors/ticket-platform/fixtures/ticket-io-bootshaus-shop.html',
);
const PURE_POW_DETAIL = join(
  process.cwd(),
  'src/features/aggregation/connectors/ticket-platform/fixtures/ticket-io-proton-shockone-detail.html',
);

const SHOP_ROOT = 'https://bootshaus.ticket.io/';

const OFFICIAL_WITH_IFRAME = `<html><body>
<a href="https://tickets.example.com/shop">Tickets</a>
<iframe src="https://alt-shop.ticket.io/"></iframe>
</body></html>`;

const FIRST_PARTY_HOP_WITH_EMBED = `<html><body>
<iframe src="https://bootshaus-tickets.ticket.io/"></iframe>
</body></html>`;

const LEVI_LIST_CARD_ROW = `<tr><td id="event-row-YvJnLSXd" class="row">
<a href="/YvJnLSXd/" class="a-eventlink">LEVI presented by NIGHTS WITH US @ Bootshaus, Cologne</a>
<script type="application/ld+json">{
  "@context":"http://schema.org","@type":"MusicEvent",
  "name":"LEVI presented by NIGHTS WITH US @ Bootshaus, Cologne",
  "startDate":"2026-08-07T22:00:00+02:00",
  "location":{"@type":"Place","name":"Bootshaus"},
  "offers":{"price":30,"priceCurrency":"EUR","url":"https://bootshaus-club.ticket.io/YvJnLSXd/"}
}</script>
<li class="tio-overview-tickets-from"><span>Tickets from 30,00 Euro</span></li>
</td></tr>`;

const BC173_LIST_CARD_ROW = `<tr><td id="event-row-BcDqml12" class="row">
<a href="/BcDqml12/" class="a-eventlink">BC173 Airport Session pres. by Bootshaus III</a>
<script type="application/ld+json">{
  "@context":"http://schema.org","@type":"MusicEvent",
  "name":"BC173 Airport Session pres. by Bootshaus III",
  "startDate":"2026-08-15T16:00:00+02:00",
  "location":{"@type":"Place","name":"Moxy Köln/Bonn Flughafen"},
  "offers":{"price":26,"priceCurrency":"EUR","url":"https://bootshaus-club.ticket.io/BcDqml12/"}
}</script>
<li class="tio-overview-tickets-from"><span>Tickets from 26,00 Euro</span></li>
</td></tr>`;

describe('ticket.io official shop alias discovery', () => {
  it('A discovers shop root from official iframe embed without guessing', () => {
    const discovery = discoverTicketIoShopRoot({
      officialPageHtml: OFFICIAL_WITH_IFRAME,
      officialPageUrl: 'https://organizer.example/events/demo/',
    });
    expect(discovery.discoveredShopRoot).toBe('https://alt-shop.ticket.io/');
    expect(discovery.shopDiscoveryMethod).toBe('official_iframe_embed');
    expect(discovery.candidateUrls).not.toContain('https://guessed-shop.ticket.io/');
  });

  it('B accepts per-slug alias when redirect chain is observed for LEVI', () => {
    const contexts = parseAllTicketIoListRowContexts(LEVI_LIST_CARD_ROW, SHOP_ROOT);
    const card = contexts.get('YvJnLSXd');
    expect(card?.linkedEventUrl).toBe('https://bootshaus.ticket.io/YvJnLSXd/');

    const alias = proveTicketIoHostAlias({
      listCard: card!,
      shopRootUrl: SHOP_ROOT,
      redirectObservation: {
        linkedEventUrl: 'https://bootshaus.ticket.io/YvJnLSXd/',
        redirectFinalUrl: 'https://bootshaus-tickets.ticket.io/YvJnLSXd/',
      },
    });

    expect(alias.valid).toBe(true);
    expect(alias.shopRootHost).toBe('bootshaus.ticket.io');
    expect(alias.linkedEventUrl).toBe('https://bootshaus.ticket.io/YvJnLSXd/');
    expect(alias.redirectFinalHost).toBe('bootshaus-tickets.ticket.io');
    expect(alias.evidenceSource).toBe('observed_redirect_chain');
    expect(alias.slugBindingProof?.redirectFinalHost).toBe('bootshaus-tickets.ticket.io');

    expect(
      validateTicketIoEventUrl({
        ticketUrl: 'https://bootshaus-tickets.ticket.io/YvJnLSXd/',
        shopSlug: 'bootshaus',
        eventSlug: 'YvJnLSXd',
        aliasProof: alias,
      }).valid,
    ).toBe(true);
  });

  it('does not prove cross-host alias from JSON-LD offer URL alone', () => {
    const contexts = parseAllTicketIoListRowContexts(LEVI_LIST_CARD_ROW, SHOP_ROOT);
    const card = contexts.get('YvJnLSXd')!;
    expect(card.publicTicketPageUrl).toContain('bootshaus-club.ticket.io');
    const alias = proveTicketIoHostAlias({
      listCard: card,
      shopRootUrl: SHOP_ROOT,
    });
    expect(alias.evidenceSource).toBe('same_host');
    expect(
      validateTicketIoEventUrl({
        ticketUrl: 'https://bootshaus-club.ticket.io/YvJnLSXd/',
        shopSlug: 'bootshaus',
        eventSlug: 'YvJnLSXd',
        aliasProof: alias,
      }).valid,
    ).toBe(false);
  });

  it('accepts per-slug alias for BC173 via observed redirect from the same shop root', () => {
    const contexts = parseAllTicketIoListRowContexts(BC173_LIST_CARD_ROW, SHOP_ROOT);
    const card = contexts.get('BcDqml12');
    expect(card?.linkedEventUrl).toBe('https://bootshaus.ticket.io/BcDqml12/');

    const alias = proveTicketIoHostAlias({
      listCard: card!,
      shopRootUrl: SHOP_ROOT,
      redirectObservation: {
        linkedEventUrl: 'https://bootshaus.ticket.io/BcDqml12/',
        redirectFinalUrl: 'https://bootshaus-club.ticket.io/BcDqml12/',
      },
    });

    expect(alias.valid).toBe(true);
    expect(alias.redirectFinalHost).toBe('bootshaus-club.ticket.io');
    expect(alias.evidenceSource).toBe('observed_redirect_chain');
  });

  it('C blocks alias when hosts differ and slugs differ', () => {
    const anchorOnlyRow = `<tr><td id="event-row-BcDqml12" class="row">
<a href="/BcDqml12/" class="a-eventlink">BC173 Airport Session pres. by Bootshaus III</a>
<script type="application/ld+json">{
  "@context":"http://schema.org","@type":"MusicEvent",
  "name":"BC173 Airport Session pres. by Bootshaus III",
  "startDate":"2026-08-15T16:00:00+02:00",
  "location":{"@type":"Place","name":"Moxy Köln/Bonn Flughafen"}
}</script>
<li class="tio-overview-tickets-from"><span>Tickets from 26,00 Euro</span></li>
</td></tr>`;
    const contexts = parseAllTicketIoListRowContexts(anchorOnlyRow, 'https://shop-a.ticket.io/');
    const card = contexts.get('BcDqml12');
    const alias = proveTicketIoHostAlias({
      listCard: card!,
      shopRootUrl: 'https://shop-a.ticket.io/',
      redirectObservation: {
        linkedEventUrl: 'https://shop-a.ticket.io/BcDqml12/',
        redirectFinalUrl: 'https://shop-b.ticket.io/other99/',
      },
    });
    expect(alias.valid).toBe(false);
    expect(alias.reason).toBe('redirect_slug_mismatch');
  });

  it('rejects canonical host as sole alias evidence without independent observation', () => {
    const contexts = parseAllTicketIoListRowContexts(LEVI_LIST_CARD_ROW, SHOP_ROOT);
    const card = contexts.get('YvJnLSXd')!;
    const alias = proveTicketIoHostAlias({
      listCard: card,
      shopRootUrl: SHOP_ROOT,
      existingCanonicalUrl: 'https://bootshaus-club.ticket.io/YvJnLSXd/',
    });
    expect(alias.evidenceSource).toBe('same_host');
    expect(
      validateTicketIoEventUrl({
        ticketUrl: 'https://bootshaus-club.ticket.io/YvJnLSXd/',
        shopSlug: 'bootshaus',
        eventSlug: 'YvJnLSXd',
        aliasProof: alias,
      }).valid,
    ).toBe(false);
    expect(
      validateTicketIoEventUrl({
        ticketUrl: 'https://bootshaus-tickets.ticket.io/YvJnLSXd/',
        shopSlug: 'bootshaus',
        eventSlug: 'YvJnLSXd',
        aliasProof: alias,
      }).reason,
    ).toBe('alias_host_not_proven');
  });

  it('does not reuse alias proof across different slugs', () => {
    const anchorOnlyRows = `<tr><td id="event-row-YvJnLSXd" class="row">
<a href="/YvJnLSXd/" class="a-eventlink">LEVI presented by NIGHTS WITH US @ Bootshaus, Cologne</a>
<script type="application/ld+json">{
  "@context":"http://schema.org","@type":"MusicEvent",
  "name":"LEVI presented by NIGHTS WITH US @ Bootshaus, Cologne",
  "startDate":"2026-08-07T22:00:00+02:00",
  "location":{"@type":"Place","name":"Bootshaus"}
}</script>
<li class="tio-overview-tickets-from"><span>Tickets from 30,00 Euro</span></li>
</td></tr>
<tr><td id="event-row-BcDqml12" class="row">
<a href="/BcDqml12/" class="a-eventlink">BC173 Airport Session pres. by Bootshaus III</a>
<script type="application/ld+json">{
  "@context":"http://schema.org","@type":"MusicEvent",
  "name":"BC173 Airport Session pres. by Bootshaus III",
  "startDate":"2026-08-15T16:00:00+02:00",
  "location":{"@type":"Place","name":"Moxy Köln/Bonn Flughafen"}
}</script>
<li class="tio-overview-tickets-from"><span>Tickets from 26,00 Euro</span></li>
</td></tr>`;
    const contexts = parseAllTicketIoListRowContexts(anchorOnlyRows, SHOP_ROOT);
    const levi = contexts.get('YvJnLSXd')!;
    const bc173 = contexts.get('BcDqml12')!;

    const leviAlias = proveTicketIoHostAlias({
      listCard: levi,
      shopRootUrl: SHOP_ROOT,
      redirectObservation: {
        linkedEventUrl: 'https://bootshaus.ticket.io/YvJnLSXd/',
        redirectFinalUrl: 'https://bootshaus-tickets.ticket.io/YvJnLSXd/',
      },
    });
    const wrongReuse = proveTicketIoHostAlias({
      listCard: bc173,
      shopRootUrl: SHOP_ROOT,
      redirectObservation: {
        linkedEventUrl: 'https://bootshaus.ticket.io/YvJnLSXd/',
        redirectFinalUrl: 'https://bootshaus-tickets.ticket.io/YvJnLSXd/',
      },
    });
    expect(leviAlias.valid).toBe(true);
    expect(wrongReuse.evidenceSource).toBe('same_host');
    expect(
      validateTicketIoEventUrl({
        ticketUrl: 'https://bootshaus-tickets.ticket.io/BcDqml12/',
        shopSlug: 'bootshaus',
        eventSlug: 'BcDqml12',
        aliasProof: wrongReuse,
      }).valid,
    ).toBe(false);
    expect(
      validateTicketIoEventUrl({
        ticketUrl: 'https://bootshaus-tickets.ticket.io/YvJnLSXd/',
        shopSlug: 'bootshaus',
        eventSlug: 'YvJnLSXd',
        aliasProof: wrongReuse,
      }).valid,
    ).toBe(false);
  });

  it('D keeps title, date, venue, price and URL bound per list card', () => {
    const html = `${LEVI_LIST_CARD_ROW}${BC173_LIST_CARD_ROW}`;
    const contexts = parseAllTicketIoListRowContexts(html, SHOP_ROOT);
    const levi = contexts.get('YvJnLSXd');
    const bc173 = contexts.get('BcDqml12');
    expect(levi?.listRowTitle).toContain('LEVI');
    expect(levi?.eventDate).toContain('2026-08-07');
    expect(levi?.venueName).toBe('Bootshaus');
    expect(levi?.priceText).toMatch(/30/);
    expect(levi?.linkedEventUrl).toBe('https://bootshaus.ticket.io/YvJnLSXd/');
    expect(bc173?.venueName).toContain('Moxy');
    expect(bc173?.priceText).toMatch(/26/);
    expect(levi?.linkedEventUrl).not.toBe(bc173?.linkedEventUrl);
  });

  it('E replaces stale admission snapshot with fresh list-card minimum price', () => {
    const contexts = parseAllTicketIoListRowContexts(LEVI_LIST_CARD_ROW, SHOP_ROOT);
    const card = contexts.get('YvJnLSXd')!;
    const snapshot = resolveTicketAdmissionSnapshot({
      listCard: card,
      listCardOffers: buildListCardAdmissionOffers(card, card.publicTicketPageUrl),
      previousSnapshot: {
        priceText: 'ab 28,00 €',
        ticketOffers: [{ name: 'Early Entry', priceAmount: 28, priceCurrency: 'EUR' }],
      },
    });
    expect(snapshot.replacedPreviousSnapshot).toBe(true);
    expect(snapshot.priceText).toMatch(/30/);
    expect(snapshot.ticketOffers?.[0]?.priceAmount).toBe(30);
  });

  it('F uses list-card identity and price when detail is challenge-only', () => {
    const powDetail = readFileSync(PURE_POW_DETAIL, 'utf8');
    expect(classifyTicketIoDetailHtml(powDetail).detailFetchStatus).toBe('pow_challenge');
    const contexts = parseAllTicketIoListRowContexts(LEVI_LIST_CARD_ROW, SHOP_ROOT);
    const card = contexts.get('YvJnLSXd')!;
    const alias = proveTicketIoHostAlias({
      listCard: card,
      shopRootUrl: SHOP_ROOT,
      redirectObservation: {
        linkedEventUrl: 'https://bootshaus.ticket.io/YvJnLSXd/',
        redirectFinalUrl: 'https://bootshaus-tickets.ticket.io/YvJnLSXd/',
      },
    });
    const evidence = buildTicketIoListCardEvidence({
      event: {
        externalId: 'https://bootshaus-tickets.ticket.io/YvJnLSXd/',
        title: 'Canonical Title',
        startDate: '2026-08-07T22:00:00+02:00',
        venueName: 'Bootshaus',
        ticketUrl: 'https://bootshaus-tickets.ticket.io/YvJnLSXd/',
        eventSlug: 'YvJnLSXd',
        platform: 'ticket_io',
        shopSlug: 'bootshaus',
      },
      listContext: card,
      detailHtml: powDetail,
      detailFetchStatus: 'pow_challenge',
      aliasProof: alias,
      observedAt: '2026-08-07T12:00:00.000Z',
      verifiedAt: '2026-08-07T12:00:00.000Z',
    });
    expect(evidence?.priceText).toMatch(/30/);
    expect(evidence?.listRowTitle).toContain('LEVI');
    expect(evidence?.redirectFinalHost).toBe('bootshaus-tickets.ticket.io');
    expect(evidence?.detailFetchStatus).toBe('pow_challenge');
  });

  it('G does not guess a shop subdomain without observed links', () => {
    const discovery = discoverTicketIoShopRoot({
      officialPageHtml: '<html><body><p>No ticketing links here.</p></body></html>',
      officialPageUrl: 'https://organizer.example/events/demo/',
    });
    expect(discovery.discovered).toBe(false);
    expect(discovery.shopDiscoveryMethod).toBe('none');
    expect(discovery.discoveredShopRoot).toBeUndefined();
  });

  it('H keeps three-way identity gate effective and blocks writes on conflict', () => {
    const contexts = parseAllTicketIoListRowContexts(BC173_LIST_CARD_ROW, SHOP_ROOT);
    const card = contexts.get('BcDqml12')!;
    const gate = evaluateEventEvidenceIdentityGate({
      event: {
        eventId: 'evt-bc173',
        title: 'Bootshaus pres. BC173 (let\'s get loco)',
        startDate: '2026-08-15T14:00:00+00:00',
        venueName: 'Bootshaus',
        ticketUrl: 'https://bootshaus-club.ticket.io/BcDqml12/',
      },
      evidence: {
        listRowTitle: card.listRowTitle,
        eventDate: card.eventDate,
        venueName: card.venueName,
        publicTicketPageUrl: card.publicTicketPageUrl,
      },
      officialPage: {
        pageTitle: 'Bootshaus pres. BC173 (let\'s get loco)',
        eventDate: '2026-08-15T14:00:00+00:00',
        venueName: 'Bootshaus',
        outboundTicketUrls: ['https://bootshaus-club.ticket.io/BcDqml12/'],
      },
      evidenceUrl: card.publicTicketPageUrl,
      verifiedAt: '2026-08-07T12:00:00.000Z',
    });
    expect(gate.criticalFieldsPublishAllowed).toBe(false);

    const write = writeCanonicalTicketFields({
      existing: {
        id: 'evt-bc173',
        title: 'Bootshaus pres. BC173 (let\'s get loco)',
        description: 'Desc',
        startDate: '2026-08-15T14:00:00+00:00',
        status: 'published',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        venueName: 'Bootshaus',
        priceText: 'ab 23,00 €',
        ticketUrl: 'https://bootshaus-club.ticket.io/BcDqml12/',
      },
      candidate: {
        externalId: 'https://bootshaus-club.ticket.io/BcDqml12/',
        sourceId: 'audit',
        sourceName: 'audit',
        title: 'Bootshaus pres. BC173 (let\'s get loco)',
        startDate: '2026-08-15T14:00:00+00:00',
        venueName: 'Bootshaus',
        ticketUrl: 'https://bootshaus-club.ticket.io/BcDqml12/',
        priceText: card.priceText,
        rawSourceType: 'html',
        sourceMetadata: {
          listRowTitle: card.listRowTitle,
          eventDate: card.eventDate,
          venueName: card.venueName,
          publicTicketPageUrl: card.publicTicketPageUrl,
          verifiedAt: '2026-08-07T12:00:00.000Z',
          ticketOffers: buildListCardAdmissionOffers(card, card.publicTicketPageUrl),
        },
      },
      fillOnly: false,
    });
    expect(write.patch.priceText).toBeUndefined();
  });

  it('requires complete same-card identity before accepting alias proof', () => {
    const incomplete = `<tr><td id="event-row-YvJnLSXd" class="row">
<a href="/YvJnLSXd/" class="a-eventlink">LEVI</a>
</td></tr>`;
    const card = parseAllTicketIoListRowContexts(incomplete, SHOP_ROOT).get('YvJnLSXd')!;
    const alias = proveTicketIoHostAlias({
      listCard: card,
      shopRootUrl: SHOP_ROOT,
      redirectObservation: {
        linkedEventUrl: 'https://bootshaus.ticket.io/YvJnLSXd/',
        redirectFinalUrl: 'https://bootshaus-tickets.ticket.io/YvJnLSXd/',
      },
    });
    expect(alias.valid).toBe(false);
    expect(alias.reason).toBe('list_card_identity_incomplete');
  });

  it('discovers shop root from first-party hop page embed', () => {
    const discovery = discoverTicketIoShopRoot({
      officialPageHtml: '<html><body><a href="https://organizer.example/tickets">Tickets</a></body></html>',
      officialPageUrl: 'https://organizer.example/events/demo/',
      firstPartyHopPageHtml: FIRST_PARTY_HOP_WITH_EMBED,
    });
    expect(discovery.discoveredShopRoot).toBe('https://bootshaus-tickets.ticket.io/');
    expect(discovery.shopDiscoveryMethod).toBe('official_iframe_embed');
  });

  it('parses bootshaus fixture cards with slug-bound identity fields', () => {
    const html = readFileSync(BOOTSHAUS_SHOP, 'utf8');
    const contexts = parseAllTicketIoListRowContexts(html, 'https://bootshaus-club.ticket.io/');
    const bc173 = contexts.get('BcDqml12');
    expect(bc173?.listRowTitle).toContain('BC173');
    expect(bc173?.venueName).toContain('Moxy');
    expect(bc173?.priceText).toMatch(/23|26/);
    expect(bc173?.linkedEventUrl).toContain('BcDqml12');
  });
});
