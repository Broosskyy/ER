#!/usr/bin/env node
const UA = 'EternalRave-SourceBot/1.0 (+https://eternalrave.app; source-research)';
const url = process.argv[2] ?? 'https://bootshaus.tv/events/';

const response = await fetch(url, {
  headers: { 'User-Agent': UA },
  redirect: 'follow',
  signal: AbortSignal.timeout(20000),
});
const html = await response.text();
console.log('status', response.status, 'final', response.url, 'size', html.length);

const patterns = [
  ['json-ld blocks', (html.match(/application\/ld\+json/gi) ?? []).length],
  ['schema Event', (html.match(/"@type"\s*:\s*"Event"/gi) ?? []).length],
  ['event class', (html.match(/class="[^"]*event[^"]*"/gi) ?? []).length],
  ['article tags', (html.match(/<article/gi) ?? []).length],
  ['h2 tags', (html.match(/<h2/gi) ?? []).length],
  ['h3 tags', (html.match(/<h3/gi) ?? []).length],
  ['time tags', (html.match(/<time/gi) ?? []).length],
  ['datetime attrs', (html.match(/datetime=/gi) ?? []).length],
  ['event links', (html.match(/href="[^"]*\/event[^"]*"/gi) ?? []).length],
];

for (const [name, count] of patterns) console.log(name, count);

// sample event blocks
const linkMatches = [...html.matchAll(/href="([^"]*\/event[^"]*)"/gi)].slice(0, 5);
console.log('\nSample event links:');
for (const m of linkMatches) console.log(' ', m[1]);

// find container patterns
const classSamples = [...new Set([...html.matchAll(/class="([^"]{5,80})"/gi)].map((m) => m[1]).filter((c) => /event|card|program|listing|item/i.test(c)))].slice(0, 20);
console.log('\nRelevant classes:', classSamples);

// snippet around first event link
const idx = html.search(/href="[^"]*\/event[^"]*"/i);
if (idx >= 0) {
  console.log('\nSnippet around first event link:\n', html.slice(Math.max(0, idx - 200), idx + 600));
}

// fetch one detail page
if (linkMatches[0]) {
  const detailUrl = new URL(linkMatches[0][1], response.url).toString();
  console.log('\n--- Detail page:', detailUrl);
  const detail = await fetch(detailUrl, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) });
  const detailHtml = await detail.text();
  console.log('detail status', detail.status, 'size', detailHtml.length);
  console.log('detail json-ld', /application\/ld\+json/i.test(detailHtml));
  console.log('detail schema Event', /"@type"\s*:\s*"(MusicEvent|Event)"/i.test(detailHtml));
  const ldIdx = detailHtml.search(/application\/ld\+json/i);
  if (ldIdx >= 0) console.log('json-ld snippet:', detailHtml.slice(ldIdx, ldIdx + 800));
}
