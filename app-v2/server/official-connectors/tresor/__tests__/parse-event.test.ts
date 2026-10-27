import {describe,expect,it} from 'vitest';
import {canonicalizeTresorUrl,findTresorEvents,parseTresorDetail} from '../parse-event';

const event='https://tresorberlin.com/event/20261030-tresor-meets-downwards-records/';
const html='<main>'+
  '<a href="/event/20261030-tresor-meets-downwards-records/">Downwards</a>'+
  '<a href="/event/20261107-tresor-invites-dave-clarke/">Dave Clarke</a>'+
  '<a href="/event/20261012-old/">old</a>'+
  '<a href="https://evil.example/event/20261112-a/">fake</a></main>';
const fixture=(schedule:string)=>'<html><body><nav><h1>Tresor Berlin</h1></nav>'+
 '<main><h2>Tresor meets Downwards Records</h2><p>'+schedule+'</p>'+
 '<h2>Guest Information</h2><p>Bring a charged phone, refunds via RA.</p>'+
 '<h2>Ticket Policy</h2></main></body></html>';
describe('Tresor official source',()=>{
  it('filters by event-specific same-origin URL and future calendar day',()=>{
    expect(findTresorEvents(html,new Date('2026-10-27T12:00:00Z'))).toEqual([
      event,'https://tresorberlin.com/event/20261107-tresor-invites-dave-clarke/',
    ]);
    expect(canonicalizeTresorUrl('http://tresorberlin.com/event/20261030-old/')).toBeNull();
    expect(canonicalizeTresorUrl('https://foreign.example/event/20261030-old/')).toBeNull();
  });
  it('preserves exact Berlin date/time and lists only confirmed timed performers',()=>{
    const parsed=parseTresorDetail(fixture(
      'Globus x Downwards 21:00-22:30 Regis DJ SET 22:30-23:30 Test Dept LIVE '+
      'Tresor x Downwards 23:00-02:00 Blu Aloé 02:00-03:00 Scion LIVE'),
      event,'2026-10-27T12:00:00Z');
    expect(parsed?.startsAt).toBe('2026-10-30T21:00:00+01:00');
    expect(parsed?.venue?.city).toBe('Berlin');
    expect(parsed?.descriptionClean).toContain('Regis');
    expect(parsed?.descriptionClean).not.toContain('charged phone');
    expect(parsed?.lineupCandidates.some(act=>act.displayName==='Regis')).toBe(true);
    expect(parsed?.linkedTicketUrl).toBeUndefined();
  });
  it('refuses to make up a start time for only a published date/lineup',()=>{
    const parsed=parseTresorDetail(fixture('Tresor: Nene H Manni Dee Regis'),
      event,'2026-10-27T12:00:00Z');
    expect(parsed).toBeNull();
  });
});
