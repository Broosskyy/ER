import { getSupabase } from '@/lib/supabase/client';
import { EventRow, EventArtistRow } from '@/types/database';
import { Event } from '@/types/event';
import { PublicEventFormData } from '@/types/lifecycle';
import { mapEventRowToEvent } from '@/utils/eventMappers';
import { buildEndDatetime, buildStartDatetime } from '@/utils/eventMappers';
import {
  detectPossibleDuplicate,
  duplicateInputFromForm,
  duplicateStorageFromResult,
  DuplicateCheckInput,
  DuplicateCheckResult,
  eventRowsToDuplicateCandidates,
} from '@/utils/duplicateDetection';
import { transitionEventLifecycle } from '@/services/eventLifecycleService';
import { ServiceResult } from './types';

async function fetchArtistsForEvents(eventIds: string[]): Promise<Map<string, EventArtistRow[]>> {
  const supabase = getSupabase();
  const map = new Map<string, EventArtistRow[]>();
  if (!supabase || eventIds.length === 0) return map;

  const { data } = await supabase
    .from('event_artists')
    .select('*')
    .in('event_id', eventIds);

  (data ?? []).forEach((artist: EventArtistRow) => {
    const list = map.get(artist.event_id) ?? [];
    list.push(artist);
    map.set(artist.event_id, list);
  });
  return map;
}

export async function fetchPublishedEvents(): Promise<ServiceResult<Event[]>> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: null, offline: true };

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('lifecycle_status', 'published')
    .order('start_datetime', { ascending: true });

  if (error) return { data: null, error: error.message, offline: false };

  const rows = (data ?? []) as EventRow[];
  const artists = await fetchArtistsForEvents(rows.map((r) => r.id));
  return {
    data: rows.map((row) => mapEventRowToEvent(row, artists.get(row.id))),
    error: null,
    offline: false,
  };
}

export async function fetchPublishedEventById(id: string): Promise<ServiceResult<Event | null>> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: null, offline: true };

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .eq('lifecycle_status', 'published')
    .maybeSingle();

  if (error) return { data: null, error: error.message, offline: false };
  if (!data) return { data: null, error: null, offline: false };

  const row = data as EventRow;
  const artists = await fetchArtistsForEvents([row.id]);
  return { data: mapEventRowToEvent(row, artists.get(row.id)), error: null, offline: false };
}

/** @deprecated Use fetchPublishedEventById for public screens */
export async function fetchEventById(id: string): Promise<ServiceResult<Event | null>> {
  return fetchPublishedEventById(id);
}

export async function fetchReviewEvents(): Promise<ServiceResult<EventRow[]>> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: null, offline: true };

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .in('lifecycle_status', [
      'draft',
      'pending_review',
      'imported_draft',
      'needs_review',
      'approved',
      'rejected',
      'duplicate',
      'archived',
    ])
    .order('created_at', { ascending: false });

  if (error) return { data: null, error: error.message, offline: false };
  return { data: (data ?? []) as EventRow[], error: null, offline: false };
}

export async function updateEventLifecycle(
  eventId: string,
  lifecycleStatus: EventRow['lifecycle_status'],
  reviewedBy?: string
): Promise<ServiceResult<EventRow>> {
  return transitionEventLifecycle(eventId, lifecycleStatus, { reviewedBy });
}

export async function createOrganizerEvent(
  payload: Partial<EventRow> & Pick<EventRow, 'title' | 'start_datetime' | 'city' | 'country' | 'venue_name' | 'lifecycle_status' | 'created_by'>,
  lineup: string[]
): Promise<ServiceResult<EventRow>> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: 'Supabase not configured', offline: true };

  const { data, error } = await supabase.from('events').insert(payload).select('*').single();
  if (error) return { data: null, error: error.message, offline: false };

  const event = data as EventRow;
  if (lineup.length > 0) {
    await supabase.from('event_artists').insert(
      lineup.map((name, i) => ({
        event_id: event.id,
        artist_name: name.trim(),
        sort_order: i,
      }))
    );
  }

  return { data: event, error: null, offline: false };
}

export async function updateOrganizerEvent(
  eventId: string,
  payload: Partial<EventRow>
): Promise<ServiceResult<EventRow>> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: 'Supabase not configured', offline: true };

  const { data, error } = await supabase
    .from('events')
    .update(payload)
    .eq('id', eventId)
    .select('*')
    .single();

  if (error) return { data: null, error: error.message, offline: false };
  return { data: data as EventRow, error: null, offline: false };
}

export async function fetchOrganizerEvents(userId: string): Promise<ServiceResult<EventRow[]>> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: null, offline: true };

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('created_by', userId)
    .order('updated_at', { ascending: false });

  if (error) return { data: null, error: error.message, offline: false };
  return { data: (data ?? []) as EventRow[], error: null, offline: false };
}

export async function fetchAllEventsForDuplicateCheck(): Promise<ServiceResult<EventRow[]>> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: null, offline: true };

  const { data, error } = await supabase
    .from('events')
    .select('id, title, city, venue_name, start_datetime, ticket_url, source_url, lifecycle_status, organizer_id')
    .neq('lifecycle_status', 'rejected');

  if (error) return { data: null, error: error.message, offline: false };
  return { data: (data ?? []) as EventRow[], error: null, offline: false };
}

export async function resolveDuplicateForInput(
  input: DuplicateCheckInput,
  options?: { excludeId?: string; defaultLifecycle?: 'pending_review' | 'imported_draft' | 'draft' }
): Promise<{ result: DuplicateCheckResult; storage: ReturnType<typeof duplicateStorageFromResult> }> {
  const existing = await fetchAllEventsForDuplicateCheck();
  const result = detectPossibleDuplicate(
    input,
    eventRowsToDuplicateCandidates(existing.data ?? []),
    { excludeId: options?.excludeId }
  );
  return {
    result,
    storage: duplicateStorageFromResult(result, { defaultLifecycle: options?.defaultLifecycle }),
  };
}

async function replaceEventLineup(eventId: string, lineup: string[]): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  await supabase.from('event_artists').delete().eq('event_id', eventId);
  if (lineup.length === 0) return;

  await supabase.from('event_artists').insert(
    lineup.map((name, i) => ({
      event_id: eventId,
      artist_name: name.trim(),
      sort_order: i,
    }))
  );
}

export async function createUserSubmissionEvent(
  userId: string,
  form: PublicEventFormData
): Promise<ServiceResult<EventRow>> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: 'Supabase not configured', offline: true };

  const lineup = form.lineup
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const { storage } = await resolveDuplicateForInput(duplicateInputFromForm(form), {
    defaultLifecycle: 'pending_review',
  });

  return createOrganizerEvent(
    {
      title: form.title,
      description: form.description,
      event_type: form.eventType,
      genres: form.genres,
      start_datetime: buildStartDatetime(form.date, form.startTime),
      end_datetime: buildEndDatetime(form.date, form.endTime),
      city: form.city,
      country: form.country || 'Germany',
      venue_name: form.venue,
      address: form.address,
      price: parseFloat(form.price) || 0,
      age_restriction: form.ageRestriction || null,
      ticket_url: form.ticketLink || null,
      instagram_url: form.instagramLink || null,
      website_url: form.websiteLink || null,
      source_url: form.sourceLink || null,
      lifecycle_status: storage.lifecycle_status ?? 'pending_review',
      created_by: userId,
      source_type: 'user_submission',
      duplicate_of_event_id: storage.duplicate_of_event_id,
      duplicate_warning: storage.duplicate_warning,
      confidence_score: storage.confidence_score,
    },
    lineup
  );
}

export async function fetchUserSubmissionEvents(userId: string): Promise<ServiceResult<EventRow[]>> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: null, offline: true };

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('created_by', userId)
    .eq('source_type', 'user_submission')
    .order('created_at', { ascending: false });

  if (error) return { data: null, error: error.message, offline: false };
  return { data: (data ?? []) as EventRow[], error: null, offline: false };
}

export async function fetchReviewEventById(id: string): Promise<ServiceResult<EventRow | null>> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: null, offline: true };

  const { data, error } = await supabase.from('events').select('*').eq('id', id).maybeSingle();
  if (error) return { data: null, error: error.message, offline: false };
  return { data: (data as EventRow | null) ?? null, error: null, offline: false };
}

export async function updateReviewEvent(
  eventId: string,
  payload: Partial<EventRow>,
  lineup?: string | string[]
): Promise<ServiceResult<EventRow>> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: 'Supabase not configured', offline: true };

  const { data, error } = await supabase
    .from('events')
    .update(payload)
    .eq('id', eventId)
    .select('*')
    .single();

  if (error) return { data: null, error: error.message, offline: false };

  if (lineup !== undefined) {
    const names = Array.isArray(lineup)
      ? lineup
      : lineup
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
    await replaceEventLineup(eventId, names);
  }

  return { data: data as EventRow, error: null, offline: false };
}

export async function fetchLineupForEvents(eventIds: string[]): Promise<Map<string, string>> {
  const artists = await fetchArtistsForEvents(eventIds);
  const map = new Map<string, string>();
  eventIds.forEach((id) => {
    const names = (artists.get(id) ?? []).sort((a, b) => a.sort_order - b.sort_order).map((a) => a.artist_name);
    map.set(id, names.join(', '));
  });
  return map;
}
