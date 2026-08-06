import './bootstrap-ops-supabase';

import type {
  ImportRecordQueueStatusSnippet,
  ImportRecordStatusSnippet,
  ImportReviewQueueRow,
} from './ops-supabase-rows';
import { opsClient } from './ops-supabase-rows';

async function main(): Promise<void> {
  const client = opsClient();

  const { data: pending } = await client
    .from('import_review_queue')
    .select('id,source_id,import_record_id,status,decision,created_at')
    .eq('status', 'pending')
    .like('source_id', 'source-ticket-io-%')
    .limit(20);

  const pendingRows = (pending ?? []) as ImportReviewQueueRow[];
  console.log('Pending review queue (ticket.io):', pendingRows.length);
  for (const entry of pendingRows) {
    const { data: record } = await client
      .from('import_records')
      .select('status,resulting_event_id,external_id')
      .eq('id', entry.import_record_id)
      .maybeSingle();
    const importRecord = record as ImportRecordQueueStatusSnippet | null;
    console.log({
      source: entry.source_id,
      decision: entry.decision,
      recordStatus: importRecord?.status,
      hasEvent: Boolean(importRecord?.resulting_event_id),
      external: importRecord?.external_id?.slice(0, 50),
    });
  }

  const { data: needsReview } = await client
    .from('import_records')
    .select('source_id,status,resulting_event_id')
    .eq('status', 'needs_review')
    .like('source_id', 'source-ticket-io-%');

  console.log('\nneeds_review by source:');
  const counts: Record<string, number> = {};
  for (const r of (needsReview ?? []) as ImportRecordStatusSnippet[]) {
    counts[r.source_id] = (counts[r.source_id] ?? 0) + 1;
  }
  console.log(counts);
}

void main().catch(console.error);
