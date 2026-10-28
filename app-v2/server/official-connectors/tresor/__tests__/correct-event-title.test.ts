import { describe,expect,it } from 'vitest';
import { parseTresorDetail } from '../parse-event';

const url='https://tresorberlin.com/event/20261107-tresor-invites-dave-clarke/';
function page(h1:string,h2:string):string {
 return '<!doctype html><html><head><meta property="og:title" content="'+h2+' | Tresor Berlin"></head><body>'+
  '<h1>'+h1+'</h1><h2>'+h2+'</h2><div>Tresor</div>'+
  '<p>23:00-03:00 Cailín 03:00-06:00 Dave Clarke 06:00-11:00 Dinamite</p>'+
  '<h2>Guest Information</h2><p>Self service lockers and box office policies</p>'+
  '</body></html>';
}
describe('Tresor official event title evidence',()=>{
 it('uses event heading instead of weekday date on a real event page shape',()=>{
  const result=parseTresorDetail(page('Sa 07.11','Tresor invites Dave Clarke'),url,'2026-10-28T10:00:00Z');
  expect(result?.title).toBe('Tresor invites Dave Clarke');
  expect(result?.startsAt).toBe('2026-11-07T23:00:00+01:00');
  expect(result?.descriptionClean).toContain('Tresor invites Dave Clarke');
  expect(result?.descriptionClean).not.toContain('Sa 07.11');
 });
 it('rejects pages that have only a date label and no event title',()=>{
  const html='<html><h1>We 11.11</h1><h2>Guest Information</h2><p>23:00-03:00 someone</p></html>';
  expect(parseTresorDetail(html,'https://tresorberlin.com/event/20261111-tresor-new-faces-hosted-by-tresor-west/','2026-10-28T10:00:00Z')).toBeNull();
 });
 it('does not mistake ticket policy for a title and can use trusted og title',()=>{
  const html='<html><head><meta property="og:title" content="Tresor Klubnacht | Tresor Berlin"></head>'+
    '<body><h1>Sa 31.10</h1><h2>Ticket Policy</h2><p>23:00-03:00 Caniche</p></body></html>';
  const result=parseTresorDetail(html,'https://tresorberlin.com/event/20261031-tresor-klubnacht/','2026-10-28T10:00:00Z');
  expect(result?.title).toBe('Tresor Klubnacht');
 });
});
