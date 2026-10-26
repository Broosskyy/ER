import { describe, expect, it } from 'vitest';
import { readTicketIoOfficialCore } from '../read-official-event-core';

const page = [
 '<html><head><meta property="og:title" content="Tickets für AREA51 TECHNO — Chapter 3 | Karten und Infos auf ticket.io"/></head><body>',
 '<h1>Dieser Ticketshop benötigt JavaScript, du hast jedoch leider in Deinem Browser kein JavaScript aktiviert.</h1>',
 '<h2>AREA51 TECHNO — Chapter 3</h2>',
 '<div>location_on Adresse/Location:Ampere, Düsseldorf calendar_month Datum Sa. 28.11.2026 schedule Uhrzeit 22:00 Uhr</div>',
 '<div>Hard Techno und Schranz auf zwei Floors mit internationalen DJs, neuen Sounds, Live-Shows und der offiziellen Eventbeschreibung.</div>',
 '<table><tr><th>Tickets</th><th>Einzelpreis</th></tr><tr><td>Normalpreis</td><td>15 Euro</td></tr></table>',
 '<script>window.checkoutCaptcha = "captcha";</script>',
 '</body></html>',
].join('');

describe('separately published official ticket.io core facts',()=>{
  it('preserves official source event details if ticket provider returns no core',()=>{
    const core=readTicketIoOfficialCore(page,{});
    expect(core.title).toContain('AREA51 TECHNO');
    expect(core.startsAt).toBe('2026-11-28T22:00:00+01:00');
    expect(core.venueName).toBe('Ampere');
    expect(core.cityName).toBe('Düsseldorf');
    expect(core.descriptionClean).toContain('Schranz');
    expect(core.sourceTitleFound).toBe(true);
  });
  it('does not turn a generic security challenge into a fake event',()=>{
    const core=readTicketIoOfficialCore('<title>Security check...</title><body>CAPTCHA</body>',{});
    expect(core.title).toBe('');
    expect(core.startsAt).toBe('');
    expect(core.sourceVenueFound).toBe(false);
  });
  it('does not replace structured provider fields with weaker source fields',()=>{
    const core=readTicketIoOfficialCore(page,{
      rawTitle:'Canonical Provider Event',startAt:'2026-11-29T21:00:00+01:00',
      venueName:'Canonical Club',cityName:'Bonn',
    });
    expect(core.title).toBe('Canonical Provider Event');
    expect(core.startsAt).toBe('2026-11-29T21:00:00+01:00');
    expect(core.cityName).toBe('Bonn');
  });
});
