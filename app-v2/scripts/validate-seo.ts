import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { getWebBaseUrl, INDEXABLE_STATIC_ROUTES } from '../src/platform/seo/seo-config';

const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'public');

function readRequired(relativePath: string): string {
  const file = path.join(publicDir, relativePath);
  if (!existsSync(file)) throw new Error(`Missing SEO file: ${relativePath}`);
  return readFileSync(file, 'utf8');
}

function main(): void {
  const origin = getWebBaseUrl();
  const robots = readRequired('robots.txt');
  const sitemap = readRequired('sitemap.xml');
  if (!/Disallow:\s*\/admin\//.test(robots)) throw new Error('Missing admin disallow');
  if (!robots.includes(`Sitemap: ${origin}/sitemap.xml`)) throw new Error('Robots sitemap must be absolute');
  if (!sitemap.includes('<urlset')) throw new Error('Missing sitemap urlset');
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]!);
  if (!locs.length || new Set(locs).size !== locs.length) throw new Error('Duplicate or empty sitemap');
  for (const loc of locs) {
    let url: URL;
    try { url = new URL(loc); } catch { throw new Error(`Invalid URL ${loc}`); }
    if (url.origin !== origin || !loc.startsWith('https://') || url.search || url.hash) {
      throw new Error(`Non-canonical sitemap URL: ${loc}`);
    }
    if (!INDEXABLE_STATIC_ROUTES.some((route) => route.path === url.pathname) &&
        !/^\/event\/[0-9a-f-]{36}$/i.test(url.pathname)) {
      throw new Error(`Unverified sitemap route: ${url.pathname}`);
    }
  }
  for (const route of INDEXABLE_STATIC_ROUTES) {
    if (!locs.includes(origin + route.path)) throw new Error(`Missing route: ${route.path}`);
  }
  for (const modulePath of [
    'src/platform/seo/seo-config.ts', 'src/platform/seo/seo-meta.ts',
    'src/platform/seo/structured-data.ts', 'src/platform/analytics/ga4-client.ts',
    'src/platform/analytics/consent-types.ts',
  ]) {
    if (!existsSync(path.join(root, modulePath))) throw new Error(`Missing SEO module: ${modulePath}`);
  }
  console.log('SEO files, canonical URLs and public routes validated.');
}
main();
