#!/usr/bin/env tsx
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import * as cheerio from 'cheerio';

import { createEmptyConnectorCounters } from '../server/official-connectors/types';
import { safeFetchHtmlWithPolicy } from '../server/official-connectors/generic-safe-fetch';

const LIST_URL = 'https://affenkaefig.info/tickets/';
const OUT = '.tmp/m8-6-affenkaefig-audit';

const policy = {
  userAgent: 'EternalRaveOfficialConnector/1.0 (+https://eternal-rave.app)',
  canonicalizeUrl(rawUrl: string, baseUrl?: string) {
    try {
      const parsed = new URL(rawUrl, baseUrl ?? LIST_URL);
      if (parsed.hostname !== 'affenkaefig.info' || parsed.protocol !== 'https:') return null;
      const pathname = parsed.pathname.endsWith('/') ? parsed.pathname : `${parsed.pathname}/`;
      return `https://affenkaefig.info${pathname}`;
    } catch {
      return null;
    }
  },
  resolveRedirectUrl(currentUrl: string, locationHeader: string | null) {
    if (!locationHeader) return null;
    return policy.canonicalizeUrl(locationHeader, currentUrl);
  },
  validateRequestUrl(url: string) {
    const parsed = new URL(url);
    if (parsed.hostname !== 'affenkaefig.info') return 'cross_origin' as const;
    if (!/^\/(tickets|event)\//.test(parsed.pathname) && parsed.pathname !== '/tickets/') {
      return 'disallowed_path' as const;
    }
    return null;
  },
};

async function save(path: string, content: string) {
  const target = join(OUT, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content, 'utf8');
}

async function main() {
  const counters = createEmptyConnectorCounters();
  const list = await safeFetchHtmlWithPolicy(LIST_URL, policy, { counters });
  await save('list.html', list.html);

  const $ = cheerio.load(list.html);
  const links = new Set<string>();
  $('a[href]').each((_i, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    const canonical = policy.canonicalizeUrl(href, LIST_URL);
    if (canonical && /\/event\//.test(canonical)) links.add(canonical);
  });

  const detailUrls = [...links].sort();
  console.log('detailUrls', detailUrls);

  for (const url of detailUrls.slice(0, 3)) {
    const detail = await safeFetchHtmlWithPolicy(url, policy, { counters }, { allowDetailOnly: true });
    const slug = new URL(detail.finalUrl).pathname.split('/').filter(Boolean).pop() ?? 'unknown';
    await save(`details/${slug}.html`, detail.html);
    const d$ = cheerio.load(detail.html);
    console.log('\n---', slug, '---');
    console.log('title', d$('h1').first().text().trim() || d$('meta[property="og:title"]').attr('content'));
    console.log('og:desc', (d$('meta[property="og:description"]').attr('content') ?? '').slice(0, 120));
    console.log('json-ld', d$('script[type="application/ld+json"]').length);
    console.log('h2', d$('h2').map((_i, e) => d$(e).text().trim()).get().slice(0, 8));
  }
}

main().catch(console.error);
