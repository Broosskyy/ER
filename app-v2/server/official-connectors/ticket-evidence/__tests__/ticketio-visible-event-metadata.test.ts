import { describe, expect, it } from 'vitest';
import { parseTicketIoVisibleEventMetadata } from '../parse-ticketio-visible-event-metadata';
import { TicketIoEvidenceProvider } from '../ticket-io-evidence-provider';

function html(title:string, place:string, date:string, time:string, description:string):string {
  return '<html><body><h1>'+title+'</h1><div>location_on Adresse/Location:'+
    place+' calendar_month Datum '+date+' schedule Uhrzeit '+time+
    ' Uhr</div><div class="event-description">'+description+
    '</div><table><tr><th>Tickets</th><th>Einzelpreis</th></tr></table>'+
    '<div>location_on Adresse/Location: Ampere, Ronsdorfer Straße 134 40233 Düsseldorf Deutschland '+
    'calendar_month Datum '+date+' schedule Uhrzeit '+time+' Uhr</div></body></html>';
}
const description='WELCOME TO CHAPTER THREE. Hardtechno und Schranz with five international DJs, zwei Floors und offiziellen Veranstaltungsdetails.';

describe('ticket.io visible event fallback when JSON-LD is absent',()=>{
  it('reads exact title, date, local CET time, city and event description',()=>{
    const out=parseTicketIoVisibleEventMetadata(html(
      'AREA51 TECHNO - HART AN DER GRENZE, Chapter 3 x AMPERE Düsseldorf',
      'Ampere, Düsseldorf','Sa. 28.11.2026','22:00',description));
    expect(out).toMatchObject({
      title:'AREA51 TECHNO - HART AN DER GRENZE, Chapter 3 x AMPERE Düsseldorf',
      startsAt:'2026-11-28T22:00:00+01:00',
      venueName:'Ampere',cityName:'Düsseldorf',countryName:'DE',
      descriptionClean:description,
    });
  });
  it('preserves summertime timezone without inventing local timestamps',()=>{
    const out=parseTicketIoVisibleEventMetadata(html('Technofestival','Nachtfabrik, Reutlingen',
      'Sa. 27.06.2027','23:30',description));
    expect(out.startsAt).toBe('2027-06-27T23:30:00+02:00');
  });
  it('does not invent venue, date or invalid DST timestamps',()=>{
    const bad=html('Rave in Germany','Not a confirmed city','So. 25.10.2026','02:30',description);
    expect(parseTicketIoVisibleEventMetadata(bad).startsAt).toBeUndefined();
    expect(parseTicketIoVisibleEventMetadata('<html><h1>Random Rave</h1></html>').startsAt).toBeUndefined();
  });
  it('makes visible metadata available through verified ticket.io provider evidence',async()=>{
    const url='https://area51events.ticket.io/aLr3YQLG/';
    const page=html('AREA51 TECHNO - HART AN DER GRENZE, Chapter 3 x AMPERE Düsseldorf',
      'Ampere, Düsseldorf','Sa. 28.11.2026','22:00',description);
    const result=await new TicketIoEvidenceProvider().fetchEventEvidence({
      url:new URL(url),canonicalTicketUrl:url,redirectChain:[url],body:page,
      contentType:'text/html',fingerprint:'real-page-sha',
      observedAt:'2026-10-26T07:00:00Z',extractedAt:'2026-10-26T07:00:00Z',
    });
    expect(result.event.rawTitle).toContain('HART AN DER GRENZE');
    expect(result.event.startAt).toBe('2026-11-28T22:00:00+01:00');
    expect(result.event.cityName).toBe('Düsseldorf');
  });
});
