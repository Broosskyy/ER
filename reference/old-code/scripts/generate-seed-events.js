#!/usr/bin/env node
/**
 * Generates supabase/seed_published_events.sql — 30 published events (Sprint 2.1)
 */
const fs = require('fs');
const path = require('path');

const cities = {
  Berlin: { country: 'Germany', lat: 52.52, lng: 13.405 },
  Hamburg: { country: 'Germany', lat: 53.551, lng: 9.994 },
  Köln: { country: 'Germany', lat: 50.937, lng: 6.96 },
  Frankfurt: { country: 'Germany', lat: 50.111, lng: 8.682 },
  Amsterdam: { country: 'Netherlands', lat: 52.367, lng: 4.904 },
  Rotterdam: { country: 'Netherlands', lat: 51.924, lng: 4.478 },
  Vienna: { country: 'Austria', lat: 48.208, lng: 16.373 },
  Zurich: { country: 'Switzerland', lat: 47.376, lng: 8.541 },
  Prague: { country: 'Czech Republic', lat: 50.075, lng: 14.437 },
  Barcelona: { country: 'Spain', lat: 41.387, lng: 2.168 },
  London: { country: 'United Kingdom', lat: 51.507, lng: -0.128 },
};

const images = [
  '1571266028247-d220c702765f',
  '1514525253161-7a46d19cd819',
  '1493225457124-a3eb161ffa5f',
  '1470225620780-e2290ab8d1c0',
  '1533174072545-7a4b6ad2a90b',
  '1516450360452-9312f5e86fc7',
  '1459745459774-aa922786897c',
  '1506157786151-b8491531f063',
  '1574169208507-843761e48f50',
  '1511379938549-c1f69419868d',
];

const events = [
  { city: 'Berlin', title: 'Berghain Klubnacht', venue: 'Berghain', address: 'Am Wriezener Bahnhof, 10243 Berlin', genres: ['Techno', 'Hard Techno'], type: 'Club Night', price: 28, days: 0, hour: 23, desc: 'Legendary Berlin techno marathon. Strict door policy, world-class sound.', artists: ['Dax J', 'Kobosil', 'FJAAK'] },
  { city: 'Berlin', title: 'Sisyphos Garden Rave', venue: 'Sisyphos', address: 'Hauptstraße 15, 10317 Berlin', genres: ['House', 'Minimal'], type: 'Open Air', price: 22, days: 2, hour: 20, desc: 'Open-air grooves and minimal house until sunrise.', artists: ['Traumprinz', 'Binh', 'Perel'] },
  { city: 'Berlin', title: 'RSO Industrial Works', venue: 'RSO.Berlin', address: 'Storkower Str. 133, 10407 Berlin', genres: ['Industrial', 'Techno'], type: 'Warehouse', price: 18, days: 5, hour: 23, desc: 'Raw warehouse energy — industrial techno and distorted kicks.', artists: ['Phase Fatale', 'Verraco', 'I Hate Models'] },
  { city: 'Hamburg', title: 'VOID at Uebel & Gefährlich', venue: 'Uebel & Gefährlich', address: 'Feldstraße 66, 20359 Hamburg', genres: ['Hard Techno', 'Techno'], type: 'Club Night', price: 15, days: 1, hour: 22, desc: 'Hamburg signature hard techno night — fast, loud, unapologetic.', artists: ['Nico Moreno', 'I Hate Models', 'Klangkuenstler'] },
  { city: 'Hamburg', title: 'Dockville Warm-up Session', venue: 'Dockville Area', address: 'Georgswerder Bogen, 21109 Hamburg', genres: ['Melodic Techno', 'House'], type: 'Open Air', price: 35, days: 3, hour: 19, desc: 'Melodic techno and house by the Elbe — festival season starts here.', artists: ['Adriatique', 'Mind Against', 'Tale Of Us'] },
  { city: 'Hamburg', title: 'Pudel DnB Takeover', venue: 'Pudel Club', address: 'St. Pauli Fischmarkt 27, 20359 Hamburg', genres: ['DnB'], type: 'Club Night', price: 12, days: 7, hour: 23, desc: 'Drum & bass all night with Hamburg finest selectors.', artists: ['Alix Perez', 'Monty', 'Visages'] },
  { city: 'Köln', title: 'Gewölbe Techno Freitag', venue: 'Gewölbe', address: 'Im Mediapark 8, 50670 Köln', genres: ['Techno'], type: 'Club Night', price: 14, days: 4, hour: 22, desc: 'Köln basement institution — driving techno until early hours.', artists: ['Len Faki', 'Ben Klock', 'Marcel Dettmann'] },
  { city: 'Köln', title: 'Bootshaus Hardcore Heaven', venue: 'Bootshaus', address: 'Auenweg 173, 51063 Köln', genres: ['Hardcore', 'Hard Techno'], type: 'Club Night', price: 20, days: 6, hour: 23, desc: 'Hardcore and hard techno on the Rhine.', artists: ['Angerfist', 'Miss K8', 'N-Vitral'] },
  { city: 'Köln', title: 'Odonien Psy Garden', venue: 'Odonien', address: 'Hornstraße 85, 50825 Köln', genres: ['Psytrance', 'Techno'], type: 'Open Air', price: 16, days: 10, hour: 18, desc: 'Psytrance and progressive grooves in Köln creative garden.', artists: ['Astrix', 'Vini Vici', 'Liquid Soul'] },
  { city: 'Frankfurt', title: 'Gibson Club Marathon', venue: 'Gibson Club', address: 'Karl-Benz-Straße 21, 60386 Frankfurt', genres: ['Techno', 'Minimal'], type: 'Club Night', price: 17, days: 2, hour: 23, desc: 'Frankfurt techno institution — long sets, dark rooms.', artists: ['Sven Väth', 'Chris Liebing', 'Lucy'] },
  { city: 'Frankfurt', title: 'Robert Johnson All Night', venue: 'Robert Johnson', address: 'Nordring 131, 60388 Frankfurt', genres: ['Minimal', 'House'], type: 'Club Night', price: 19, days: 8, hour: 22, desc: 'Minimal and house perfection on the Main.', artists: ['Ricardo Villalobos', 'Raresh', 'Rhadow'] },
  { city: 'Frankfurt', title: 'Tanzhaus West Melodic', venue: 'Tanzhaus West', address: 'Gutleutstraße 294, 60327 Frankfurt', genres: ['Melodic Techno'], type: 'Warehouse', price: 15, days: 12, hour: 21, desc: 'Melodic techno and emotional peaks in Frankfurt warehouse.', artists: ['Anyma', 'Massano', 'MRAK'] },
  { city: 'Amsterdam', title: 'De School Night Program', venue: 'De School', address: 'Dr Jan van Breemenstraat 1, 1056 AB Amsterdam', genres: ['Techno'], type: 'Club Night', price: 24, days: 1, hour: 23, desc: 'Amsterdam cultural bunker — techno, art, marathon sessions.', artists: ['Amelie Lens', 'Charlotte de Witte', '999999999'] },
  { city: 'Amsterdam', title: 'Paradiso DnB Sessions', venue: 'Paradiso', address: 'Weteringschans 6-8, 1017 SG Amsterdam', genres: ['DnB'], type: 'Club Night', price: 22, days: 5, hour: 20, desc: 'Legendary venue hosts full drum & bass programme.', artists: ['Noisia', 'Camo & Krooked', 'Metrik'] },
  { city: 'Amsterdam', title: 'RADION Warehouse Rave', venue: 'RADION', address: 'Louwesweg 1, 1066 EA Amsterdam', genres: ['Industrial', 'Techno'], type: 'Warehouse', price: 18, days: 9, hour: 23, desc: 'Industrial techno in a former hospital.', artists: ['Paula Temple', 'Anetha', 'VTSS'] },
  { city: 'Rotterdam', title: 'Now&Wow Festival Warm-up', venue: 'Maassilo', address: 'Maashaven Zuidzijde 1-2, 3081 AE Rotterdam', genres: ['House', 'Techno'], type: 'Festival', price: 30, days: 11, hour: 19, desc: 'House and techno preview ahead of Rotterdam summer highlight.', artists: ['Carl Cox', 'Joseph Capriati', 'Adam Beyer'] },
  { city: 'Rotterdam', title: 'Maassilo Hard Techno', venue: 'Maassilo', address: 'Maashaven Zuidzijde 1-2, 3081 AE Rotterdam', genres: ['Hard Techno'], type: 'Warehouse', price: 25, days: 14, hour: 22, desc: 'Hard techno in an iconic silo.', artists: ['SPFDJ', 'Kluster', 'Nico Moreno'] },
  { city: 'Vienna', title: 'Flex Vienna Techno', venue: 'Flex', address: 'Augartenbrücke 1, 1020 Wien', genres: ['Techno'], type: 'Club Night', price: 16, days: 3, hour: 22, desc: 'Austria flagship club — techno, visuals, serious crowd.', artists: ['Rebekah', 'Anja Schneider', 'Len Faki'] },
  { city: 'Vienna', title: 'Grelle Forelle Melodic', venue: 'Grelle Forelle', address: 'Spittelauer Lände 12, 1090 Wien', genres: ['Melodic Techno', 'House'], type: 'Club Night', price: 18, days: 6, hour: 23, desc: 'Melodic techno on the Danube canal.', artists: ['Colyn', 'Innellea', 'Kevin de Vries'] },
  { city: 'Vienna', title: 'Pratersauna Summer', venue: 'Pratersauna', address: 'Waldsteig 3, 1020 Wien', genres: ['House', 'Minimal'], type: 'Open Air', price: 14, days: 13, hour: 18, desc: 'Summer sessions at Vienna favourite riverside spot.', artists: ['DJ Tennis', 'Gerd Janson', 'Moomin'] },
  { city: 'Zurich', title: 'Hive Club Night', venue: 'Hive Club', address: 'Geroldstrasse 5, 8005 Zürich', genres: ['Techno', 'Minimal'], type: 'Club Night', price: 20, days: 4, hour: 23, desc: 'Zurich underground techno in a tight basement.', artists: ['DVS1', 'Answer Code Request', 'Sam Paganini'] },
  { city: 'Zurich', title: 'Kaufleuten House Session', venue: 'Kaufleuten', address: 'Pelikanstrasse 18, 8001 Zürich', genres: ['House'], type: 'Club Night', price: 22, days: 15, hour: 22, desc: 'Upscale house night in Zurich historic club.', artists: ['Black Coffee', 'Peggy Gou', 'Folamour'] },
  { city: 'Prague', title: 'Roxy Prague Techno', venue: 'Roxy', address: 'Dlouhá 33, 110 00 Praha', genres: ['Techno'], type: 'Club Night', price: 13, days: 7, hour: 22, desc: 'Prague techno landmark in the old town.', artists: ['Rødhåd', 'DVS1', 'Blawan'] },
  { city: 'Prague', title: 'Ankali Deep Minimal', venue: 'Ankali', address: 'Bubenské nábřeží 306, 170 00 Praha', genres: ['Minimal', 'Melodic Techno'], type: 'Club Night', price: 11, days: 16, hour: 23, desc: 'Deep minimal and melodic grooves by the river.', artists: ['Priku', 'Cezar', 'Arapu'] },
  { city: 'Barcelona', title: 'Nitsa Club Techno', venue: 'Nitsa Club', address: 'Plaça Reial 10, 08002 Barcelona', genres: ['Techno'], type: 'Club Night', price: 15, days: 2, hour: 23, desc: 'Barcelona techno institution under Plaça Reial.', artists: ['Oscar Mulero', 'Regal', 'Claudio PRC'] },
  { city: 'Barcelona', title: 'INPUT High Fidelity', venue: 'INPUT', address: 'C/ d\'Equador 40, 08029 Barcelona', genres: ['House', 'Techno'], type: 'Club Night', price: 18, days: 8, hour: 23, desc: 'High-fidelity sound system and curated electronic lineups.', artists: ['Honey Dijon', 'The Martinez Brothers', 'Dennis Ferrer'] },
  { city: 'Barcelona', title: 'Sala Apolo Hardcore', venue: 'Sala Apolo', address: 'C/ Nou de la Rambla 109, 08001 Barcelona', genres: ['Hardcore', 'DnB'], type: 'Club Night', price: 16, days: 17, hour: 22, desc: 'Hardcore and DnB takeover at Apolo.', artists: ['Neophyte', 'Mad Dog', 'Mefjus'] },
  { city: 'London', title: 'Fabric Room One', venue: 'Fabric', address: '77A Charterhouse St, London EC1M 6HJ', genres: ['DnB', 'Techno'], type: 'Club Night', price: 26, days: 0, hour: 22, desc: 'London legendary club — DnB and techno in Room One.', artists: ['Andy C', 'Chase & Status', 'Pendulum'] },
  { city: 'London', title: 'Printworks London', venue: 'Printworks', address: 'Surrey Quays Rd, London SE16 7PJ', genres: ['Techno', 'Hard Techno'], type: 'Warehouse', price: 45, days: 9, hour: 19, desc: 'Massive warehouse rave at Printworks London.', artists: ['Charlotte de Witte', 'Amelie Lens', 'I Hate Models'] },
  { city: 'London', title: 'Ministry of Sound', venue: 'Ministry of Sound', address: '103 Gaunt St, London SE1 6DP', genres: ['House'], type: 'Club Night', price: 30, days: 20, hour: 22, desc: 'Iconic London house night — global DJs, big production.', artists: ['John Summit', 'Fisher', 'Chris Lake'] },
];

function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function uuid(n) {
  return `2b0e8400-e29b-41d4-a716-${String(n).padStart(12, '0')}`;
}

function esc(s) {
  return s.replace(/'/g, "''");
}

const eventRows = [];
const artistRows = [];

events.forEach((e, i) => {
  const id = uuid(i + 1);
  const slug = slugify(e.title);
  const meta = cities[e.city];
  const lat = meta.lat + (i % 5) * 0.008;
  const lng = meta.lng + (i % 3) * 0.006;
  const img = images[i % images.length];
  const start = `date_trunc('day', now()) + interval '${e.days} days ${e.hour} hours'`;
  const end = `date_trunc('day', now()) + interval '${e.days} days ${e.hour + 8} hours'`;
  const genres = `array[${e.genres.map((g) => `'${g}'`).join(', ')}]`;

  eventRows.push(`(
  '${id}',
  '${esc(e.title)}',
  '${esc(e.desc)}',
  '${esc(e.type)}',
  ${genres},
  ${start},
  ${end},
  '${esc(e.city)}', '${esc(meta.country)}', '${esc(e.venue)}', '${esc(e.address)}',
  ${lat.toFixed(4)}, ${lng.toFixed(4)},
  ${e.price}, '18+',
  'https://tickets.eternalrave.app/${slug}',
  'https://source.eternalrave.app/events/${slug}',
  'https://images.unsplash.com/photo-${img}?w=800&h=600&fit=crop',
  'published', 'seed', ${(0.85 + (i % 10) * 0.01).toFixed(2)}
)`);

  e.artists.forEach((name, j) => {
    const slotHour = e.hour + j * 2;
    artistRows.push(`('${id}', '${esc(name)}', '${String(slotHour % 24).padStart(2, '0')}:00', ${j})`);
  });
});

const sql = `-- Sprint 2.1 — 30 published seed events for Eternal Rave
-- Generated by scripts/generate-seed-events.js
-- Run after 001_initial_schema.sql in Supabase SQL Editor.
-- Idempotent: removes previous seed rows (source_type = 'seed') before insert.

delete from public.event_artists
where event_id in (select id from public.events where source_type = 'seed');

delete from public.events where source_type = 'seed';

insert into public.events (
  id, title, description, event_type, genres,
  start_datetime, end_datetime,
  city, country, venue_name, address,
  latitude, longitude,
  price, age_restriction,
  ticket_url, source_url, flyer_url,
  lifecycle_status, source_type, confidence_score
) values
${eventRows.join(',\n')};

insert into public.event_artists (event_id, artist_name, slot_time, sort_order) values
${artistRows.join(',\n')};
`;

const out = path.join(__dirname, '..', 'supabase', 'seed_published_events.sql');
fs.writeFileSync(out, sql);
console.log(`Wrote ${events.length} events (${artistRows.length} artists) to ${out}`);
