#!/usr/bin/env tsx
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import type { OfficialConnector, OfficialConnectorRunResult } from '../server/official-connectors/connector-contract';
import { BOOTSHAUS_CONNECTOR_ID } from '../server/official-connectors/bootshaus/constants';
import { BootshausOfficialConnector } from '../server/official-connectors/bootshaus/bootshaus-official-connector';
import { createStagingSyncDependencies } from '../server/ingestion/sync/create-staging-dependencies';
import {
  assertProductionNotLinked,
  createSupabaseCliLinkedQueryExecutor,
  verifyLinkedStagingTarget,
} from '../server/ingestion/sync/linked-db';
import { runSourceSync } from '../server/ingestion/sync/orchestrator';
import type { OfficialEventConsumerPreview } from '../server/official-connectors/types';
import { createEmptyConnectorCounters } from '../server/official-connectors/types';
import { OfficialSourceRegistry } from '../server/official-connectors/source-registry';

const OUT_DIR = '.tmp/m8-5-staging-e2e';
const CACHE_PATH = join(OUT_DIR, 'bootshaus-preview-cache.json');

class ReplayBootshausConnector implements OfficialConnector {
  readonly metadata;

  constructor(private readonly cached: OfficialConnectorRunResult) {
    this.metadata = new BootshausOfficialConnector().metadata;
  }

  discoverFromListHtml() {
    return { listUrl: this.cached.listUrl, detailUrls: this.cached.discoveredDetailUrls, duplicateCount: 0 };
  }

  async fetchHtml(url: string) {
    return { finalUrl: url, html: '<html></html>', contentType: 'text/html' };
  }

  parseDetailPage() {
    return this.cached.previews[0]!;
  }

  async runPreview(): Promise<OfficialConnectorRunResult> {
    return this.cached;
  }
}

async function loadOrCreatePreviewCache(): Promise<OfficialConnectorRunResult> {
  if (existsSync(CACHE_PATH)) {
    const payload = JSON.parse(readFileSync(CACHE_PATH, 'utf8')) as {
      previews: OfficialEventConsumerPreview[];
      listUrl: string;
      discoveredDetailUrls: string[];
      loadedDetailUrls: string[];
      fetchedAt: string;
    };
    return {
      fetchedAt: payload.fetchedAt,
      listUrl: payload.listUrl,
      discoveredDetailUrls: payload.discoveredDetailUrls,
      loadedDetailUrls: payload.loadedDetailUrls,
      previews: payload.previews,
      counters: createEmptyConnectorCounters(),
      mediaCounters: {
        imagesConsidered: 0,
        imagesDownloaded: 0,
        imagesRejectedLowQuality: 0,
        imagesRejectedPolicy: 0,
        ocrAttempts: 0,
        ocrSuccesses: 0,
        lineupActsCorroborated: 0,
        lineupActsRejected: 0,
      },
    };
  }

  const live = await new BootshausOfficialConnector().runPreview();
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(
    CACHE_PATH,
    JSON.stringify(
      {
        fetchedAt: live.fetchedAt,
        listUrl: live.listUrl,
        discoveredDetailUrls: live.discoveredDetailUrls,
        loadedDetailUrls: live.loadedDetailUrls,
        previews: live.previews,
      },
      null,
      2,
    ),
  );
  return live;
}

async function main() {
  const cwd = process.cwd();
  assertProductionNotLinked(cwd);
  verifyLinkedStagingTarget(cwd);
  const runQuery = createSupabaseCliLinkedQueryExecutor(cwd);
  const cached = await loadOrCreatePreviewCache();

  const registry = new OfficialSourceRegistry();
  registry.register(new ReplayBootshausConnector(cached));
  const baseDeps = createStagingSyncDependencies({ cwd, runQuery, verifyTarget: false });
  const replayDeps = { ...baseDeps, registry };

  const replayRun = await runSourceSync(
    { connectorId: BOOTSHAUS_CONNECTOR_ID, mode: 'apply', triggerType: 'test' },
    replayDeps,
  );

  writeFileSync(join(OUT_DIR, 'replay-idempotency-run.json'), JSON.stringify(replayRun, null, 2));
  console.log(
    JSON.stringify(
      {
        appliedWrites: replayRun.run.counters.appliedWrites,
        noops: replayRun.run.counters.noops,
        status: replayRun.run.status,
      },
      null,
      2,
    ),
  );

  if (replayRun.run.counters.appliedWrites !== 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
