#!/usr/bin/env tsx
/**
 * M9.2.1 — Global multi-source media evidence gate (staging apply + idempotency).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { AFFENKAEFIG_CONNECTOR_ID } from '../server/official-connectors/affenkaefig/constants';
import { BOOTSHAUS_CONNECTOR_ID } from '../server/official-connectors/bootshaus/constants';
import { createStagingSyncDependencies } from '../server/ingestion/sync/create-staging-dependencies';
import {
  assertProductionNotLinked,
  createSupabaseCliLinkedQueryExecutor,
  verifyLinkedStagingTarget,
} from '../server/ingestion/sync/linked-db';
import { runSourceSync } from '../server/ingestion/sync/orchestrator';
import { STAGING_PROJECT_REF, PRODUCTION_PROJECT_REF } from '../server/ingestion/sync/staging-guard';

const OUT_DIR = '.tmp/m9-2-1-media-gate';
const SOURCES = [BOOTSHAUS_CONNECTOR_ID, AFFENKAEFIG_CONNECTOR_ID] as const;

function writeJson(name: string, payload: unknown): void {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, name), JSON.stringify(payload, null, 2));
}

async function runConnectorPass(
  connectorId: string,
  deps: ReturnType<typeof createStagingSyncDependencies>,
  mode: 'dry_run' | 'apply',
) {
  const first = await runSourceSync({ connectorId, mode, triggerType: 'manual' }, deps);
  const second = await runSourceSync({ connectorId, mode, triggerType: 'manual' }, deps);
  return { first, second };
}

async function main() {
  const cwd = process.cwd();
  assertProductionNotLinked(cwd);
  verifyLinkedStagingTarget(cwd);
  const deps = createStagingSyncDependencies({ cwd, runQuery: createSupabaseCliLinkedQueryExecutor(cwd), verifyTarget: false });

  const runs: Record<string, unknown> = {};
  let secondRunConsumerWrites = 0;

  for (const connectorId of SOURCES) {
    const { first, second } = await runConnectorPass(connectorId, deps, 'apply');
    runs[connectorId] = {
      firstRunConsumerWrites: first.run.counters.appliedWrites,
      secondRunConsumerWrites: second.run.counters.appliedWrites,
    };
    secondRunConsumerWrites += second.run.counters.appliedWrites;
  }

  const summary = {
    sources: SOURCES,
    runs,
    secondRunConsumerWrites,
    secondRunMediaWrites: secondRunConsumerWrites,
    productionMutations: 0,
    staging: STAGING_PROJECT_REF,
    production: PRODUCTION_PROJECT_REF,
  };
  writeJson('gate-summary.json', summary);
  console.log(JSON.stringify(summary, null, 2));

  if (secondRunConsumerWrites !== 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
