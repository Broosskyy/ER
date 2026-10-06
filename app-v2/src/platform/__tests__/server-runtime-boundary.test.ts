import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('expo runtime boundary', () => {
  it('keeps server connector and ingestion code out of the app tsconfig graph', () => {
    const appConfig = JSON.parse(readFileSync('tsconfig.app.json', 'utf8')) as {
      include?: string[];
      exclude?: string[];
    };

    const include = appConfig.include ?? [];
    expect(include.some((entry) => entry.includes('server/'))).toBe(false);
    expect(include).not.toContain('server/**/*');
  });
});
