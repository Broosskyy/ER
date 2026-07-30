/**
 * Sprint 33.4 — Platform discovery validation (live probe).
 * Run: npx tsx scripts/operations/_sprint334-platform-discovery-validation.ts
 */
import { collectDiscoveryCorpusFromSources } from '@/features/ticket-platform-discovery/discovery/discovery-corpus';
import { discoverTicketIoShops } from '@/features/ticket-platform-discovery/discovery/ticket-io-shop-discovery';
import {
  crawlTicketKingsPlatform,
  TICKET_KINGS_PLATFORM_LIST_URL,
} from '@/features/ticket-platform-discovery/discovery/ticket-kings-platform-crawler';
import { InMemoryPlatformDiscoveryRepository } from '@/features/ticket-platform-discovery/repositories/platform-discovery-repository';
import { PlatformDiscoveryService } from '@/features/ticket-platform-discovery/services/platform-discovery-service';

async function main() {
  const kingsCrawl = await crawlTicketKingsPlatform();
  const corpus = [
    'https://bootshaus.ticket.io/',
    'https://affenkaefig.ticket.io/',
  ];
  const ticketIoShops = await discoverTicketIoShops({
    corpusTexts: corpus,
    knownShopSlugs: ['bootshaus'],
    maxShops: 5,
  });

  const repository = new InMemoryPlatformDiscoveryRepository();
  const service = new PlatformDiscoveryService(
    repository,
    async () => [],
    async () => collectDiscoveryCorpusFromSources([]).concat(corpus),
    async (record) => record,
  );

  const kingsReport = await service.runTicketKingsDiscovery('admin');
  const ioReport = await service.runTicketIoDiscovery('admin');

  const report = {
    ticketKings: {
      listUrl: TICKET_KINGS_PLATFORM_LIST_URL,
      pagesCrawled: kingsCrawl.pagesCrawled,
      rawEvents: kingsCrawl.rawEvents.length,
      acceptedEvents: kingsCrawl.acceptedEvents.length,
      rejected: kingsCrawl.scopeStats.rejected,
      organizers: kingsCrawl.organizers.size,
      venues: kingsCrawl.venues.size,
      limitations: kingsCrawl.limitations,
      serviceCandidates: kingsReport.candidates.length,
    },
    ticketIo: {
      corpusSlugs: corpus.length,
      probedShops: ticketIoShops.length,
      limitations: ioReport.run.summary.limitations,
      serviceCandidates: ioReport.candidates.length,
    },
    verdict:
      kingsCrawl.acceptedEvents.length > 0 || ticketIoShops.length > 0
        ? 'PLATFORM_DISCOVERY_OPERATIONAL'
        : 'PLATFORM_DISCOVERY_EMPTY_BUT_FUNCTIONAL',
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
