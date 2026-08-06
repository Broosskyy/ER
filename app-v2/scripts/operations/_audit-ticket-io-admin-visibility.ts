import './bootstrap-ops-supabase';

import type { EventSourceReferenceRow } from './ops-supabase-rows';
import { getSupabaseClient } from '@/services/supabase/client';
import { getSupabaseServiceClient } from '@/services/supabase/client-service-role';

const EXPANSION_SOURCES = [
  'source-ticket-io-protontheclub',
  'source-ticket-io-lehmannclub',
  'source-ticket-io-area51events',
  'source-ticket-io-technodampfer',
  'source-ticket-io-hmg-concerts',
];

async function main(): Promise<void> {
  const service = getSupabaseServiceClient();
  const anon = getSupabaseClient();

  console.log('\n=== ORIGINS (service role, correct columns) ===');
  for (const sourceId of EXPANSION_SOURCES) {
    const { data, error } = await service
      .from('event_source_references')
      .select('id,canonical_event_id,source_id,external_event_id,active')
      .eq('source_id', sourceId)
      .limit(3);
    console.log(sourceId, 'count sample:', data?.length, error?.message);
    if (data?.[0]) console.log('  sample:', data[0]);
  }

  console.log('\n=== ORIGINS (anon client - simulates admin RLS) ===');
  for (const sourceId of EXPANSION_SOURCES.slice(0, 2)) {
    const { data, error } = await anon
      .from('event_source_references')
      .select('id,canonical_event_id,source_id')
      .eq('source_id', sourceId)
      .limit(3);
    console.log(sourceId, 'rows:', data?.length ?? 0, 'error:', error?.message ?? 'none');
  }

  console.log('\n=== EVENTS BY source_id (expansion shops) ===');
  for (const sourceId of EXPANSION_SOURCES) {
    const { count } = await service
      .from('events')
      .select('*', { count: 'exact', head: true })
      .eq('source_id', sourceId);
    const { count: published } = await service
      .from('events')
      .select('*', { count: 'exact', head: true })
      .eq('source_id', sourceId)
      .eq('status', 'published');
    console.log(`${sourceId}: total=${count}, published=${published}`);
  }

  console.log('\n=== SOURCE METRICS ON sources TABLE ===');
  const { data: sources } = await service
    .from('sources')
    .select('id,display_name,total_valid_event_count,total_import_count,last_import_at,last_job_status')
    .in('id', EXPANSION_SOURCES);
  console.log(JSON.stringify(sources, null, 2));

  console.log('\n=== IMPORT RECORDS still needs_review ===');
  const { data: pending } = await service
    .from('import_records')
    .select('source_id,status')
    .in('source_id', EXPANSION_SOURCES)
    .eq('status', 'needs_review');
  console.log('needs_review count:', pending?.length);
  console.log(pending);

  console.log('\n=== EVENTS: source_id vs origins canonical_event_id mismatch check ===');
  const { data: protonEvents } = await service
    .from('events')
    .select('id,title,source_id,status')
    .eq('source_id', 'source-ticket-io-protontheclub')
    .limit(3);
  console.log('events with source_id=protontheclub:', protonEvents);

  const { data: protonOrigins } = await service
    .from('event_source_references')
    .select('canonical_event_id,source_id')
    .eq('source_id', 'source-ticket-io-protontheclub')
    .limit(3);
  console.log('origins for protontheclub:', protonOrigins);

  if (protonOrigins?.[0]) {
    const origin = protonOrigins[0] as EventSourceReferenceRow;
    const { data: eventByOrigin } = await service
      .from('events')
      .select('id,title,source_id,status')
      .eq('id', origin.canonical_event_id);
    console.log('event linked via origin:', eventByOrigin);
  }
}

void main().catch(console.error);
