/**
 * Quick Bootshaus discovery validation.
 */
import './bootstrap-ops-supabase';

import { createClient } from '@supabase/supabase-js';
import { getSupabaseServiceClient } from '@/services/supabase/client-service-role';

const BOOTSHAUS = 'source-bootshaus-koeln';

async function main() {
  const service = getSupabaseServiceClient();
  const anon = createClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '',
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: sample } = await service
    .from('events')
    .select('id, title, venue_id, venue_name, organizer_name, search_document, status')
    .eq('source_id', BOOTSHAUS)
    .eq('status', 'published')
    .limit(3);

  const title = sample?.[0]?.title ?? 'Bootshaus';
  const { data: titleSearch } = await anon
    .from('events')
    .select('id, title')
    .eq('status', 'published')
    .ilike('title', `%${String(title).slice(0, 10)}%`)
    .limit(5);

  const { data: venueSearch } = await anon
    .from('events')
    .select('id, title, venue_id')
    .eq('status', 'published')
    .eq('venue_id', 'venue-bootshaus-koeln')
    .limit(5);

  const { count } = await anon
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'published')
    .eq('source_id', BOOTSHAUS);

  console.log(
    JSON.stringify(
      {
        publishedCount: count,
        sample,
        titleSearchHits: titleSearch?.length ?? 0,
        venueSearchHits: venueSearch?.length ?? 0,
        searchDocumentPopulated: (sample ?? []).filter((row) => Boolean(row.search_document)).length,
      },
      null,
      2,
    ),
  );
}

main();
