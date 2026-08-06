import './bootstrap-ops-supabase';
import { getSupabaseServiceClient } from '@/services/supabase/client-service-role';

async function main() {
  const client = getSupabaseServiceClient();
  const { data, error } = await client
    .from('import_jobs')
    .update({
      status: 'failed',
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', 'f7bf6136-48bf-4aa4-b387-8a2a0da8c6fa')
    .select('id,status');
  console.log({ data, error });
}
void main();
