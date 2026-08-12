/**
 * Bootshaus source-pack proof — one live fetch, zero production writes.
 *
 * npx tsx scripts/operations/run-bootshaus-source-pack-proof.ts
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ProductionCleanImportSourceCollection,
} from '@/features/import/clean-import-core/clean-multi-source-import-service';
import {
  BOOTSHAUS_OFFICIAL_SOURCE_ID,
  BOOTSHAUS_SOURCE_PACK,
} from '@/features/import/clean-import-core/source-pack/bootshaus-source-pack';
import {
  ACTIVE_IMPORT_ENTRY,
  LEGACY_DATA_TRANSITION,
  RETIRED_IMPORT_PATHS,
} from '@/features/import/clean-import-core/source-pack/import-path-manifest';
import { runSourcePackImport } from '@/features/import/clean-import-core/source-pack/source-pack-import-entry';
import { createBootshausLiveProductionSourceRecord } from '@/features/sources/production/production-source-records';
import { createBootshausTicketIoLiveProductionSourceRecord } from '@/features/sources/production/ticket-io-source.core';

const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_DIR = join(APP_ROOT, 'docs/real-data');
const RESULT_PATH = join(OUT_DIR, '_bootshaus_source_pack_proof.json');

const LIVE_FETCH_LIMIT_MS = 8 * 60_000;

function installReadOnlyMutationGuard(baseUrl: string | undefined) {
  if (!baseUrl) return () => undefined;
  const originalFetch = globalThis.fetch.bind(globalThis);
  const base = new URL(baseUrl);
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    const isDatabaseRequest =
      url.origin === base.origin && url.pathname.startsWith('/rest/v1/');
    const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(request.method.toUpperCase());
    if (isDatabaseRequest && isMutation) {
      throw new Error(`read_only_blocked:${url.pathname}:${request.method}`);
    }
    return originalFetch(request);
  };
  return () => {
    globalThis.fetch = originalFetch;
  };
}

async function run(): Promise<void> {
  const restoreFetch = installReadOnlyMutationGuard(
    process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL,
  );
  const startedAt = Date.now();
  try {
    const sources = [
      createBootshausLiveProductionSourceRecord(),
      createBootshausTicketIoLiveProductionSourceRecord(),
    ];
    const executor = new ProductionCleanImportSourceCollection(async () => sources);
    const deadline = startedAt + LIVE_FETCH_LIMIT_MS;
    if (Date.now() > deadline) throw new Error('live_fetch_deadline_exceeded_before_start');

    const result = await runSourcePackImport({
      sources,
      officialSourceId: BOOTSHAUS_OFFICIAL_SOURCE_ID,
      executor,
      now: new Date(),
    });
    if (Date.now() - startedAt > LIVE_FETCH_LIMIT_MS) {
      throw new Error(`live_fetch_limit_exceeded:${Date.now() - startedAt}`);
    }

    const matrix = result.rows.map((row) => ({
      title: row.title,
      date: row.localDay,
      venue: row.venueName,
      address: row.venueAddress,
      city: row.venueCity,
      officialUrl: row.websiteUrl,
      ticketUrl: row.ticketUrl,
      price: row.priceText,
      ticketStatus: row.ticketStatus,
      genres: row.genreLabels,
      lineupArtists: row.lineupCount,
      decision: row.decision,
      reviewReason: row.reviewReason,
      consumerReady: row.consumerReady,
      consumerIssues: row.consumerIssues,
      validationIssues: row.validationIssues.map((issue) => issue.code),
    }));

    const consumerReadyRate =
      result.summary.upcomingOfficialEvents > 0
        ? result.summary.consumerReady / result.summary.upcomingOfficialEvents
        : 0;

    const payload = {
      phase: 'import-source-pack-reset',
      sourcePack: BOOTSHAUS_SOURCE_PACK.id,
      activeImportEntry: ACTIVE_IMPORT_ENTRY,
      retiredPaths: RETIRED_IMPORT_PATHS,
      legacyTransition: LEGACY_DATA_TRANSITION,
      fetch: {
        officialSourceId: BOOTSHAUS_OFFICIAL_SOURCE_ID,
        ticketSourceId: BOOTSHAUS_SOURCE_PACK.ticketSourceId,
        officialEventsFetched: result.summary.officialFetchCount,
        ticketEventsFetched: result.summary.ticketFetchCount,
        elapsedMs: Date.now() - startedAt,
      },
      summary: result.summary,
      consumerReadyRate,
      successCriteria: {
        singleImportPath: true,
        consumerReadyAtLeast90Percent: consumerReadyRate >= 0.9,
        productionMutationsInThisRun: 0,
      },
      matrix,
      diagnostics: result.cleanResult.diagnostics,
      productionMutationsInThisRun: 0,
      rolloutActivated: false,
    };

    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(RESULT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify(payload, null, 2));
  } finally {
    restoreFetch();
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
