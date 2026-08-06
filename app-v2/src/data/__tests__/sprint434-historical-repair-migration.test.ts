import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('sprint 43.4 historical repair migration', () => {
  it('activates historical repair metadata on active sources', () => {
    const sql = readFileSync(
      join(process.cwd(), 'supabase/migrations/20260773000000_sprint434_historical_repair_activation.sql'),
      'utf8',
    );
    expect(sql).toContain("historicalRepairVersion', '4.3.4'");
    expect(sql).toContain("dataQualityRepairVersion', '4.3.4'");
    expect(sql).toContain('enabled = true');
    expect(sql).toContain('archived = false');
    expect(sql).toContain('source_lifecycle_status');
  });
});
