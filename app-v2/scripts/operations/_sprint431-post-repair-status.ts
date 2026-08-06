import './bootstrap-ops-supabase';

import type { EventStatusMetricsSnippet, ImportJobMetricsSnippet } from './ops-supabase-rows';
import { opsClient } from './ops-supabase-rows';

async function main(): Promise<void> {
  const client = opsClient();
  const sources = [
    'source-ticket-io-protontheclub',
    'source-ticket-io-lehmannclub',
    'source-ticket-io-technodampfer',
    'source-ticket-io-hmg-concerts',
  ];

  for (const sourceId of sources) {
    const { data: job } = await client
      .from('import_jobs')
      .select('id,status,fetched_count,updated_count,unchanged_count,created_count,published_count,skipped_count,warnings')
      .eq('source_id', sourceId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const { data: events } = await client
      .from('events')
      .select('status,description,price_text')
      .eq('source_id', sourceId);

    const jobRow = job as ImportJobMetricsSnippet | null;
    const eventRows = (events ?? []) as EventStatusMetricsSnippet[];

    const statuses = eventRows.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = (acc[row.status] ?? 0) + 1;
      return acc;
    }, {});

    console.log(
      JSON.stringify({
        sourceId,
        job: jobRow,
        eventStatuses: statuses,
        withPriceText: eventRows.filter((row) => row.price_text?.trim()).length,
        naDescription: eventRows.filter((row) => /^n\/a$/i.test(row.description ?? '')).length,
      }),
    );
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
