import './bootstrap-ops-supabase';

import type { EventRow, EventSourceReferenceRow } from './ops-supabase-rows';
import { opsClient } from './ops-supabase-rows';

const EXPANSION_SOURCES = [
  'source-ticket-io-protontheclub',
  'source-ticket-io-lehmannclub',
  'source-ticket-io-area51events',
  'source-ticket-io-technodampfer',
  'source-ticket-io-hmg-concerts',
];

async function countByStatus(table: string, sourceId: string, statusCol = 'status') {
  const client = opsClient();
  const { data } = await client.from(table).select(statusCol).eq('source_id', sourceId);
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const status = (row as Record<string, string | undefined>)[statusCol];
    if (!status) {
      continue;
    }
    counts[status] = (counts[status] ?? 0) + 1;
  }
  return counts;
}

async function main(): Promise<void> {
  const client = opsClient();

  // 1. Sources
  const { data: sources } = await client
    .from('sources')
    .select('id,slug,display_name,enabled,publish_mode,review_required,trust_score,source_config')
    .like('id', 'source-ticket-io-%')
    .order('id');

  console.log('\n=== SOURCES ===');
  console.log(JSON.stringify(sources, null, 2));

  // 2. Per-source breakdown
  for (const sourceId of EXPANSION_SOURCES) {
    console.log(`\n=== ${sourceId} ===`);

    const recordStatus = await countByStatus('import_records', sourceId);
    console.log('import_records by status:', recordStatus);

    const { data: recordsSample } = await client
      .from('import_records')
      .select('id,external_id,status,resulting_event_id,duplicate_score,duplicate_event_id,validation_errors')
      .eq('source_id', sourceId)
      .limit(3);
    console.log('import_records sample:', JSON.stringify(recordsSample, null, 2));

    const { count: origins } = await client
      .from('event_source_references')
      .select('*', { count: 'exact', head: true })
      .eq('source_id', sourceId);
    console.log('event_source_references (origins):', origins);

    const { data: originsSample } = await client
      .from('event_source_references')
      .select('id,event_id,source_id,external_id,source_url')
      .eq('source_id', sourceId)
      .limit(3);
    console.log('origins sample:', JSON.stringify(originsSample, null, 2));

    if (originsSample && originsSample.length > 0) {
      const originRows = originsSample as EventSourceReferenceRow[];
      const eventIds = originRows.map((o) => o.event_id).filter((id): id is string => Boolean(id));
      const { data: events } = await client
        .from('events')
        .select('id,title,status,published_at,canonical_event_id,source_id')
        .in('id', eventIds);
      console.log('linked events:', JSON.stringify(events, null, 2));
    }
  }

  // 3. Global event counts
  const { count: totalEvents } = await client.from('events').select('*', { count: 'exact', head: true });
  const { count: publishedEvents } = await client
    .from('events')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'published');
  const { count: draftEvents } = await client
    .from('events')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'draft');

  console.log('\n=== GLOBAL EVENTS ===');
  console.log({ totalEvents, publishedEvents, draftEvents });

  // 4. Events with ticket.io URLs from expansion sources
  const { data: ticketIoEvents } = await client
    .from('events')
    .select('id,title,status,ticket_url,source_id,published_at')
    .ilike('ticket_url', '%.ticket.io%')
    .order('created_at', { ascending: false })
    .limit(20);
  console.log('\n=== RECENT TICKET.IO EVENTS (top 20) ===');
  console.log(JSON.stringify(ticketIoEvents, null, 2));

  // 5. Import review queue
  const { data: reviewQueue } = await client
    .from('import_review_queue')
    .select('id,import_record_id,source_id,status,decision,created_at')
    .in('source_id', EXPANSION_SOURCES)
    .limit(10);
  console.log('\n=== IMPORT REVIEW QUEUE (sample) ===');
  console.log(JSON.stringify(reviewQueue, null, 2));

  // 6. Recent import jobs
  const { data: jobs } = await client
    .from('import_jobs')
    .select('id,source_id,status,fetched_count,created_count,published_count,queued_count,created_at')
    .in('source_id', EXPANSION_SOURCES)
    .order('created_at', { ascending: false })
    .limit(15);
  console.log('\n=== RECENT IMPORT JOBS ===');
  console.log(JSON.stringify(jobs, null, 2));
}

void main().catch(console.error);
