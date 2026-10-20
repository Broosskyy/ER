import { describe, expect, it } from 'vitest';
import { createEmptySyncRunCounters, type SyncRunResult } from '../types';
import { evaluateDailyOfficialSyncPreflight } from '../daily-sync-preflight';

function preview(overrides: Partial<SyncRunResult['run']> = {}): SyncRunResult {
  return {
    run: {
      runId:'test-run', connectorId:'bootshaus-official',
      triggerType:'scheduled', mode:'dry_run',
      startedAt:'2026-10-19T04:00:00Z', status:'succeeded',
      counters:{...createEmptySyncRunCounters(),
        discovered:23, fetched:23, parsed:23, candidates:23,
        planned:23, newEvents:3, safeUpdates:5, noops:15},
      errorCategories:[], retryCount:0,
      ...overrides,
    },
    health:{ connectorId:'bootshaus-official',enabled:true,
      consecutiveFailures:0,lastDiscoveredCount:23,lastParsedCount:23,
      lastAppliedCount:0,healthStatus:'healthy'},
    eventResults:[],
  };
}

describe('daily unattended official sync guard', () => {
  it('allows small, healthy, idempotent public-catalog updates', () => {
    expect(evaluateDailyOfficialSyncPreflight(preview(),8)).toEqual({allowed:true,reasons:[]});
  });
  it('blocks bad run mode and skipped source data', () => {
    expect(evaluateDailyOfficialSyncPreflight(preview({mode:'apply'}),8).allowed).toBe(false);
    expect(evaluateDailyOfficialSyncPreflight(preview({
      counters:{...preview().run.counters, parsed:0},
    }),8).reasons).toContain('too_few_verified_events');
  });
  it('blocks suspicious bulk inserts and updates', () => {
    const b=preview().run.counters;
    expect(evaluateDailyOfficialSyncPreflight(preview({
      counters:{...b,newEvents:9},
    }),8).reasons).toContain('bulk_new_events_requires_review');
    expect(evaluateDailyOfficialSyncPreflight(preview({
      counters:{...b,safeUpdates:26},
    }),8).reasons).toContain('bulk_updates_requires_review');
  });
  it('rejects automated ticket deletions or bulk repricing regardless of event-core count', () => {
    expect(evaluateDailyOfficialSyncPreflight({
      ...preview(),
      ticketPersistence:{applied:false,inserts:0,updates:0,deletes:1,ticketRowsChanged:1,allIdempotent:false},
    },8).reasons).toContain('automatic_ticket_deletions_forbidden');
    expect(evaluateDailyOfficialSyncPreflight({
      ...preview(),
      ticketPersistence:{applied:false,inserts:0,updates:30,deletes:0,ticketRowsChanged:30,allIdempotent:false},
    },8).reasons).toContain('bulk_ticket_mutations_require_review');
  });

  it('allows quarantined invalid events without globally skipping a bounded safe batch',()=>{
    const baseline=preview();
    baseline.run.counters.newEvents=16;
    baseline.run.counters.rejected=1;
    baseline.run.status='partially_succeeded';
    expect(evaluateDailyOfficialSyncPreflight(baseline,8,{
      selectedNewEvents:8,selectedExistingUpdates:5,
      quarantinedRejected:1,duplicateBindingKeys:0,
    }).allowed).toBe(true);
    expect(evaluateDailyOfficialSyncPreflight(baseline,8,{
      selectedNewEvents:9,selectedExistingUpdates:5,
      quarantinedRejected:1,duplicateBindingKeys:0,
    }).reasons).toContain('bulk_new_events_requires_review');
    expect(evaluateDailyOfficialSyncPreflight(baseline,8,{
      selectedNewEvents:8,selectedExistingUpdates:5,
      quarantinedRejected:0,duplicateBindingKeys:0,
    }).reasons).toContain('invalid_source_candidates');
  });

  it('blocks parser degradation, invalid candidates and source failures', () => {
    expect(evaluateDailyOfficialSyncPreflight(preview({
      errorCategories:['parser_degraded'],
    }),8).allowed).toBe(false);
    expect(evaluateDailyOfficialSyncPreflight(preview({
      counters:{...preview().run.counters,rejected:1,failures:1},
    }),8).reasons).toContain('invalid_source_candidates');
  });
  it('never lets candidate/plan mismatches pass without review', () => {
    expect(evaluateDailyOfficialSyncPreflight(preview({
      counters:{...preview().run.counters, planned:1},
    }),8).reasons).toContain('inconsistent_candidate_plan_count');
  });
});
