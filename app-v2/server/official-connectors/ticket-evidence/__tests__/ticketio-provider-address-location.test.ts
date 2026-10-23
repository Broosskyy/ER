import { describe, expect, it } from 'vitest';
import { parseTicketIoDetailDom } from '../parse-ticket-io-detail-dom';
import { TicketIoEvidenceProvider } from '../ticket-io-evidence-provider';

const url='https://electric-horizon.ticket.io/Wtl0ajjK/';
const html='<html><script type="application/ld+json">'+JSON.stringify({
  '@context':'https://schema.org','@type':'MusicEvent',
  name:'ELECTRIC HORIZON - halle02 | HEIDELBERG',
  startDate:'2026-11-21T22:00:00+01:00',
  location:{
    '@type':'Place',name:'halle02 - Heidelberg',
    address:{'@type':'PostalAddress',streetAddress:'Zollhofgarten 2',
      addressLocality:'Heidelberg',postalCode:'69115',addressCountry:'DE'},
  },
  description:'Zwei Floors Hardtechno, Trance & Bounce in der halle02. Die Veranstalter bestätigen den Veranstaltungsort und das Datum mit weiteren Infos.',
})+'</script></html>';

describe('ticket.io official event location mapping',()=>{
  it('extracts the city from event-specific PostalAddress, not promoter data',()=>{
    const parsed=parseTicketIoDetailDom(html,{sourceUrl:url,providerEventId:'Wtl0ajjK',shopHost:'electric-horizon.ticket.io'});
    expect(parsed?.cityName).toBe('Heidelberg');
    expect(parsed?.venueAddress).toContain('Zollhofgarten 2');
    expect(parsed?.venueName).toBe('halle02 - Heidelberg');
  });
  it('makes city available to the reusable ticket.io organizer importer',async()=>{
    const provider=new TicketIoEvidenceProvider();
    const verified=await provider.fetchEventEvidence({
      url:new URL(url),canonicalTicketUrl:url,redirectChain:[url],
      body:html,contentType:'text/html',fingerprint:'sha-fixture',
      observedAt:'2026-10-23T13:00:00Z',extractedAt:'2026-10-23T13:00:00Z',
    });
    expect(verified.event.cityName).toBe('Heidelberg');
    expect(verified.event.venueName).toBe('halle02 - Heidelberg');
  });
});