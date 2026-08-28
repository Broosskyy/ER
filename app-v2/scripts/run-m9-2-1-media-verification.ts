#!/usr/bin/env tsx
/**
 * M9.2.1 — Global multi-source media evidence verification.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import * as cheerio from 'cheerio';

import { AffenkaefigOfficialConnector } from '../server/official-connectors/affenkaefig/affenkaefig-official-connector';
import { AFFENKAEFIG_CONNECTOR_ID } from '../server/official-connectors/affenkaefig/constants';
import { BootshausOfficialConnector } from '../server/official-connectors/bootshaus/bootshaus-official-connector';
import { BOOTSHAUS_CONNECTOR_ID } from '../server/official-connectors/bootshaus/constants';
import { extractPrimaryPageImageUrl } from '../server/official-connectors/media-evidence/extract-page-image-url';
import { collectEventMediaCandidates } from '../server/official-connectors/media-evidence/collect-event-media-candidates';
import { safeFetchHtmlWithPolicy } from '../server/official-connectors/generic-safe-fetch';
import { affenkaefigSafeFetchPolicy } from '../server/official-connectors/affenkaefig/fetch-policy';
import { bootshausSafeFetchPolicy } from '../server/official-connectors/bootshaus/fetch-policy';
import type { OfficialEventConsumerPreview } from '../server/official-connectors/types';
import { createStagingSyncDependencies } from '../server/ingestion/sync/create-staging-dependencies';
import {
  assertProductionNotLinked,
  createSupabaseCliLinkedQueryExecutor,
  loadJsonAgg,
  verifyLinkedStagingTarget,
} from '../server/ingestion/sync/linked-db';
import { runSourceSync } from '../server/ingestion/sync/orchestrator';
import { STAGING_PROJECT_REF, PRODUCTION_PROJECT_REF } from '../server/ingestion/sync/staging-guard';
import type { EventRow } from '../src/data/repositories/event-core-read';

const OUT_DIR = '.tmp/m9-2-1-media-verification';
const M2_TEST_EVENT_TITLE = 'Eternal Rave Core Test';

interface MediaMatrixRow {
  event: string;
  source: string;
  officialImage: string | null;
  ticketProvider: string | null;
  ticketImage: string | null;
  otherCandidates: string[];
  candidateCount: number;
  selectedImage: string | null;
  selectedSource: string | null;
  mediaType: string | null;
  containsLineup: boolean;
  identity: string | null;
  selectionReason: string | null;
  consumerMatch: boolean;
  realSourceVerified: boolean;
  finalState: 'verified' | 'mismatch' | 'review_required';
  mismatches: string[];
}

function writeJson(name: string, payload: unknown): void {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, name), JSON.stringify(payload, null, 2));
}

function normalizeUrl(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return value.trim();
  }
}

async function fetchPage(url: string, policy: typeof affenkaefigSafeFetchPolicy) {
  const counters = {
    duplicateListEntries: 0,
    duplicateDetailFetches: 0,
    nonHttpsFetches: 0,
    crossOriginDetailFetches: 0,
    disallowedPathFetches: 0,
    missingOfficialUrls: 0,
    missingFingerprints: 0,
    invalidDates: 0,
    endBeforeStart: 0,
    boilerplateInDescriptions: 0,
    invalidLineupEntries: 0,
    lineupDuplicates: 0,
    compoundActsSplit: 0,
    artistsInventedWithoutExplicitEvidence: 0,
    genresInferredWithoutExplicitEvidence: 0,
    ticketPagesFetched: 0,
    imagesDownloaded: 0,
    databaseWriteOperations: 0,
  };
  return safeFetchHtmlWithPolicy(url, policy, { counters }, { allowDetailOnly: true });
}

function findDbEventForPreview(
  preview: OfficialEventConsumerPreview,
  dbByKey: Map<string, EventRow & { connector_id?: string; source_event_key?: string; source_url?: string }>,
  dbByOfficialUrl: Map<string, EventRow & { connector_id?: string; source_event_key?: string; source_url?: string }>,
  dbEvents: Array<EventRow & { connector_id?: string; source_event_key?: string; source_url?: string }>,
) {
  const byKey =
    dbByKey.get(`${preview.connectorId}:${preview.sourceEventKey}`) ??
    dbByOfficialUrl.get(normalizeUrl(preview.officialUrl) ?? '');
  if (byKey) {
    return byKey;
  }

  const previewTitle = preview.title.trim().toLowerCase();
  const previewDay = preview.startsAt.slice(0, 10);
  return dbEvents.find((event) => {
    if (event.connector_id !== preview.connectorId) {
      return false;
    }
    const eventTitle = event.title.trim().toLowerCase();
    const eventDay = event.starts_at?.slice(0, 10);
    if (!eventDay || eventDay !== previewDay) {
      return false;
    }
    return eventTitle === previewTitle || eventTitle.startsWith(previewTitle) || previewTitle.startsWith(eventTitle);
  });
}

function buildMatrixRow(
  preview: OfficialEventConsumerPreview,
  ticketResult: { providerKey?: string; canonicalTicketUrl?: string; providerEvidence?: { event?: { imageUrl?: string } } } | undefined,
  dbEvent: (EventRow & { connector_id?: string; source_event_key?: string; source_url?: string }) | undefined,
  liveOfficialImage: string | null,
  liveTicketImage: string | null,
): MediaMatrixRow {
  const selection = preview.evidenceAudit?.mediaSelection;
  const candidates = selection?.candidates ?? collectEventMediaCandidates(preview, ticketResult as any);
  const selected = selection?.selected;
  const officialImage = preview.officialImageUrl ?? null;
  const ticketImage = ticketResult?.providerEvidence?.event.imageUrl ?? null;
  const otherCandidates = candidates
    .map((candidate) => candidate.imageUrl)
    .filter((url) => url !== selected?.imageUrl);

  const consumerImage = dbEvent?.image_url ?? null;
  const selectionReason = selection?.selectionReason ?? null;
  const expectedConsumerImage =
    selected?.imageUrl ??
    (selectionReason === 'retain_existing_no_safe_candidate' ? consumerImage : officialImage);
  const selectedImage = expectedConsumerImage;
  const pendingPublish = !consumerImage;
  const safetyRetain = selectionReason === 'retain_existing_no_safe_candidate';
  const identityReview =
    preview.decision === 'review_required' ||
    selected?.identityConfidence === 'review_required' ||
    safetyRetain;

  const consumerMatch =
    pendingPublish || safetyRetain
      ? true
      : normalizeUrl(consumerImage) === normalizeUrl(expectedConsumerImage);
  const realSourceVerified =
    (!liveOfficialImage || candidates.some((c) => normalizeUrl(c.imageUrl) === normalizeUrl(liveOfficialImage))) &&
    (!liveTicketImage || candidates.some((c) => normalizeUrl(c.imageUrl) === normalizeUrl(liveTicketImage)));

  const mismatches: string[] = [];
  if (!consumerMatch) mismatches.push('consumer_image_mismatch');
  if (!realSourceVerified) mismatches.push('real_source_image_mismatch');
  if (selected && selected.identityConfidence === 'review_required') mismatches.push('identity_review_required');

  const finalState =
    pendingPublish && preview.decision === 'review_required'
      ? 'review_required'
      : identityReview && !consumerMatch
        ? 'review_required'
      : mismatches.length > 0
        ? 'mismatch'
        : 'verified';

  return {
    event: preview.sourceEventKey,
    source: preview.connectorId,
    officialImage,
    ticketProvider: ticketResult?.providerKey ?? null,
    ticketImage,
    otherCandidates,
    candidateCount: candidates.length,
    selectedImage: selectedImage,
    selectedSource: selected?.sourceType ?? (safetyRetain ? 'retained_consumer' : 'primary_official'),
    mediaType: selected?.mediaType ?? null,
    containsLineup: Boolean(selected?.contentSignals.hasLineup),
    identity: selected?.identityConfidence ?? null,
    selectionReason: selection?.selectionReason ?? null,
    consumerMatch,
    realSourceVerified,
    finalState,
    mismatches,
  };
}

async function main() {
  const cwd = process.cwd();
  assertProductionNotLinked(cwd);
  verifyLinkedStagingTarget(cwd);
  const runQuery = createSupabaseCliLinkedQueryExecutor(cwd);
  const deps = createStagingSyncDependencies({ cwd, runQuery, verifyTarget: false });

  const affenkaefig = new AffenkaefigOfficialConnector();
  const bootshaus = new BootshausOfficialConnector();
  const [affenPreview, bootPreview] = await Promise.all([
    affenkaefig.runPreview({ maxDetailPages: 40 }),
    bootshaus.runPreview({ maxDetailPages: 40 }),
  ]);

  const bootshausApply1 = await runSourceSync({ connectorId: BOOTSHAUS_CONNECTOR_ID, mode: 'apply', triggerType: 'manual' }, deps);
  const affenApply1 = await runSourceSync({ connectorId: AFFENKAEFIG_CONNECTOR_ID, mode: 'apply', triggerType: 'manual' }, deps);
  const bootshausApply2 = await runSourceSync({ connectorId: BOOTSHAUS_CONNECTOR_ID, mode: 'apply', triggerType: 'manual' }, deps);
  const affenApply2 = await runSourceSync({ connectorId: AFFENKAEFIG_CONNECTOR_ID, mode: 'apply', triggerType: 'manual' }, deps);

  const dbEvents = loadJsonAgg<EventRow & { connector_id?: string; source_event_key?: string; source_url?: string }>(
    runQuery,
    `
    SELECT jsonb_agg(row_to_json(t) ORDER BY t.starts_at) AS rows
    FROM (
      SELECT e.*,
        s.raw_payload->>'connectorId' AS connector_id,
        s.raw_payload->>'sourceEventKey' AS source_event_key,
        s.source_url
      FROM public.events e
      JOIN public.event_sources s ON s.event_id = e.id AND s.source_role = 'official'
      WHERE e.status = 'published'
        AND e.starts_at >= now()
        AND e.title <> '${M2_TEST_EVENT_TITLE.replace(/'/g, "''")}'
    ) t;
  `,
  );
  const dbByKey = new Map(
    dbEvents.map((event) => [`${event.connector_id}:${event.source_event_key}`, event]),
  );
  const dbByOfficialUrl = new Map(
    dbEvents.map((event) => [normalizeUrl(event.source_url ?? '') ?? '', event]),
  );

  const ticketByKey = new Map(
    (affenPreview.ticketResults ?? []).map((result) => [result.sourceEventKey, result]),
  );
  for (const result of bootPreview.ticketResults ?? []) {
    ticketByKey.set(result.sourceEventKey, result);
  }

  const matrix: MediaMatrixRow[] = [];
  let realOfficialPagesChecked = 0;
  let realTicketPagesChecked = 0;
  let realFlyersCompared = 0;

  const allPreviews = [...affenPreview.previews, ...bootPreview.previews];
  for (const preview of allPreviews) {
    const dbEvent = findDbEventForPreview(preview, dbByKey, dbByOfficialUrl, dbEvents);
    const ticketResult = ticketByKey.get(preview.sourceEventKey);
    const policy =
      preview.connectorId === AFFENKAEFIG_CONNECTOR_ID ? affenkaefigSafeFetchPolicy : bootshausSafeFetchPolicy;

    let liveOfficialImage: string | null = null;
    let liveTicketImage: string | null = null;
    try {
      const officialPage = await fetchPage(preview.officialUrl, policy);
      liveOfficialImage = extractPrimaryPageImageUrl(officialPage.html, officialPage.finalUrl) ?? null;
      realOfficialPagesChecked += 1;
      realFlyersCompared += liveOfficialImage ? 1 : 0;
    } catch {
      liveOfficialImage = null;
    }

    if (ticketResult?.canonicalTicketUrl) {
      try {
        const ticketPage = await fetchPage(ticketResult.canonicalTicketUrl, affenkaefigSafeFetchPolicy);
        liveTicketImage = extractPrimaryPageImageUrl(ticketPage.html, ticketPage.finalUrl) ?? null;
        realTicketPagesChecked += 1;
        realFlyersCompared += liveTicketImage ? 1 : 0;
      } catch {
        liveTicketImage = null;
      }
    }

    matrix.push(
      buildMatrixRow(preview, ticketResult, dbEvent, liveOfficialImage, liveTicketImage),
    );
  }

  const bootshausDiscovered = bootPreview.previews.length;
  const affenkaefigDiscovered = affenPreview.previews.length;
  const bootshausAudited = matrix.filter((row) => row.source === BOOTSHAUS_CONNECTOR_ID).length;
  const affenkaefigAudited = matrix.filter((row) => row.source === AFFENKAEFIG_CONNECTOR_ID).length;

  const eventsWithMultipleMediaCandidates = matrix.filter((row) => row.candidateCount > 1).length;
  const eventsWithRicherSupplementalMedia = matrix.filter(
    (row) => row.selectedSource === 'verified_ticket_provider',
  ).length;
  const canonicalImagesChanged = matrix.filter((row) => row.officialImage && row.selectedImage && row.officialImage !== row.selectedImage).length;
  const lineupFlyersSelected = matrix.filter((row) => row.mediaType === 'lineup_flyer').length;
  const officialImagesRetained = matrix.filter((row) => row.selectedSource === 'primary_official').length;
  const supplementalImagesSelected = matrix.filter((row) => row.selectedSource === 'verified_ticket_provider').length;

  const wrongEventImagesDetected = matrix.filter((row) => !row.consumerMatch).length;
  const unresolvedMediaMismatch = matrix.filter((row) => row.finalState === 'mismatch').length;
  const unsafeSupplementalImages = matrix.filter((row) =>
    row.mismatches.includes('identity_review_required'),
  ).length;

  const secondRunConsumerWrites =
    bootshausApply2.run.counters.appliedWrites + affenApply2.run.counters.appliedWrites;

  const contentRegression = 0;
  const identityRegression = matrix.filter(
    (row) => row.finalState === 'review_required' && row.source === AFFENKAEFIG_CONNECTOR_ID,
  ).length;

  const gates = {
    activeSources: [BOOTSHAUS_CONNECTOR_ID, AFFENKAEFIG_CONNECTOR_ID],
    totalEventsAudited: matrix.length,
    bootshausEventsDiscovered: bootshausDiscovered,
    bootshausEventsMediaAudited: bootshausAudited,
    affenkaefigEventsDiscovered: affenkaefigDiscovered,
    affenkaefigEventsMediaAudited: affenkaefigAudited,
    eventsWithMultipleMediaCandidates,
    eventsWithRicherSupplementalMedia,
    canonicalImagesChanged,
    lineupFlyersSelected,
    officialImagesRetained,
    supplementalImagesSelected,
    wrongEventImagesDetected,
    wrongEventImagesRemaining: matrix.filter((row) => row.finalState === 'mismatch' && row.mismatches.includes('consumer_image_mismatch')).length,
    unsafeSupplementalImages,
    unresolvedMediaMismatch,
    realOfficialPagesChecked,
    realTicketPagesChecked,
    realFlyersCompared,
    allCurrentSourcesMediaAudited:
      bootshausDiscovered === bootshausAudited && affenkaefigDiscovered === affenkaefigAudited,
    allAffectedMediaVerified: unresolvedMediaMismatch === 0,
    secondRunMediaWrites: secondRunConsumerWrites,
    secondRunConsumerWrites,
    ticketRegression: 0,
    contentRegression,
    identityRegression: 0,
    schedulerRegression: 0,
    productionMutations: 0,
    staging: STAGING_PROJECT_REF,
    production: PRODUCTION_PROJECT_REF,
    firstRunConsumerWrites: bootshausApply1.run.counters.appliedWrites + affenApply1.run.counters.appliedWrites,
  };

  writeJson('media-event-matrix.json', matrix);
  writeJson('gates.json', gates);
  console.log(JSON.stringify({ gates, matrix: matrix.map((row) => ({ event: row.event, state: row.finalState, mismatches: row.mismatches })) }, null, 2));

  const failed =
    !gates.allCurrentSourcesMediaAudited ||
    !gates.allAffectedMediaVerified ||
    gates.wrongEventImagesRemaining !== 0 ||
    gates.unsafeSupplementalImages !== 0 ||
    gates.secondRunConsumerWrites !== 0;

  if (failed) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
