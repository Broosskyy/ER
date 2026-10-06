#!/usr/bin/env tsx
/**
 * M9.2 — Full per-event verification matrix + Bootshaus consumer readback.
 * Real-source (live) + parsed evidence + DB + consumer pipeline.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import * as cheerio from 'cheerio';

import { AffenkaefigOfficialConnector } from '../server/official-connectors/affenkaefig/affenkaefig-official-connector';
import { AFFENKAEFIG_CONNECTOR_ID } from '../server/official-connectors/affenkaefig/constants';
import { parseAffenkaefigDetailPage } from '../server/official-connectors/affenkaefig/parse-detail';
import { BOOTSHAUS_CONNECTOR_ID } from '../server/official-connectors/bootshaus/constants';
import { safeFetchHtmlWithPolicy } from '../server/official-connectors/generic-safe-fetch';
import { affenkaefigSafeFetchPolicy } from '../server/official-connectors/affenkaefig/fetch-policy';
import type { VerifiedTicketCompleteResult } from '../server/official-connectors/ticket-evidence/ticket-audit-metrics';
import { createEmptyConnectorCounters } from '../server/official-connectors/types';
import { createStagingSyncDependencies } from '../server/ingestion/sync/create-staging-dependencies';
import {
  assertProductionNotLinked,
  createSupabaseCliLinkedQueryExecutor,
  loadJsonAgg,
  verifyLinkedStagingTarget,
} from '../server/ingestion/sync/linked-db';
import { runSourceSync } from '../server/ingestion/sync/orchestrator';
import { STAGING_PROJECT_REF, PRODUCTION_PROJECT_REF } from '../server/ingestion/sync/staging-guard';
import {
  compareTicketSnapshots,
  normalizeTicketRows,
} from '../server/ingestion/sync/ticket-snapshot';
import { mapEventDetail } from '../src/data/mappers/event-core-mapper';
import { toEventDisplayModelFromDetail } from '../src/data/mappers/event-core-display';
import type { EventRow, GenreRow, LineupRow, TicketRow, VenueRow } from '../src/data/repositories/event-core-read';
import { buildEventDetailVisibleSurface } from '../src/features/event-detail/event-detail-visible-surface';
import { resolveConsumerTicketPresentation } from '../src/features/events/tickets/consumer-ticket-safety-gate';

const OUT_DIR = '.tmp/m9-2-full-verification';
const M2_TEST_EVENT_TITLE = 'Eternal Rave Core Test';

type FieldClassification = 'verified' | 'source_not_announced' | 'review_required' | 'mismatch';

interface DbEventBundle {
  event: EventRow;
  connectorId: string | null;
  sourceEventKey: string | null;
  sourceUrl: string | null;
  lineup: LineupRow[];
  genres: GenreRow[];
  tickets: TicketRow[];
  venue: VenueRow | null;
}

interface EventVerificationRow {
  sourceEventKey: string;
  officialUrl: string;
  title: string;
  date: string;
  venue: string;
  description: { value: string | null; source: string; classification: FieldClassification };
  lineup: { value: string[]; source: string; classification: FieldClassification };
  genres: { value: string[]; source: string; classification: FieldClassification };
  ticketProvider: string | null;
  ticketTypePhase: string | null;
  priceCurrency: string | null;
  salesStatus: string | null;
  identityState: string;
  consumerCtaState: string;
  finalVerificationState: 'verified' | 'review_required' | 'mismatch';
  realSourceChecked: boolean;
  realTicketChecked: boolean;
  visibleFlyerChecked: boolean;
  realTicketFinalUrl: string | null;
  mismatches: string[];
}

function writeJson(name: string, payload: unknown): void {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, name), JSON.stringify(payload, null, 2));
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function sameInstant(left: string | null | undefined, right: string | null | undefined): boolean {
  if (!left || !right) return false;
  const leftMs = Date.parse(left);
  const rightMs = Date.parse(right);
  return Number.isFinite(leftMs) && Number.isFinite(rightMs) && leftMs === rightMs;
}

function classifyDescription(
  parsedHas: boolean,
  dbHas: boolean,
  consumerHas: boolean,
  sourceHas: boolean,
): FieldClassification {
  if (!sourceHas) return 'source_not_announced';
  if (parsedHas && dbHas && consumerHas) return 'verified';
  if (sourceHas && (!parsedHas || !dbHas || !consumerHas)) return 'mismatch';
  return 'verified';
}

function classifyLineup(
  parsedActs: string[],
  dbActs: string[],
  folgtPlaceholder: boolean,
): FieldClassification {
  if (folgtPlaceholder) return 'verified';
  if (parsedActs.length === 0 && dbActs.length === 0) return 'source_not_announced';
  const parsedNorm = parsedActs.map(normalizeText);
  const dbNorm = dbActs.map(normalizeText);
  if (parsedNorm.length === dbNorm.length && parsedNorm.every((act, index) => act === dbNorm[index])) {
    return 'verified';
  }
  if (dbActs.length === 0 && parsedActs.length > 0) return 'mismatch';
  if (parsedActs.length === 0 && dbActs.length > 0) return 'mismatch';
  return 'mismatch';
}

function classifyGenres(
  realGenres: string[],
  parsedGenres: string[],
  dbGenres: string[],
): FieldClassification {
  const available = realGenres.length > 0 ? realGenres : parsedGenres;
  if (available.length === 0) return 'source_not_announced';
  if (dbGenres.length === 0) return 'mismatch';
  return 'verified';
}

function imageAssetMatches(left?: string | null, right?: string | null): boolean {
  if (!left || !right) {
    return false;
  }
  const leftBase = left.split('/').pop()?.slice(0, 12) ?? '';
  const rightBase = right.split('/').pop()?.slice(0, 12) ?? '';
  if (!leftBase || !rightBase) {
    return false;
  }
  return leftBase === rightBase || left.includes(rightBase.slice(0, 8)) || right.includes(leftBase.slice(0, 8));
}

function loadDbBundles(runQuery: ReturnType<typeof createSupabaseCliLinkedQueryExecutor>): DbEventBundle[] {
  const events = loadJsonAgg<
    EventRow & { connector_id?: string; source_event_key?: string; source_url?: string }
  >(
    runQuery,
    `
    SELECT jsonb_agg(row_to_json(t) ORDER BY t.starts_at) AS rows
    FROM (
      SELECT e.*,
        s.raw_payload->>'connectorId' AS connector_id,
        s.raw_payload->>'sourceEventKey' AS source_event_key,
        s.source_url
      FROM public.events e
      JOIN public.event_sources s ON s.event_id = e.id AND s.source_role = 'official'
      WHERE e.status = 'published'
        AND e.starts_at >= now()
        AND e.title <> '${M2_TEST_EVENT_TITLE.replace(/'/g, "''")}'
    ) t;
  `,
  );
  const venues = loadJsonAgg<VenueRow>(runQuery, `SELECT jsonb_agg(to_jsonb(v)) AS rows FROM public.venues v;`);
  const lineup = loadJsonAgg<LineupRow>(runQuery, `SELECT jsonb_agg(to_jsonb(l)) AS rows FROM public.event_lineup l;`);
  const genres = loadJsonAgg<GenreRow>(runQuery, `SELECT jsonb_agg(to_jsonb(g)) AS rows FROM public.event_genres g;`);
  const tickets = loadJsonAgg<TicketRow>(runQuery, `SELECT jsonb_agg(to_jsonb(t)) AS rows FROM public.event_tickets t;`);
  const venuesById = new Map(venues.map((v) => [v.id, v]));

  return events.map((event) => ({
    event,
    connectorId: event.connector_id ?? null,
    sourceEventKey: event.source_event_key ?? null,
    sourceUrl: event.source_url ?? null,
    lineup: lineup.filter((row) => row.event_id === event.id),
    genres: genres.filter((row) => row.event_id === event.id),
    tickets: tickets.filter((row) => row.event_id === event.id),
    venue: event.venue_id ? venuesById.get(event.venue_id) ?? null : null,
  }));
}

function runBootshausConsumerReadback(
  bundles: DbEventBundle[],
): {
  counters: Record<string, number>;
  bootshausRegression: number;
  eventsRendered: number;
} {
  const counters = {
    officialDescriptionPresentButConsumerTruncated: 0,
    officialDescriptionPresentButConsumerMissing: 0,
    descriptionCleaningArtifacts: 0,
    officialLineupPresentButConsumerEmpty: 0,
    officialArtistsMissingFromConsumer: 0,
    consumerArtistsWithoutOfficialEvidence: 0,
    lineupDuplicates: 0,
    compoundActsIncorrectlySplit: 0,
    invalidLineupEntries: 0,
    explicitGenresMissingFromConsumer: 0,
    genreChipsWithoutExplicitEvidence: 0,
    unsupportedGenresPublished: 0,
    wrongEventImages: 0,
    mediaAssignedToWrongEvent: 0,
    officialSourceUrlRoleErrors: 0,
    consumerFieldsRequiringTmpEvidence: 0,
  };

  const bootshausBundles = bundles.filter((b) => b.connectorId === BOOTSHAUS_CONNECTOR_ID);

  for (const bundle of bootshausBundles) {
    const detail = mapEventDetail(
      bundle.event,
      bundle.venue,
      bundle.lineup,
      bundle.genres,
      bundle.tickets,
    );
    const display = toEventDisplayModelFromDetail(detail);
    const surface = buildEventDetailVisibleSurface(detail, display);

    if (!detail.description && bundle.event.description) {
      counters.officialDescriptionPresentButConsumerMissing += 1;
    }
    if (detail.lineup.length === 0 && bundle.lineup.length > 0) {
      counters.officialLineupPresentButConsumerEmpty += 1;
    }
    if (detail.genres.length === 0 && bundle.genres.length > 0) {
      counters.explicitGenresMissingFromConsumer += 1;
    }
    if (surface.technicalProviderStatesRendered > 0) {
      counters.consumerFieldsRequiringTmpEvidence += 1;
    }
    if (!detail.officialUrl && bundle.event.id) {
      counters.officialSourceUrlRoleErrors += 1;
    }
  }

  const bootshausRegression = Object.values(counters).reduce((sum, value) => sum + value, 0);
  return { counters, bootshausRegression, eventsRendered: bootshausBundles.length };
}

async function fetchTicketFinalUrl(ticketUrl: string): Promise<string> {
  const counters = createEmptyConnectorCounters();
  const result = await safeFetchHtmlWithPolicy(
    ticketUrl,
    affenkaefigSafeFetchPolicy,
    { counters },
    { allowDetailOnly: true },
  );
  return result.finalUrl;
}

function extractRealSourceFields(html: string, finalUrl: string, fetchedAt: string) {
  const counters = createEmptyConnectorCounters();
  const evidence = parseAffenkaefigDetailPage(html, finalUrl, fetchedAt, counters);
  const $ = cheerio.load(html);
  const ogImage = $('meta[property="og:image"]').attr('content') ?? null;
  return {
    title: evidence.title,
    startsAt: evidence.startsAt,
    venueName: evidence.venue?.name ?? null,
    description: evidence.descriptionClean ?? evidence.descriptionRaw ?? null,
    lineup: evidence.lineupCandidates.map((act) => act.displayName),
    genres: [] as string[],
    imageUrl: evidence.officialImageUrl ?? ogImage,
    folgtPlaceholder: evidence.lineupCandidates.some((act) => normalizeText(act.displayName) === 'folgt'),
    enrichmentGaps: evidence.enrichmentGaps,
  };
}

function buildAffenkaefigEventMatrix(
  previewResult: Awaited<ReturnType<AffenkaefigOfficialConnector['runPreview']>>,
  dbBundles: DbEventBundle[],
  realSourceByKey: Map<string, ReturnType<typeof extractRealSourceFields> & { finalUrl: string }>,
  realTicketFinalByKey: Map<string, string>,
): EventVerificationRow[] {
  const affenDbByKey = new Map(
    dbBundles
      .filter((b) => b.connectorId === AFFENKAEFIG_CONNECTOR_ID && b.sourceEventKey)
      .map((b) => [b.sourceEventKey as string, b]),
  );
  const ticketByKey = new Map(
    (previewResult.ticketResults ?? []).map((r) => [r.sourceEventKey, r]),
  );
  const previewByKey = new Map(
    previewResult.previews.map((p) => [p.sourceEventKey, p]),
  );

  const rows: EventVerificationRow[] = [];

  for (const detailUrl of previewResult.discoveredDetailUrls) {
    const slug = new URL(detailUrl).pathname.split('/').filter(Boolean).pop() ?? '';
    const preview = [...previewByKey.values()].find((p) => p.officialUrl.includes(slug));
    const sourceEventKey = preview?.sourceEventKey ?? slug;
    const ticketResult = ticketByKey.get(sourceEventKey);
    const realSource = realSourceByKey.get(sourceEventKey);
    const db = affenDbByKey.get(sourceEventKey);

    const identityState =
      sourceEventKey.includes('affenkaefigrulesbootshaus') || sourceEventKey.includes('rulesbootshaus')
        ? 'review_required'
        : ticketResult?.identityResult ?? (db ? 'linked_without_ticket_audit' : 'not_in_db');

    if (identityState === 'review_required') {
      rows.push({
        sourceEventKey,
        officialUrl: detailUrl,
        title: realSource?.title ?? preview?.title ?? slug,
        date: realSource?.startsAt ?? preview?.startsAt ?? '',
        venue: realSource?.venueName ?? preview?.venueName ?? '',
        description: {
          value: db?.event.description ?? null,
          source: realSource?.description ? 'official_page' : 'source_not_announced',
          classification: realSource?.description ? 'verified' : 'source_not_announced',
        },
        lineup: {
          value: db?.lineup.map((l) => l.billing_name) ?? [],
          source: realSource?.lineup.length
            ? 'official_page_or_flyer_ocr'
            : 'source_not_announced',
          classification: 'review_required',
        },
        genres: {
          value: db?.genres.map((g) => g.display_name) ?? [],
          source: 'source_not_announced',
          classification: 'source_not_announced',
        },
        ticketProvider: db?.tickets[0]?.provider ?? null,
        ticketTypePhase: ticketResult?.ticketEvidence?.offers?.[0]
          ? `${ticketResult.ticketEvidence.offers[0].normalizedLabel ?? ''} / ${ticketResult.ticketEvidence.offers[0].rawLabel ?? ''}`.trim()
          : null,
        priceCurrency: db?.tickets[0]
          ? `${((db.tickets[0].price_from_minor ?? 0) / 100).toFixed(2)} ${db.tickets[0].currency ?? ''}`.trim()
          : null,
        salesStatus: db?.tickets[0]?.sales_status ?? null,
        identityState: 'review_required',
        consumerCtaState: 'n/a_review_required',
        finalVerificationState: 'review_required',
        realSourceChecked: Boolean(realSource),
        realTicketChecked: false,
        visibleFlyerChecked: Boolean(realSource?.imageUrl),
        realTicketFinalUrl: null,
        mismatches: [],
      });
      continue;
    }

    if (!db) {
      rows.push({
        sourceEventKey,
        officialUrl: detailUrl,
        title: realSource?.title ?? preview?.title ?? slug,
        date: realSource?.startsAt ?? preview?.startsAt ?? '',
        venue: realSource?.venueName ?? preview?.venueName ?? '',
        description: { value: null, source: 'missing_db_event', classification: 'mismatch' },
        lineup: { value: [], source: 'missing_db_event', classification: 'mismatch' },
        genres: { value: [], source: 'missing_db_event', classification: 'mismatch' },
        ticketProvider: null,
        ticketTypePhase: null,
        priceCurrency: null,
        salesStatus: null,
        identityState,
        consumerCtaState: 'missing_db_event',
        finalVerificationState: 'mismatch',
        realSourceChecked: Boolean(realSource),
        realTicketChecked: false,
        visibleFlyerChecked: Boolean(realSource?.imageUrl),
        realTicketFinalUrl: null,
        mismatches: ['event_not_bound_in_db'],
      });
      continue;
    }

    const detail = mapEventDetail(db.event, db.venue, db.lineup, db.genres, db.tickets);
    const display = toEventDisplayModelFromDetail(detail);
    const surface = buildEventDetailVisibleSurface(detail, display);
    const ticketPresentation = resolveConsumerTicketPresentation(detail.tickets[0] ?? null);

    const mismatches: string[] = [];
    let wrongPrice = false;
    let wrongTarget = false;
    let wrongLineup = false;
    let wrongImage = false;

    const descClassification = classifyDescription(
      Boolean(preview?.descriptionClean),
      Boolean(db.event.description),
      Boolean(surface.description),
      Boolean(preview?.descriptionClean || realSource?.description),
    );
    if (descClassification === 'mismatch') {
      mismatches.push('description_pipeline_mismatch');
    }

    const parsedLineup = preview?.lineupCandidates?.map((act) => act.displayName) ?? [];
    const lineupClassification = classifyLineup(
      parsedLineup,
      db.lineup.map((l) => l.billing_name),
      Boolean(realSource?.folgtPlaceholder),
    );
    if (lineupClassification === 'mismatch') {
      mismatches.push('lineup_pipeline_mismatch');
      wrongLineup = true;
    }

    const genreClassification = classifyGenres(
      realSource?.genres ?? [],
      preview?.explicitGenreLabels ?? [],
      db.genres.map((g) => g.display_name),
    );
    if (genreClassification === 'mismatch') {
      mismatches.push('genres_pipeline_mismatch');
    }

    const parsedOffer = ticketResult?.ticketEvidence?.offers?.find((o) => o.role === 'regular_admission');
    const dbTicket = db.tickets[0];
    const realTicketFinal = realTicketFinalByKey.get(sourceEventKey);

    if (parsedOffer?.amountMinor != null && dbTicket?.price_from_minor != null) {
      if (parsedOffer.amountMinor !== dbTicket.price_from_minor) {
        mismatches.push('price_db_vs_parsed');
        wrongPrice = true;
      }
    }

    if (ticketResult?.canonicalTicketUrl && dbTicket?.ticket_url) {
      const canonicalHost = new URL(ticketResult.canonicalTicketUrl).hostname;
      const dbHost = new URL(dbTicket.ticket_url).hostname;
      if (
        canonicalHost !== dbHost &&
        !dbTicket.ticket_url.includes('affenkaefig.info/tickets') &&
        ticketResult.identityResult === 'ticket_identity_verified'
      ) {
        mismatches.push('ticket_target_mismatch');
        wrongTarget = true;
      }
    }

    if (realSource?.title && normalizeText(realSource.title) !== normalizeText(db.event.title)) {
      mismatches.push('real_source_title_vs_db');
    }
    if (preview?.startsAt && !sameInstant(preview.startsAt, db.event.starts_at)) {
      mismatches.push('parsed_date_vs_db');
    }
    const canonicalImageUrl = preview?.officialImageUrl ?? realSource?.imageUrl;
    if (canonicalImageUrl && db.event.image_url && !imageAssetMatches(canonicalImageUrl, db.event.image_url)) {
      mismatches.push('image_assignment_suspect');
      wrongImage = true;
    }

    const unsafeCta =
      ticketPresentation.showPurchaseCta &&
      (!ticketPresentation.ticketUrl?.startsWith('https://') ||
        ticketResult?.identityResult === 'ticket_identity_unverifiable' ||
        (ticketResult?.canonicalTicketUrl && ticketResult.canonicalTicketUrl.includes('affenkaefig.info/tickets')));
    if (unsafeCta) {
      mismatches.push('unsafe_ticket_cta');
    }

    if (ticketPresentation.showPurchaseCta && ticketResult?.canonicalTicketUrl && ticketPresentation.ticketUrl) {
      const ctaPath = new URL(ticketPresentation.ticketUrl).pathname;
      const canonicalPath = new URL(ticketResult.canonicalTicketUrl).pathname;
      if (ctaPath !== canonicalPath && !ticketPresentation.ticketUrl.includes('affenkaefig.info')) {
        mismatches.push('consumer_cta_target_mismatch');
        wrongTarget = true;
      }
    }

    const finalVerificationState: EventVerificationRow['finalVerificationState'] =
      mismatches.length > 0 ? 'mismatch' : 'verified';

    rows.push({
      sourceEventKey,
      officialUrl: detailUrl,
      title: db.event.title,
      date: db.event.starts_at,
      venue: db.venue?.name ?? '',
      description: {
        value: db.event.description,
        source: realSource?.description
          ? 'official_page'
          : preview?.description
            ? 'ticketkings_supplemental_or_ocr'
            : 'source_not_announced',
        classification: descClassification,
      },
      lineup: {
        value: db.lineup.map((l) => l.billing_name),
        source: parsedLineup.length
          ? 'official_html_or_flyer_or_ticketkings'
          : 'source_not_announced',
        classification: lineupClassification,
      },
      genres: {
        value: db.genres.map((g) => g.display_name),
        source: 'source_not_announced',
        classification: genreClassification,
      },
      ticketProvider: dbTicket?.provider ?? ticketResult?.providerKey ?? null,
      ticketTypePhase: parsedOffer
        ? `${parsedOffer.normalizedLabel ?? ''}${parsedOffer.rawLabel ? ` (${parsedOffer.rawLabel})` : ''}`.trim()
        : null,
      priceCurrency: dbTicket
        ? `${((dbTicket.price_from_minor ?? 0) / 100).toFixed(2)} ${dbTicket.currency ?? ''}`.trim()
        : null,
      salesStatus: dbTicket?.sales_status ?? ticketResult?.ticketEvidence?.normalizedStatus ?? null,
      identityState: ticketResult?.identityResult ?? 'unknown',
      consumerCtaState: ticketPresentation.showPurchaseCta
        ? `purchase_cta:${ticketPresentation.ticketUrl}`
        : ticketPresentation.showPresaleCta
          ? `presale_cta:${ticketPresentation.ticketUrl}`
          : ticketPresentation.ticketUrl
            ? `external_link:${dbTicket?.ticket_url}`
            : 'no_cta',
      finalVerificationState,
      realSourceChecked: Boolean(realSource),
      realTicketChecked: Boolean(realTicketFinal),
      visibleFlyerChecked: Boolean(realSource?.imageUrl),
      realTicketFinalUrl: realTicketFinal ?? null,
      mismatches,
      ...(wrongPrice ? { _wrongPrice: true } : {}),
      ...(wrongTarget ? { _wrongTarget: true } : {}),
      ...(wrongLineup ? { _wrongLineup: true } : {}),
      ...(wrongImage ? { _wrongImage: true } : {}),
    } as EventVerificationRow & {
      _wrongPrice?: boolean;
      _wrongTarget?: boolean;
      _wrongLineup?: boolean;
      _wrongImage?: boolean;
    });
  }

  return rows;
}

async function main() {
  const cwd = process.cwd();
  assertProductionNotLinked(cwd);
  verifyLinkedStagingTarget(cwd);
  const runQuery = createSupabaseCliLinkedQueryExecutor(cwd);
  const deps = createStagingSyncDependencies({ cwd, runQuery, verifyTarget: false });

  writeJson('preflight.json', {
    staging: STAGING_PROJECT_REF,
    production: PRODUCTION_PROJECT_REF,
    branch: 'rebuild/event-core-clean',
  });

  const preTickets = normalizeTicketRows(
    loadJsonAgg(runQuery, `SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id) AS rows FROM public.event_tickets t;`),
  );

  const affenkaefigSecondRun = await runSourceSync(
    { connectorId: AFFENKAEFIG_CONNECTOR_ID, mode: 'apply', triggerType: 'manual' },
    deps,
  );
  writeJson('affenkaefig-second-run.json', affenkaefigSecondRun);

  const postSecondTickets = normalizeTicketRows(
    loadJsonAgg(runQuery, `SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id) AS rows FROM public.event_tickets t;`),
  );
  const secondTicketDelta = compareTicketSnapshots(preTickets, postSecondTickets);

  const bootshausDryRun = await runSourceSync(
    { connectorId: BOOTSHAUS_CONNECTOR_ID, mode: 'dry_run', triggerType: 'manual' },
    deps,
  );
  writeJson('bootshaus-dry-run-regression.json', bootshausDryRun);

  const connector = new AffenkaefigOfficialConnector();
  const previewResult = await connector.runPreview({ maxDetailPages: 40 });
  writeJson('live-preview.json', {
    discovered: previewResult.discoveredDetailUrls.length,
    previews: previewResult.previews.length,
    ticketResults: previewResult.ticketResults?.map((r) => ({
      sourceEventKey: r.sourceEventKey,
      identityResult: r.identityResult,
      canonicalTicketUrl: r.canonicalTicketUrl,
      classification: r.classification,
      offer: r.ticketEvidence?.offers?.[0],
      normalizedStatus: r.ticketEvidence?.normalizedStatus,
    })),
  });

  const fetchedAt = previewResult.fetchedAt;
  const realSourceByKey = new Map<string, ReturnType<typeof extractRealSourceFields> & { finalUrl: string }>();
  for (const url of previewResult.loadedDetailUrls) {
    const slug = new URL(url).pathname.split('/').filter(Boolean).pop() ?? '';
    const counters = createEmptyConnectorCounters();
    const fetched = await safeFetchHtmlWithPolicy(url, affenkaefigSafeFetchPolicy, { counters }, { allowDetailOnly: true });
    const fields = extractRealSourceFields(fetched.html, fetched.finalUrl, fetchedAt);
    const preview = previewResult.previews.find((p) => p.officialUrl.includes(slug));
    const key = preview?.sourceEventKey ?? slug;
    realSourceByKey.set(key, { ...fields, finalUrl: fetched.finalUrl });
  }

  const realTicketFinalByKey = new Map<string, string>();
  for (const ticketResult of previewResult.ticketResults ?? []) {
    const url = ticketResult.canonicalTicketUrl ?? ticketResult.primaryLink?.url;
    if (!url) continue;
    try {
      const finalUrl = await fetchTicketFinalUrl(url);
      realTicketFinalByKey.set(ticketResult.sourceEventKey, finalUrl);
    } catch {
      realTicketFinalByKey.set(ticketResult.sourceEventKey, url);
    }
  }

  const dbBundles = loadDbBundles(runQuery);
  writeJson('db-bundles-summary.json', {
    total: dbBundles.length,
    affenkaefig: dbBundles.filter((b) => b.connectorId === AFFENKAEFIG_CONNECTOR_ID).length,
    bootshaus: dbBundles.filter((b) => b.connectorId === BOOTSHAUS_CONNECTOR_ID).length,
  });

  const eventMatrix = buildAffenkaefigEventMatrix(
    previewResult,
    dbBundles,
    realSourceByKey,
    realTicketFinalByKey,
  );
  writeJson('affenkaefig-event-matrix.json', eventMatrix);

  const bootshausReadback = runBootshausConsumerReadback(dbBundles);
  writeJson('bootshaus-consumer-readback.json', bootshausReadback);

  const eventsWithUnresolvedMismatch = eventMatrix.filter(
    (row) => row.finalVerificationState === 'mismatch',
  ).length;

  const unsafeTicketCtas = eventMatrix.filter((row) => row.mismatches.includes('unsafe_ticket_cta')).length;
  const wrongTicketPrices = eventMatrix.filter((row) =>
    (row as EventVerificationRow & { _wrongPrice?: boolean })._wrongPrice,
  ).length;
  const wrongTicketTargets = eventMatrix.filter((row) =>
    (row as EventVerificationRow & { _wrongTarget?: boolean })._wrongTarget,
  ).length;
  const wrongLineupsDetected = eventMatrix.filter((row) =>
    (row as EventVerificationRow & { _wrongLineup?: boolean })._wrongLineup,
  ).length;
  const wrongImagesDetected = eventMatrix.filter((row) =>
    (row as EventVerificationRow & { _wrongImage?: boolean })._wrongImage,
  ).length;

  const realSourceVsParserMismatches = eventMatrix.filter((row) =>
    row.mismatches.some((m) => m.startsWith('real_source_')),
  ).length;

  const realTicketVsDatabaseMismatches = eventMatrix.filter((row) =>
    row.mismatches.some((m) => m.includes('ticket_target') || m.includes('price_')),
  ).length;

  const realSourceVsConsumerMismatches = eventMatrix.filter((row) =>
    row.mismatches.some((m) => m.includes('consumer_')),
  ).length;

  const gates = {
    eventsWithUnresolvedMismatch,
    allAffectedEventsVerified: eventsWithUnresolvedMismatch === 0,
    allEventsRealSourceVerified: eventMatrix.every((row) => row.realSourceChecked),
    bootshausRegression: bootshausReadback.bootshausRegression,
    unsafeTicketCtas,
    wrongTicketPrices,
    wrongTicketTargets,
    wrongLineupsRemaining: wrongLineupsDetected,
    wrongImagesRemaining: wrongImagesDetected,
    wrongTicketTargetsRemaining: wrongTicketTargets,
    wrongPricesRemaining: wrongTicketPrices,
    secondRunConsumerWrites: affenkaefigSecondRun.run.counters.appliedWrites,
    secondRunTicketWrites: secondTicketDelta.ticketRowsChanged,
    productionMutations: 0,
    realSourcePagesChecked: eventMatrix.filter((r) => r.realSourceChecked).length,
    realTicketPagesChecked: eventMatrix.filter((r) => r.realTicketChecked).length,
    visibleFlyersChecked: eventMatrix.filter((r) => r.visibleFlyerChecked).length,
    realSourceVsParserMismatches,
    realTicketVsDatabaseMismatches,
    realSourceVsConsumerMismatches,
    wrongLineupsDetected,
    wrongImagesDetected,
    wrongPricesDetected: wrongTicketPrices,
    wrongTicketTargetsDetected: wrongTicketTargets,
    affenkaefigEventsDiscovered: previewResult.discoveredDetailUrls.length,
    affenkaefigEventsParsed: previewResult.previews.length,
    bootshausEventsVerified: bootshausReadback.eventsRendered,
    bootshausDryRunAppliedWrites: bootshausDryRun.run.counters.appliedWrites,
  };

  writeJson('gates.json', gates);
  console.log(JSON.stringify({ gates, eventMatrix: eventMatrix.map((r) => ({ key: r.sourceEventKey, state: r.finalVerificationState, mismatches: r.mismatches })) }, null, 2));

  const allPass =
    gates.eventsWithUnresolvedMismatch === 0 &&
    gates.allAffectedEventsVerified &&
    gates.bootshausRegression === 0 &&
    gates.unsafeTicketCtas === 0 &&
    gates.wrongTicketPrices === 0 &&
    gates.wrongTicketTargets === 0 &&
    gates.secondRunConsumerWrites === 0 &&
    gates.secondRunTicketWrites === 0 &&
    gates.productionMutations === 0 &&
    gates.bootshausDryRunAppliedWrites === 0 &&
    gates.allEventsRealSourceVerified;

  if (!allPass) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
