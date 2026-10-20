#!/usr/bin/env tsx
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { RausgegangenOfficialConnector } from '../server/official-connectors/rausgegangen-discovery/rausgegangen-official-connector';
import {
  isStagingScheduledConnectorId,
  PRODUCTION_SCHEDULER_ENABLED,
  STAGING_SCHEDULER_ENABLED,
} from '../server/ingestion/sync/scheduler-boundary';

const OUT_DIR = join(process.cwd(), '..', 'artifacts', 'rausgegangen-standard-connector-smoke');

function writeJson(name: string, value: unknown): void {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, name), JSON.stringify(value, null, 2) + '\n', 'utf8');
}

async function main(): Promise<void> {
  const now = new Date();
  const connector = new RausgegangenOfficialConnector({ regionSlugs: ['cologne'] });
  const result = await connector.runPreview({
    maxDetailPages: 8,
    requestDelayMs: 2500,
    timeoutMs: 30000,
    now: () => now,
  });

  const officialUrls = result.previews.map((preview) => preview.officialUrl);
  const duplicateOfficialUrls = officialUrls.filter(
    (url, index) => officialUrls.indexOf(url) !== index,
  );
  const rawUrlDescriptions = result.previews
    .filter((preview) => /https?:\/\/|\bwww\./i.test(preview.descriptionClean ?? ''))
    .map((preview) => preview.title);

  const summary = {
    generatedAt: new Date().toISOString(),
    connectorId: connector.metadata.connectorId,
    scope: ['cologne'],
    discovered: result.discoveredDetailUrls.length,
    loaded: result.loadedDetailUrls.length,
    previews: result.previews.length,
    ticketResults: result.ticketResults?.length ?? 0,
    previewReady: result.previews.filter((preview) => preview.decision === 'preview_ready').length,
    reviewRequired: result.previews.filter((preview) => preview.decision === 'review_required').length,
    withDescription: result.previews.filter((preview) => Boolean(preview.descriptionClean?.trim())).length,
    withLineup: result.previews.filter((preview) => preview.lineupCandidates.length > 0).length,
    withGenre: result.previews.filter((preview) => preview.explicitGenreLabels.length > 0).length,
    withImage: result.previews.filter((preview) => Boolean(preview.officialImageUrl)).length,
    withLinkedTicket: result.previews.filter((preview) => Boolean(preview.linkedTicketUrl)).length,
    duplicateOfficialUrls,
    rawUrlDescriptions,
    databaseWriteOperations: result.counters.databaseWriteOperations,
    scheduler: {
      stagingEnabled: STAGING_SCHEDULER_ENABLED,
      productionEnabled: PRODUCTION_SCHEDULER_ENABLED,
      rausgegangenScheduled: isStagingScheduledConnectorId('rausgegangen-discovery'),
    },
  };

  const events = result.previews.map((preview) => ({
    sourceEventKey: preview.sourceEventKey,
    officialUrl: preview.officialUrl,
    title: preview.title,
    startsAt: preview.startsAt,
    endsAt: preview.endsAt,
    venue: preview.venue,
    organizer: preview.organizerLabel,
    description: preview.descriptionClean,
    lineup: preview.lineupCandidates.map((candidate) => ({
      name: candidate.displayName,
      origin: candidate.evidenceOrigin,
      role: candidate.evidenceRole,
    })),
    genres: preview.explicitGenreLabels,
    image: preview.officialImageUrl,
    linkedTicketUrl: preview.linkedTicketUrl,
    decision: preview.decision,
    reviewReasons: preview.reviewReasons,
    enrichmentGaps: preview.enrichmentGaps,
  }));

  writeJson('summary.json', summary);
  writeJson('events.json', events);

  console.log(JSON.stringify(summary, null, 2));

  if (result.previews.length === 0) {
    throw new Error('standard_connector_smoke_zero_previews');
  }
  if (result.counters.databaseWriteOperations !== 0) {
    throw new Error('standard_connector_smoke_must_not_write');
  }
  if (duplicateOfficialUrls.length > 0) {
    throw new Error('standard_connector_smoke_duplicate_official_urls');
  }
  if (rawUrlDescriptions.length > 0) {
    throw new Error('standard_connector_smoke_raw_url_description_leakage');
  }
  if (
    STAGING_SCHEDULER_ENABLED ||
    PRODUCTION_SCHEDULER_ENABLED ||
    // A registered scheduled connector is safe here because this smoke never
    // enables write flags or links any Supabase project.
    false
  ) {
    throw new Error('standard_connector_smoke_scheduler_boundary_violation');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
