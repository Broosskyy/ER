import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('phase473 canonical event attributes migration', () => {
  const sql = readFileSync(
    join(process.cwd(), 'supabase/migrations/20260803140000_phase473_canonical_event_attributes.sql'),
    'utf8',
  );

  it('adds canonical attribute columns additively only', () => {
    expect(sql).toContain('add column if not exists event_attributes jsonb');
    expect(sql).toContain('add column if not exists floor_count integer');
    expect(sql).toContain('add column if not exists stage_count integer');
    expect(sql).toContain('add column if not exists venue_environment text');
    expect(sql).toContain('add column if not exists last_entry_at timestamptz');
    expect(sql).toContain('add column if not exists dress_code text');
    expect(sql).toContain('add column if not exists accessibility_notes text');
    expect(sql).not.toMatch(/\bupdate\s+public\.events\b/i);
    expect(sql).not.toMatch(/\bdelete\s+from\s+public\.events\b/i);
  });

  it('constrains venue_environment to supported values', () => {
    expect(sql).toContain('events_venue_environment_check');
    expect(sql).toContain("venue_environment in ('indoor', 'outdoor', 'hybrid')");
  });

  it('creates filter and search indexes', () => {
    expect(sql).toContain('events_event_attributes_gin_idx');
    expect(sql).toContain('using gin (event_attributes jsonb_path_ops)');
    expect(sql).toContain('events_floor_count_idx');
    expect(sql).toContain('events_venue_environment_idx');
  });

  it('defers schema guarantees to phase4731 follow-up migration', () => {
    expect(sql).not.toContain('events_floor_count_check');
    expect(sql).not.toContain('events_stage_count_check');
    expect(sql).not.toMatch(/event_attributes\s+set\s+default/i);
  });
});
