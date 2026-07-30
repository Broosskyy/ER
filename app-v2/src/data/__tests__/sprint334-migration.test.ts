import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Sprint 33.4 platform discovery migration', () => {
  const sql = readFileSync(
    join(process.cwd(), 'supabase/migrations/20260767000000_sprint334_platform_discovery.sql'),
    'utf8',
  );

  it('creates platform_discovery_runs table', () => {
    expect(sql).toContain('create table if not exists public.platform_discovery_runs');
    expect(sql).toContain("check (platform in ('ticket_io', 'ticket_king'))");
  });

  it('creates platform_discovery_candidates table with source FK', () => {
    expect(sql).toContain('create table if not exists public.platform_discovery_candidates');
    expect(sql).toContain('references public.sources(id)');
    expect(sql).toContain("check (candidate_type in ('platform_list', 'shop', 'organizer', 'venue'))");
  });

  it('adds admin RLS policies', () => {
    expect(sql).toContain('admin_read_platform_discovery_runs');
    expect(sql).toContain('admin_write_platform_discovery_candidates');
    expect(sql).toContain('service_role_platform_discovery_runs');
  });
});
