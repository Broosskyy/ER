#!/usr/bin/env tsx
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runTicketIoGermanyNetworkDiscovery } from '../server/official-connectors/ticket-evidence/network-discovery/ticket-io-germany-network-discovery';

const OUT = join(process.cwd(), '..', 'artifacts', 'm9-3b-3-ticketio-germany-expansion');
mkdirSync(OUT, { recursive: true });

async function main(): Promise<void> {
  const result = await runTicketIoGermanyNetworkDiscovery({
    referenceInstant: new Date(),
    sampleDetailCountPerShop: 0,
  });

  writeFileSync(join(OUT, 'phase-a-summary.json'), JSON.stringify(result.germanySummary, null, 2));
  console.log(JSON.stringify(result.germanySummary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
