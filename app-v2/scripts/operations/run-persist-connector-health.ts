/**
 * Persists connector health snapshots from the in-process registry.
 * Usage: npx tsx scripts/operations/run-persist-connector-health.ts
 */
import { connectorHealthPersistenceService } from '@/data/repositories/registry';
import { sourceConnectorRegistry } from '@/features/aggregation/connectors/source-connector-registry';

async function main() {
  const snapshots = await connectorHealthPersistenceService.persistFromRegistry(
    sourceConnectorRegistry,
  );
  console.log(JSON.stringify({ count: snapshots.length, snapshots }, null, 2));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
