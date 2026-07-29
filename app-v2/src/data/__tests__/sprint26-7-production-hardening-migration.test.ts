import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATION_PATH = resolve(
  process.cwd(),
  'supabase/migrations/20260755000000_sprint26_7_production_hardening.sql',
);

describe('Sprint 26.7 production hardening migration', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf8');

  it('hardens claim_import_job_queue_entries with validation and maintenance checks', () => {
    expect(sql).toContain('create or replace function public.claim_import_job_queue_entries');
    expect(sql).toContain('security definer');
    expect(sql).toContain('set search_path = pg_catalog, public, pg_temp');
    expect(sql).toContain('for update skip locked');
    expect(sql).toContain('p_limit must be between 1 and 100');
    expect(sql).toContain('p_worker_id must not be null or blank');
    expect(sql).toContain('p_lease_ms must be between 60000 and 3600000');
    expect(sql).toContain('q.dead_lettered_at is null');
    expect(sql).toContain('coalesce(q.attempt_count, 0) < coalesce(q.max_attempts, 3)');
    expect(sql).not.toContain('pg_catalog.coalesce');
    expect(sql).toContain('q.next_retry_at is null or q.next_retry_at <= v_effective_now');
    expect(sql).toContain('platform_operations_state');
    expect(sql).toContain('worker_paused');
    expect(sql).toContain('global_maintenance_mode');
  });

  it('restricts claim function execute privileges to service_role', () => {
    expect(sql).toContain('revoke all on function public.claim_import_job_queue_entries');
    expect(sql).toContain("from anon");
    expect(sql).toContain("from authenticated");
    expect(sql).toContain('grant execute on function public.claim_import_job_queue_entries');
    expect(sql).toContain('to service_role');
    expect(sql).toContain('pg_roles');
  });

  it('disables Affenkäfig and sets Bootshaus go-live posture', () => {
    expect(sql).toContain("where id = 'source-affenkaefig'");
    expect(sql).toContain('enabled = false');
    expect(sql).toContain("publish_mode = 'manual_review'");
    expect(sql).toContain('schedule_enabled = false');
    expect(sql).toContain("where id = 'source-bootshaus-koeln'");
    expect(sql).toContain("publish_mode = 'auto_publish'");
    expect(sql).toContain('review_required = false');
  });

  it('adds integrity constraints, matching rules, triggers, and indexes', () => {
    expect(sql).toContain('import_job_queue_attempt_count_nonnegative_chk');
    expect(sql).toContain('event_match_evaluations_auto_link_requires_canonical_chk');
    expect(sql).toContain('event_merge_candidates_evaluation_canonical_unique_idx');
    expect(sql).toContain('import_records_match_evaluation_id_fkey');
    expect(sql).toContain('sprint267_set_updated_at');
    expect(sql).not.toContain('create or replace function public.set_updated_at()');
    expect(sql).toContain('import_job_queue_claim_ready_idx');
    expect(sql).toContain('events_discovery_start_date_only_idx');
    expect(sql).toContain('comment on column public.event_match_evaluations.confidence_score');
    expect(sql).toContain('comment on column public.duplicate_decisions.confidence');
  });

  it('ensures sources.publish_mode exists before pilot posture updates', () => {
    expect(sql).toContain('2b. Ensure sources.publish_mode exists');
    expect(sql).toContain('20260744000000_sprint13_production_integration.sql');
    expect(sql).toContain("check (publish_mode in ('auto_publish', 'manual_review', 'conditional_review'))");
    expect(sql).toContain('sources_publish_mode_idx');
  });

  it('verifies event search infrastructure without row backfill', () => {
    expect(sql).toContain('events_search_document_trigger()');
    expect(sql).toContain('events_search_document_update');
    expect(sql).toContain('events_search_document_gin_idx');
    expect(sql).not.toContain('set title = e.title');
    expect(sql).not.toContain('where search_document is null');
    expect(sql).not.toContain('set search_document =');
  });
});
