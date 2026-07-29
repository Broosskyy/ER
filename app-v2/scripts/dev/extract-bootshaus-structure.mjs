#!/usr/bin/env node
const UA = 'EternalRave-SourceBot/1.0';
const url = 'https://bootshaus.tv/events/';
const r = await fetch(url, { headers: { 'User-Agent': UA } });
const html = await r.text();

// extract upcoming items
const items = [...html.matchAll(/<div class="upcoming-item[^"]*"[\s\S]*?<\/div>\s*<\/div>/gi)].slice(0, 3);
console.log('upcoming-item blocks found (rough):', items.length);

// Better: find links to /events/ slug pages from list
const links = [...new Set([...html.matchAll(/href="(\/events\/[^"#?]+)"/gi)].map((m) => m[1]).filter((p) => p !== '/events' && p !== '/events/'))];
console.log('unique event paths:', links.length);
console.log('first 10:', links.slice(0, 10));

// extract one item around upcoming-item
const idx = html.indexOf('upcoming-item');
if (idx >= 0) console.log('\nLIST SNIPPET:\n', html.slice(idx, idx + 2500));

const detailUrl = 'https://bootshaus.tv' + links[0];
console.log('\nDETAIL URL', detailUrl);
const dr = await fetch(detailUrl, { headers: { 'User-Agent': UA } });
const dhtml = await dr.text();

// title
const titleMatch = dhtml.match(/<title>([^<]+)<\/title>/i);
const h1Match = dhtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
const ogTitle = dhtml.match(/property="og:title"\s+content="([^"]+)"/i);
const ogDesc = dhtml.match(/property="og:description"\s+content="([^"]+)"/i);
const ogImage = dhtml.match(/property="og:image"\s+content="([^"]+)"/i);
console.log('title', titleMatch?.[1]);
console.log('h1', h1Match?.[1]?.replace(/<[^>]+>/g, '').trim());
console.log('og:title', ogTitle?.[1]);
console.log('og:description', ogDesc?.[1]?.slice(0, 120));
console.log('og:image', ogImage?.[1]);

// date patterns
const datePatterns = ['date', 'time', 'datum', 'uhr', 'start', 'when'];
for (const p of datePatterns) {
  const re = new RegExp(`class="[^"]*${p}[^"]*"[^>]*>([^<]{0,80})`, 'gi');
  const m = [...dhtml.matchAll(re)].slice(0, 3);
  if (m.length) console.log('class *'+p+'*', m.map((x) => x[0].slice(0,120)));
}

// tag items (lineup?)
const tags = [...dhtml.matchAll(/class="tag-item"[^>]*>([\s\S]*?)<\/div>/gi)].slice(0, 8);
console.log('\ntag-items:', tags.map((t) => t[1].replace(/<[^>]+>/g,'').trim()));

// head-slide (maybe date?)
const head = dhtml.match(/head-slide-item[\s\S]{0,1500}/i);
if (head) console.log('\nhead-slide snippet:', head[0].slice(0, 800));
