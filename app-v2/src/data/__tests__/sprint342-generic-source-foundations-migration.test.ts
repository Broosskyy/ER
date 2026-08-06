import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('sprint342 generic source foundations migration', () => {
  const sql = readFileSync(
    join(process.cwd(), 'supabase/migrations/20260768000000_sprint342_generic_source_foundations.sql'),
    'utf8',
  );

  it('extends event_field_provenance additively', () => {
    expect(sql).toContain('alter table public.event_field_provenance');
    expect(sql).toContain('confidence numeric');
    expect(sql).toContain('freshness_at timestamptz');
    expect(sql).toContain('origin_external_id text');
    expect(sql).toContain('merge_decision text');
    expect(sql).toContain('selected_tier text');
    expect(sql).not.toContain('drop table');
    expect(sql).not.toContain('delete from');
  });
});
