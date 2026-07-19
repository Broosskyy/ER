import { describe, expect, it } from 'vitest';

describe('iOS config validation script', () => {
  it('passes static iOS release checks', async () => {
    const { execSync } = await import('node:child_process');
    const out = execSync('npm run validate:ios', {
      cwd: process.cwd(),
      encoding: 'utf8',
    });
    expect(out).toContain('iOS release configuration validated.');
  });
});
