import './bootstrap-ops-supabase';

import type { EventAdminListSnippet, EventSourceIdSnippet } from './ops-supabase-rows';
import { opsClient } from './ops-supabase-rows';

async function main(): Promise<void> {
  const client = opsClient();

  const { count: recordsInReview } = await client
    .from('import_records')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'needs_review');

  const { count: recordsImported } = await client
    .from('import_records')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'imported');

  const { count: reviewQueuePending } = await client
    .from('import_review_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  const { data: ticketIoEventsBySource } = await client
    .from('events')
    .select('source_id')
    .like('source_id', 'source-ticket-io-%');

  const bySource: Record<string, number> = {};
  for (const row of (ticketIoEventsBySource ?? []) as EventSourceIdSnippet[]) {
    if (!row.source_id) {
      continue;
    }
    bySource[row.source_id] = (bySource[row.source_id] ?? 0) + 1;
  }

  // Simulate admin listEvents pagination
  const { data: allEvents } = await client.from('events').select('id,title,status,source_id,updated_at');
  const eventRows = (allEvents ?? []) as EventAdminListSnippet[];
  const published = eventRows.filter((e) => e.status === 'published');
  const ticketIoPublished = published.filter((e) => e.source_id?.includes('ticket-io'));

  console.log(JSON.stringify({
    importRecords: { needs_review: recordsInReview, imported: recordsImported },
    reviewQueuePending,
    eventsByTicketIoSource: bySource,
    totalEvents: eventRows.length,
    publishedEvents: published.length,
    ticketIoPublishedEvents: ticketIoPublished.length,
    adminListPageSize50: {
      allStatus: eventRows.slice(0, 50).length,
      ticketIoInFirst50ByUpdated: [...eventRows]
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, 50)
        .filter((e) => e.source_id?.includes('ticket-io')).length,
    },
    sourcesWithZeroMetrics: (
      await client
        .from('sources')
        .select('id,total_valid_event_count,last_import_at')
        .like('id', 'source-ticket-io-%')
    ).data,
  }, null, 2));
}

void main().catch(console.error);
