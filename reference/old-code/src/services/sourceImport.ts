import { getSupabase } from '@/lib/supabase/client';
import {
  EventSourceImportStatus,
  ManagedEventSource,
  mapEventSourceTypeToLegacyImport,
} from '@/types/eventSource';
import { ImportSource, ImportedEventDraft } from '@/types/lifecycle';
import { detectPossibleDuplicate } from '@/utils/duplicateDetection';
import { buildEndDatetime, buildStartDatetime } from '@/utils/eventMappers';
import { fromDbImportStatus, mapImportSourceToDb } from '@/utils/lifecycleMap';
import { EventRow, ImportSourceRow } from '@/types/database';
import { fetchAllEventsForDuplicateCheck } from './events';
import { updateEventSourceImportStatus } from './eventSources';
import { ServiceResult } from './types';

function mockParsedFromSource(source: ManagedEventSource) {
  const typeLabels: Record<string, string> = {
    ticketmaster: 'Ticketmaster',
    eventbrite: 'Eventbrite',
    eventim: 'Eventim',
    shotgun: 'Shotgun',
    resident_advisor: 'RA',
    club_website: 'Club',
    festival_website: 'Festival',
    instagram: 'Instagram',
    csv: 'CSV',
    text_paste: 'Text',
    flyer_upload: 'Flyer',
  };
  const label = typeLabels[source.sourceType] ?? 'Imported';
  return {
    title: `${label} Import: ${source.name}`,
    date: '2026-09-01',
    startTime: '23:00',
    endTime: '06:00',
    city: source.city || 'Berlin',
    country: source.country || 'Germany',
    venue: `${source.city || 'Berlin'} Venue`,
    address: `${source.city}, ${source.country}`,
    genres: ['Techno'],
    description: `Mock import from ${source.name}. Real scraping in a future sprint.`,
    sourceUrl: source.url || undefined,
  };
}

export async function triggerMockImportForManagedSource(
  source: ManagedEventSource,
  adminUserId?: string
): Promise<ServiceResult<{ source: ManagedEventSource; draft: ImportedEventDraft }>> {
  const supabase = getSupabase();
  const now = new Date().toISOString();
  const legacyType = mapEventSourceTypeToLegacyImport(source.sourceType) as ImportSource;
  const parsed = mockParsedFromSource(source);
  const confidenceScore = 0.78 + Math.random() * 0.15;

  const existing = supabase ? await fetchAllEventsForDuplicateCheck() : { data: [] };
  const duplicate = detectPossibleDuplicate(
    {
      title: parsed.title,
      city: parsed.city,
      venue_name: parsed.venue,
      date: parsed.date,
      source_url: parsed.sourceUrl,
    },
    (existing.data ?? []).map((e) => ({
      id: e.id,
      title: e.title,
      city: e.city,
      venue_name: e.venue_name,
      start_datetime: e.start_datetime,
      ticket_url: e.ticket_url ?? undefined,
      source_url: e.source_url ?? undefined,
    }))
  );

  const importStatus: EventSourceImportStatus = duplicate.isDuplicate ? 'needs_review' : 'success';

  if (!supabase) {
    const draft: ImportedEventDraft = {
      id: `mock-${source.id}-${Date.now()}`,
      title: parsed.title,
      date: parsed.date,
      startTime: parsed.startTime,
      endTime: parsed.endTime,
      city: parsed.city,
      country: parsed.country,
      venue: parsed.venue,
      address: parsed.address,
      genres: parsed.genres,
      lineup: 'TBA',
      sourceUrl: parsed.sourceUrl ?? source.url,
      source: legacyType,
      confidenceScore,
      duplicateWarning: duplicate.warning,
      status: 'Needs Review',
      importedAt: now,
      description: parsed.description,
    };

    const updatedSource: ManagedEventSource = {
      ...source,
      lastCheckedAt: now,
      importStatus,
      updatedAt: now,
    };

    return { data: { source: updatedSource, draft }, error: null, offline: true };
  }

  await updateEventSourceImportStatus(source.id, 'running', now);

  const dbLegacy = mapImportSourceToDb(legacyType);
  const { data: eventRow, error: eventError } = await supabase
    .from('events')
    .insert({
      title: parsed.title,
      description: parsed.description,
      event_type: 'Club Night',
      genres: parsed.genres,
      start_datetime: buildStartDatetime(parsed.date, parsed.startTime),
      end_datetime: buildEndDatetime(parsed.date, parsed.endTime),
      city: parsed.city,
      country: parsed.country,
      venue_name: parsed.venue,
      address: parsed.address,
      source_url: parsed.sourceUrl ?? source.url,
      source_type: dbLegacy,
      lifecycle_status: duplicate.isPossibleDuplicate ? 'needs_review' : 'imported_draft',
      confidence_score: confidenceScore,
      duplicate_of_event_id: duplicate.matchedEvent?.id ?? null,
      duplicate_warning: duplicate.warning ?? null,
      created_by: adminUserId ?? null,
      event_source_id: source.id,
    })
    .select('*')
    .single();

  if (eventError) {
    await updateEventSourceImportStatus(source.id, 'failed', now);
    return { data: null, error: eventError.message, offline: false };
  }

  const { error: importError } = await supabase.from('import_sources').insert({
    source_type: dbLegacy as ImportSourceRow['source_type'],
    source_url: parsed.sourceUrl ?? source.url,
    status: 'needs_review',
    parsed_event_id: (eventRow as EventRow).id,
    confidence_score: confidenceScore,
    duplicate_warning: duplicate.warning ?? null,
    event_source_id: source.id,
  });

  if (importError) {
    await updateEventSourceImportStatus(source.id, 'failed', now);
    return { data: null, error: importError.message, offline: false };
  }

  const statusResult = await updateEventSourceImportStatus(source.id, importStatus, now);
  const event = eventRow as EventRow;
  const draft: ImportedEventDraft = {
    id: event.id,
    title: event.title,
    date: parsed.date,
    startTime: parsed.startTime,
    endTime: parsed.endTime,
    city: event.city,
    country: event.country,
    venue: event.venue_name,
    address: event.address ?? '',
    genres: event.genres,
    lineup: 'TBA',
    sourceUrl: event.source_url ?? source.url,
    source: legacyType,
    confidenceScore,
    duplicateWarning: duplicate.warning,
    status: fromDbImportStatus('needs_review'),
    importedAt: now,
    description: event.description ?? '',
  };

  return {
    data: { source: statusResult.data ?? source, draft },
    error: null,
    offline: false,
  };
}
