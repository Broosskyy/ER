import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

import { PWA_CONFIG } from '../src/platform/pwa/pwa-config';

const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'public');
const manifestPath = path.join(publicDir, 'manifest.webmanifest');

function assertFile(relativePath: string): void {
  const fullPath = path.join(publicDir, relativePath);
  if (!existsSync(fullPath)) {
    throw new Error(`Missing PWA asset: ${relativePath}`);
  }
}

function main(): void {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;

  const requiredFields = [
    'name',
    'short_name',
    'description',
    'start_url',
    'scope',
    'display',
    'theme_color',
    'background_color',
    'icons',
  ];

  for (const field of requiredFields) {
    if (!(field in manifest)) {
      throw new Error(`Manifest missing field: ${field}`);
    }
  }

  if (manifest.name !== PWA_CONFIG.name) {
    throw new Error('Manifest name does not match PWA_CONFIG.name');
  }

  const icons = manifest.icons as Array<{ sizes?: string; purpose?: string }>;
  const has192 = icons.some((icon) => icon.sizes === '192x192');
  const has512 = icons.some((icon) => icon.sizes === '512x512');
  const hasMaskable = icons.some((icon) => icon.purpose === 'maskable');

  if (!has192 || !has512 || !hasMaskable) {
    throw new Error('Manifest icons must include 192x192, 512x512, and maskable 512x512 entries.');
  }

  assertFile('pwa/icon-192.png');
  assertFile('pwa/icon-512.png');
  assertFile('pwa/icon-maskable-512.png');
  assertFile('pwa/apple-touch-icon.png');
  assertFile('offline.html');
  assertFile('sw.js');

  console.log('PWA manifest and assets validated.');
}

main();
