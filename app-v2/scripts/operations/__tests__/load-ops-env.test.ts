import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';

describe('load-ops-env ER_OPS_ENV_FILE', () => {
  it('loads explicit env file path when ER_OPS_ENV_FILE is set', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'er-ops-env-'));
    const envPath = join(dir, 'ops.env');
    writeFileSync(envPath, 'ER_OPS_TEST_MARKER=phase48656\n', 'utf8');

    process.env.ER_OPS_ENV_FILE = envPath;
    delete process.env.ER_OPS_TEST_MARKER;

    await import('../load-ops-env');

    expect(process.env.ER_OPS_TEST_MARKER).toBe('phase48656');
    expect(existsSync(envPath)).toBe(true);
    expect(readFileSync(envPath, 'utf8')).not.toMatch(/SERVICE_ROLE|ANON_KEY|password/i);
  });
});
