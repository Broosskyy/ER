import type { SyncRunResult } from './types';

export interface DailySyncGateDecision {
  allowed: boolean;
  reasons: string[];
}

/**
 * Fail-closed safety check for an unattended import into the DB currently
 * serving the PUBLIC site. Identity / reconciliation reviewers remain in
 * the existing planners. This additionally prevents bulk surprises.
 */
export function evaluateDailyOfficialSyncPreflight(
  preview: SyncRunResult,
  minimumParsed: number,
): DailySyncGateDecision {
  const reasons: string[] = [];
  const { run } = preview;
  const { counters, errorCategories } = run;

  if (run.mode !== 'dry_run' || run.triggerType !== 'scheduled') {
    reasons.push('invalid_preflight_mode');
  }
  if (run.status !== 'succeeded' && run.status !== 'partially_succeeded') {
    reasons.push('unhealthy_run_status');
  }
  if (counters.parsed < minimumParsed || counters.discovered < minimumParsed ||
      counters.fetched < minimumParsed) {
    reasons.push('too_few_verified_events');
  }
  if (counters.failures > 0) reasons.push('source_fetch_or_processing_failed');
  if (counters.rejected > 0) reasons.push('invalid_source_candidates');
  if (counters.newEvents > 8) reasons.push('bulk_new_events_requires_review');
  if (counters.safeUpdates > 25) reasons.push('bulk_updates_requires_review');
  // Ticket evidence may change independently of event-core fields. Apply must
  // never mass-reprice the public catalog or delete tickets unattended.
  if ((preview.ticketPersistence?.deletes ?? 0) > 0) {
    reasons.push('automatic_ticket_deletions_forbidden');
  }
  if ((preview.ticketPersistence?.ticketRowsChanged ?? 0) > 25) {
    reasons.push('bulk_ticket_mutations_require_review');
  }
  if (errorCategories.some((category) =>
    ['unexpected_zero_results','parser_degraded','invalid_response',
      'rate_limited','network_timeout','upstream_5xx','unknown'].includes(category),
  )) {
    reasons.push('source_quality_or_network_degraded');
  }
  if (counters.planned !== counters.candidates) {
    reasons.push('inconsistent_candidate_plan_count');
  }
  return { allowed: reasons.length === 0, reasons };
}
