#!/usr/bin/env tsx
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { BOOTSHAUS_CONNECTOR_ID } from '../server/official-connectors/bootshaus/constants';
import { createStagingSyncDependencies } from '../server/ingestion/sync/create-staging-dependencies';
import {
  assertProductionNotLinked,
  createSupabaseCliLinkedQueryExecutor,
  verifyLinkedStagingTarget,
} from '../server/ingestion/sync/linked-db';
import { runSourceSync } from '../server/ingestion/sync/orchestrator';

const OUT_DIR = '.tmp/m8-5-staging-e2e';

async function main() {
  const cwd = process.cwd();
  assertProductionNotLinked(cwd);
  verifyLinkedStagingTarget(cwd);
  const deps = createStagingSyncDependencies({ cwd, runQuery: createSupabaseCliLinkedQueryExecutor(cwd), verifyTarget: false });
  const thirdRun = await runSourceSync(
    { connectorId: BOOTSHAUS_CONNECTOR_ID, mode: 'apply', triggerType: 'manual' },
    deps,
  );
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, 'third-run-idempotency.json'), JSON.stringify(thirdRun, null, 2));
  console.log(JSON.stringify({
    appliedWrites: thirdRun.run.counters.appliedWrites,
    noops: thirdRun.run.counters.noops,
    status: thirdRun.run.status,
  }, null, 2));
  if (thirdRun.run.counters.appliedWrites !== 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
