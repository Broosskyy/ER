import './bootstrap-ops-supabase';

import type {
  EventProductionAuditSnippet,
  EventSourceReferenceRow,
  ImportJobDiagnosticRow,
  ImportRecordExternalSnippet,
} from './ops-supabase-rows';
import { opsClient } from './ops-supabase-rows';

async function main(): Promise<void> {
  const client = opsClient();
  const sourceId = 'source-ticket-io-protontheclub';

  const { data: refs, error: refError } = await client
    .from('event_source_references')
    .select('canonical_event_id, external_event_id, original_url')
    .eq('source_id', sourceId)
    .ilike('original_url', '%hyHJr2xd%')
    .limit(1);

  if (refError) {
    throw new Error(refError.message);
  }

  const ref = (refs?.[0] ?? null) as EventSourceReferenceRow | null;
  const ext = ref?.external_event_id;

  const { data: records, error: recordError } = await client
    .from('import_records')
    .select('id,status,resulting_event_id,normalized_payload,updated_at,import_job_id')
    .eq('source_id', sourceId)
    .eq('external_id', ext ?? '')
    .order('updated_at', { ascending: false })
    .limit(1);

  if (recordError) {
    throw new Error(recordError.message);
  }

  const { data: event, error: eventError } = await client
    .from('events')
    .select('id,title,description,price_text,status,source_id')
    .eq('id', ref?.canonical_event_id ?? '')
    .single();

  if (eventError) {
    throw new Error(eventError.message);
  }

  const { data: job, error: jobError } = await client
    .from('import_jobs')
    .select('*')
    .eq('source_id', sourceId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (jobError) {
    throw new Error(jobError.message);
  }

  const recordRows = (records ?? []) as ImportRecordExternalSnippet[];
  const eventRow = event as EventProductionAuditSnippet | null;
  const jobRow = job as ImportJobDiagnosticRow;
  const payload = recordRows[0]?.normalized_payload as Record<string, unknown> | undefined;
  const metadata = payload?.sourceMetadata as Record<string, unknown> | undefined;

  console.log(
    JSON.stringify(
      {
        ref,
        event: eventRow,
        job: {
          id: jobRow.id,
          status: jobRow.status,
          fetchedCount: jobRow.fetched_count,
          createdCount: jobRow.created_count,
          updatedCount: jobRow.updated_count,
          unchangedCount: jobRow.unchanged_count,
          duplicateCount: jobRow.duplicate_count,
          publishedCount: jobRow.published_count,
          skippedCount: jobRow.skipped_count,
          warnings: jobRow.warnings,
        },
        record: recordRows[0]
          ? {
              id: recordRows[0].id,
              status: recordRows[0].status,
              resulting: recordRows[0].resulting_event_id,
              jobId: recordRows[0].import_job_id,
              priceText: payload?.priceText,
              description: payload?.description,
              artistNames: payload?.artistNames,
              repairVersion: metadata?.dataQualityRepairVersion,
              connectorVersion: metadata?.connectorVersion,
              normalizedHash: metadata?.normalizedHash,
            }
          : null,
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
