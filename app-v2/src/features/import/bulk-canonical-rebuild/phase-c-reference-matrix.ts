import { BULK_REBUILD_ACCEPTANCE_FIXTURES } from './acceptance-fixtures';
import { categorizeLiveReferenceRow } from './live-reference-validation';
import type { BulkRebuildEventRow } from './types';

export interface PhaseCLiveReferenceEntry {
  key: string;
  eventId: string;
  category: string;
  disposition?: string;
  officialUrl?: string;
  ticketUrl?: string;
  detailFetchStatuses: string[];
  nativeIdentityEvidence: Array<Record<string, unknown>>;
  verifiedAt?: string | null;
  fieldGroupsPresent: string[];
  isolatedContributionKeys: string[];
  collisionTriage?: Record<string, unknown>;
  pipelineGaps: string[];
  notes: string[];
  sourcePhase: '4.8.6.7.3_final';
  httpCapableRun: true;
}

function contributionUrls(row: BulkRebuildEventRow): { official?: string; ticket?: string } {
  let official: string | undefined;
  let ticket: string | undefined;

  for (const c of row.sourceContributions) {
    const role = c.bundle.sourceRole;
    if (role === 'official_website_source' && c.candidate.eventUrl) {
      official = c.candidate.eventUrl;
    }
    if (role === 'ticket_platform') {
      ticket = c.candidate.ticketUrl ?? c.candidate.eventUrl ?? ticket;
    }
    if (!official && c.candidate.eventUrl && !String(c.candidate.eventUrl).includes('ticket')) {
      official = c.candidate.eventUrl;
    }
  }

  if (!ticket) {
    ticket = row.rebuilt.ticketUrl ?? row.existing?.ticketUrl;
  }
  if (!official) {
    official = row.rebuilt.websiteUrl ?? row.existing?.websiteUrl;
  }

  return { official, ticket };
}

function fieldGroupsPresent(row: BulkRebuildEventRow): string[] {
  const groups = new Set<string>();
  if (row.rebuilt.title || row.rebuilt.startDate) groups.add('identity');
  if (row.rebuilt.venueName) groups.add('venue');
  if (row.rebuilt.description) groups.add('content');
  if ((row.rebuilt.genreLabels?.length ?? 0) > 0) groups.add('genres');
  if ((row.rebuilt.lineupArtistNames?.length ?? 0) > 0) groups.add('lineup');
  if (row.rebuilt.ticketUrl || row.rebuilt.priceText) groups.add('tickets');
  return [...groups];
}

export function buildPhaseCLiveReferenceMatrix(
  rows: BulkRebuildEventRow[],
  detailFetchMetrics?: Record<string, unknown>,
): {
  sourceRun: string;
  detailFetchMetrics?: Record<string, unknown>;
  fixtureAcceptanceSeparate: true;
  entries: PhaseCLiveReferenceEntry[];
} {
  const byId = new Map(rows.map((row) => [row.eventIdBefore, row]));

  const entries: PhaseCLiveReferenceEntry[] = BULK_REBUILD_ACCEPTANCE_FIXTURES.map((fixture) => {
    const row = byId.get(fixture.eventId);
    const categorized = categorizeLiveReferenceRow(fixture.key, fixture.eventId, row);
    const urls = row ? contributionUrls(row) : {};

    const nativeIdentityEvidence = row
      ? row.sourceContributions.map((c) => ({
          sourceId: c.sourceId,
          role: c.bundle.sourceRole,
          identityVerdict: c.identityVerdict,
          verifiedAt: c.verifiedAt,
          pageTitle: c.bundle.identity.pageTitle,
          eventDate: c.bundle.identity.eventDate,
          venueName: c.bundle.identity.venueName,
          detailFetchStatus: c.detailEvidence?.fetchStatus,
          eventUrl: c.candidate.eventUrl,
          ticketUrl: c.candidate.ticketUrl,
        }))
      : [];

    const detailFetchStatuses = row
      ? row.sourceContributions.map((c) => c.detailEvidence?.fetchStatus ?? 'not_requested')
      : [];

    let category = categorized.category;
    const notes = [...categorized.notes];
    if (row?.disposition === 'review_core_missing') {
      category = 'pipeline_missing_evidence';
      notes.push('review_core_missing');
    }

    return {
      key: fixture.key,
      eventId: fixture.eventId,
      category,
      disposition: row?.disposition,
      officialUrl: urls.official,
      ticketUrl: urls.ticket,
      detailFetchStatuses,
      nativeIdentityEvidence,
      verifiedAt: row?.rebuilt.verifiedAt,
      fieldGroupsPresent: row ? fieldGroupsPresent(row) : [],
      isolatedContributionKeys:
        (row?.collision?.isolatedContributionKeys as string[] | undefined) ?? [],
      collisionTriage: row?.collision?.triage as Record<string, unknown> | undefined,
      pipelineGaps: categorized.pipelineGaps,
      notes,
      sourcePhase: '4.8.6.7.3_final' as const,
      httpCapableRun: true,
    };
  });

  return {
    sourceRun: 'phase_4867_bulk_rebuild_events_phase_c',
    detailFetchMetrics,
    fixtureAcceptanceSeparate: true,
    entries,
  };
}
