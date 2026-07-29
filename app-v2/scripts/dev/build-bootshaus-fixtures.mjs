#!/usr/bin/env node
/**
 * Fetches minimal Bootshaus HTML snippets for offline test fixtures.
 * Manual/dev use only — not part of automated test suite.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const UA = 'EternalRave-SourceBot/1.0 (+https://eternalrave.app; fixture-build)';
const listUrl = 'https://bootshaus.tv/events/';
const detailUrl = 'https://bootshaus.tv/events/1-8-26-play-open-air-bootshaus-koeln';

const listResponse = await fetch(listUrl, { headers: { 'User-Agent': UA } });
const listHtml = await listResponse.text();

const detailResponse = await fetch(detailUrl, { headers: { 'User-Agent': UA } });
const detailHtml = await detailResponse.text();

function extractUpcomingItems(html) {
  const items = [];
  const pattern = /<a[^>]*class=["'][^"']*\bupcoming-item\b[^"']*["'][^>]*>[\s\S]*?<\/a>/gi;
  let match;
  while ((match = pattern.exec(html)) !== null && items.length < 4) {
    items.push(match[0]);
  }
  return items;
}

const items = extractUpcomingItems(listHtml);
const listFixture = `<!DOCTYPE html><html><head><title>Bootshaus Events Fixture</title></head><body>
<div class="events-container">
<div class="upcoming-latest-container">
${items.join('\n')}
</div>
</div>
</body></html>`;

const detailFixture = detailHtml.length > 12000 ? detailHtml.slice(0, 12000) : detailHtml;

const outDir = dirname(fileURLToPath(import.meta.url));
const target = join(outDir, '../../src/features/sources/production/bootshaus-fixture-snippets.json');
writeFileSync(
  target,
  JSON.stringify({ listFixture, detailFixture, listUrl, detailUrl, itemCount: items.length }, null, 2),
);
console.log('Wrote', target, 'items', items.length);
