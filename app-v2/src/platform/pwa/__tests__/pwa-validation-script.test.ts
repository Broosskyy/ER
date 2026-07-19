import { describe, expect, it } from 'vitest';

describe('PWA validation script', () => {
  it('validates manifest and assets', async () => {
    const { execSync } = await import('node:child_process');
    const out = execSync('npm run validate:pwa', {
      cwd: process.cwd(),
      encoding: 'utf8',
    });
    expect(out).toContain('PWA manifest and assets validated.');
  });
});
