import type { ResolvedCanonicalLineupEntry } from '@/features/aggregation/domain/canonical-lineup-entry';
import {
  lineupBillingNamesFingerprint,
  lineupBillingNamesFromEntries,
} from '@/features/import/services/structured-lineup-replace-decision';

export type ImportLineupPreflightState =
  | 'already_after'
  | 'needs_persistence_write'
  | 'unexpected_drift';

/**
 * Classifies whether structured lineup persistence must run for an import/apply candidate.
 *
 * `matches_before` against an empty manifest snapshot must not suppress a write when the
 * golden target differs from the live structured billing rows.
 */
export function classifyImportLineupPreflight(input: {
  manifestBeforeNames: string[];
  goldenTargetNames: string[];
  currentStructuredEntries: ResolvedCanonicalLineupEntry[];
}): ImportLineupPreflightState {
  const goldenFingerprint = lineupBillingNamesFingerprint(input.goldenTargetNames);
  const currentFingerprint = lineupBillingNamesFingerprint(
    lineupBillingNamesFromEntries(input.currentStructuredEntries),
  );
  const beforeFingerprint = lineupBillingNamesFingerprint(input.manifestBeforeNames);

  if (goldenFingerprint === currentFingerprint) {
    return 'already_after';
  }

  if (goldenFingerprint !== beforeFingerprint) {
    return 'needs_persistence_write';
  }

  return 'unexpected_drift';
}

export function importLineupPreflightIsWritable(state: ImportLineupPreflightState): boolean {
  return state === 'needs_persistence_write';
}
