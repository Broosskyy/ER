import type { LinkedQueryExecutor } from '../../../ingestion/sync/linked-db';
import { loadStagingEventSnapshots, type StagingEventSnapshot } from '../../../ingestion/sync/canonical-consolidation';
import {
  collectLineupEvidence,
  loadEventSourcePayloads,
} from '../../shared/staging-source-evidence';
import { isLineupPlaceholderLine, normalizeLineupName } from '../../shared/lineup-normalization';

export type LineupCoverageClassification =
  | 'LINEUP_COMPLETE'
  | 'LINEUP_PARTIAL'
  | 'LINEUP_RECOVERABLE'
  | 'LINEUP_NOT_ANNOUNCED'
  | 'LINEUP_CONFLICT_REVIEW';

export interface LineupCoverageEntry {
  eventId: string;
  title: string;
  currentLineup: string[];
  recommendedLineup: string[];
  invalidPlaceholderLineup: boolean;
  classification: LineupCoverageClassification;
  checkedLayers: string[];
  reason?: string;
}

function hasPlaceholderOnly(lineup: string[]): boolean {
  if (lineup.length === 0) {
    return false;
  }
  return lineup.every((name) => isLineupPlaceholderLine(name));
}

export function auditLineupCoverage(runQuery: LinkedQueryExecutor): LineupCoverageEntry[] {
  const events = loadStagingEventSnapshots(runQuery).filter((event) => event.status === 'published');
  return events.map((event) => {
    const sourceRows = loadEventSourcePayloads(runQuery, event.eventId);
    const current = event.lineup.map((name) => normalizeLineupName(name));
    const invalidPlaceholderLineup = hasPlaceholderOnly(current);
    const { lineup: recommended, checkedLayers } = collectLineupEvidence(event, sourceRows);
    const validCurrent = current.filter((name) => name && !isLineupPlaceholderLine(name));

    let classification: LineupCoverageClassification;
    let reason: string | undefined;

    if (invalidPlaceholderLineup && recommended.length > 0) {
      classification = 'LINEUP_RECOVERABLE';
      reason = 'placeholder_canonical_with_verified_source_lineup';
    } else if (invalidPlaceholderLineup || validCurrent.length === 0) {
      classification = recommended.length > 0 ? 'LINEUP_RECOVERABLE' : 'LINEUP_NOT_ANNOUNCED';
      reason = recommended.length > 0 ? 'verified_source_lineup_available' : 'no_verified_lineup_evidence';
    } else if (recommended.length > validCurrent.length) {
      classification = 'LINEUP_RECOVERABLE';
      reason = 'additional_verified_lineup_evidence_available';
    } else if (validCurrent.length >= 4) {
      classification = 'LINEUP_COMPLETE';
    } else if (validCurrent.length > 0) {
      classification = 'LINEUP_PARTIAL';
    } else {
      classification = 'LINEUP_NOT_ANNOUNCED';
      reason = 'no_verified_lineup_evidence';
    }

    if (
      validCurrent.length > 0 &&
      recommended.length > 0 &&
      validCurrent.length !== recommended.length &&
      !recommended.every((name) => validCurrent.includes(name))
    ) {
      classification = 'LINEUP_CONFLICT_REVIEW';
      reason = 'canonical_and_source_lineup_disagree';
    }

    return {
      eventId: event.eventId,
      title: event.title,
      currentLineup: current,
      recommendedLineup: recommended,
      invalidPlaceholderLineup,
      classification,
      checkedLayers,
      reason,
    };
  });
}

export function repairRecoverableLineups(
  runQuery: LinkedQueryExecutor,
  entries: LineupCoverageEntry[],
): number {
  let repaired = 0;
  for (const entry of entries.filter((item) => item.classification === 'LINEUP_RECOVERABLE')) {
    if (entry.recommendedLineup.length === 0) {
      continue;
    }
    runQuery(`DELETE FROM public.event_lineup WHERE event_id = '${entry.eventId}'::uuid;`);
    for (const [index, billingName] of entry.recommendedLineup.entries()) {
      runQuery(
        `INSERT INTO public.event_lineup (event_id, billing_name, billing_role, sort_order)
         VALUES ('${entry.eventId}'::uuid, '${billingName.replace(/'/g, "''")}', ${index === 0 ? "'headliner'" : "'artist'"}, ${index});`,
      );
    }
    repaired += 1;
  }
  return repaired;
}
