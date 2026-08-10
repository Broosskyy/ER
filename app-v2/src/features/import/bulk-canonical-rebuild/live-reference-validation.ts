import type { BulkRebuildEventRow } from './types';
import { rebuiltToAdminShape } from './evidence-field-extractor';
import { runFixtureRebuildAcceptance } from './fixture-rebuild-runner';

export type LiveReferenceCategory =
  | 'current_truth_match'
  | 'source_unavailable'
  | 'identity_conflict'
  | 'pipeline_missing_evidence'
  | 'live_truth_changed'
  | 'collision_review';

export interface LiveReferenceValidationEntry {
  key: string;
  eventId: string;
  category: LiveReferenceCategory;
  disposition?: BulkRebuildEventRow['disposition'];
  detailFetchStatuses: string[];
  pipelineGaps: string[];
  notes: string[];
}

function detectPipelineGaps(row: BulkRebuildEventRow | undefined): string[] {
  if (!row) return ['row_missing'];
  const gaps: string[] = [];
  const rebuilt = row.rebuilt;

  for (const contribution of row.sourceContributions) {
    const detail = contribution.detailEvidence;
    if (!detail) continue;
    if (detail.fetchStatus === 'ok') {
      if (detail.content?.description && !rebuilt.description) {
        gaps.push(`description_not_applied:${contribution.sourceId}`);
      }
      if (detail.content?.lineup?.length && !(rebuilt.lineupArtistNames?.length)) {
        gaps.push(`lineup_not_applied:${contribution.sourceId}`);
      }
      if (detail.content?.genreLabels?.length && !(rebuilt.genreLabels?.length)) {
        gaps.push(`genres_not_applied:${contribution.sourceId}`);
      }
    }
    if (detail.fetchStatus === 'content_unusable' && contribution.embeddedDetailHtml) {
      gaps.push(`embedded_unparsed:${contribution.sourceId}`);
    }
  }

  if (!rebuilt.verifiedAt && row.sourceContributions.some((c) => c.detailEvidence?.fetchStatus === 'ok')) {
    gaps.push('verified_at_missing_after_ok_fetch');
  }

  return gaps;
}

export function categorizeLiveReferenceRow(
  key: string,
  eventId: string,
  row: BulkRebuildEventRow | undefined,
): LiveReferenceValidationEntry {
  const notes: string[] = [];
  if (!row) {
    return {
      key,
      eventId,
      category: 'pipeline_missing_evidence',
      detailFetchStatuses: [],
      pipelineGaps: ['row_missing'],
      notes: ['no_rebuilt_row'],
    };
  }

  const detailFetchStatuses = row.sourceContributions
    .map((c) => c.detailEvidence?.fetchStatus ?? 'not_requested')
    .filter(Boolean);

  const pipelineGaps = detectPipelineGaps(row);

  if (row.disposition === 'review_collision' || row.collision?.clusterCollision) {
    return {
      key,
      eventId,
      category: 'collision_review',
      disposition: row.disposition,
      detailFetchStatuses,
      pipelineGaps,
      notes: ['collision_requires_review'],
    };
  }

  const unavailable = detailFetchStatuses.every(
    (status) => status === 'not_found' || status === 'timeout' || status === 'http_error',
  );
  if (unavailable && row.sourceContributions.length > 0) {
    return {
      key,
      eventId,
      category: 'source_unavailable',
      disposition: row.disposition,
      detailFetchStatuses,
      pipelineGaps,
      notes: ['all_detail_fetches_unavailable'],
    };
  }

  if (pipelineGaps.length > 0) {
    return {
      key,
      eventId,
      category: 'pipeline_missing_evidence',
      disposition: row.disposition,
      detailFetchStatuses,
      pipelineGaps,
      notes,
    };
  }

  const fixtureAcceptance = runFixtureRebuildAcceptance().acceptance;
  const fixtureResult = fixtureAcceptance.results.find((r) => r.key === key);
  const rebuiltAdmin = rebuiltToAdminShape(row.rebuilt, { id: eventId, status: row.existing?.status });

  if (fixtureResult && !fixtureResult.passed) {
    notes.push('live_rebuild_differs_from_fixture_catalog');
    return {
      key,
      eventId,
      category: 'live_truth_changed',
      disposition: row.disposition,
      detailFetchStatuses,
      pipelineGaps: [],
      notes,
    };
  }

  if (row.disposition === 'review_identity' && row.reviewReasons.some((r) => r.includes('identity'))) {
    return {
      key,
      eventId,
      category: 'identity_conflict',
      disposition: row.disposition,
      detailFetchStatuses,
      pipelineGaps: [],
      notes: ['identity_review'],
    };
  }

  return {
    key,
    eventId,
    category: 'current_truth_match',
    disposition: row.disposition,
    detailFetchStatuses,
    pipelineGaps: [],
    notes: [`rebuilt_title:${rebuiltAdmin.title}`],
  };
}

export function buildLiveReferenceMatrix(
  rows: BulkRebuildEventRow[],
  fixtureKeys: Array<{ key: string; eventId: string }>,
): {
  entries: LiveReferenceValidationEntry[];
  pipelineMissingEvidenceCount: number;
  fixtureAcceptancePassed: boolean;
} {
  const byId = new Map(rows.map((row) => [row.eventIdBefore, row]));
  const entries = fixtureKeys.map((fixture) =>
    categorizeLiveReferenceRow(fixture.key, fixture.eventId, byId.get(fixture.eventId)),
  );

  return {
    entries,
    pipelineMissingEvidenceCount: entries.filter((e) => e.category === 'pipeline_missing_evidence').length,
    fixtureAcceptancePassed: runFixtureRebuildAcceptance().acceptance.passed,
  };
}
