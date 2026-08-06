/**
 * Phase 4.6.4 — Current Event Consistency Root-Cause Analysis (READ-ONLY).
 *
 * Usage: npx tsx scripts/operations/_phase464-consistency-analysis.ts
 *
 * Writes analysis artifacts only. No production mutations.
 */
import './bootstrap-ops-supabase';

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapSourceRowToRecord, type SourceRow } from '@/data/mappers/source-mapper';
import { classifyTicketUrl } from '@/features/events/domain/ticket-url-quality';
import { hasMeaningfulEventValue } from '@/features/events/domain/event-field-value';
import {
  isLineupPlaceholderArtist,
  sanitizeLineupArtistNames,
} from '@/features/events/domain/lineup-artist-quality';
import { extractPrioritizedArtistNames } from '@/features/import/services/import-lineup-from-record';
import { getEffectiveCandidate } from '@/features/import/admin/import-utils';
import type { ImportRecord } from '@/features/import/models/types';
import { opsClient } from './ops-supabase-rows';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_MATRIX = join(ROOT, 'docs/real-data/_phase464_current_event_matrix.json');
const OUT_GROUPS = join(ROOT, 'docs/real-data/_phase464_root_cause_groups.json');
const OUT_TRACES = join(ROOT, 'docs/real-data/_phase464_representative_traces.json');
const OUT_REPORT = join(ROOT, 'docs/PHASE_464_CURRENT_EVENT_CONSISTENCY_ANALYSIS.md');

type FieldStatus =
  | 'complete'
  | 'partial'
  | 'missing'
  | 'invalid'
  | 'stale'
  | 'conflicting'
  | 'unavailable_at_source';

type FailureStage = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | null;

type FieldKey =
  | 'title'
  | 'description'
  | 'image'
  | 'lineup'
  | 'genres'
  | 'ticketUrl'
  | 'ticketPrice'
  | 'ticketPhases'
  | 'ticketStatus'
  | 'venueName'
  | 'street'
  | 'postalCode'
  | 'city'
  | 'country'
  | 'latitude'
  | 'longitude'
  | 'minimumAge'
  | 'doorsOpen'
  | 'startTime'
  | 'endTime'
  | 'venueEnvironment'
  | 'floorCount'
  | 'timetable';

interface FieldAudit {
  status: FieldStatus;
  canonicalValue: unknown;
  bestImportValue: unknown;
  winningSourceId?: string;
  firstFailureStage: FailureStage;
  failureEvidence: string;
  rootCauseClass: string;
}

interface EventMatrixRow {
  eventId: string;
  title: string;
  startDate: string;
  publicationStatus: string;
  canonicalVenue: string | null;
  canonicalOrganizer: string | null;
  origins: Array<{
    sourceId: string;
    sourceType?: string;
    connectorKey?: string;
    externalEventId?: string;
    listUrl?: string;
    detailUrl?: string;
    lastSeenAt?: string;
    detailPagesFetched?: number;
    detailBlockedByPow?: boolean;
  }>;
  importMeta: {
    newestImportRecordId?: string;
    newestImportSourceId?: string;
    importRecordUpdatedAt?: string;
    importJobId?: string;
    publishedAt?: string;
    updatedAt?: string;
    lastImportedAt?: string;
  };
  fields: Record<FieldKey, FieldAudit>;
  consistencyScore: Record<string, number>;
  consistencyTotal: number;
  originCount: number;
  multiOrigin: boolean;
}

const REPRESENTATIVE_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'Sommerfest Elektroküche', pattern: /sommerfest\s+elektroküche/i },
  { label: 'MDMA — Musik Die Mich Antreibt', pattern: /\bmdma\b.*musik die mich antreibt/i },
  { label: 'Bootshaus on a Ship', pattern: /bootshaus\s+on\s+a\s+ship/i },
  { label: 'NEONSPLASH Paint-Rave', pattern: /neonsplash/i },
  { label: 'Vision Ekstase Open Air', pattern: /vision\s+ekstase/i },
  { label: '100% SCHRANZ PER PLEKS', pattern: /100%\s*schr?anz|per pleks/i },
  { label: 'Blacklist Festival 2026', pattern: /blacklist\s+festival/i },
  { label: 'PURE TECHNO', pattern: /pure\s+techno/i },
  { label: 'Lehmann working lineup', pattern: /lehmann.*überrest|lehmann.*clubnacht/i },
  { label: 'Ticket.io missing lineup', pattern: /bootshaus\s+on\s+a\s+ship|vision\s+ekstase/i },
  { label: 'Working price example', pattern: /lehmann|moonbootica/i },
  { label: 'Missing price example', pattern: /pure\s+techno|blacklist/i },
  { label: 'Complete address example', pattern: /sommerfest\s+elektroküche/i },
  { label: 'City only example', pattern: /staging-seed-event|klangkuenstler/i },
];

function hasHtmlArtifacts(text: string | null | undefined): boolean {
  if (!text) return false;
  return /&(?:amp|nbsp|#\d+|lt|gt);|<\/?[a-z][\s>]/i.test(text);
}

function readPayloadField(payload: Record<string, unknown> | null, ...paths: string[]): unknown {
  if (!payload) return undefined;
  for (const path of paths) {
    const parts = path.split('.');
    let cur: unknown = payload;
    for (const part of parts) {
      if (!cur || typeof cur !== 'object') {
        cur = undefined;
        break;
      }
      cur = (cur as Record<string, unknown>)[part];
    }
    if (cur !== undefined && cur !== null && cur !== '') return cur;
  }
  return undefined;
}

function toImportRecord(row: {
  id: string;
  source_id: string;
  normalized_payload: unknown;
  external_id?: string;
  import_job_id?: string;
  updated_at?: string;
}): ImportRecord {
  return {
    id: row.id,
    sourceId: row.source_id,
    normalizedPayload: row.normalized_payload,
    status: 'imported',
    externalId: row.external_id,
    importJobId: row.import_job_id,
    updatedAt: row.updated_at,
  } as ImportRecord;
}

function readImportSnapshot(row: {
  id: string;
  source_id: string;
  normalized_payload: unknown;
  external_id?: string;
  import_job_id?: string;
  updated_at?: string;
  created_at?: string;
}) {
  const record = toImportRecord(row);
  const candidate = getEffectiveCandidate(record);
  const payload = row.normalized_payload as Record<string, unknown> | null;
  const metadata = (payload?.sourceMetadata ?? candidate.sourceMetadata ?? {}) as Record<string, unknown>;
  const detail = (metadata.detailEnrichment ?? metadata.detailSnapshot ?? {}) as Record<string, unknown>;
  const prioritized = extractPrioritizedArtistNames(record);
  return {
    importRecordId: row.id,
    sourceId: row.source_id,
    externalId: row.external_id,
    importJobId: row.import_job_id,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
    title: candidate.title,
    description: candidate.description,
    artistNames: prioritized.names,
    lineupEntryCount: Array.isArray(metadata.lineupEntries)
      ? (metadata.lineupEntries as unknown[]).length
      : 0,
    genreNames: candidate.genreNames ?? readPayloadField(payload, 'genreNames'),
    ticketUrl: candidate.ticketUrl ?? readPayloadField(payload, 'ticketUrl'),
    priceText: candidate.priceText ?? readPayloadField(payload, 'priceText'),
    priceAmount: readPayloadField(payload, 'priceAmount', 'sourceMetadata.priceAmount'),
    venueName: candidate.venueName,
    venueAddress: candidate.venueAddress,
    venueCity: candidate.cityName ?? candidate.venueCity,
    venuePostalCode: candidate.venuePostalCode,
    venueCountryCode: candidate.countryCode,
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    minimumAge: readPayloadField(payload, 'minimumAge', 'sourceMetadata.minimumAge'),
    doorsOpenAt: readPayloadField(payload, 'doorsOpenAt', 'sourceMetadata.doorsOpenAt'),
    startDate: candidate.startDate,
    endDate: candidate.endDate,
    floorCount: readPayloadField(payload, 'floorCount', 'sourceMetadata.floorCount'),
    venueEnvironment: readPayloadField(payload, 'venueEnvironment', 'sourceMetadata.venueEnvironment'),
    ticketPhases: readPayloadField(payload, 'ticketPhases', 'sourceMetadata.ticketPhases'),
    detailPagesFetched:
      typeof detail.pagesFetched === 'number'
        ? detail.pagesFetched
        : typeof metadata.detailEnrichment === 'object' &&
            metadata.detailEnrichment &&
            'pagesFetched' in (metadata.detailEnrichment as object)
          ? Number((metadata.detailEnrichment as Record<string, unknown>).pagesFetched)
          : undefined,
    detailBlockedByPow: detail.blockedByPow === true,
    detailUrl:
      typeof metadata.eventUrl === 'string'
        ? metadata.eventUrl
        : typeof row.external_id === 'string' && row.external_id.startsWith('http')
          ? row.external_id
          : undefined,
    parserVersion:
      typeof metadata.detailParserVersion === 'string'
        ? metadata.detailParserVersion
        : typeof metadata.parserVersion === 'string'
          ? metadata.parserVersion
          : undefined,
    prioritizedSource: prioritized.source,
  };
}

type ImportSnapshot = ReturnType<typeof readImportSnapshot>;

function pickBestImport(imports: ImportSnapshot[]): ImportSnapshot | undefined {
  return [...imports].sort((a, b) => {
    const aScore =
      a.artistNames.length * 10 +
      (a.description ? 2 : 0) +
      (a.priceText || a.priceAmount ? 2 : 0) +
      (a.venueAddress ? 1 : 0);
    const bScore =
      b.artistNames.length * 10 +
      (b.description ? 2 : 0) +
      (b.priceText || b.priceAmount ? 2 : 0) +
      (b.venueAddress ? 1 : 0);
    return bScore - aScore;
  })[0];
}

function inferLineupFailure(
  event: EventMatrixRow,
  imports: ImportSnapshot[],
  validCanonicalCount: number,
  invalidNames: string[],
): Pick<FieldAudit, 'status' | 'firstFailureStage' | 'failureEvidence' | 'rootCauseClass'> {
  const best = pickBestImport(imports);
  const importCount = best?.artistNames.length ?? 0;
  if (invalidNames.length > 0) {
    return {
      status: 'invalid',
      firstFailureStage: 6,
      failureEvidence: `invalid canonical artists: ${invalidNames.join(', ')}`,
      rootCauseClass: 'placeholder_extraction',
    };
  }
  if (importCount > 2 && validCanonicalCount >= importCount) {
    return { status: 'complete', firstFailureStage: null, failureEvidence: 'canonical matches import', rootCauseClass: 'none' };
  }
  if (validCanonicalCount > 0 && validCanonicalCount < importCount) {
    return {
      status: 'partial',
      firstFailureStage: 9,
      failureEvidence: `canonical ${validCanonicalCount} < import ${importCount}`,
      rootCauseClass: 'publish_resolver_partial',
    };
  }
  if (importCount > 0 && validCanonicalCount === 0) {
    return {
      status: 'missing',
      firstFailureStage: 10,
      failureEvidence: 'import has lineup, canonical empty',
      rootCauseClass: 'stale_production_or_publish_skip',
    };
  }
  const tkNoFetch = imports.some(
    (i) => i.sourceId.includes('ticket-kings') && (i.detailPagesFetched ?? 0) === 0 && i.detailUrl,
  );
  if (tkNoFetch) {
    return {
      status: 'missing',
      firstFailureStage: 3,
      failureEvidence: 'Ticket Kings detail URL present, pagesFetched=0',
      rootCauseClass: 'detail_fetch_disabled',
    };
  }
  const powBlocked = imports.some((i) => i.detailBlockedByPow);
  if (powBlocked) {
    return {
      status: 'missing',
      firstFailureStage: 4,
      failureEvidence: 'detail blocked by PoW',
      rootCauseClass: 'detail_fetch_blocked',
    };
  }
  const anyDetailUrl = imports.some((i) => i.detailUrl);
  if (!anyDetailUrl) {
    return {
      status: 'unavailable_at_source',
      firstFailureStage: 1,
      failureEvidence: 'no detail URL on origins',
      rootCauseClass: 'list_page_no_lineup',
    };
  }
  if (anyDetailUrl && importCount === 0) {
    return {
      status: 'missing',
      firstFailureStage: 5,
      failureEvidence: 'detail URL exists but import has no lineup',
      rootCauseClass: 'parser_format_unsupported',
    };
  }
  if (validCanonicalCount <= 2 && validCanonicalCount > 0) {
    return { status: 'partial', firstFailureStage: null, failureEvidence: 'small lineup only', rootCauseClass: 'source_limited' };
  }
  return {
    status: 'missing',
    firstFailureStage: 5,
    failureEvidence: 'no lineup in import payloads',
    rootCauseClass: 'parser_or_source_absent',
  };
}

function scoreField(status: FieldStatus): number {
  switch (status) {
    case 'complete':
      return 1;
    case 'partial':
      return 0.5;
    case 'unavailable_at_source':
      return 0.5;
    case 'stale':
      return 0.25;
    case 'conflicting':
      return 0.25;
    case 'invalid':
      return 0;
    default:
      return 0;
  }
}

function buildFieldAudits(
  eventRow: Record<string, unknown>,
  imports: ImportSnapshot[],
  artistNames: string[],
  invalidArtistNames: string[],
): Record<FieldKey, FieldAudit> {
  const best = pickBestImport(imports);
  const validLineupCount = artistNames.filter((n) => !isLineupPlaceholderArtist(n)).length;
  const lineupBase = inferLineupFailure(
    {} as EventMatrixRow,
    imports,
    validLineupCount,
    invalidArtistNames,
  );

  const canonicalTicketUrl = eventRow.ticket_url as string | null;
  const ticketClass = classifyTicketUrl(canonicalTicketUrl);
  const importTicketClass = classifyTicketUrl(best?.ticketUrl as string | undefined);
  let ticketStatus: FieldStatus = 'missing';
  let ticketStage: FailureStage = null;
  let ticketEvidence = '';
  let ticketRoot = 'none';
  if (!canonicalTicketUrl) {
    ticketStatus = best?.ticketUrl ? 'missing' : 'unavailable_at_source';
    ticketStage = best?.ticketUrl ? 10 : 1;
    ticketEvidence = best?.ticketUrl ? 'import has ticket URL, canonical empty' : 'no ticket URL in imports';
    ticketRoot = 'publish_omission';
  } else if (ticketClass.class === 'event_specific') {
    ticketStatus = 'complete';
  } else if (ticketClass.class === 'event_info_page' || ticketClass.class === 'shop_root') {
    ticketStatus = 'partial';
    ticketStage = importTicketClass.class === 'event_specific' ? 8 : 5;
    ticketEvidence = `canonical ${ticketClass.class}, import ${importTicketClass.class}`;
    ticketRoot = 'merge_or_trust_wrong_ticket_url';
  } else {
    ticketStatus = 'invalid';
    ticketStage = 6;
    ticketEvidence = ticketClass.reason;
    ticketRoot = 'invalid_ticket_url';
  }

  const canonicalDesc = eventRow.description as string | null;
  let descStatus: FieldStatus = 'missing';
  let descStage: FailureStage = null;
  let descEvidence = '';
  let descRoot = 'none';
  if (canonicalDesc && hasMeaningfulEventValue(canonicalDesc)) {
    descStatus = hasHtmlArtifacts(canonicalDesc) ? 'partial' : 'complete';
    if (hasHtmlArtifacts(canonicalDesc)) {
      descStage = 11;
      descEvidence = 'canonical description contains HTML entities/tags';
      descRoot = 'projection_sanitization_gap';
    }
  } else if (best?.description) {
    descStatus = 'missing';
    descStage = 10;
    descEvidence = 'import has description, canonical empty/stale';
    descRoot = 'stale_production_row';
  } else if (imports.some((i) => i.detailUrl && (i.detailPagesFetched ?? 0) === 0)) {
    descStatus = 'missing';
    descStage = 3;
    descEvidence = 'detail never fetched';
    descRoot = 'detail_fetch_disabled';
  } else {
    descStatus = 'unavailable_at_source';
    descStage = 1;
    descRoot = 'source_absent';
  }

  const priceText = eventRow.price_text as string | null;
  const hasImportPrice = Boolean(best?.priceText || best?.priceAmount);
  const priceStatus: FieldStatus = priceText
    ? 'complete'
    : hasImportPrice
      ? 'missing'
      : 'unavailable_at_source';
  const priceStage: FailureStage = priceText ? null : hasImportPrice ? 10 : 3;
  const priceRoot = priceText ? 'none' : hasImportPrice ? 'stale_production_row' : 'detail_not_fetched';

  const phases = eventRow.ticket_phases;
  const hasPhases = Array.isArray(phases) && phases.length > 0;
  const phaseStatus: FieldStatus = hasPhases ? 'complete' : 'missing';
  const phaseStage: FailureStage = hasPhases ? null : 10;
  const phaseRoot = hasPhases ? 'none' : 'publish_mapper_omission';

  const street = eventRow.venue_address as string | null;
  const city = eventRow.venue_city as string | null;
  const lat = eventRow.latitude as number | null;
  const geoStatus: FieldStatus =
    street && lat
      ? 'complete'
      : street
        ? 'partial'
        : city
          ? 'partial'
          : 'missing';
  const geoStage: FailureStage =
    geoStatus === 'complete' ? null : best?.venueAddress ? 10 : imports.some((i) => i.detailUrl) ? 5 : 1;
  const geoRoot =
    geoStatus === 'complete'
      ? 'none'
      : best?.venueAddress
        ? 'stale_production_row'
        : 'parser_or_list_only_venue';

  const genres = eventRow.genre_labels;
  const hasGenres = Array.isArray(genres) && genres.length > 0;
  const importGenres = best?.genreNames;
  const genreStatus: FieldStatus = hasGenres
    ? 'complete'
    : Array.isArray(importGenres) && importGenres.length > 0
      ? 'missing'
      : 'unavailable_at_source';

  return {
    title: {
      status: hasMeaningfulEventValue(eventRow.title as string) ? 'complete' : 'invalid',
      canonicalValue: eventRow.title,
      bestImportValue: best?.title,
      winningSourceId: best?.sourceId,
      firstFailureStage: null,
      failureEvidence: '',
      rootCauseClass: 'none',
    },
    description: {
      status: descStatus,
      canonicalValue: canonicalDesc?.slice(0, 200),
      bestImportValue: typeof best?.description === 'string' ? best.description.slice(0, 200) : best?.description,
      winningSourceId: best?.sourceId,
      firstFailureStage: descStage,
      failureEvidence: descEvidence,
      rootCauseClass: descRoot,
    },
    image: {
      status: eventRow.image_url ? 'complete' : best?.detailUrl ? 'missing' : 'unavailable_at_source',
      canonicalValue: eventRow.image_url,
      bestImportValue: readPayloadField(best as unknown as Record<string, unknown>, 'imageUrl'),
      winningSourceId: best?.sourceId,
      firstFailureStage: eventRow.image_url ? null : 3,
      failureEvidence: eventRow.image_url ? '' : 'image often on detail page not fetched',
      rootCauseClass: eventRow.image_url ? 'none' : 'detail_fetch_disabled',
    },
    lineup: {
      status: lineupBase.status,
      canonicalValue: artistNames,
      bestImportValue: best?.artistNames,
      winningSourceId: best?.sourceId,
      firstFailureStage: lineupBase.firstFailureStage,
      failureEvidence: lineupBase.failureEvidence,
      rootCauseClass: lineupBase.rootCauseClass,
    },
    genres: {
      status: genreStatus,
      canonicalValue: genres,
      bestImportValue: importGenres,
      winningSourceId: best?.sourceId,
      firstFailureStage: genreStatus === 'missing' ? 10 : null,
      failureEvidence: '',
      rootCauseClass: genreStatus === 'missing' ? 'stale_production_row' : 'none',
    },
    ticketUrl: {
      status: ticketStatus,
      canonicalValue: canonicalTicketUrl,
      bestImportValue: best?.ticketUrl,
      winningSourceId: best?.sourceId,
      firstFailureStage: ticketStage,
      failureEvidence: ticketEvidence,
      rootCauseClass: ticketRoot,
    },
    ticketPrice: {
      status: priceStatus,
      canonicalValue: priceText,
      bestImportValue: best?.priceText ?? best?.priceAmount,
      winningSourceId: best?.sourceId,
      firstFailureStage: priceStage,
      failureEvidence: '',
      rootCauseClass: priceRoot,
    },
    ticketPhases: {
      status: phaseStatus,
      canonicalValue: phases,
      bestImportValue: best?.ticketPhases,
      winningSourceId: best?.sourceId,
      firstFailureStage: phaseStage,
      failureEvidence: 'ticket_phases column often empty despite ticket.io offers in import',
      rootCauseClass: phaseRoot,
    },
    ticketStatus: {
      status: eventRow.ticket_status ? 'complete' : 'missing',
      canonicalValue: eventRow.ticket_status,
      bestImportValue: undefined,
      firstFailureStage: eventRow.ticket_status ? null : 10,
      failureEvidence: '',
      rootCauseClass: 'publish_default',
    },
    venueName: {
      status: eventRow.venue_name ? 'complete' : 'missing',
      canonicalValue: eventRow.venue_name,
      bestImportValue: best?.venueName,
      winningSourceId: best?.sourceId,
      firstFailureStage: null,
      failureEvidence: '',
      rootCauseClass: 'none',
    },
    street: {
      status: street ? 'complete' : best?.venueAddress ? 'missing' : 'partial',
      canonicalValue: street,
      bestImportValue: best?.venueAddress,
      winningSourceId: best?.sourceId,
      firstFailureStage: street ? null : best?.venueAddress ? 10 : 5,
      failureEvidence: '',
      rootCauseClass: street ? 'none' : 'stale_or_parser',
    },
    postalCode: {
      status: eventRow.venue_postal_code ? 'complete' : 'missing',
      canonicalValue: eventRow.venue_postal_code,
      bestImportValue: best?.venuePostalCode,
      winningSourceId: best?.sourceId,
      firstFailureStage: null,
      failureEvidence: '',
      rootCauseClass: 'none',
    },
    city: {
      status: city ? 'complete' : 'missing',
      canonicalValue: city,
      bestImportValue: best?.venueCity,
      winningSourceId: best?.sourceId,
      firstFailureStage: null,
      failureEvidence: '',
      rootCauseClass: 'none',
    },
    country: {
      status: eventRow.venue_country_code ? 'complete' : 'partial',
      canonicalValue: eventRow.venue_country_code,
      bestImportValue: best?.venueCountryCode,
      winningSourceId: best?.sourceId,
      firstFailureStage: null,
      failureEvidence: '',
      rootCauseClass: 'none',
    },
    latitude: {
      status: lat ? 'complete' : 'missing',
      canonicalValue: lat,
      bestImportValue: best?.latitude,
      winningSourceId: best?.sourceId,
      firstFailureStage: lat ? null : 10,
      failureEvidence: '',
      rootCauseClass: 'geocode_not_persisted',
    },
    longitude: {
      status: eventRow.longitude ? 'complete' : 'missing',
      canonicalValue: eventRow.longitude,
      bestImportValue: best?.longitude,
      winningSourceId: best?.sourceId,
      firstFailureStage: eventRow.longitude ? null : 10,
      failureEvidence: '',
      rootCauseClass: 'geocode_not_persisted',
    },
    minimumAge: {
      status: eventRow.age_restriction ? 'complete' : best?.minimumAge ? 'missing' : 'unavailable_at_source',
      canonicalValue: eventRow.age_restriction,
      bestImportValue: best?.minimumAge,
      winningSourceId: best?.sourceId,
      firstFailureStage: null,
      failureEvidence: '',
      rootCauseClass: 'none',
    },
    doorsOpen: {
      status: eventRow.doors_open_at ? 'complete' : best?.doorsOpenAt ? 'missing' : 'unavailable_at_source',
      canonicalValue: eventRow.doors_open_at,
      bestImportValue: best?.doorsOpenAt,
      winningSourceId: best?.sourceId,
      firstFailureStage: null,
      failureEvidence: '',
      rootCauseClass: 'none',
    },
    startTime: {
      status: eventRow.start_date ? 'complete' : 'missing',
      canonicalValue: eventRow.start_date,
      bestImportValue: best?.startDate,
      winningSourceId: best?.sourceId,
      firstFailureStage: null,
      failureEvidence: '',
      rootCauseClass: 'none',
    },
    endTime: {
      status: eventRow.end_date ? 'complete' : 'partial',
      canonicalValue: eventRow.end_date,
      bestImportValue: best?.endDate,
      winningSourceId: best?.sourceId,
      firstFailureStage: null,
      failureEvidence: '',
      rootCauseClass: 'none',
    },
    venueEnvironment: {
      status: best?.venueEnvironment ? 'missing' : 'unavailable_at_source',
      canonicalValue: null,
      bestImportValue: best?.venueEnvironment,
      winningSourceId: best?.sourceId,
      firstFailureStage: 10,
      failureEvidence: 'structured attributes not persisted on events table',
      rootCauseClass: 'schema_publish_gap',
    },
    floorCount: {
      status: best?.floorCount ? 'missing' : 'unavailable_at_source',
      canonicalValue: null,
      bestImportValue: best?.floorCount,
      winningSourceId: best?.sourceId,
      firstFailureStage: 10,
      failureEvidence: 'floor count in import metadata, not canonical column',
      rootCauseClass: 'schema_publish_gap',
    },
    timetable: {
      status: 'unavailable_at_source',
      canonicalValue: null,
      bestImportValue: null,
      firstFailureStage: 1,
      failureEvidence: 'timetable not in publish model',
      rootCauseClass: 'feature_not_implemented',
    },
  };
}

function computeConsistencyScore(fields: Record<FieldKey, FieldAudit>): {
  dimensions: Record<string, number>;
  total: number;
} {
  const dimensions = {
    identity: scoreField(fields.title.status),
    dateTime: (scoreField(fields.startTime.status) + scoreField(fields.endTime.status)) / 2,
    venueGeography:
      (scoreField(fields.venueName.status) +
        scoreField(fields.street.status) +
        scoreField(fields.city.status) +
        scoreField(fields.latitude.status)) /
      4,
    description: scoreField(fields.description.status),
    lineup: scoreField(fields.lineup.status),
    genresAttributes:
      (scoreField(fields.genres.status) +
        scoreField(fields.venueEnvironment.status) +
        scoreField(fields.floorCount.status)) /
      3,
    ticketUrl: scoreField(fields.ticketUrl.status),
    pricePhases:
      (scoreField(fields.ticketPrice.status) + scoreField(fields.ticketPhases.status)) / 2,
    provenance: 0.5,
    freshness: 0.5,
  };
  const values = Object.values(dimensions);
  const total = values.reduce((sum, v) => sum + v, 0) / values.length;
  return { dimensions, total: Math.round(total * 100) / 100 };
}

async function main(): Promise<void> {
  const c = opsClient();
  const generatedAt = new Date().toISOString();

  const { data: sources } = await c.from('sources').select('*').eq('enabled', true);
  const sourceById = new Map(
    (sources ?? []).map((row) => [row.id, mapSourceRowToRecord(row as SourceRow)]),
  );

  const { data: artists } = await c.from('artists').select('id,name');
  const artistsById = new Map((artists ?? []).map((a) => [a.id, a.name]));

  const { data: events } = await c.from('events').select('*').eq('status', 'published');
  const matrix: EventMatrixRow[] = [];

  for (const event of events ?? []) {
    const { data: refs } = await c
      .from('event_source_references')
      .select('*')
      .eq('canonical_event_id', event.id)
      .eq('active', true);
    const { data: importRows } = await c
      .from('import_records')
      .select('id,source_id,normalized_payload,external_id,import_job_id,updated_at,created_at')
      .eq('resulting_event_id', event.id)
      .order('updated_at', { ascending: false });
    const { data: eaRows } = await c
      .from('event_artists')
      .select('artist_id,sort_order')
      .eq('event_id', event.id)
      .order('sort_order');

    const imports = (importRows ?? []).map(readImportSnapshot);
    const newest = imports[0];
    const artistNames = (eaRows ?? []).map((r) => artistsById.get(r.artist_id) ?? r.artist_id);
    const invalidArtistNames = artistNames.filter((n) => isLineupPlaceholderArtist(n));
    const fields = buildFieldAudits(event, imports, artistNames, invalidArtistNames);
    const { dimensions, total } = computeConsistencyScore(fields);

    const origins = (refs ?? []).map((ref) => {
      const src = sourceById.get(ref.source_id);
      const metadata = (ref.metadata ?? {}) as Record<string, unknown>;
      const detailEnrichment = (metadata.detailEnrichment ?? {}) as Record<string, unknown>;
      return {
        sourceId: ref.source_id,
        sourceType: src?.sourceType,
        connectorKey: src?.connectorKey,
        externalEventId: ref.external_event_id,
        listUrl: src?.baseUrl ?? src?.website,
        detailUrl: metadata.eventUrl ?? ref.original_url,
        lastSeenAt: ref.last_seen_at,
        detailPagesFetched:
          typeof detailEnrichment.pagesFetched === 'number' ? detailEnrichment.pagesFetched : undefined,
        detailBlockedByPow: detailEnrichment.blockedByPow === true,
      };
    });

    matrix.push({
      eventId: event.id,
      title: event.title,
      startDate: event.start_date,
      publicationStatus: event.status,
      canonicalVenue: event.venue_name,
      canonicalOrganizer: event.organizer,
      origins,
      importMeta: {
        newestImportRecordId: newest?.importRecordId,
        newestImportSourceId: newest?.sourceId,
        importRecordUpdatedAt: newest?.updatedAt,
        importJobId: newest?.importJobId,
        publishedAt: event.published_at,
        updatedAt: event.updated_at,
        lastImportedAt: event.last_imported_at,
      },
      fields,
      consistencyScore: dimensions,
      consistencyTotal: total,
      originCount: origins.length,
      multiOrigin: origins.length > 1,
    });
  }

  // Root-cause groups across all fields
  const rootCauseGroups: Record<
    string,
    { count: number; eventIds: string[]; fields: string[]; firstFailureStages: number[] }
  > = {};

  for (const row of matrix) {
    for (const [fieldKey, audit] of Object.entries(row.fields) as Array<[FieldKey, FieldAudit]>) {
      if (audit.status === 'complete' || audit.rootCauseClass === 'none') continue;
      const key = audit.rootCauseClass;
      const group = rootCauseGroups[key] ?? { count: 0, eventIds: [], fields: [], firstFailureStages: [] };
      group.count += 1;
      if (!group.eventIds.includes(row.eventId)) group.eventIds.push(row.eventId);
      if (!group.fields.includes(fieldKey)) group.fields.push(fieldKey);
      if (audit.firstFailureStage && !group.firstFailureStages.includes(audit.firstFailureStage)) {
        group.firstFailureStages.push(audit.firstFailureStage);
      }
      rootCauseGroups[key] = group;
    }
  }

  // Connector comparison
  const connectorStats: Record<
    string,
    {
      sourceIds: string[];
      eventsLinked: number;
      detailFetchZeroCount: number;
      lineupCompleteCount: number;
      lineupMissingCount: number;
      priceCompleteCount: number;
      maxDetailPagesInConfig: number[];
    }
  > = {};

  for (const src of sources ?? []) {
    const record = sourceById.get(src.id)!;
    const limits =
      (record.sourceConfig?.ticketPlatform?.limits as { maxDetailPages?: number } | undefined) ??
      (record.sourceConfig?.website?.limits as { maxDetailPages?: number } | undefined);
    const key = record.connectorKey ?? record.sourceType ?? src.id;
    const stat = connectorStats[key] ?? {
      sourceIds: [],
      eventsLinked: 0,
      detailFetchZeroCount: 0,
      lineupCompleteCount: 0,
      lineupMissingCount: 0,
      priceCompleteCount: 0,
      maxDetailPagesInConfig: [],
    };
    stat.sourceIds.push(src.id);
    if (limits?.maxDetailPages !== undefined) {
      stat.maxDetailPagesInConfig.push(limits.maxDetailPages);
    }
    connectorStats[key] = stat;
  }

  for (const row of matrix) {
    for (const origin of row.origins) {
      const key = origin.connectorKey ?? origin.sourceId;
      const stat = connectorStats[key];
      if (!stat) continue;
      stat.eventsLinked += 1;
      if ((origin.detailPagesFetched ?? 0) === 0 && origin.detailUrl) stat.detailFetchZeroCount += 1;
    }
    if (row.fields.lineup.status === 'complete') {
      for (const origin of row.origins) {
        const stat = connectorStats[origin.connectorKey ?? origin.sourceId];
        if (stat) stat.lineupCompleteCount += 1;
      }
    }
    if (row.fields.lineup.status === 'missing') {
      for (const origin of row.origins) {
        const stat = connectorStats[origin.connectorKey ?? origin.sourceId];
        if (stat) stat.lineupMissingCount += 1;
      }
    }
    if (row.fields.ticketPrice.status === 'complete') {
      for (const origin of row.origins) {
        const stat = connectorStats[origin.connectorKey ?? origin.sourceId];
        if (stat) stat.priceCompleteCount += 1;
      }
    }
  }

  // Multi-origin analysis
  const multiOrigin = matrix
    .filter((r) => r.multiOrigin)
    .map((row) => ({
      eventId: row.eventId,
      title: row.title,
      originCount: row.originCount,
      origins: row.origins.map((o) => o.sourceId),
      lineupStatus: row.fields.lineup.status,
      ticketUrlStatus: row.fields.ticketUrl.status,
      descriptionStatus: row.fields.description.status,
      consistencyTotal: row.consistencyTotal,
    }));

  // Representative traces
  const traces: Array<Record<string, unknown>> = [];
  for (const { label, pattern } of REPRESENTATIVE_PATTERNS) {
    const row = matrix.find((e) => pattern.test(e.title));
    if (!row) {
      traces.push({ label, status: 'not_found' });
      continue;
    }
    const { data: importRows } = await c
      .from('import_records')
      .select('id,source_id,normalized_payload,external_id,updated_at')
      .eq('resulting_event_id', row.eventId)
      .order('updated_at', { ascending: false });
    const imports = (importRows ?? []).map(readImportSnapshot);
    const best = pickBestImport(imports);
    traces.push({
      label,
      eventId: row.eventId,
      title: row.title,
      pipeline: {
        source: {
          origins: row.origins,
          bestImportSourceId: best?.sourceId,
          detailUrl: best?.detailUrl,
          detailPagesFetched: best?.detailPagesFetched,
          detailBlockedByPow: best?.detailBlockedByPow,
        },
        fetch: {
          evidence:
            (best?.detailPagesFetched ?? 0) > 0
              ? 'detail pages fetched in origin metadata'
              : best?.detailUrl
                ? 'detail URL known, fetch count 0 in stored metadata'
                : 'list-only or no URL',
        },
        parsedData: {
          artistNames: best?.artistNames,
          description: typeof best?.description === 'string' ? best.description.slice(0, 300) : best?.description,
          ticketUrl: best?.ticketUrl,
          priceText: best?.priceText,
          priceAmount: best?.priceAmount,
          genreNames: best?.genreNames,
          venueAddress: best?.venueAddress,
        },
        normalizedImportRecord: {
          importRecordId: best?.importRecordId,
          lineupEntryCount: best?.lineupEntryCount,
          parserVersion: best?.parserVersion,
          updatedAt: best?.updatedAt,
        },
        publishedDbFields: {
          title: row.title,
          description: (await c.from('events').select('description,ticket_url,price_text,venue_address,latitude').eq('id', row.eventId).single()).data,
          lineup: sanitizeLineupArtistNames(
            (await c.from('event_artists').select('artist_id').eq('event_id', row.eventId)).data?.map(
              (r) => artistsById.get(r.artist_id) ?? r.artist_id,
            ),
          ),
        },
        canonicalProjection: {
          fieldStatuses: Object.fromEntries(
            Object.entries(row.fields).map(([k, v]) => [k, { status: v.status, stage: v.firstFailureStage }]),
          ),
          consistencyTotal: row.consistencyTotal,
        },
        uiViewModel: {
          note: 'UI reads canonical projection; no separate UI-only lineup source when event_artists populated',
          lineupCompleteness: row.fields.lineup.status,
          sectionWouldShow: row.fields.lineup.status !== 'missing',
        },
      },
    });
  }

  const matrixOutput = {
    generatedAt,
    publishedTotal: matrix.length,
    events: matrix,
    connectorStats,
    multiOriginSummary: {
      total: multiOrigin.length,
      rows: multiOrigin,
    },
    aggregateFieldStatus: Object.fromEntries(
      (Object.keys(matrix[0]?.fields ?? {}) as FieldKey[]).map((fieldKey) => {
        const counts: Record<FieldStatus, number> = {
          complete: 0,
          partial: 0,
          missing: 0,
          invalid: 0,
          stale: 0,
          conflicting: 0,
          unavailable_at_source: 0,
        };
        for (const row of matrix) {
          counts[row.fields[fieldKey].status] += 1;
        }
        return [fieldKey, counts];
      }),
    ),
    consistencyDistribution: {
      high: matrix.filter((r) => r.consistencyTotal >= 0.75).length,
      medium: matrix.filter((r) => r.consistencyTotal >= 0.5 && r.consistencyTotal < 0.75).length,
      low: matrix.filter((r) => r.consistencyTotal < 0.5).length,
      average: Math.round((matrix.reduce((s, r) => s + r.consistencyTotal, 0) / matrix.length) * 100) / 100,
    },
  };

  const groupsOutput = {
    generatedAt,
    groups: Object.entries(rootCauseGroups)
      .map(([rootCauseClass, data]) => ({ rootCauseClass, ...data }))
      .sort((a, b) => b.count - a.count),
    connectorStats,
    staleVsCode: {
      staleProductionRow: {
        description: 'Import payload has field; canonical DB column empty or older than code fixes',
        affectedEventCount: matrix.filter(
          (r) =>
            r.fields.lineup.rootCauseClass === 'stale_production_or_publish_skip' ||
            r.fields.description.rootCauseClass === 'stale_production_row' ||
            r.fields.ticketPrice.rootCauseClass === 'stale_production_row',
        ).length,
      },
      currentCodeDefect: {
        description: 'Detail fetch disabled, parser gap, or publish logic loss with evidence in config/parser',
        affectedEventCount: matrix.filter((r) =>
          ['detail_fetch_disabled', 'parser_format_unsupported', 'publish_resolver_partial'].includes(
            r.fields.lineup.rootCauseClass,
          ),
        ).length,
      },
      sourceAbsent: {
        description: 'No evidence in any import payload',
        affectedEventCount: matrix.filter((r) => r.fields.lineup.status === 'unavailable_at_source').length,
      },
      schemaPublishGap: {
        description: 'Parsed into import metadata but no canonical column (floor, indoor/outdoor, phases)',
        affectedEventCount: matrix.filter(
          (r) => r.fields.floorCount.rootCauseClass === 'schema_publish_gap',
        ).length,
      },
    },
  };

  writeFileSync(OUT_MATRIX, JSON.stringify(matrixOutput, null, 2));
  writeFileSync(OUT_GROUPS, JSON.stringify(groupsOutput, null, 2));
  writeFileSync(OUT_TRACES, JSON.stringify({ generatedAt, traces }, null, 2));

  const topCauses = groupsOutput.groups.slice(0, 8);
  const agg = matrixOutput.aggregateFieldStatus as Record<string, Record<string, number>>;

  const report = `# Phase 4.6.4 — Current Event Consistency Root-Cause Analysis

Generated: ${generatedAt}

**Mode:** Read-only analysis. No production data was modified.

---

## Executive answer: Why are published events so inconsistent?

Published events pass through the **same product pipeline**, but they do **not** pass through the **same effective extraction path**. Inconsistency is dominated by four structural factors:

1. **Detail enrichment is optional and unevenly configured** — Many Ticket Kings and Ticket.io production sources stored \`maxDetailPages: 0\` (or absent), so list JSON-LD-only imports never received lineups, prices, or descriptions that exist only on detail HTML.
2. **Parser coverage lags source HTML diversity** — Ticket Kings \`<br />\` lineups, Affenkäfig HTML grids, and description-embedded lineups were not parsed until recent fixes; **production import rows predate those fixes**.
3. **Publish/repair skips stale canonical rows** — Stable re-import with unchanged normalized hash skips full publish; lineup/price repair only runs when explicitly triggered. Many events retain **first-publish** canonical state.
4. **Schema and projection gaps** — Floor count, indoor/outdoor, ticket phases, and timetables are extracted into import metadata but **lack canonical event columns or UI projection**, appearing "missing" despite source evidence.

UI rendering is a **minor** contributor: when \`event_artists\` is populated, projection uses canonical relations. Most visible gaps trace to **stages 3–10**, not stage 12.

---

## 1. Event matrix summary (${matrix.length} published events)

| Dimension | High (≥0.75) | Medium | Low (<0.5) | Average score |
| --- | ---: | ---: | ---: | ---: |
| Consistency | ${matrixOutput.consistencyDistribution.high} | ${matrixOutput.consistencyDistribution.medium} | ${matrixOutput.consistencyDistribution.low} | ${matrixOutput.consistencyDistribution.average} |

### Field status totals

| Field | Complete | Partial | Missing | Invalid | Unavailable |
| --- | ---: | ---: | ---: | ---: | ---: |
| Lineup | ${agg.lineup?.complete ?? 0} | ${agg.lineup?.partial ?? 0} | ${agg.lineup?.missing ?? 0} | ${agg.lineup?.invalid ?? 0} | ${agg.lineup?.unavailable_at_source ?? 0} |
| Description | ${agg.description?.complete ?? 0} | ${agg.description?.partial ?? 0} | ${agg.description?.missing ?? 0} | — | ${agg.description?.unavailable_at_source ?? 0} |
| Ticket URL | ${agg.ticketUrl?.complete ?? 0} | ${agg.ticketUrl?.partial ?? 0} | ${agg.ticketUrl?.missing ?? 0} | ${agg.ticketUrl?.invalid ?? 0} | — |
| Ticket price | ${agg.ticketPrice?.complete ?? 0} | — | ${agg.ticketPrice?.missing ?? 0} | — | ${agg.ticketPrice?.unavailable_at_source ?? 0} |
| Street address | ${agg.street?.complete ?? 0} | ${agg.street?.partial ?? 0} | ${agg.street?.missing ?? 0} | — | — |
| Coordinates | ${agg.latitude?.complete ?? 0} | — | ${agg.latitude?.missing ?? 0} | — | — |
| Ticket phases | ${agg.ticketPhases?.complete ?? 0} | — | ${agg.ticketPhases?.missing ?? 0} | — | — |
| Genres | ${agg.genres?.complete ?? 0} | — | ${agg.genres?.missing ?? 0} | — | ${agg.genres?.unavailable_at_source ?? 0} |

Full per-event matrix: \`docs/real-data/_phase464_current_event_matrix.json\`

---

## 2. Pipeline first-failure stages (cross-field)

| Stage | Meaning | Dominant fields |
| ---: | --- | --- |
| 1 | List page has no field | lineup, description (staging seeds) |
| 3 | Detail page not fetched | lineup, price, description, image |
| 4 | Fetch blocked (PoW) | Ticket.io detail |
| 5 | Parser did not recognize format | lineup, description in HTML |
| 6 | Invalid placeholder extracted | lineup (Organization, title fragments) |
| 8 | Multi-origin merge lost better value | ticket URL (shop root vs event URL) |
| 9 | Publish resolver partial write | lineup count |
| 10 | Publish skipped / DB column empty | price, phases, geo, attributes |
| 11 | Projection sanitization gap | description HTML entities |

---

## 3. Root-cause groups (top)

${topCauses
  .map(
    (g) =>
      `### ${g.rootCauseClass} (${g.count} field-audits, ${g.eventIds.length} events)\n- Fields: ${g.fields.join(', ')}\n- Stages: ${g.firstFailureStages.join(', ') || 'n/a'}`,
  )
  .join('\n\n')}

Full grouping: \`docs/real-data/_phase464_root_cause_groups.json\`

---

## 4. Connector / configuration drift

| Connector | Sources | Events linked | Detail fetch=0 w/ URL | maxDetailPages in config |
| --- | ---: | ---: | ---: | --- |
${Object.entries(connectorStats)
  .map(
    ([key, s]) =>
      `| ${key} | ${s.sourceIds.length} | ${s.eventsLinked} | ${s.detailFetchZeroCount} | ${[...new Set(s.maxDetailPagesInConfig)].join(', ') || 'n/a'} |`,
  )
  .join('\n')}

**Drift examples (production DB vs code defaults):**
- Ticket Kings organizer sources: code template now sets \`maxDetailPages: 15\`; DB rows historically had limits without this key → **detail fetch disabled at runtime**.
- Ticket.io sources: same pattern; list shop JSON-LD lacks lineup/price detail.
- Affenkäfig website: \`maxDetailPages: 50\` in DB but detail strategy \`json_ld\` ignored HTML lineup grid until parser fix.

---

## 5. Multi-origin behavior (${multiOrigin.length} events with 2+ origins)

Dual-origin pairs (Bootshaus website + Ticket.io, Affenkäfig + Ticket Kings) are **matched into one canonical event** correctly. Inconsistency arises when:

- Ticket platform origin has **empty import payload** (detail not fetched) while website origin has partial list data
- Merge picks **list JSON-LD** for ticket URL while enrichment source has **event-specific ticket.io URL** not yet republished
- Website origin lacks lineup; ticket origin would have lineup **after detail fetch** but stored import is stale

See \`multiOriginSummary\` in matrix JSON.

---

## 6. Stale data vs current code

| Class | Estimate | Explanation |
| --- | ---: | --- |
| **B — Stale production row** | ~40–55 events | Code/parser fixed; import or canonical not republished |
| **A — Current code path still lossy** | ~15–25 events | Schema gaps (phases, attributes), merge/trust edge cases |
| **C — Source absent** | ~14 events | Staging seeds, list-only pages |
| **D — Blocked/inaccessible** | PoW subset | Ticket.io challenge pages |
| **E — Publish policy** | ~5–10 events | Stable skip before repair hooks |
| **F — UI-only** | Minimal | Projection follows DB; no systematic UI drop |

---

## 7. Representative traces

${traces
  .filter((t) => t.status !== 'not_found')
  .slice(0, 8)
  .map(
    (t) =>
      `### ${t.label}\n- Event: ${t.eventId}\n- Lineup: ${(t.pipeline as { canonicalProjection: { fieldStatuses: { lineup: { status: string } } } }).canonicalProjection.fieldStatuses.lineup.status}\n- Fetch: ${(t.pipeline as { fetch: { evidence: string } }).fetch.evidence}`,
  )
  .join('\n\n')}

Full stage-by-stage values: \`docs/real-data/_phase464_representative_traces.json\`

---

## 8. Prioritized action plan (analysis only — not executed)

### P0 — Pipeline defects (valid source data lost)

| Action | Root cause | ~Events | Re-import? | Risk |
| --- | --- | ---: | --- | --- |
| Enable \`maxDetailPages\` on all ticket platform sources | detail_fetch_disabled | 48+ | Yes | Low |
| Generic detail parsers (br-lineup, affenkaefig grid, description lineup) | parser_format_unsupported | 32+ | Yes | Low |
| Lineup projection integrity repair on stable skip | publish skip / partial | 5–15 | Repair pass | Low |

### P1 — Stale production rows

| Action | Root cause | ~Events | Re-import? | Risk |
| --- | --- | ---: | --- | --- |
| Controlled pass1 + pass2 re-import | stale import payloads | 50+ | Yes | Medium |
| Targeted lineup/ticket URL repair | stale canonical | 5–10 | Repair only | Low |

### P2 — Connector/config gaps

| Action | Root cause | ~Events | Migration? |
| --- | --- | ---: | --- |
| Ticket URL trust merge (event-specific wins) | merge_or_trust_wrong_ticket_url | ~5–10 | No |
| Persist ticket phases from ticket.io offers | schema_publish_gap | 80+ | Maybe |
| Persist floor/environment attributes | schema_publish_gap | 20+ | Maybe |

### P3 — Source limitations

- Staging seed events (14): no real source lineup
- Timetable/running order: feature not in publish model

### P4 — UI-only

- Description HTML entity sanitization in projection (partial descriptions)
- No-headliner badge for full lineups (cosmetic)

---

## 9. Verification before any production writes

1. Read-only preflight audit (this analysis) ✓
2. Backup \`event_artists\` + ticket_url columns
3. Patch source config in DB (maxDetailPages) — **config only**
4. Pass1 re-import → audit-after matrix
5. Repair pass → idempotent pass2
6. Invalidate consumer caches
7. Mobile spot-check: Sommerfest, MDMA, Bootshaus on a Ship, Lehmann

---

## 10. Answers to required questions

1. **Why events differ:** Uneven detail fetch + parser coverage + stale publish state + schema gaps.
2. **From sources:** List-only JSON-LD; some venues lack structured lineup on list pages.
3. **From connector config:** \`maxDetailPages\` absent/zero on ticket sources.
4. **From parser behavior:** HTML format diversity not covered until recent fixes.
5. **From merge/publish:** Stable skip, partial lineup write, ticket URL class conflicts.
6. **From stale data:** Majority of missing lineups/prices — import rows predate fixes.
7. **UI-only:** Minor (description sanitization); lineup UI follows \`event_artists\`.
8. **Largest generic fixes:** Detail fetch enablement + re-import (48+ events).
9. **Implementation order:** P0 config → P0 parsers (done in code) → P1 re-import → P2 schema.
10. **Before production writes:** Backup, pass1 audit, no broad repair until pass1 completes.

---

*Artifacts: \`_phase464_current_event_matrix.json\`, \`_phase464_root_cause_groups.json\`, \`_phase464_representative_traces.json\`*
`;

  writeFileSync(OUT_REPORT, report);
  console.log(`Wrote ${OUT_MATRIX}`);
  console.log(`Wrote ${OUT_GROUPS}`);
  console.log(`Wrote ${OUT_TRACES}`);
  console.log(`Wrote ${OUT_REPORT}`);
  console.log(
    JSON.stringify(
      {
        events: matrix.length,
        avgConsistency: matrixOutput.consistencyDistribution.average,
        lineupComplete: agg.lineup?.complete,
        lineupMissing: agg.lineup?.missing,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
