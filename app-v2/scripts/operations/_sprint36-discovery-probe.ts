import './bootstrap-ops-supabase';

import { ticketIoCorpusExpansionService } from '@/data/repositories/registry';

async function main(): Promise<void> {
  const discovery = await ticketIoCorpusExpansionService.discoverQualifiedShops('admin');
  console.log(
    JSON.stringify(
      {
        corpus: discovery.corpus,
        shopCount: discovery.discoveredShops.length,
        shops: discovery.discoveredShops.map((entry) => ({
          slug: entry.candidate.shopSlug,
          events: entry.candidate.eventCount,
          tier: entry.qualification.tier,
          behavior: entry.qualification.recommendedPublishBehavior,
        })),
      },
      null,
      2,
    ),
  );
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
