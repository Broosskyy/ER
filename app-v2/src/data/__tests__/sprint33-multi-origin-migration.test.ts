import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Sprint 33 multi-origin and source onboarding migration', () => {
  const sql = readFileSync(
    join(process.cwd(), 'supabase/migrations/20260765000000_sprint33_multi_origin_source_onboarding.sql'),
    'utf8',
  );

  it('creates source_onboarding_jobs table with lifecycle statuses', () => {
    expect(sql).toContain('create table if not exists public.source_onboarding_jobs');
    expect(sql).toContain("'review_required'");
    expect(sql).toContain("'ready'");
    expect(sql).toContain("'enabled'");
  });

  it('documents event_source_references metadata for origins', () => {
    expect(sql).toContain('event_source_references.metadata');
    expect(sql).toContain('Origin metadata');
  });

  it('enables RLS on onboarding jobs', () => {
    expect(sql).toContain('source_onboarding_jobs enable row level security');
  });
});
