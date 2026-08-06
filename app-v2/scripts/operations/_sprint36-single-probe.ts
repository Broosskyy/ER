import './bootstrap-ops-supabase';

import { probeTicketIoShopUrl } from '@/features/ticket-platform-discovery/discovery/ticket-io-probe';
import { adminSourceRepository } from '@/data/repositories/registry';

async function main(): Promise<void> {
  const slugs = ['technodampfer', 'protontheclub', 'lehmannclub', 'area51events', 'hmg-concerts'];
  const sources = await adminSourceRepository.getAll();
  const known = sources
    .map((source) => source.sourceConfig?.ticketPlatform?.shopSlug)
    .filter(Boolean);
  console.log('known slugs:', known);

  for (const slug of slugs) {
    const probe = await probeTicketIoShopUrl(slug);
    console.log(slug, probe?.valid, probe?.eventCount, probe?.scopeStats);
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
