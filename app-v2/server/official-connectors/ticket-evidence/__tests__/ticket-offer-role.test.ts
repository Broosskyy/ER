import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { TicketIoEvidenceProvider } from '../ticket-io-evidence-provider';
import { parseTicketIoPage } from '../parse-ticket-io-page';
import { classifyTicketOffer, isRegularAdmissionOfferRole } from '../ticket-offer-role';
import { auditRawProviderOffers } from '../ticket-offer-audit';
import { selectRegularAdmissionOffer, selectRegularAdmissionOfferWithAudit } from '../select-regular-admission-offer';

const FIXTURE_DIR = join(__dirname, 'fixtures');

describe('ticket offer roles', () => {
  it('rejects parking, locker and shuttle add-ons by default', () => {
    expect(classifyTicketOffer({ label: 'Parkticket Claudius Therme' }).role).toBe('parking');
    expect(classifyTicketOffer({ label: 'Locker – Size M' }).role).toBe('locker');
    expect(classifyTicketOffer({ label: 'SHUTTLE: 1x Shuttle Ticket – One-Time Use' }).role).toBe('shuttle');
    expect(isRegularAdmissionOfferRole('parking')).toBe(false);
  });

  it('accepts positive admission labels', () => {
    expect(classifyTicketOffer({ label: 'Phase 3' }).role).toBe('regular_admission');
    expect(classifyTicketOffer({ label: 'FRIDAY Dayticket (Phase 3)' }).grantsEventEntry).toBe(true);
    expect(classifyTicketOffer({ label: 'Upgrade only valid in combination with ticket' }).requiresBaseTicket).toBe(true);
  });
});

describe('Loonyland fixture', () => {
  it('selects Phase 3 and rejects cheaper add-ons', async () => {
    const html = readFileSync(join(FIXTURE_DIR, 'ticket-io-loonyland.html'), 'utf8');
    const provider = new TicketIoEvidenceProvider();
    const evidence = await provider.fetchEventEvidence({
      url: new URL('https://bootshaus-club.ticket.io/tA3dBrv7/'),
      canonicalTicketUrl: 'https://bootshaus-club.ticket.io/tA3dBrv7/',
      redirectChain: ['https://bootshaus-club.ticket.io/tA3dBrv7/'],
      body: html,
      contentType: 'text/html',
      fingerprint: 'fixture-loonyland',
      observedAt: '2026-08-18T12:00:00.000Z',
      extractedAt: '2026-08-18T12:00:01.000Z',
    });

    const selection = selectRegularAdmissionOfferWithAudit(evidence.tickets);
    expect(selection.selected?.rawLabel).toBe('Phase 3');
    expect(selection.selected?.amountMinor).toBe(2590);
    expect(selection.rejectedCheaperOffers.map((entry) => entry.reason)).toEqual(
      expect.arrayContaining(['locker', 'locker', 'parking']),
    );

    const independent = auditRawProviderOffers({
      eventTitle: 'Loonyland',
      provider: 'ticket_io',
      offers: evidence.tickets.offers.map((offer) => ({
        productName: offer.rawLabel ?? '',
        priceMinor: offer.amountMinor,
        availability: offer.availability,
      })),
    });
    expect(independent.selected?.productName).toBe('Phase 3');
    expect(independent.selected?.priceMinor).toBe(2590);
  });
});

describe('Nibirii Festival fixture', () => {
  it('selects Friday Dayticket and rejects shuttle, upgrades and sold-out tiers', async () => {
    const html = readFileSync(join(FIXTURE_DIR, 'ticket-io-nibirii-festival.html'), 'utf8');
    const provider = new TicketIoEvidenceProvider();
    const evidence = await provider.fetchEventEvidence({
      url: new URL('https://nibirii-festival.ticket.io/uw3dsjtw/'),
      canonicalTicketUrl: 'https://nibirii-festival.ticket.io/uw3dsjtw/',
      redirectChain: ['https://nibirii-festival.ticket.io/uw3dsjtw/'],
      body: html,
      contentType: 'text/html',
      fingerprint: 'fixture-nibirii',
      observedAt: '2026-08-18T12:00:00.000Z',
      extractedAt: '2026-08-18T12:00:01.000Z',
    });

    const selection = selectRegularAdmissionOfferWithAudit(evidence.tickets);
    expect(selection.selected?.rawLabel).toBe('FRIDAY Dayticket (Phase 3)');
    expect(selection.selected?.amountMinor).toBe(9900);
    expect(selection.rejectedCheaperOffers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ offer: expect.objectContaining({ rawLabel: 'SHUTTLE: 1x Shuttle Ticket – One-Time Use' }), reason: 'shuttle' }),
        expect.objectContaining({ offer: expect.objectContaining({ rawLabel: 'SUNDAY Dayticket (Phase 3)' }), reason: 'sold_out' }),
      ]),
    );
  });
});

describe('generic role regression', () => {
  it('rejects camping-only, merchandise and unknown cheap products', () => {
    expect(classifyTicketOffer({ label: 'Admission' }).role).toBe('unknown');
    expect(classifyTicketOffer({ label: 'Camping Only' }).role).toBe('camping');
    expect(classifyTicketOffer({ label: 'Festival T-Shirt' }).role).toBe('merchandise');
    expect(classifyTicketOffer({ label: 'Mystery Box' }).role).toBe('unknown');
    expect(classifyTicketOffer({ label: 'VIP Lounge' }).role).toBe('vip_admission');
    expect(classifyTicketOffer({ label: 'Early Bird' }).role).toBe('regular_admission');
    expect(classifyTicketOffer({ label: 'First Release' }).role).toBe('regular_admission');
    expect(classifyTicketOffer({ label: 'Upgrade only valid in combination with ticket' }).role).toBe('upgrade');
    expect(classifyTicketOffer({ label: 'Upgrade only valid in combination with ticket' }).requiresBaseTicket).toBe(true);
  });

  it('does not treat unnamed JSON-LD aggregate prices as admission', () => {
    const html = `<!DOCTYPE html><html><body>
      <script type="application/ld+json">{
        "@type":"MusicEvent",
        "name":"LOONYLAND",
        "offers":{"@type":"AggregateOffer","lowPrice":8,"priceCurrency":"EUR","availability":"https://schema.org/InStock"}
      }</script>
    </body></html>`;
    const evidence = parseTicketIoPage({
      sourceUrl: 'https://bootshaus-club.ticket.io/tA3dBrv7/',
      body: html,
      fingerprint: 'jsonld-aggregate',
      observedAt: '2026-08-18T12:00:00.000Z',
      extractedAt: '2026-08-18T12:00:01.000Z',
    });
    expect(evidence?.offers.some((offer) => offer.amountMinor === 800 && offer.role === 'regular_admission')).toBe(false);
    expect(selectRegularAdmissionOffer(evidence!)).toBeUndefined();
  });
});
