import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.resolve(
  __dirname,
  '../../../supabase/migrations/20260762000000_sprint30_ticket_platform_foundation.sql',
);

describe('Sprint 30 ticket platform foundation migration', () => {
  it('documents ticket_platform category without altering production sources', () => {
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('ticket_platform');
    expect(sql).not.toContain('source-bootshaus');
    expect(sql).not.toContain('source-affenkaefig');
    expect(sql).not.toMatch(/INSERT\s+INTO/i);
  });
});
