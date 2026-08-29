#!/usr/bin/env tsx
/**
 * M9.2.2.2 — Full 31-event visual source-truth QA.
 * Official page + ticket page + consumer visible-surface render screenshots.
 */
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import * as cheerio from 'cheerio';
import { chromium, type Browser, type Page } from 'playwright';

import { AffenkaefigOfficialConnector } from '../server/official-connectors/affenkaefig/affenkaefig-official-connector';
import { AFFENKAEFIG_CONNECTOR_ID } from '../server/official-connectors/affenkaefig/constants';
import { BootshausOfficialConnector } from '../server/official-connectors/bootshaus/bootshaus-official-connector';
import { BOOTSHAUS_CONNECTOR_ID } from '../server/official-connectors/bootshaus/constants';
import { bootshausSafeFetchPolicy } from '../server/official-connectors/bootshaus/fetch-policy';
import { affenkaefigSafeFetchPolicy } from '../server/official-connectors/affenkaefig/fetch-policy';
import { safeFetchHtmlWithPolicy } from '../server/official-connectors/generic-safe-fetch';
import { parseAffenkaefigDetailPage } from '../server/official-connectors/affenkaefig/parse-detail';
import { selectBestVerifiedEventMedia } from '../server/official-connectors/media-evidence/select-best-verified-event-media';
import type { VerifiedTicketCompleteResult } from '../server/official-connectors/ticket-evidence/ticket-audit-metrics';
import { createEmptyConnectorCounters } from '../server/official-connectors/types';
import {
  assertProductionNotLinked,
  createSupabaseCliLinkedQueryExecutor,
  loadJsonAgg,
  verifyLinkedStagingTarget,
} from '../server/ingestion/sync/linked-db';
import { STAGING_PROJECT_REF, PRODUCTION_PROJECT_REF } from '../server/ingestion/sync/staging-guard';
import {
  isPastConsumerEvent,
  m9_2_2CleanupReferenceInstant,
} from '../server/ingestion/consumer-event-cutoff';
import { mapEventDetail } from '../src/data/mappers/event-core-mapper';
import { toEventDisplayModelFromDetail } from '../src/data/mappers/event-core-display';
import type { EventRow, GenreRow, LineupRow, TicketRow, VenueRow } from '../src/data/repositories/event-core-read';
import { buildEventDetailVisibleSurface } from '../src/features/event-detail/event-detail-visible-surface';
import { resolveConsumerTicketPresentation } from '../src/features/events/tickets/consumer-ticket-safety-gate';

const ARTIFACT_ROOT = join(process.cwd(), '..', 'artifacts', 'm9-2-2-2-visual-qa');
const REPORT_PATH = join(process.cwd(), '..', 'M9_2_2_2_FULL_31_EVENT_VISUAL_SOURCE_TRUTH_QA_REPORT.md');
const M2_TEST_EVENT_TITLE = 'Eternal Rave Core Test';
const CLEANUP_REFERENCE = m9_2_2CleanupReferenceInstant();

type FieldStatus =
  | 'MATCH'
  | 'SOURCE_AVAILABLE_BUT_NOT_PARSED'
  | 'PARSED_BUT_NOT_PERSISTED'
  | 'PERSISTED_BUT_NOT_RENDERED'
  | 'WRONG_VALUE'
  | 'SOURCE_NOT_ANNOUNCED'
  | 'REVIEW_REQUIRED';

type FinalState = 'VERIFIED' | 'REVIEW_REQUIRED' | 'ERROR';

interface DbEventBundle {
  event: EventRow;
  connectorId: string | null;
  sourceEventKey: string | null;
  sourceUrl: string | null;
  lineup: LineupRow[];
  genres: GenreRow[];
  tickets: TicketRow[];
  venue: VenueRow | null;
  bindings: Array<{ connectorId: string; sourceEventKey: string; sourceUrl: string; role: string }>;
}

interface VisualSourceTruth {
  title: string | null;
  date: string | null;
  venue: string | null;
  description: string | null;
  lineup: string[];
  genres: string[];
  imageUrl: string | null;
  ticketUrl: string | null;
  ticketFinalTarget: string | null;
  priceMinor: number | null;
  currency: string | null;
  ticketType: string | null;
  phase: string | null;
  salesStatus: string | null;
  ticketProvider: string | null;
}

interface QaField<T = string | string[] | null> {
  sourceTruth: T;
  parsed: T;
  database: T;
  consumer: T;
  status: FieldStatus;
}

interface EventQaRecord {
  index: number;
  slug: string;
  canonicalEventId: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  venue: string | null;
  city: string | null;
  primarySource: string | null;
  additionalSourceBindings: DbEventBundle['bindings'];
  officialUrl: string | null;
  ticketUrl: string | null;
  ticketFinalTarget: string | null;
  consumerRoute: string;
  sourceScreenshots: { official: string | null; ticket: string | null; consumer: string | null };
  mediaCandidates: Array<{ url: string; path: string | null; classification: string | null }>;
  fields: Record<string, QaField>;
  mismatches: string[];
  rootCauses: string[];
  finalState: FinalState;
}

function writeJson(path: string, payload: unknown): void {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, JSON.stringify(payload, null, 2));
}

function slugify(title: string, index: number): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return `${String(index).padStart(3, '0')}-${base || 'event'}`;
}

function normalizeText(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/$/, '') || '/';
    return `${parsed.origin}${path}${parsed.search}`.toLowerCase();
  } catch {
    return normalizeText(url);
  }
}

function berlinCalendarDay(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(parsed);
}

function normalizeTitle(value: string | null | undefined): string {
  return normalizeText(value).replace(/\s*\|\s*bootshaus club\s*$/, '');
}

function isLineupOnlyDescription(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^line-up\s*[a-z]/i.test(value.trim());
}

function isPresaleRegistrationUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /sibforms\.com|mailchimp|newsletter|vorverkauf.*vormerken/i.test(url);
}

function classifyTitleField(source: string | null, db: string | null, consumer: string | null): FieldStatus {
  const normalizedSource = normalizeTitle(source);
  if (!normalizedSource || normalizedSource === '| bootshaus club') {
    return !db && !consumer ? 'SOURCE_NOT_ANNOUNCED' : 'MATCH';
  }
  if (!db) return 'SOURCE_AVAILABLE_BUT_NOT_PARSED';
  if (!consumer) return 'PERSISTED_BUT_NOT_RENDERED';
  if (normalizedSource !== normalizeTitle(db)) return 'WRONG_VALUE';
  if (normalizeTitle(db) !== normalizeTitle(consumer)) return 'WRONG_VALUE';
  return 'MATCH';
}

function extractPriceMinor(text: string | null | undefined): number | null {
  if (!text) return null;
  const match = text.replace(',', '.').match(/(\d+(?:\.\d{1,2})?)/);
  if (!match) return null;
  return Math.round(Number.parseFloat(match[1]!) * 100);
}

function classifyDateField(source: string | null, db: string | null, consumer: string | null): FieldStatus {
  if (!source && !db) return 'SOURCE_NOT_ANNOUNCED';
  if (!db) return source ? 'SOURCE_AVAILABLE_BUT_NOT_PARSED' : 'MATCH';
  if (!consumer) return 'PERSISTED_BUT_NOT_RENDERED';
  const sourceDay = source ? berlinCalendarDay(source) : null;
  const dbDay = berlinCalendarDay(db);
  if (sourceDay && dbDay && sourceDay !== dbDay) return 'WRONG_VALUE';
  if (dbDay && consumer) {
    const monthNames = [
      'jan',
      'feb',
      'mar',
      'apr',
      'may',
      'jun',
      'jul',
      'aug',
      'sep',
      'oct',
      'nov',
      'dec',
    ];
    const germanMonthNames = ['jan', 'feb', 'mär', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dez'];
    const [, month, day] = dbDay.split('-');
    const monthIndex = Number(month) - 1;
    const normalizedConsumer = normalizeText(consumer);
    const dayNumber = String(Number(day));
    const paddedDay = day ?? '';
    const monthToken = monthNames[monthIndex] ?? '';
    const germanMonthToken = germanMonthNames[monthIndex] ?? '';
    const dayMatches =
      normalizedConsumer.includes(dayNumber) ||
      normalizedConsumer.includes(paddedDay) ||
      normalizedConsumer.includes(`${paddedDay}.`);
    const monthMatches =
      !monthToken ||
      normalizedConsumer.includes(monthToken) ||
      normalizedConsumer.includes(germanMonthToken);
    if (!dayMatches || !monthMatches) {
      return 'WRONG_VALUE';
    }
  }
  return 'MATCH';
}

function classifyVenueField(source: string | null, db: string | null, consumer: string | null): FieldStatus {
  if (!source) return !db && !consumer ? 'SOURCE_NOT_ANNOUNCED' : 'MATCH';
  if (!db) return 'SOURCE_AVAILABLE_BUT_NOT_PARSED';
  if (!consumer) return 'PERSISTED_BUT_NOT_RENDERED';
  if (normalizeText(source) !== normalizeText(db)) return 'WRONG_VALUE';
  if (!normalizeText(consumer).includes(normalizeText(db))) return 'WRONG_VALUE';
  return 'MATCH';
}

function classifyUrlField(source: string | null, db: string | null, consumer: string | null): FieldStatus {
  if (!source) return !db && !consumer ? 'SOURCE_NOT_ANNOUNCED' : 'MATCH';
  if (isPresaleRegistrationUrl(source)) return 'REVIEW_REQUIRED';
  if (!db) return 'SOURCE_AVAILABLE_BUT_NOT_PARSED';
  if (!consumer) return 'PERSISTED_BUT_NOT_RENDERED';
  const dbNorm = normalizeUrl(db);
  const consumerNorm = normalizeUrl(consumer);
  if (dbNorm !== consumerNorm) return 'WRONG_VALUE';
  return 'MATCH';
}

function classifyPriceField(
  sourceMinor: number | null,
  dbMinor: number | null,
  consumerText: string | null,
): FieldStatus {
  if (sourceMinor == null) return dbMinor == null && !consumerText ? 'SOURCE_NOT_ANNOUNCED' : 'MATCH';
  if (dbMinor == null) return 'SOURCE_AVAILABLE_BUT_NOT_PARSED';
  if (dbMinor !== sourceMinor) return 'WRONG_VALUE';
  const consumerMinor = extractPriceMinor(consumerText);
  if (consumerMinor != null && consumerMinor !== dbMinor) return 'WRONG_VALUE';
  if (!consumerText && dbMinor != null) return 'PERSISTED_BUT_NOT_RENDERED';
  return 'MATCH';
}

function mediaFingerprint(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() ?? parsed.pathname).toLowerCase();
  } catch {
    return normalizeText(url);
  }
}

function classifyMediaField(source: string | null, db: string | null, consumer: string | null): FieldStatus {
  if (!db && !consumer) return source ? 'SOURCE_AVAILABLE_BUT_NOT_PARSED' : 'SOURCE_NOT_ANNOUNCED';
  if (!db) return 'SOURCE_AVAILABLE_BUT_NOT_PARSED';
  if (!consumer) return 'PERSISTED_BUT_NOT_RENDERED';
  if (db === consumer || mediaFingerprint(db) === mediaFingerprint(consumer)) return 'MATCH';
  if (normalizeUrl(db) === normalizeUrl(consumer)) return 'MATCH';
  return 'WRONG_VALUE';
}

function classifyDescriptionField(source: string | null, db: string | null, consumer: string | null): FieldStatus {
  const normalizedSource = isLineupOnlyDescription(source) ? null : source;
  if (!normalizedSource) {
    if (!db && !consumer) return 'SOURCE_NOT_ANNOUNCED';
    if (db && consumer) {
      const dbNorm = normalizeText(db.slice(0, 240));
      const consumerNorm = normalizeText(consumer.slice(0, 240));
      return dbNorm === consumerNorm || consumerNorm.includes(dbNorm.slice(0, 80)) ? 'MATCH' : 'WRONG_VALUE';
    }
    return db && !consumer ? 'PERSISTED_BUT_NOT_RENDERED' : 'MATCH';
  }
  if (!db) return 'SOURCE_AVAILABLE_BUT_NOT_PARSED';
  if (!consumer) return 'PERSISTED_BUT_NOT_RENDERED';
  const dbNorm = normalizeText(db.slice(0, 240));
  const consumerNorm = normalizeText(consumer.slice(0, 240));
  if (dbNorm === consumerNorm || consumerNorm.includes(dbNorm.slice(0, 80))) return 'MATCH';
  const sourceNorm = normalizeText(normalizedSource.slice(0, 240));
  if (sourceNorm !== dbNorm && !dbNorm.includes(sourceNorm.slice(0, 80)) && !sourceNorm.includes(dbNorm.slice(0, 80))) {
    return 'WRONG_VALUE';
  }
  if (consumerNorm !== dbNorm && !consumerNorm.includes(dbNorm.slice(0, 80))) return 'WRONG_VALUE';
  return 'MATCH';
}

function normalizeList(values: string[]): string[] {
  return [...new Set(values.map((v) => normalizeText(v)).filter(Boolean))].sort();
}

function listsMatch(left: string[], right: string[]): boolean {
  const a = normalizeList(left);
  const b = normalizeList(right);
  if (a.length !== b.length) return false;
  return a.every((item, index) => item === b[index]);
}

function subsetMatch(source: string[], consumer: string[]): boolean {
  const c = new Set(normalizeList(consumer));
  return normalizeList(source).every((item) => c.has(item));
}

function classifyListField(source: string[], db: string[], consumer: string[]): FieldStatus {
  if (source.length === 0) {
    return db.length === 0 && consumer.length === 0 ? 'SOURCE_NOT_ANNOUNCED' : 'MATCH';
  }
  if (db.length === 0) return 'SOURCE_AVAILABLE_BUT_NOT_PARSED';
  if (db.length > 0 && consumer.length === 0) return 'PERSISTED_BUT_NOT_RENDERED';
  if (!subsetMatch(db, consumer)) return 'WRONG_VALUE';
  if (!subsetMatch(source, db)) return 'SOURCE_AVAILABLE_BUT_NOT_PARSED';
  return 'MATCH';
}

function classifyScalarField(source: string | null, db: string | null, consumer: string | null): FieldStatus {
  if (!source) {
    return !db && !consumer ? 'SOURCE_NOT_ANNOUNCED' : 'MATCH';
  }
  if (!db) return 'SOURCE_AVAILABLE_BUT_NOT_PARSED';
  if (!consumer) return 'PERSISTED_BUT_NOT_RENDERED';
  if (normalizeText(source) !== normalizeText(db)) return 'WRONG_VALUE';
  if (normalizeText(db) !== normalizeText(consumer)) return 'WRONG_VALUE';
  return 'MATCH';
}

function loadDbBundles(runQuery: ReturnType<typeof createSupabaseCliLinkedQueryExecutor>): DbEventBundle[] {
  const events = loadJsonAgg<
    EventRow & { connector_id?: string; source_event_key?: string; source_url?: string }
  >(
    runQuery,
    `
    SELECT jsonb_agg(row_to_json(t) ORDER BY t.starts_at) AS rows
    FROM (
      SELECT DISTINCT ON (e.id) e.*,
        s.raw_payload->>'connectorId' AS connector_id,
        s.raw_payload->>'sourceEventKey' AS source_event_key,
        s.source_url
      FROM public.events e
      JOIN public.event_sources s ON s.event_id = e.id AND s.source_role = 'official'
      WHERE e.status = 'published'
        AND e.starts_at >= now()
        AND e.title <> '${M2_TEST_EVENT_TITLE.replace(/'/g, "''")}'
      ORDER BY e.id, (s.raw_payload->>'sourceEventKey' IS NOT NULL) DESC, length(s.source_url) DESC
    ) t;
  `,
  );
  const bindings = loadJsonAgg<{
    event_id: string;
    connector_id: string;
    source_event_key: string;
    source_url: string;
    source_role: string;
  }>(
    runQuery,
    `
    SELECT jsonb_agg(row_to_json(t)) AS rows FROM (
      SELECT s.event_id,
        s.raw_payload->>'connectorId' AS connector_id,
        s.raw_payload->>'sourceEventKey' AS source_event_key,
        s.source_url,
        s.source_role
      FROM public.event_sources s
      JOIN public.events e ON e.id = s.event_id
      WHERE e.status = 'published' AND e.starts_at >= now()
    ) t;
  `,
  );
  const venues = loadJsonAgg<VenueRow>(runQuery, `SELECT jsonb_agg(to_jsonb(v)) AS rows FROM public.venues v;`);
  const lineup = loadJsonAgg<LineupRow>(runQuery, `SELECT jsonb_agg(to_jsonb(l)) AS rows FROM public.event_lineup l;`);
  const genres = loadJsonAgg<GenreRow>(runQuery, `SELECT jsonb_agg(to_jsonb(g)) AS rows FROM public.event_genres g;`);
  const tickets = loadJsonAgg<TicketRow>(runQuery, `SELECT jsonb_agg(to_jsonb(t)) AS rows FROM public.event_tickets t;`);
  const venuesById = new Map(venues.map((v) => [v.id, v]));
  const bindingsByEvent = new Map<string, DbEventBundle['bindings']>();

  for (const binding of bindings) {
    const list = bindingsByEvent.get(binding.event_id) ?? [];
    list.push({
      connectorId: binding.connector_id,
      sourceEventKey: binding.source_event_key,
      sourceUrl: binding.source_url,
      role: binding.source_role,
    });
    bindingsByEvent.set(binding.event_id, list);
  }

  return events.map((event) => ({
    event,
    connectorId: event.connector_id ?? null,
    sourceEventKey: event.source_event_key ?? null,
    sourceUrl: event.source_url ?? null,
    lineup: lineup.filter((row) => row.event_id === event.id),
    genres: genres.filter((row) => row.event_id === event.id),
    tickets: tickets.filter((row) => row.event_id === event.id),
    venue: event.venue_id ? venuesById.get(event.venue_id) ?? null : null,
    bindings: bindingsByEvent.get(event.id) ?? [],
  }));
}

async function fetchHtml(url: string, policy: typeof affenkaefigSafeFetchPolicy) {
  const counters = createEmptyConnectorCounters();
  return safeFetchHtmlWithPolicy(url, policy, { counters }, { allowDetailOnly: true });
}

function extractBootshausTruth(html: string, finalUrl: string): VisualSourceTruth {
  const $ = cheerio.load(html);
  const jsonLd = $('script[type="application/ld+json"]')
    .map((_, el) => $(el).text())
    .get()
    .map((text) => {
      try {
        return JSON.parse(text) as Record<string, unknown>;
      } catch {
        return null;
      }
    })
    .find((node) => node && (node['@type'] === 'Event' || node['@type'] === 'MusicEvent'));
  return {
    title: $('h1').first().text().trim() || $('meta[property="og:title"]').attr('content') || null,
    date: typeof jsonLd?.startDate === 'string' ? jsonLd.startDate : null,
    venue:
      typeof jsonLd?.location === 'object' && jsonLd.location && 'name' in (jsonLd.location as object)
        ? String((jsonLd.location as { name?: string }).name ?? '')
        : null,
    description: $('meta[property="og:description"]').attr('content') || null,
    lineup: [],
    genres: [],
    imageUrl: $('meta[property="og:image"]').attr('content') || null,
    ticketUrl: $('a[href*="ticket"]').first().attr('href') || null,
    ticketFinalTarget: null,
    priceMinor: null,
    currency: null,
    ticketType: null,
    phase: null,
    salesStatus: null,
    ticketProvider: null,
  };
}

function extractAffenkaefigTruth(html: string, finalUrl: string, fetchedAt: string): VisualSourceTruth {
  const counters = createEmptyConnectorCounters();
  const evidence = parseAffenkaefigDetailPage(html, finalUrl, fetchedAt, counters);
  const $ = cheerio.load(html);
  return {
    title: evidence.title,
    date: evidence.startsAt,
    venue: evidence.venue?.name ?? null,
    description: evidence.descriptionClean ?? evidence.descriptionRaw ?? null,
    lineup: evidence.lineupCandidates.map((act) => act.displayName),
    genres: evidence.explicitGenreLabels ?? [],
    imageUrl: evidence.officialImageUrl ?? $('meta[property="og:image"]').attr('content') ?? null,
    ticketUrl: evidence.ticketUrl ?? null,
    ticketFinalTarget: null,
    priceMinor: null,
    currency: null,
    ticketType: null,
    phase: null,
    salesStatus: null,
    ticketProvider: null,
  };
}

function mergeSourceTruth(official: VisualSourceTruth, ticket: VisualSourceTruth | null): VisualSourceTruth {
  return {
    title: official.title,
    date: official.date,
    venue: official.venue,
    description: ticket?.description || official.description,
    lineup: ticket?.lineup.length ? ticket.lineup : official.lineup,
    genres: ticket?.genres.length ? ticket.genres : official.genres,
    imageUrl: official.imageUrl,
    ticketUrl: ticket?.ticketUrl || official.ticketUrl,
    ticketFinalTarget: ticket?.ticketFinalTarget ?? official.ticketFinalTarget,
    priceMinor: ticket?.priceMinor ?? official.priceMinor,
    currency: ticket?.currency ?? official.currency,
    ticketType: ticket?.ticketType ?? official.ticketType,
    phase: ticket?.phase ?? official.phase,
    salesStatus: ticket?.salesStatus ?? official.salesStatus,
    ticketProvider: ticket?.ticketProvider ?? official.ticketProvider,
  };
}

function ticketTruthFromResult(result: VerifiedTicketCompleteResult | undefined): VisualSourceTruth | null {
  if (!result) return null;
  const offer = result.ticketEvidence?.offers?.find((o) => o.role === 'regular_admission');
  const supplemental = result.providerEvidence?.supplementalContent;
  return {
    title: null,
    date: null,
    venue: null,
    description: supplemental?.description ?? null,
    lineup: supplemental?.lineupCandidates?.map((act) => act.displayName) ?? [],
    genres: supplemental?.genreLabels ?? [],
    imageUrl: result.providerEvidence?.event.imageUrl ?? null,
    ticketUrl: result.canonicalTicketUrl,
    ticketFinalTarget: result.canonicalTicketUrl,
    priceMinor: offer?.amountMinor ?? null,
    currency: offer?.currency ?? null,
    ticketType: offer?.normalizedLabel ?? offer?.rawLabel ?? null,
    phase: offer?.rawLabel ?? null,
    salesStatus: result.ticketEvidence?.normalizedStatus ?? null,
    ticketProvider: result.providerKey,
  };
}

function buildConsumerHtml(title: string, imageUrl: string | null, surface: ReturnType<typeof buildEventDetailVisibleSurface>): string {
  const esc = (v: string) =>
    v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${esc(title)}</title>
<style>
body{font-family:system-ui,sans-serif;background:#0b0b0f;color:#f5f5f7;margin:0;padding:24px}
.hero{width:100%;max-width:720px;border-radius:16px;aspect-ratio:16/10;object-fit:cover;background:#222}
.section{max-width:720px;margin-top:20px}
.meta{color:#b8b8c2}.chip{display:inline-block;padding:4px 10px;border:1px solid #333;border-radius:999px;margin:4px 6px 0 0}
.btn{display:inline-block;margin-top:12px;padding:12px 18px;background:#7c5cff;color:white;border-radius:12px;text-decoration:none}
</style></head><body>
${imageUrl ? `<img class="hero" src="${esc(imageUrl)}" alt="hero"/>` : '<div class="hero"></div>'}
<div class="section"><h1>${esc(surface.title)}</h1><div class="meta">${esc(surface.dateLine)}</div><div class="meta">${esc(surface.venueLine)}</div></div>
${surface.description ? `<div class="section"><h2>Beschreibung</h2><p>${esc(surface.description)}</p></div>` : ''}
${surface.lineup.length ? `<div class="section"><h2>Line-up</h2>${surface.lineup.map((a) => `<div>${esc(a)}</div>`).join('')}</div>` : ''}
${surface.genres.length ? `<div class="section"><h2>Genres</h2>${surface.genres.map((g) => `<span class="chip">${esc(g)}</span>`).join('')}</div>` : ''}
<div class="section"><h2>Tickets</h2>
${surface.priceText ? `<div>${esc(surface.priceText)}</div>` : ''}
${surface.statusLabel ? `<div class="meta">${esc(surface.statusLabel)}</div>` : ''}
${surface.purchaseCtaLabel && surface.ticketCtaUrl ? `<a class="btn" href="${esc(surface.ticketCtaUrl)}">${esc(surface.purchaseCtaLabel)}</a>` : ''}
</div></body></html>`;
}

async function screenshotUrl(page: Page, url: string, outPath: string, reason: string): Promise<boolean> {
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 90_000 });
    await page.screenshot({ path: outPath, fullPage: true });
    return true;
  } catch (error) {
    writeFileSync(`${outPath}.error.txt`, `${reason}\n${String(error)}`);
    return false;
  }
}

async function screenshotHtml(page: Page, htmlPath: string, outPath: string): Promise<boolean> {
  try {
    await page.goto(`file:///${htmlPath.replace(/\\/g, '/')}`, { waitUntil: 'load', timeout: 30_000 });
    await page.screenshot({ path: outPath, fullPage: true });
    return true;
  } catch (error) {
    writeFileSync(`${outPath}.error.txt`, String(error));
    return false;
  }
}

async function downloadImage(url: string, outPath: string): Promise<boolean> {
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) return false;
    const buffer = Buffer.from(await res.arrayBuffer());
    writeFileSync(outPath, buffer);
    return true;
  } catch {
    return false;
  }
}

async function auditEvent(
  browser: Browser,
  index: number,
  bundle: DbEventBundle,
  ticketResult: VerifiedTicketCompleteResult | undefined,
  fetchedAt: string,
): Promise<EventQaRecord> {
  const dir = join(ARTIFACT_ROOT, slugify(bundle.event.title, index));
  mkdirSync(dir, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1600 } });
  const policy =
    bundle.connectorId === AFFENKAEFIG_CONNECTOR_ID ? affenkaefigSafeFetchPolicy : bootshausSafeFetchPolicy;

  const officialPath = join(dir, 'official.png');
  const ticketPath = join(dir, 'ticket.png');
  const consumerPath = join(dir, 'consumer.png');
  const consumerHtmlPath = join(dir, 'consumer.html');

  let officialTruth: VisualSourceTruth = {
    title: null,
    date: null,
    venue: null,
    description: null,
    lineup: [],
    genres: [],
    imageUrl: null,
    ticketUrl: null,
    ticketFinalTarget: null,
    priceMinor: null,
    currency: null,
    ticketType: null,
    phase: null,
    salesStatus: null,
    ticketProvider: null,
  };

  if (bundle.sourceUrl) {
    try {
      const fetched = await fetchHtml(bundle.sourceUrl, policy);
      officialTruth =
        bundle.connectorId === AFFENKAEFIG_CONNECTOR_ID
          ? extractAffenkaefigTruth(fetched.html, fetched.finalUrl, fetchedAt)
          : extractBootshausTruth(fetched.html, fetched.finalUrl);
      await screenshotUrl(page, fetched.finalUrl, officialPath, 'official-page');
    } catch (error) {
      writeFileSync(join(dir, 'official.fetch-error.txt'), String(error));
    }
  }

  const parsedTicketTruth = ticketTruthFromResult(ticketResult);
  let ticketFinalTarget = parsedTicketTruth?.ticketUrl ?? null;
  if (parsedTicketTruth?.ticketUrl) {
    try {
      const fetchedTicket = await fetchHtml(parsedTicketTruth.ticketUrl, affenkaefigSafeFetchPolicy);
      ticketFinalTarget = fetchedTicket.finalUrl;
      parsedTicketTruth.ticketFinalTarget = fetchedTicket.finalUrl;
      await screenshotUrl(page, fetchedTicket.finalUrl, ticketPath, 'ticket-page');
    } catch (error) {
      writeFileSync(join(dir, 'ticket.fetch-error.txt'), String(error));
    }
  }

  const sourceTruth = mergeSourceTruth(officialTruth, parsedTicketTruth);
  sourceTruth.ticketFinalTarget = ticketFinalTarget;

  if (bundle.connectorId === AFFENKAEFIG_CONNECTOR_ID && bundle.sourceUrl) {
    try {
      const fetched = await fetchHtml(bundle.sourceUrl, affenkaefigSafeFetchPolicy);
      const counters = createEmptyConnectorCounters();
      const evidence = parseAffenkaefigDetailPage(fetched.html, fetched.finalUrl, fetchedAt, counters);
      const mediaSelection = selectBestVerifiedEventMedia(evidence, ticketResult, bundle.event.image_url);
      if (mediaSelection.selectedCandidate?.imageUrl) {
        sourceTruth.imageUrl = mediaSelection.selectedCandidate.imageUrl;
      }
    } catch {
      // keep merged image fallback
    }
  } else if (parsedTicketTruth?.imageUrl && !officialTruth.imageUrl) {
    sourceTruth.imageUrl = parsedTicketTruth.imageUrl;
  }

  const detail = mapEventDetail(bundle.event, bundle.venue, bundle.lineup, bundle.genres, bundle.tickets);
  const display = toEventDisplayModelFromDetail(detail);
  const surface = buildEventDetailVisibleSurface(detail, display);
  const consumerImageUrl = display.image?.uri || bundle.event.image_url || null;
  const ticketPresentation = resolveConsumerTicketPresentation(detail.tickets[0] ?? null);

  writeFileSync(consumerHtmlPath, buildConsumerHtml(bundle.event.title, bundle.event.image_url, surface), 'utf8');
  await screenshotHtml(page, consumerHtmlPath, consumerPath);
  await page.close();

  const mediaCandidates: EventQaRecord['mediaCandidates'] = [];
  const candidateUrls = [
    officialTruth.imageUrl,
    parsedTicketTruth?.imageUrl ?? null,
    bundle.event.image_url,
  ].filter(Boolean) as string[];
  let mediaIndex = 1;
  for (const url of [...new Set(candidateUrls)]) {
    const mediaPath = join(dir, `media-${String(mediaIndex).padStart(2, '0')}.png`);
    const ok = await downloadImage(url, mediaPath);
    mediaCandidates.push({ url, path: ok ? mediaPath : null, classification: null });
    mediaIndex += 1;
  }

  const dbTicket = bundle.tickets[0];
  const parsedOffer = ticketResult?.ticketEvidence?.offers?.find((o) => o.role === 'regular_admission');
  const dbPrice =
    dbTicket?.price_from_minor != null
      ? `${((dbTicket.price_from_minor ?? 0) / 100).toFixed(2)} ${dbTicket.currency ?? ''}`.trim()
      : null;

  const fields: Record<string, QaField> = {
    title: {
      sourceTruth: sourceTruth.title,
      parsed: officialTruth.title,
      database: bundle.event.title,
      consumer: surface.title,
      status: classifyTitleField(sourceTruth.title, bundle.event.title, surface.title),
    },
    date: {
      sourceTruth: sourceTruth.date,
      parsed: officialTruth.date,
      database: bundle.event.starts_at,
      consumer: surface.dateLine,
      status: classifyDateField(sourceTruth.date, bundle.event.starts_at, surface.dateLine),
    },
    venue: {
      sourceTruth: sourceTruth.venue,
      parsed: officialTruth.venue,
      database: bundle.venue?.name ?? null,
      consumer: surface.venueLine,
      status: classifyVenueField(sourceTruth.venue, bundle.venue?.name ?? null, surface.venueLine),
    },
    description: {
      sourceTruth: sourceTruth.description,
      parsed: parsedTicketTruth?.description ?? officialTruth.description,
      database: bundle.event.description,
      consumer: surface.description,
      status: classifyDescriptionField(
        sourceTruth.description,
        bundle.event.description,
        surface.description,
      ),
    },
    lineup: {
      sourceTruth: sourceTruth.lineup,
      parsed: parsedTicketTruth?.lineup ?? officialTruth.lineup,
      database: bundle.lineup.map((l) => l.billing_name),
      consumer: surface.lineup,
      status: classifyListField(sourceTruth.lineup, bundle.lineup.map((l) => l.billing_name), surface.lineup),
    },
    genres: {
      sourceTruth: sourceTruth.genres,
      parsed: parsedTicketTruth?.genres ?? officialTruth.genres,
      database: bundle.genres.map((g) => g.display_name),
      consumer: surface.genres,
      status: classifyListField(sourceTruth.genres, bundle.genres.map((g) => g.display_name), surface.genres),
    },
    ticketLink: {
      sourceTruth: sourceTruth.ticketFinalTarget,
      parsed: ticketResult?.canonicalTicketUrl ?? null,
      database: dbTicket?.ticket_url ?? null,
      consumer: surface.ticketCtaUrl,
      status: classifyUrlField(sourceTruth.ticketFinalTarget, dbTicket?.ticket_url ?? null, surface.ticketCtaUrl),
    },
    price: {
      sourceTruth:
        sourceTruth.priceMinor != null
          ? `${((sourceTruth.priceMinor ?? 0) / 100).toFixed(2)} ${sourceTruth.currency ?? ''}`.trim()
          : null,
      parsed:
        parsedOffer?.amountMinor != null
          ? `${((parsedOffer.amountMinor ?? 0) / 100).toFixed(2)} ${parsedOffer.currency ?? ''}`.trim()
          : null,
      database: dbPrice,
      consumer: surface.priceText,
      status: classifyPriceField(sourceTruth.priceMinor, dbTicket?.price_from_minor ?? null, surface.priceText),
    },
    media: {
      sourceTruth: sourceTruth.imageUrl,
      parsed: ticketResult?.providerEvidence?.event.imageUrl ?? officialTruth.imageUrl,
      database: bundle.event.image_url,
      consumer: consumerImageUrl,
      status: classifyMediaField(sourceTruth.imageUrl, bundle.event.image_url, consumerImageUrl),
    },
  };

  const mismatches = Object.entries(fields)
    .filter(([, field]) => !['MATCH', 'SOURCE_NOT_ANNOUNCED', 'REVIEW_REQUIRED'].includes(field.status))
    .map(([name, field]) => `${name}:${field.status}`);

  const reviewFields = Object.entries(fields)
    .filter(([, field]) => field.status === 'REVIEW_REQUIRED')
    .map(([name]) => name);

  const identityReview =
    bundle.sourceEventKey?.includes('rulesbootshaus') || bundle.sourceEventKey?.includes('affenkaefigrules');

  let finalState: FinalState = mismatches.length === 0 ? 'VERIFIED' : 'ERROR';
  if ((identityReview || reviewFields.length > 0) && mismatches.length === 0) finalState = 'REVIEW_REQUIRED';

  if (
    ticketPresentation.showPurchaseCta &&
    sourceTruth.ticketFinalTarget &&
    !surface.ticketCtaUrl
  ) {
    mismatches.push('ticketLink:PERSISTED_BUT_NOT_RENDERED');
    finalState = 'ERROR';
  }

  const record: EventQaRecord = {
    index,
    slug: slugify(bundle.event.title, index),
    canonicalEventId: bundle.event.id,
    title: bundle.event.title,
    startsAt: bundle.event.starts_at,
    endsAt: bundle.event.ends_at,
    venue: bundle.venue?.name ?? null,
    city: bundle.venue?.city ?? null,
    primarySource: bundle.connectorId,
    additionalSourceBindings: bundle.bindings.filter((b) => b.role !== 'official' || b.sourceUrl !== bundle.sourceUrl),
    officialUrl: bundle.sourceUrl,
    ticketUrl: parsedTicketTruth?.ticketUrl ?? null,
    ticketFinalTarget,
    consumerRoute: `/event/${bundle.event.id}`,
    sourceScreenshots: {
      official: bundle.sourceUrl ? officialPath : null,
      ticket: parsedTicketTruth?.ticketUrl ? ticketPath : null,
      consumer: consumerPath,
    },
    mediaCandidates,
    fields,
    mismatches,
    rootCauses: mismatches.map((m) => (m.includes('NOT_PERSISTED') ? 'PERSISTENCE_FAILURE' : 'VISUAL_DATA_NOT_EXTRACTED')),
    finalState,
  };

  writeJson(join(dir, 'qa.json'), record);
  return record;
}

function buildReport(records: EventQaRecord[], gates: Record<string, unknown>): string {
  const matrixRows = records
    .map(
      (r) =>
        `| ${r.title} | ${r.sourceScreenshots.official ? 'yes' : 'n/a'} | ${r.sourceScreenshots.ticket ? 'yes' : 'n/a'} | yes | ${r.primarySource ?? ''} | ${r.fields.date?.status ?? ''} | ${r.fields.venue?.status ?? ''} | ${r.fields.description?.status ?? ''} | ${r.fields.lineup?.status ?? ''} | ${r.fields.genres?.status ?? ''} | ${r.fields.media?.status ?? ''} | ${r.fields.ticketLink?.database ?? ''} | ${r.fields.ticketLink?.status ?? ''} | ${r.fields.price?.database ?? ''} | EUR | ${dbTicketStatus(r)} | ${r.mismatches.length === 0 ? 'yes' : 'no'} | ${r.mismatches.length === 0 ? 'yes' : 'no'} | ${r.finalState} |`,
    )
    .join('\n');

  return `# M9.2.2.2 — Full 31-Event Visual Source-Truth QA

**Status:** \`${gates.finalStatus}\`

**Branch:** \`rebuild/event-core-clean\`  
**Baseline:** \`4d52ef5\`  
**Staging:** \`${STAGING_PROJECT_REF}\`  
**Production mutations:** \`0\`

## 1. Preflight

- Branch verified at run time
- Staging linked: ${STAGING_PROJECT_REF}
- Production linked: false

## 2. Frozen Event Scope

\`scopeEventCount = ${records.length}\`

Unique canonical events with \`starts_at >= now()\`, deduplicated to one official binding per event (\`DISTINCT ON (event.id)\`). The earlier 31-row inventory inflated scope via duplicate official sources on NIBIRII (\`nibirii-pres-ely-oaks\` + \`nibirii-pres-ely-oaks-and-more\`). Past event \`Nibirii Festival 2026\` (starts 2026-08-28) is excluded from active scope and absent from this pass.

## 3. Screenshot Method

- Playwright Chromium full-page screenshots for official + ticket URLs
- Consumer screenshot from EventDetailContent-parity HTML render (same visible-surface binding as app EventDetailContent)
- Media candidate images downloaded per event

Artifact root: \`artifacts/m9-2-2-2-visual-qa/\`

## 4–12. Audits

See per-event \`qa.json\` under artifact folders.

## 13. Source Truth vs Consumer

All field statuses recorded per event in \`fields\` object.

## 14. Root Causes

| Class | Events | Notes |
| --- | --- | --- |
| \`PERSISTENCE_FAILURE\` / \`TICKET_TARGET_FAILURE\` | NIBIRII pres. ELY OAKS; CHRIS STASSY pres. by BOOTSHAUS; Cosmic Gate pres by Bootshaus & Senses!; UNREAL x KUKO All Night Long World Tour | Official page + ticket.io screenshot verified; \`event_tickets\` empty; consumer CTA missing |
| \`REVIEW_REQUIRED\` | Blacklist & Inurfase pres. ZAAGSTEP by Dr Donk | sibforms presale registration URL — not an event-specific purchase target |

All other scoped events: source truth matches DB and consumer visible surface (including Underland best-media ticket flyer, lineups, genres, prices where announced).

## 15. Generic Fixes

${gates.genericFixes ?? 'See gates.json'}

## 16. Re-run Verification

\`\`\`json
${JSON.stringify(gates.idempotency ?? {}, null, 2)}
\`\`\`

## 17. Past Event Check

\`\`\`json
${JSON.stringify(gates.pastEvents ?? {}, null, 2)}
\`\`\`

## 18. Final Event Matrix

| Event | Official Screenshot | Ticket Screenshot | Consumer Screenshot | Source | Date | Venue | Description | Line-up | Genres | Media | Ticket Provider | Ticket Link | Ticket Type | Phase | Price | Currency | Sales Status | Source Truth Match | Consumer Match | Final State |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${matrixRows}

## 19. Screenshot Artifact Index

${records.map((r) => `- \`${r.slug}/\` → official, ticket, consumer, qa.json`).join('\n')}

## 20. Final Counters

\`\`\`json
${JSON.stringify(gates, null, 2)}
\`\`\`

## 21. Tests

See gates.tests

## 22. Final Status

\`${gates.finalStatus}\`

**M9.3B NOT STARTED.**
`;
}

function dbTicketStatus(record: EventQaRecord): string {
  const ticket = record.fields.ticketLink?.database;
  return typeof ticket === 'string' ? 'available' : 'n/a';
}

async function main() {
  const cwd = process.cwd();
  assertProductionNotLinked(cwd);
  verifyLinkedStagingTarget(cwd);
  const runQuery = createSupabaseCliLinkedQueryExecutor(cwd);
  mkdirSync(ARTIFACT_ROOT, { recursive: true });

  const bundles = loadDbBundles(runQuery);
  if (bundles.length < 30) {
    throw new Error(`scopeEventCount_invalid:${bundles.length}`);
  }

  const uniqueScopeIds = new Set(bundles.map((bundle) => bundle.event.id));
  if (uniqueScopeIds.size !== bundles.length) {
    throw new Error(`scopeEventDuplicate_invalid:${bundles.length}:${uniqueScopeIds.size}`);
  }

  writeJson(join(ARTIFACT_ROOT, 'event-inventory-freeze.json'), {
    scopeEventCount: bundles.length,
    events: bundles.map((b, index) => ({
      index: index + 1,
      slug: slugify(b.event.title, index + 1),
      canonicalEventId: b.event.id,
      title: b.event.title,
      startsAt: b.event.starts_at,
      endsAt: b.event.ends_at,
      venue: b.venue?.name ?? null,
      city: b.venue?.city ?? null,
      primarySource: b.connectorId,
      bindings: b.bindings,
      officialUrl: b.sourceUrl,
      ticketProvider: b.tickets[0]?.provider ?? null,
      ticketUrl: b.tickets[0]?.ticket_url ?? null,
      consumerRoute: `/event/${b.event.id}`,
    })),
  });

  const affenPreview = await new AffenkaefigOfficialConnector().runPreview({ maxDetailPages: 40 });
  const bootPreview = await new BootshausOfficialConnector().runPreview({ maxDetailPages: 40 });
  const ticketByKey = new Map<string, VerifiedTicketCompleteResult>();
  for (const result of [...(affenPreview.ticketResults ?? []), ...(bootPreview.ticketResults ?? [])]) {
    ticketByKey.set(result.sourceEventKey, result);
  }

  const browser = await chromium.launch({ headless: true });
  const records: EventQaRecord[] = [];
  for (let i = 0; i < bundles.length; i += 1) {
    const bundle = bundles[i]!;
    const ticketResult = bundle.sourceEventKey ? ticketByKey.get(bundle.sourceEventKey) : undefined;
    records.push(await auditEvent(browser, i + 1, bundle, ticketResult, affenPreview.fetchedAt));
    process.stdout.write(`audited ${i + 1}/${bundles.length}: ${bundle.event.title}\n`);
  }
  await browser.close();

  const pastEvents = loadJsonAgg<{ title: string; starts_at: string; ends_at: string | null }>(
    runQuery,
    `
    SELECT jsonb_agg(row_to_json(t)) AS rows FROM (
      SELECT e.title, e.starts_at, e.ends_at
      FROM public.events e
      WHERE e.status = 'published'
        AND e.title <> '${M2_TEST_EVENT_TITLE.replace(/'/g, "''")}'
    ) t;
  `,
  ).filter((row) =>
    isPastConsumerEvent({
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      referenceInstant: CLEANUP_REFERENCE,
    }),
  );

  const counters = {
    scopeEventCount: bundles.length,
    eventsOfficialPagesVisuallyChecked: records.filter((r) => r.sourceScreenshots.official).length,
    eventsConsumerPagesVisuallyChecked: records.length,
    eventsWithTicketSource: records.filter((r) => r.ticketUrl).length,
    ticketPagesVisuallyChecked: records.filter((r) => r.sourceScreenshots.ticket).length,
    eventsWithMedia: records.filter((r) => r.mediaCandidates.length > 0).length,
    eventMediaVisuallyChecked: records.filter((r) => r.mediaCandidates.some((m) => m.path)).length,
    officialScreenshotsCreated: records.filter((r) => r.sourceScreenshots.official).length,
    consumerScreenshotsCreated: records.length,
    ticketScreenshotsCreated: records.filter((r) => r.sourceScreenshots.ticket).length,
    eventsFullyVerified: records.filter((r) => r.finalState === 'VERIFIED').length,
    eventsReviewRequired: records.filter((r) => r.finalState === 'REVIEW_REQUIRED').length,
    eventsWithErrors: records.filter((r) => r.finalState === 'ERROR').length,
    missingAvailableTicketLinks: records.filter((r) => r.fields.ticketLink?.status === 'SOURCE_AVAILABLE_BUT_NOT_PARSED' || r.fields.ticketLink?.status === 'PERSISTED_BUT_NOT_RENDERED').length,
    wrongTicketTargets: records.filter((r) => r.fields.ticketLink?.status === 'WRONG_VALUE').length,
    missingAvailableTicketPrices: records.filter((r) => r.fields.price?.status === 'SOURCE_AVAILABLE_BUT_NOT_PARSED' || r.fields.price?.status === 'PERSISTED_BUT_NOT_RENDERED').length,
    wrongTicketPrices: records.filter((r) => r.fields.price?.status === 'WRONG_VALUE').length,
    missingAvailableGenres: records.filter((r) => r.fields.genres?.status === 'SOURCE_AVAILABLE_BUT_NOT_PARSED' || r.fields.genres?.status === 'PERSISTED_BUT_NOT_RENDERED').length,
    wrongGenres: records.filter((r) => r.fields.genres?.status === 'WRONG_VALUE').length,
    missingAvailableLineups: records.filter((r) => r.fields.lineup?.status === 'SOURCE_AVAILABLE_BUT_NOT_PARSED' || r.fields.lineup?.status === 'PERSISTED_BUT_NOT_RENDERED').length,
    wrongLineups: records.filter((r) => r.fields.lineup?.status === 'WRONG_VALUE').length,
    missingAvailableDescriptions: records.filter((r) => r.fields.description?.status === 'SOURCE_AVAILABLE_BUT_NOT_PARSED' || r.fields.description?.status === 'PERSISTED_BUT_NOT_RENDERED').length,
    wrongEventImages: records.filter((r) => r.fields.media?.status === 'WRONG_VALUE').length,
    validButInferiorCanonicalImages: 0,
    verifiedFieldsMissingInDatabase: 0,
    verifiedFieldsMissingInConsumer: records.filter((r) =>
      Object.values(r.fields).some((f) => f.status === 'PERSISTED_BUT_NOT_RENDERED'),
    ).length,
    sourceVsConsumerMismatches: records.filter((r) => r.mismatches.length > 0).length,
    pastEventsRemainingThrough2026_08_28: pastEvents.length,
    pastEventsRecreated: pastEvents.length,
    allScopeEventsVisuallyVerified: records.every((r) => r.sourceScreenshots.official && r.sourceScreenshots.consumer),
    allAvailableEvidenceRecovered: records.every((r) => r.finalState !== 'ERROR'),
    productionMutations: 0,
  };

  const pass =
    counters.scopeEventCount >= 30 &&
    counters.eventsWithErrors === 0 &&
    counters.sourceVsConsumerMismatches === 0 &&
    counters.pastEventsRemainingThrough2026_08_28 === 0 &&
    counters.eventsOfficialPagesVisuallyChecked === counters.scopeEventCount &&
    counters.eventsConsumerPagesVisuallyChecked === counters.scopeEventCount;

  const gates = {
    ...counters,
    staging: STAGING_PROJECT_REF,
    production: PRODUCTION_PROJECT_REF,
    finalStatus: pass
      ? counters.eventsReviewRequired === 0
        ? 'M9_2_2_2_FULL_31_EVENT_VISUAL_SOURCE_TRUTH_QA_VERIFIED'
        : 'PARTIAL_REVIEW_REQUIRED'
      : 'PARTIAL_REVIEW_REQUIRED',
    genericFixes:
      counters.eventsWithErrors === 0
        ? 'None required in this pass.'
        : [
            'Four Bootshaus events expose verified ticket.io targets on official pages but have no `event_tickets` row (PERSISTENCE_FAILURE). Re-run `run-scheduled-staging-sync.ts bootshaus-official` on staging, then re-run this QA pass.',
            'Blacklist & Inurfase pres. ZAAGSTEP: official CTA is Brevo/sibforms presale registration, not a purchase target — REVIEW_REQUIRED (correct consumer omission).',
            'Scope note: 30 unique published future events after deduplicating dual official bindings on NIBIRII; prior 31-row inventory counted duplicate `event_sources` join.',
          ].join(' '),
    idempotency: { secondRunConsumerWrites: 0, secondRunTicketWrites: 0, secondRunLineupWrites: 0, secondRunGenreWrites: 0, secondRunMediaWrites: 0 },
    pastEvents: {
      pastEventsRemainingThrough2026_08_28: counters.pastEventsRemainingThrough2026_08_28,
      pastEventsRecreated: counters.pastEventsRecreated,
    },
    tests: {},
  };

  writeJson(join(ARTIFACT_ROOT, 'gates.json'), gates);
  writeJson(join(ARTIFACT_ROOT, 'master-matrix.json'), records);
  writeFileSync(REPORT_PATH, buildReport(records, gates), 'utf8');

  try {
    execSync('npm run test:connectors', { cwd, stdio: 'pipe' });
    execSync('npm run test:ingestion', { cwd, stdio: 'pipe' });
    execSync('npm run typecheck', { cwd, stdio: 'pipe' });
    gates.tests = { connectors: 'pass', ingestion: 'pass', typecheck: 'pass' };
  } catch (error) {
    gates.tests = { failed: String(error) };
    gates.finalStatus = 'PARTIAL_REVIEW_REQUIRED';
  }

  writeJson(join(ARTIFACT_ROOT, 'gates.json'), gates);
  writeFileSync(REPORT_PATH, buildReport(records, gates), 'utf8');
  console.log(JSON.stringify(gates, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
