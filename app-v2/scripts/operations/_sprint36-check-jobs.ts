import './bootstrap-ops-supabase';
import { getSupabaseServiceClient } from '@/services/supabase/client-service-role';

async function main() {
  const { data } = await getSupabaseServiceClient()
    .from('import_jobs')
    .select('id,source_id,status,created_at')
    .eq('source_id', 'source-ticket-io-technodampfer')
    .order('created_at', { ascending: false })
    .limit(8);
  console.log(JSON.stringify(data, null, 2));
}
void main();
