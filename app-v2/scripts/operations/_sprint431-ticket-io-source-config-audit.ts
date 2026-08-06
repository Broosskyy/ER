import './bootstrap-ops-supabase';

import { adminSourceRepository } from '@/data/repositories/registry';

async function main(): Promise<void> {
  const ids = [
    'source-ticket-io-protontheclub',
    'source-ticket-io-lehmannclub',
    'source-ticket-io-area51events',
    'source-ticket-io-technodampfer',
    'source-ticket-io-hmg-concerts',
    'source-bootshaus-ticket-io',
  ];

  const rows = [];
  for (const id of ids) {
    const source = await adminSourceRepository.getById(id);
    rows.push({
      id,
      enabled: source?.enabled,
      active: source?.enabled,
      shopSlug: source?.sourceConfig?.ticketPlatform?.shopSlug,
      listUrl: source?.sourceConfig?.ticketPlatform?.listUrl,
      publishMode: source?.publishMode,
    });
  }

  console.log(JSON.stringify(rows, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
