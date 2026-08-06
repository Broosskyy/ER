import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('phase4731 event attribute schema guarantees follow-up migration', () => {
  const sql = readFileSync(
    join(
      process.cwd(),
      'supabase/migrations/20260803150000_phase4731_event_attribute_schema_guarantees.sql',
    ),
    'utf8',
  );

  it('sets event_attributes default without mutating existing rows', () => {
    expect(sql).toContain("alter column event_attributes set default '{}'::jsonb");
    expect(sql).not.toMatch(/\bupdate\s+public\.events\b/i);
    expect(sql).not.toMatch(/\bdelete\s+from\s+public\.events\b/i);
  });

  it('adds non-negative floor_count check idempotently', () => {
    expect(sql).toContain('drop constraint if exists events_floor_count_check');
    expect(sql).toContain('events_floor_count_check');
    expect(sql).toMatch(/floor_count\s+is\s+null\s+or\s+floor_count\s*>=\s*0/i);
  });

  it('adds non-negative stage_count check idempotently', () => {
    expect(sql).toContain('drop constraint if exists events_stage_count_check');
    expect(sql).toContain('events_stage_count_check');
    expect(sql).toMatch(/stage_count\s+is\s+null\s+or\s+stage_count\s*>=\s*0/i);
  });

  it('does not recreate columns or indexes from phase473', () => {
    expect(sql).not.toContain('add column');
    expect(sql).not.toContain('create index');
  });
});
