import { getSupabase } from '@/lib/supabase/client';
import {
  EventSourceImportStatus,
  EventSourceType,
  ManagedEventSource,
  ManagedEventSourceFormData,
} from '@/types/eventSource';
import { ImportedEventDraft } from '@/types/lifecycle';
import { ServiceResult } from './types';
import { triggerMockImportForManagedSource } from './sourceImport';

export interface EventSourceRow {
  id: string;
  name: string;
  source_type: EventSourceType;
  url: string | null;
  country: string;
  city: string;
  is_active: boolean;
  last_checked_at: string | null;
  import_status: EventSourceImportStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function rowToManagedSource(row: EventSourceRow): ManagedEventSource {
  return {
    id: row.id,
    name: row.name,
    sourceType: row.source_type,
    url: row.url ?? '',
    country: row.country,
    city: row.city,
    isActive: row.is_active,
    lastCheckedAt: row.last_checked_at,
    importStatus: row.import_status,
    notes: row.notes ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function formToRowPayload(form: ManagedEventSourceFormData): Partial<EventSourceRow> {
  return {
    name: form.name.trim(),
    source_type: form.sourceType,
    url: form.url.trim() || null,
    country: form.country.trim(),
    city: form.city.trim(),
    is_active: form.isActive,
    notes: form.notes.trim() || '',
  };
}

export async function fetchEventSources(): Promise<ServiceResult<ManagedEventSource[]>> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: null, offline: true };

  const { data, error } = await supabase
    .from('event_sources')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) return { data: null, error: error.message, offline: false };
  return {
    data: ((data ?? []) as EventSourceRow[]).map(rowToManagedSource),
    error: null,
    offline: false,
  };
}

export async function createEventSource(
  form: ManagedEventSourceFormData
): Promise<ServiceResult<ManagedEventSource>> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: null, offline: true };

  const { data, error } = await supabase
    .from('event_sources')
    .insert(formToRowPayload(form))
    .select('*')
    .single();

  if (error) return { data: null, error: error.message, offline: false };
  return { data: rowToManagedSource(data as EventSourceRow), error: null, offline: false };
}

export async function updateEventSource(
  id: string,
  form: ManagedEventSourceFormData
): Promise<ServiceResult<ManagedEventSource>> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: null, offline: true };

  const { data, error } = await supabase
    .from('event_sources')
    .update(formToRowPayload(form))
    .eq('id', id)
    .select('*')
    .single();

  if (error) return { data: null, error: error.message, offline: false };
  return { data: rowToManagedSource(data as EventSourceRow), error: null, offline: false };
}

export async function setEventSourceActive(
  id: string,
  isActive: boolean
): Promise<ServiceResult<ManagedEventSource>> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: null, offline: true };

  const { data, error } = await supabase
    .from('event_sources')
    .update({ is_active: isActive })
    .eq('id', id)
    .select('*')
    .single();

  if (error) return { data: null, error: error.message, offline: false };
  return { data: rowToManagedSource(data as EventSourceRow), error: null, offline: false };
}

export async function updateEventSourceImportStatus(
  id: string,
  importStatus: EventSourceImportStatus,
  lastCheckedAt?: string
): Promise<ServiceResult<ManagedEventSource>> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: null, offline: true };

  const payload: Partial<EventSourceRow> = { import_status: importStatus };
  if (lastCheckedAt) payload.last_checked_at = lastCheckedAt;

  const { data, error } = await supabase
    .from('event_sources')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  if (error) return { data: null, error: error.message, offline: false };
  return { data: rowToManagedSource(data as EventSourceRow), error: null, offline: false };
}

export async function runMockImportForSource(
  source: ManagedEventSource,
  adminUserId?: string
): Promise<ServiceResult<{ source: ManagedEventSource; draft: ImportedEventDraft }>> {
  return triggerMockImportForManagedSource(source, adminUserId);
}

export async function fetchDraftsForSource(sourceId: string): Promise<ServiceResult<ImportedEventDraft[]>> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: null, offline: true };

  const { data: events, error } = await supabase
    .from('events')
    .select('*')
    .eq('event_source_id', sourceId)
    .in('lifecycle_status', ['imported_draft', 'needs_review', 'approved'])
    .order('created_at', { ascending: false });

  if (error) return { data: null, error: error.message, offline: false };

  const drafts: ImportedEventDraft[] = ((events ?? []) as import('@/types/database').EventRow[]).map(
    (event) => ({
      id: event.id,
      title: event.title,
      date: event.start_datetime.slice(0, 10),
      startTime: '23:00',
      endTime: '06:00',
      city: event.city,
      country: event.country,
      venue: event.venue_name,
      address: event.address ?? '',
      genres: event.genres ?? [],
      lineup: 'TBA',
      sourceUrl: event.source_url ?? '',
      source: 'website',
      confidenceScore: event.confidence_score ?? 0.8,
      duplicateWarning: event.duplicate_of_event_id ? 'Possible duplicate' : undefined,
      status: 'Needs Review',
      importedAt: event.created_at,
      description: event.description ?? '',
    })
  );

  return { data: drafts, error: null, offline: false };
}
