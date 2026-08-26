#!/usr/bin/env tsx
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { AFFENKAEFIG_CONNECTOR_ID } from '../server/official-connectors/affenkaefig/constants';
import { createStagingSyncDependencies } from '../server/ingestion/sync/create-staging-dependencies';
import { assertProductionNotLinked, verifyLinkedStagingTarget } from '../server/ingestion/sync/linked-db';
import { runSourceSync } from '../server/ingestion/sync/orchestrator';

const OUT_DIR = '.tmp/m8-6-affenkaefig-e2e';

async function main() {
  assertProductionNotLinked(process.cwd());
  verifyLinkedStagingTarget(process.cwd());
  const deps = createStagingSyncDependencies({ verifyTarget: false });
  const secondRun = await runSourceSync(
    { connectorId: AFFENKAEFIG_CONNECTOR_ID, mode: 'apply', triggerType: 'manual' },
    deps,
  );
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, 'second-run-result.json'), JSON.stringify(secondRun, null, 2));
  console.log(
    JSON.stringify(
      {
        appliedWrites: secondRun.run.counters.appliedWrites,
        noops: secondRun.run.counters.noops,
      },
      null,
      2,
    ),
  );
  if (secondRun.run.counters.appliedWrites !== 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
