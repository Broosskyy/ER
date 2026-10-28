import {describe,expect,it} from 'vitest';
import {discoverOdonienClubEventUrls,parseOdonienClubDetail,canonicalizeOdonienUrl} from '../parse-official-event';

const SYMBIOSE='https://odonien.de/veranstaltungen/art-of-symbiose';
function detail(name:string,date:string,description:string):string {
 return '<html><head><meta property="og:image" content="https://odonien.de/test.jpg"></head>'+
 '<body><nav>Club Kultur Impressum</nav><main><h1>'+name+'</h1><div>'+date+'</div>'+
 '<article><h2>Programm</h2><p>'+description+'</p><h3>TICKETS</h3>'+
 '<p>Vorverkauf bei rausgegangen.de</p></article><h3>Club Care Odonien</h3></main></body></html>';
}
describe('Odonien club-only official event intake',()=>{
 it('finds only explicit club event detail links and deduplicates',()=>{
  const html='<main><a href="/veranstaltungen/art-of-symbiose">SYMBIOSE</a>'+
   '<a href="https://odonien.de/veranstaltungen/wyldhearts">Wyldhearts</a>'+
   '<a href="/veranstaltungen/art-of-symbiose">dup</a>'+
   '<a href="https://tickets.example/checkout">foreign</a>'+
   '</main>';
  expect(discoverOdonienClubEventUrls(html)).toEqual([SYMBIOSE,'https://odonien.de/veranstaltungen/wyldhearts']);
 });
 it('preserves official local date and published dance genres without fabricating lineup or price',()=>{
  const html=detail('Art of House x art of urban life pres. SYMBIOSE',
   '30.10.2026 23:00 Uhr',
   'Eine treibende Symbiose aus House, Trancy Bouncy Techno, Neo Rave, Groove-Techno, NuDisco, Melodic Techno, Hard Trance & Hard Bounce. LINE UP: Snoritz. Kichererbsenstampf.');
  const parsed=parseOdonienClubDetail(html,SYMBIOSE,'2026-10-28T10:00:00Z');
  expect(parsed?.startsAt).toBe('2026-10-30T23:00:00+01:00');
  expect(parsed?.venue).toMatchObject({name:'Odonien',city:'Köln'});
  expect(parsed?.explicitGenreLabels).toContain('House');
  expect(parsed?.explicitGenreLabels).toContain('Melodic Techno');
  expect(parsed?.lineupCandidates).toEqual([]);
  expect(parsed?.linkedTicketUrl).toBeUndefined();
 });
 it('rejects non-dance culture shows even with a valid date and location',()=>{
  expect(parseOdonienClubDetail(detail('ROBODONIEN LEUCHTET',
   '15.11.2026 15:00 Uhr',
   'Roboterkunst, Feuerinstallationen und Performances treffen auf Lichtkunst. Familienprogramm mit Essen und Getränken.'),
   'https://odonien.de/veranstaltungen/robodonien-leuchtet-2026-15','2026-10-28T10:00:00Z')).toBeNull();
 });
 it('rejects missing dates, invalid hosts and unrelated pages',()=>{
  expect(parseOdonienClubDetail(detail('SYMBIOSE','Uhrzeit unbekannt',
   'House, Techno und Hard Trance auf drei Floors mit vielen Acts im Club.'),
   SYMBIOSE,'2026-10-28T10:00:00Z')).toBeNull();
  expect(canonicalizeOdonienUrl('https://another.example/veranstaltungen/test')).toBeNull();
  expect(canonicalizeOdonienUrl('https://odonien.de/kultur')).toBeNull();
 });
});
