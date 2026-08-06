import './bootstrap-ops-supabase';

import { getSupabaseServiceClient } from '@/services/supabase/client-service-role';

const SOURCE_IDS = [
  'source-ticket-io-protontheclub',
  'source-ticket-io-lehmannclub',
  'source-ticket-io-area51events',
  'source-ticket-io-technodampfer',
  'source-ticket-io-hmg-concerts',
];

async function main(): Promise<void> {
  const client = getSupabaseServiceClient();

  for (const sourceId of SOURCE_IDS) {
    const { data: records } = await client
      .from('import_records')
      .select('id,external_id,status,duplicate_score,duplicate_decision,resulting_event_id,validation_errors')
      .eq('source_id', sourceId)
      .order('created_at', { ascending: false })
      .limit(5);

    const statusCounts: Record<string, number> = {};
    const { data: all } = await client
      .from('import_records')
      .select('status')
      .eq('source_id', sourceId);
    for (const row of all ?? []) {
      statusCounts[row.status] = (statusCounts[row.status] ?? 0) + 1;
    }

    console.log(`\n=== ${sourceId} ===`);
    console.log('statusCounts', statusCounts);
    console.log('sample', records);
  }

  const { data: stuck } = await client
    .from('import_jobs')
    .select('id,source_id,status,created_at')
    .eq('status', 'running');
  console.log('\n=== stuck jobs ===', stuck);
}

void main().catch(console.error);
