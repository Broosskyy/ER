import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const distDir = path.resolve(__dirname, '../dist');

const forbiddenPatterns = [
  /SUPABASE_SERVICE_ROLE_KEY/i,
  /EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY/i,
  /BEGIN PRIVATE KEY/,
];

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

function main(): void {
  if (!existsSync(distDir)) {
    throw new Error('dist/ not found. Run npm run build:web first.');
  }

  const required = [
    'index.html',
    'manifest.webmanifest',
    'sw.js',
    'offline.html',
    'favicon.ico',
    'robots.txt',
    'sitemap.xml',
    'pwa/icon-192.png',
    'pwa/icon-512.png',
    'notifications.html',
    'admin/login.html',
  ];

  for (const relative of required) {
    const fullPath = path.join(distDir, relative);
    if (!existsSync(fullPath)) {
      throw new Error(`Missing build output: ${relative}`);
    }
  }

  const textFiles = walk(distDir).filter((file) => /\.(html|js|json|css|webmanifest)$/i.test(file));
  for (const file of textFiles) {
    const content = readFileSync(file, 'utf8');
    for (const pattern of forbiddenPatterns) {
      if (pattern.test(content)) {
        throw new Error(`Forbidden pattern ${pattern} found in ${path.relative(distDir, file)}`);
      }
    }
  }

  if (existsSync(path.join(distDir, '.env'))) {
    throw new Error('.env must not be included in dist output.');
  }

  console.log('Web build output validated.');
}

main();
