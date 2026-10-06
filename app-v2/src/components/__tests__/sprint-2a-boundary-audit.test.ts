import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const COMPONENTS_ROOT = join(process.cwd(), 'src', 'components');

const FORBIDDEN_PATTERNS = [
  /from ['"]expo-router['"]/,
  /from ['"]@supabase/,
  /from ['"]@\/data\//,
  /from ['"]@\/features\/(?!events\/data\/demo-images)/,
];

const ALLOWED_EXCEPTIONS = new Set([
  'navigation/WebTopNav.tsx',
  'preview/Phase2AEventDiscoveryPreview.tsx',
]);

function collectSourceFiles(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const relativePath = fullPath.slice(COMPONENTS_ROOT.length + 1).replace(/\\/g, '/');

    if (statSync(fullPath).isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue;
      collectSourceFiles(fullPath, files);
      continue;
    }

    if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      files.push(relativePath);
    }
  }

  return files;
}

describe('Sprint 2A component boundary audit', () => {
  it('keeps UI components free of router, repository, and feature imports', () => {
    const violations: string[] = [];

    for (const file of collectSourceFiles(COMPONENTS_ROOT)) {
      if (ALLOWED_EXCEPTIONS.has(file)) continue;

      const source = readFileSync(join(COMPONENTS_ROOT, file), 'utf8');
      for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.test(source)) {
          violations.push(`${file} matches ${pattern}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
