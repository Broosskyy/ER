import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'public');

function assertFile(relativePath: string): void {
  const fullPath = path.join(publicDir, relativePath);
  if (!existsSync(fullPath)) {
    throw new Error(`Missing SEO file: ${relativePath}`);
  }
}

function assertContains(relativePath: string, pattern: RegExp): void {
  const content = readFileSync(path.join(publicDir, relativePath), 'utf8');
  if (!pattern.test(content)) {
    throw new Error(`SEO file ${relativePath} missing pattern ${pattern}`);
  }
}

function main(): void {
  assertFile('robots.txt');
  assertFile('sitemap.xml');

  assertContains('robots.txt', /Disallow:\s*\/admin\//);
  assertContains('robots.txt', /Sitemap:/);
  assertContains('sitemap.xml', /<urlset/);
  assertContains('sitemap.xml', /<loc>\//);

  const seoModules = [
    'src/platform/seo/seo-config.ts',
    'src/platform/seo/seo-meta.ts',
    'src/platform/seo/structured-data.ts',
    'src/platform/analytics/ga4-client.ts',
    'src/platform/analytics/consent-types.ts',
  ];

  for (const modulePath of seoModules) {
    if (!existsSync(path.join(root, modulePath))) {
      throw new Error(`Missing SEO module: ${modulePath}`);
    }
  }

  console.log('SEO files and modules validated.');
}

main();
