#!/usr/bin/env node
const UA = 'EternalRave-SourceBot/1.0';
const url = 'https://tanzin.koeln/';
const r = await fetch(url, { headers: { 'User-Agent': UA } });
const html = await r.text();
const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
console.log('json-ld blocks', blocks.length);
for (const [i, b] of blocks.entries()) {
  console.log('\n--- block', i, 'len', b[1].length);
  console.log(b[1].slice(0, 1200));
}
