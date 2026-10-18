import { STAGING_PROJECT_REF } from '../../ingestion/sync/staging-guard';
import { buildRausgegangenIdentityKey, extractEventSlugFromUrl } from './rausgegangen-url';

/** A read-only projection of existing event-core records, never raw_payload or user data. */
export interface LiveScopeRow {
  eventId: string;
  sourceId: string;
  sourceUrl: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  timezone: string | null;
  venueName: string | null;
  city: string | null;
  organizerName: string | null;
  currentLineupCount: number;
  hasDescription: boolean;
  currentTicket: {
    ticketId: string;
    provider: string | null;
    ticketUrl: string | null;
    priceFromMinor: number | null;
    currency: string | null;
    salesStatus: string | null;
    sortOrder: number;
  } | null;
}
export interface LiveScopeEvent extends LiveScopeRow {
  sourceEventKey: string;
}
export interface LiveScopeManifest {
  schemaVersion: 1;
  generatedAt: string;
  source: string;
  scope: string;
  count: number;
  events: LiveScopeEvent[];
}
export type Gap =
  | 'missing_description'
  | 'missing_lineup'
  | 'missing_ticket_row'
  | 'missing_ticket_target'
  | 'missing_ticket_price'
  | 'unverified_ticket_status'
  | 'missing_organizer';
export interface LiveScopeAudit {
  generatedAt: string;
  scopeCount: number;
  withTicketRow: number;
  missingTicketRows: number;
  missingTicketTargets: number;
  missingTicketPrices: number;
  unverifiedTicketStatuses: number;
  missingLineups: number;
  missingDescriptions: number;
  missingOrganizers: number;
  reviewCount: number;
  reviewItems: Array<{ eventId: string; title: string; startsAt: string; gaps: Gap[] }>;
}
const UNKNOWN_STATUSES = new Set([
  'availability_unverified', 'provider_access_unavailable', 'unavailable_unknown',
]);
function validatedSource(url: string): { canonical: string; key: string } {
  let parsed: URL;
  try { parsed = new URL(url); }
  catch { throw new Error('live_scope_invalid_source_url'); }
  if (parsed.protocol !== 'https:' || !['rausgegangen.de', 'www.rausgegangen.de'].includes(parsed.hostname)
      || parsed.username || parsed.password) {
    throw new Error('live_scope_non_rausgegangen_source');
  }
  const slug = extractEventSlugFromUrl(url);
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) throw new Error('live_scope_invalid_source_path');
  return {
    canonical: `https://rausgegangen.de/events/${slug}/`,
    key: buildRausgegangenIdentityKey(slug),
  };
}
function assess(event: LiveScopeEvent): Gap[] {
  const result: Gap[] = [];
  if (!event.hasDescription) result.push('missing_description');
  if (!event.currentLineupCount) result.push('missing_lineup');
  if (!event.organizerName?.trim()) result.push('missing_organizer');
  if (!event.currentTicket) result.push('missing_ticket_row');
  else {
    if (!event.currentTicket.ticketUrl?.trim()) result.push('missing_ticket_target');
    if (event.currentTicket.priceFromMinor === null) result.push('missing_ticket_price');
    if (!event.currentTicket.salesStatus ||
        UNKNOWN_STATUSES.has(event.currentTicket.salesStatus)) {
      result.push('unverified_ticket_status');
    }
  }
  return result;
}
/** Conservative audit. Missing fields do not assert that an event is free, sold out, or lineup-free. */
export function buildLiveRausgegangenScope(
  rows: LiveScopeRow[], projectRef: string, generatedAt = new Date().toISOString(),
): { manifest: LiveScopeManifest; audit: LiveScopeAudit } {
  if (projectRef !== STAGING_PROJECT_REF) throw new Error('live_scope_wrong_project');
  if (rows.length === 0) throw new Error('live_scope_empty_or_unavailable');
  if (!Number.isFinite(Date.parse(generatedAt))) throw new Error('live_scope_invalid_timestamp');
  const ids = new Set<string>(), keys = new Set<string>();
  const events = rows.map((row) => {
    const source = validatedSource(row.sourceUrl);
    if (!row.eventId || !row.sourceId || !row.title?.trim() ||
        !Number.isFinite(Date.parse(row.startsAt)) ||
        !Number.isInteger(row.currentLineupCount) || row.currentLineupCount < 0 ||
        (row.currentTicket && (!row.currentTicket.ticketId ||
          !Number.isInteger(row.currentTicket.sortOrder)))) {
      throw new Error('live_scope_invalid_row');
    }
    if (ids.has(row.eventId) || keys.has(source.key)) throw new Error('live_scope_duplicate_binding');
    ids.add(row.eventId); keys.add(source.key);
    return { ...row, sourceEventKey: source.key, sourceUrl: source.canonical };
  }).sort((a,b) => a.startsAt.localeCompare(b.startsAt) || a.eventId.localeCompare(b.eventId));

  const reviewItems = events.map(event => ({
    eventId: event.eventId, title: event.title, startsAt: event.startsAt, gaps: assess(event),
  })).filter(item => item.gaps.length > 0);
  const count = (gap: Gap) => reviewItems.filter(item => item.gaps.includes(gap)).length;
  return {
    manifest: {
      schemaVersion: 1, generatedAt, source: `Eternal Rave staging ${projectRef}`,
      scope: 'consumer-visible published Rausgegangen events (read-only current snapshot)',
      count: events.length, events,
    },
    audit: {
      generatedAt, scopeCount: events.length,
      withTicketRow: events.filter(event => event.currentTicket !== null).length,
      missingTicketRows: count('missing_ticket_row'),
      missingTicketTargets: count('missing_ticket_target'),
      missingTicketPrices: count('missing_ticket_price'),
      unverifiedTicketStatuses: count('unverified_ticket_status'),
      missingLineups: count('missing_lineup'),
      missingDescriptions: count('missing_description'),
      missingOrganizers: count('missing_organizer'),
      reviewCount: reviewItems.length, reviewItems,
    },
  };
}
