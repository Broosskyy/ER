import { getSupabase } from '@/lib/supabase/client';
import { ImportSourceRow, EventRow } from '@/types/database';
import { ImportSource, ImportedEventDraft } from '@/types/lifecycle';
import { buildEndDatetime, buildStartDatetime } from '@/utils/eventMappers';
import { fromDbImportStatus, mapImportSourceToDb } from '@/utils/lifecycleMap';
import { mockParseText, mockParseUrl, parsedUrlToDraft, ParsedUrlImport } from '@/utils/urlImporterMock';
import { resolveDuplicateForInput } from './events';
import { ServiceResult } from './types';
import { DuplicateCheckResult } from '@/utils/duplicateDetection';

function generateLocalId(): string {
  return `imp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

type ImportAnalysisData = {
  importRow?: ImportSourceRow;
  eventRow?: EventRow;
  draft: ImportedEventDraft;
};

async function enrichDuplicateWarning(parsed: ParsedUrlImport): Promise<{
  parsed: ParsedUrlImport;
  duplicate: DuplicateCheckResult;
}> {
  const { result: duplicate } = await resolveDuplicateForInput(
    {
      title: parsed.title,
      city: parsed.city,
      venue_name: parsed.venue,
      date: parsed.date,
      ticket_link: parsed.ticketUrl,
      source_url: parsed.sourceUrl,
    },
    { defaultLifecycle: 'imported_draft' }
  );
  if (duplicate.warning) parsed.duplicateWarning = duplicate.warning;
  return { parsed, duplicate };
}

async function persistImportFromParsed(
  parsed: ParsedUrlImport,
  adminUserId?: string,
  rawText?: string
): Promise<ServiceResult<ImportAnalysisData>> {
  const supabase = getSupabase();

  if (!supabase) {
    const draft = parsedUrlToDraft(parsed, generateLocalId());
    return { data: { draft }, error: null, offline: true };
  }

  const { parsed: enriched, duplicate } = await enrichDuplicateWarning({ ...parsed });
  const source = enriched.source;
  const confidenceScore = enriched.confidenceScore;
  const lifecycleStatus = duplicate.isPossibleDuplicate ? 'needs_review' : 'imported_draft';

  const { data: eventRow, error: eventError } = await supabase
    .from('events')
    .insert({
      title: enriched.title,
      description: enriched.description,
      event_type: 'Club Night',
      genres: enriched.genres,
      start_datetime: buildStartDatetime(enriched.date, enriched.startTime),
      end_datetime: buildEndDatetime(enriched.date, enriched.endTime),
      city: enriched.city,
      country: enriched.country,
      venue_name: enriched.venue,
      address: enriched.address,
      ticket_url: enriched.ticketUrl ?? null,
      source_url: enriched.sourceUrl,
      price: enriched.price ?? null,
      source_type: mapImportSourceToDb(source),
      lifecycle_status: lifecycleStatus,
      confidence_score: confidenceScore,
      duplicate_of_event_id: duplicate.matchedEvent?.id ?? null,
      duplicate_warning: duplicate.warning ?? null,
      created_by: adminUserId ?? null,
    })
    .select('*')
    .single();

  if (eventError) return { data: null, error: eventError.message, offline: false };

  const event = eventRow as EventRow;
  const lineupNames = enriched.lineup.split(',').map((n) => n.trim()).filter(Boolean);
  if (lineupNames.length > 0) {
    await supabase.from('event_artists').insert(
      lineupNames.map((name, i) => ({
        event_id: event.id,
        artist_name: name,
        sort_order: i,
      }))
    );
  }

  const dbSourceType = mapImportSourceToDb(source) as ImportSourceRow['source_type'];
  const { data: importRow, error: importError } = await supabase
    .from('import_sources')
    .insert({
      source_type: dbSourceType,
      source_url: enriched.sourceUrl.startsWith('text://') ? null : enriched.sourceUrl,
      raw_text: rawText ?? null,
      status: 'needs_review',
      parsed_event_id: event.id,
      confidence_score: confidenceScore,
      duplicate_warning: enriched.duplicateWarning ?? null,
    })
    .select('*')
    .single();

  if (importError) return { data: null, error: importError.message, offline: false };

  const imp = importRow as ImportSourceRow;
  const draft: ImportedEventDraft = {
    id: event.id,
    title: event.title,
    date: enriched.date,
    startTime: enriched.startTime,
    endTime: enriched.endTime,
    city: event.city,
    country: event.country,
    venue: event.venue_name,
    address: event.address ?? '',
    genres: event.genres,
    lineup: enriched.lineup,
    ticketLink: enriched.ticketUrl,
    ticketPrice: enriched.price,
    sourceUrl: event.source_url ?? enriched.sourceUrl,
    source,
    confidenceScore,
    duplicateWarning: enriched.duplicateWarning,
    status: fromDbImportStatus(imp.status),
    importedAt: imp.created_at,
    description: event.description ?? '',
    pageType: enriched.pageType,
  };

  return { data: { importRow: imp, eventRow: event, draft }, error: null, offline: false };
}

export async function analyzeUrlImport(url: string, adminUserId?: string): Promise<ServiceResult<ImportAnalysisData>> {
  const trimmed = url.trim();
  if (!trimmed) {
    return { data: null, error: 'URL is required', offline: false };
  }
  return persistImportFromParsed(mockParseUrl(trimmed), adminUserId);
}

export async function analyzeTextImport(text: string, adminUserId?: string): Promise<ServiceResult<ImportAnalysisData>> {
  const trimmed = text.trim();
  if (!trimmed) {
    return { data: null, error: 'Text is required', offline: false };
  }
  return persistImportFromParsed(mockParseText(trimmed), adminUserId, trimmed);
}

/** Analyze pasted URL or plain-text event description (rules parser for text). */
export async function analyzeImportInput(input: string, adminUserId?: string): Promise<ServiceResult<ImportAnalysisData>> {
  const trimmed = input.trim();
  if (!trimmed) {
    return { data: null, error: 'Paste a URL or event text to analyze', offline: false };
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return analyzeUrlImport(trimmed, adminUserId);
  }
  return analyzeTextImport(trimmed, adminUserId);
}

export async function updateImportedEventDraft(
  eventId: string,
  updates: Partial<{
    title: string;
    description: string;
    date: string;
    startTime: string;
    endTime: string;
    city: string;
    country: string;
    venue: string;
    address: string;
    genres: string[];
    lineup: string;
    ticketLink: string;
    ticketPrice?: number;
  }>
): Promise<ServiceResult<EventRow>> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: null, offline: true };

  const payload: Partial<EventRow> = {};
  if (updates.title) payload.title = updates.title;
  if (updates.description) payload.description = updates.description;
  if (updates.city) payload.city = updates.city;
  if (updates.country) payload.country = updates.country;
  if (updates.venue) payload.venue_name = updates.venue;
  if (updates.address) payload.address = updates.address;
  if (updates.genres) payload.genres = updates.genres;
  if (updates.ticketLink) payload.ticket_url = updates.ticketLink;
  if (updates.ticketPrice !== undefined) payload.price = updates.ticketPrice;
  if (updates.date && updates.startTime) {
    payload.start_datetime = buildStartDatetime(updates.date, updates.startTime);
  }
  if (updates.date && updates.endTime) {
    payload.end_datetime = buildEndDatetime(updates.date, updates.endTime);
  }

  const { data, error } = await supabase
    .from('events')
    .update(payload)
    .eq('id', eventId)
    .select('*')
    .single();

  if (error) return { data: null, error: error.message, offline: false };
  return { data: data as EventRow, error: null, offline: false };
}

/** @deprecated Use analyzeImportInput */
export async function analyzeImportSource(
  source: ImportSource,
  input: string,
  adminUserId?: string
): Promise<ServiceResult<{ importRow: ImportSourceRow; eventRow: EventRow; draft: ImportedEventDraft }>> {
  const result = await analyzeImportInput(input || `https://example.com/${source}`, adminUserId);
  if (!result.data) return { data: null, error: result.error, offline: result.offline };
  if (!result.data.importRow || !result.data.eventRow) {
    return { data: null, error: null, offline: true };
  }
  return {
    data: {
      importRow: result.data.importRow,
      eventRow: result.data.eventRow,
      draft: result.data.draft,
    },
    error: null,
    offline: false,
  };
}

export async function fetchImportSources(): Promise<ServiceResult<ImportSourceRow[]>> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: null, offline: true };

  const { data, error } = await supabase
    .from('import_sources')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return { data: null, error: error.message, offline: false };
  return { data: (data ?? []) as ImportSourceRow[], error: null, offline: false };
}

export async function sendImportToReview(eventId: string, adminUserId?: string): Promise<ServiceResult<EventRow>> {
  const { updateEventLifecycle } = await import('./events');
  return updateEventLifecycle(eventId, 'needs_review', adminUserId);
}
