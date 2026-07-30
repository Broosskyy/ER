import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const BUNDLE_SAFE_FILES = [
  'src/features/sources/production/ticket-io-source.ts',
  'src/features/sources/production/ticket-io-source.core.ts',
  'src/features/sources/production/ticket-kings-source.ts',
  'src/features/sources/production/ticket-kings-source.core.ts',
  'src/features/ticket-platform-discovery/config/proposed-source-config.ts',
];

const NODE_PATTERNS = [/node:fs/, /node:path/, /readFileSync/, /__dirname/, /process\.cwd\(/];

describe('bundle-safe ticket platform modules', () => {
  it.each(BUNDLE_SAFE_FILES)('%s avoids Node.js filesystem APIs', (relativePath) => {
    const source = readFileSync(join(process.cwd(), relativePath), 'utf8');
    for (const pattern of NODE_PATTERNS) {
      expect(source, `${relativePath} must not match ${pattern}`).not.toMatch(pattern);
    }
  });
});
