import type { SyncEventProcessingResult, SyncRunResult } from './types';

export interface DailySafeBatch {
  /** A key must map to exactly one verified official event URL. */
  bindings: ReadonlyMap<string, string>;
  selectedNewEvents: number;
  selectedExistingUpdates: number;
  selectedExistingNoops: number;
  quarantinedRejected: number;
  quarantinedReview: number;
  deferredNewEvents: number;
  deferredExistingUpdates: number;
  duplicateBindingKeys: number;
}

const REVIEW_DECISIONS = new Set(['review_required','possible_match']);

/**
 * Preflight selectors never grant write permission by themselves: the live
 * apply re-runs source parsing, identity, validation and reconciliation.
 *
 * Existing-event NOOPs stay eligible for ticket-only verification.
 * All new events are rate-limited so a new source listing cannot publish an
 * unexpected large batch to the public app in one unattended run.
 */
export function selectDailySafeBatch(
  preview: SyncRunResult,
  limits: { newEvents: number; existingUpdates: number } = {newEvents: 8, existingUpdates: 25},
  options: { existingOnly?: boolean } = {},
): DailySafeBatch {
  const results = preview.eventResults;
  if (preview.run.mode !== 'dry_run' || preview.run.triggerType !== 'scheduled' ||
      results.length !== preview.run.counters.planned) {
    throw new Error('daily_batch_not_a_complete_scheduled_preflight');
  }
  const byKey = new Map<string, number>();
  for (const event of results) {
    if (event.sourceEventKey) {
      byKey.set(event.sourceEventKey, (byKey.get(event.sourceEventKey) ?? 0) + 1);
    }
  }

  const bindings = new Map<string,string>();
  let selectedNewEvents = 0, selectedExistingUpdates = 0, selectedExistingNoops = 0;
  let quarantinedRejected = 0, quarantinedReview = 0;
  let deferredNewEvents = 0, deferredExistingUpdates = 0, duplicateBindingKeys = 0;
  for (const event of results) {
    if (event.outcome === 'rejected') {
      quarantinedRejected++;
      continue;
    }
    if (event.outcome === 'review_required' ||
        REVIEW_DECISIONS.has(event.identityDecision ?? '') ||
        event.reconciliationReviewReasons?.length) {
      quarantinedReview++;
      continue;
    }
    if ((event.outcome !== 'planned_only' && event.outcome !== 'noop') ||
        !event.sourceEventKey?.trim() ||
        !event.officialUrl?.startsWith('https://')) {
      quarantinedReview++;
      continue;
    }
    if (byKey.get(event.sourceEventKey) !== 1) {
      duplicateBindingKeys++;
      continue;
    }
    if (options.existingOnly && !event.verifiedExistingSourceBinding) {
      // Unbound net-new discoveries are reported for future source onboarding.
      // A similar-looking existing event must never receive Rausgegangen edits.
      if (!event.matchedEventId) deferredNewEvents++;
      else quarantinedReview++;
      continue;
    }
    if (!event.matchedEventId) {
      if (event.outcome === 'noop') {
        quarantinedReview++;
      } else if (selectedNewEvents < limits.newEvents) {
        selectedNewEvents++;
        bindings.set(event.sourceEventKey, event.officialUrl);
      } else {
        deferredNewEvents++;
      }
    } else if (event.outcome === 'planned_only') {
      if (selectedExistingUpdates < limits.existingUpdates) {
        selectedExistingUpdates++;
        bindings.set(event.sourceEventKey, event.officialUrl);
      } else {
        deferredExistingUpdates++;
      }
    } else {
      selectedExistingNoops++;
      bindings.set(event.sourceEventKey, event.officialUrl);
    }
  }
  return {
    bindings,selectedNewEvents,selectedExistingUpdates,selectedExistingNoops,
    quarantinedRejected,quarantinedReview,deferredNewEvents,
    deferredExistingUpdates,duplicateBindingKeys,
  };
}
