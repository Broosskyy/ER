/**
 * Typed Supabase row helpers for operations scripts.
 * Avoids `never` inference on partial `.select()` queries.
 */
import type { EventRow } from '@/data/mappers/event-mapper';
import type { ImportJobRow, ImportRecordRow, SourceRow } from '@/data/mappers/import-mapper';
import { getSupabaseServiceClient } from '@/services/supabase/client-service-role';

export type { EventRow, ImportJobRow, ImportRecordRow, SourceRow };

export type PublishedEventSnippet = Pick<
  EventRow,
  'id' | 'title' | 'ticket_url' | 'website_url' | 'description' | 'status' | 'source_id' | 'updated_at'
>;
export type ImportRecordPayloadSnippet = Pick<
  ImportRecordRow,
  'raw_payload' | 'normalized_payload' | 'source_id' | 'external_id' | 'resulting_event_id' | 'status' | 'updated_at'
>;
export type ImportReviewQueueSnippet = {
  import_record_id: string;
  source_id: string;
  decision: string | null;
  status: string;
  resulting_event_id: string | null;
  external_id: string | null;
};
export type ImportReviewQueueRow = {
  id: string;
  source_id: string;
  import_record_id: string;
  status: string;
  decision: string | null;
  created_at?: string;
};
export type EventSourceReferenceRow = {
  id?: string;
  canonical_event_id: string;
  source_id: string;
  external_event_id?: string | null;
  original_url?: string | null;
  event_id?: string;
  active?: boolean;
};
export type EventArtistLineupRow = {
  event_id: string;
  artist_id: string;
  artists?: { name?: string } | null;
};
export type EventArtistCountRow = { event_id: string };
export type EventAdminListSnippet = Pick<EventRow, 'id' | 'title' | 'status' | 'source_id' | 'updated_at'>;
export type EventSourceIdSnippet = Pick<EventRow, 'source_id'>;
export type EventStatusMetricsSnippet = Pick<EventRow, 'status' | 'description' | 'price_text'>;
export type EventRepairMetricsSnippet = Pick<
  EventRow,
  'id' | 'description' | 'price_text' | 'ticket_url' | 'image_url' | 'status' | 'source_id'
>;
export type EventTicketAuditSnippet = Pick<
  EventRow,
  'id' | 'title' | 'description' | 'ticket_url' | 'price_text' | 'venue_name' | 'updated_at'
> & { city_name?: string | null };
export type EventProductionAuditSnippet = Pick<
  EventRow,
  | 'id'
  | 'title'
  | 'description'
  | 'price_text'
  | 'ticket_url'
  | 'image_url'
  | 'status'
  | 'venue_name'
  | 'genre_id'
  | 'source_id'
  | 'venue_id'
  | 'venue_city'
> & { organizer?: string | null; published_at?: string | null };
export type EventArchivedSnippet = Pick<EventRow, 'id' | 'title' | 'status'>;
export type EventDescriptionSampleSnippet = Pick<
  EventRow,
  'id' | 'title' | 'description' | 'venue_name' | 'updated_at'
> & { city_name?: string | null };
export type ImportRecordReviewSnippet = Pick<
  ImportRecordRow,
  | 'id'
  | 'source_id'
  | 'resulting_event_id'
  | 'normalized_payload'
  | 'raw_payload'
  | 'updated_at'
  | 'external_id'
  | 'status'
  | 'import_job_id'
>;
export type ImportRecordResultingSnippet = Pick<
  ImportRecordRow,
  'id' | 'resulting_event_id' | 'normalized_payload' | 'source_id' | 'external_id'
>;
export type ImportRecordQueueStatusSnippet = Pick<ImportRecordRow, 'status' | 'resulting_event_id' | 'external_id'>;
export type ImportRecordStatusSnippet = Pick<ImportRecordRow, 'source_id' | 'status' | 'resulting_event_id'>;
export type EventFrontendSampleRow = Pick<
  EventRow,
  'description' | 'ticket_url' | 'price_text' | 'venue_name' | 'source_id'
> & { city_name?: string | null };
export type ImportRecordExternalSnippet = Pick<
  ImportRecordRow,
  'id' | 'status' | 'resulting_event_id' | 'normalized_payload' | 'updated_at' | 'import_job_id'
>;
export type ImportJobMetricsSnippet = Pick<
  ImportJobRow,
  | 'id'
  | 'status'
  | 'fetched_count'
  | 'updated_count'
  | 'unchanged_count'
  | 'created_count'
  | 'duplicate_count'
  | 'source_id'
  | 'created_at'
  | 'warning_count'
  | 'error_count'
>;
export type ImportJobDiagnosticRow = ImportJobRow & {
  warnings?: unknown;
  error_message?: string | null;
  metrics?: Record<string, unknown> | null;
  published_count?: number;
  skipped_count?: number;
};
export type ImportJobActiveSnippet = Pick<ImportJobRow, 'id' | 'source_id' | 'status'>;
export type SourceConfigAuditSnippet = Pick<SourceRow, 'id' | 'source_config' | 'metadata'>;
export type SourceIntegritySnippet = Pick<
  SourceRow,
  'id' | 'display_name' | 'source_type' | 'enabled' | 'archived' | 'source_config' | 'slug' | 'parser_type'
>;
export type SourceMetricsSnippet = Pick<
  SourceRow,
  'id' | 'display_name' | 'total_valid_event_count' | 'total_import_count' | 'last_import_at' | 'last_job_status'
>;
export type SourceConfigOnlySnippet = Pick<SourceRow, 'source_config'>;

export function opsClient() {
  return getSupabaseServiceClient();
}

export async function listPublishedEventSnippets(limit = 500): Promise<PublishedEventSnippet[]> {
  const { data, error } = await opsClient()
    .from('events')
    .select('id,title,ticket_url,website_url,description,status,source_id,updated_at')
    .eq('status', 'published')
    .limit(limit);
  if (error) {
    throw error;
  }
  return (data ?? []) as PublishedEventSnippet[];
}

export async function listImportRecordPayloads(limit = 300): Promise<ImportRecordPayloadSnippet[]> {
  const { data, error } = await opsClient()
    .from('import_records')
    .select('raw_payload,normalized_payload,source_id,external_id,resulting_event_id,status,updated_at')
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error) {
    throw error;
  }
  return (data ?? []) as ImportRecordPayloadSnippet[];
}

export async function getSourceById(sourceId: string): Promise<SourceRow | null> {
  const { data, error } = await opsClient().from('sources').select('*').eq('id', sourceId).maybeSingle();
  if (error) {
    throw error;
  }
  return (data as SourceRow | null) ?? null;
}

export async function updateSourceRow(sourceId: string, patch: Partial<SourceRow>): Promise<void> {
  const { error } = await opsClient()
    .from('sources')
    .update({ ...patch, updated_at: new Date().toISOString() } as never)
    .eq('id', sourceId);
  if (error) {
    throw error;
  }
}

export async function updateEventRow(eventId: string, patch: Partial<EventRow>): Promise<void> {
  const { error } = await opsClient()
    .from('events')
    .update({ ...patch, updated_at: new Date().toISOString() } as never)
    .eq('id', eventId);
  if (error) {
    throw error;
  }
}

export async function updateImportJobRow(jobId: string, patch: Partial<ImportJobRow>): Promise<void> {
  const { error } = await opsClient()
    .from('import_jobs')
    .update({ ...patch, updated_at: new Date().toISOString() } as never)
    .eq('id', jobId);
  if (error) {
    throw error;
  }
}
