/**
 * Legacy event_submissions table CRUD.
 * @deprecated Prefer `events` table with source_type=user_submission (see ADR / analysis/06).
 * Kept for backward compatibility until Sprint 3 migration (AR-02).
 */
import { getSupabase } from '@/lib/supabase/client';
import { EventSubmissionRow } from '@/types/database';
import { PublicEventFormData, EventSubmission } from '@/types/lifecycle';
import { fromDbSubmissionStatus, toDbSubmissionStatus } from '@/utils/lifecycleMap';
import { ServiceResult } from './types';

function rowToSubmission(row: EventSubmissionRow, email: string): EventSubmission {
  const payload = row.raw_payload as Record<string, unknown>;
  return {
    id: row.id,
    title: row.title,
    date: String(payload.date ?? ''),
    startTime: String(payload.startTime ?? ''),
    endTime: String(payload.endTime ?? ''),
    city: String(payload.city ?? ''),
    country: String(payload.country ?? ''),
    venue: String(payload.venue ?? ''),
    address: String(payload.address ?? ''),
    genres: (payload.genres as string[]) ?? [],
    lineup: String(payload.lineup ?? ''),
    organizerName: String(payload.organizerName ?? ''),
    ticketLink: payload.ticketLink ? String(payload.ticketLink) : undefined,
    instagramLink: payload.instagramLink ? String(payload.instagramLink) : undefined,
    websiteLink: payload.websiteLink ? String(payload.websiteLink) : undefined,
    sourceLink: payload.sourceLink ? String(payload.sourceLink) : undefined,
    price: Number(payload.price ?? 0),
    ageRestriction: payload.ageRestriction ? String(payload.ageRestriction) : undefined,
    eventType: (payload.eventType as EventSubmission['eventType']) ?? 'Club Night',
    description: String(payload.description ?? ''),
    status: fromDbSubmissionStatus(row.status),
    submittedAt: row.created_at,
    submittedBy: email,
    source: 'user_submission',
  };
}

export async function createEventSubmission(
  userId: string,
  email: string,
  form: PublicEventFormData
): Promise<ServiceResult<EventSubmission>> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: null, offline: true };

  const raw_payload = { ...form, price: parseFloat(form.price) || 0 };
  const { data, error } = await supabase
    .from('event_submissions')
    .insert({
      submitted_by: userId,
      title: form.title,
      raw_payload,
      status: 'pending',
    })
    .select('*')
    .single();

  if (error) return { data: null, error: error.message, offline: false };
  return { data: rowToSubmission(data as EventSubmissionRow, email), error: null, offline: false };
}

export async function fetchMySubmissions(userId: string, email: string): Promise<ServiceResult<EventSubmission[]>> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: null, offline: true };

  const { data, error } = await supabase
    .from('event_submissions')
    .select('*')
    .eq('submitted_by', userId)
    .order('created_at', { ascending: false });

  if (error) return { data: null, error: error.message, offline: false };
  return {
    data: ((data ?? []) as EventSubmissionRow[]).map((row) => rowToSubmission(row, email)),
    error: null,
    offline: false,
  };
}

export async function fetchAllSubmissions(): Promise<ServiceResult<EventSubmissionRow[]>> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: null, offline: true };

  const { data, error } = await supabase
    .from('event_submissions')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return { data: null, error: error.message, offline: false };
  return { data: (data ?? []) as EventSubmissionRow[], error: null, offline: false };
}

export async function updateSubmissionStatus(
  submissionId: string,
  status: EventSubmission['status']
): Promise<ServiceResult<EventSubmissionRow>> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: 'Supabase not configured', offline: true };

  const { data, error } = await supabase
    .from('event_submissions')
    .update({ status: toDbSubmissionStatus(status) })
    .eq('id', submissionId)
    .select('*')
    .single();

  if (error) return { data: null, error: error.message, offline: false };
  return { data: data as EventSubmissionRow, error: null, offline: false };
}

export function submissionRowToEventSubmission(row: EventSubmissionRow, email = 'user'): EventSubmission {
  return rowToSubmission(row, email);
}
