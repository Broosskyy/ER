#!/usr/bin/env node
const UA = 'EternalRave-SourceBot/1.0 (+https://eternalrave.app; source-research)';
const candidates = [
  { name: 'Bootshaus list', url: 'https://bootshaus.tv/events/' },
  { name: 'Bootshaus detail', url: 'https://bootshaus.tv/events/1-8-26-play-open-air-bootshaus-koeln' },
  { name: 'Odonien home', url: 'https://odonien.de/' },
  { name: 'Grelle Forelle', url: 'https://www.grelleforelle.com/' },
  { name: 'Gebäude 9', url: 'https://gebaeude9.de/programm/' },
  { name: 'Live Club Cologne', url: 'https://live-club.net/events/' },
  { name: 'Cologne Dance', url: 'https://www.cologne-dance.de/events' },
];

for (const c of candidates) {
  try {
    const r = await fetch(c.url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(15000) });
    const html = await r.text();
    const jsonLd = (html.match(/application\/ld\+json/gi) ?? []).length;
    const schema = /"@type"\s*:\s*"(MusicEvent|Event|Festival)"/i.test(html);
    const next = /__NEXT_DATA__/i.test(html);
    const eventLinks = (html.match(/href="[^"]*\/event[^"]*"/gi) ?? []).length;
    const upcoming = /upcoming-item|event-item|event-card|termin/i.test(html);
    console.log(JSON.stringify({ name: c.name, status: r.status, final: r.url, size: html.length, jsonLd, schema, next, eventLinks, upcoming }));
  } catch (e) {
    console.log(JSON.stringify({ name: c.name, error: e.message }));
  }
  await new Promise((r) => setTimeout(r, 400));
}
