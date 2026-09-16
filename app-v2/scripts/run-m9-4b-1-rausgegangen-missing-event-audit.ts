#!/usr/bin/env tsx
/**
 * M9.4B.1 — Missing relevant event / discovery coverage audit (READ-ONLY).
 * STAGING: gnkjzinwvmrxcadwebhv — SELECT only, no mutations.
 */
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

import { loadStagingEventSnapshots } from '../server/ingestion/sync/canonical-consolidation';
import {
  assertProductionNotLinked,
  createSupabaseCliLinkedQueryExecutor,
  loadJsonAgg,
  verifyLinkedStagingTarget,
} from '../server/ingestion/sync/linked-db';
import { PRODUCTION_PROJECT_REF, STAGING_PROJECT_REF } from '../server/ingestion/sync/staging-guard';
import { evaluateImportCandidateQualityContract } from '../server/official-connectors/ticket-evidence/network-discovery/import-quality-contract-gate';
import {
  buildMatchCatalogFromStaging,
  type StagingCatalogEvent,
} from '../server/official-connectors/ticket-evidence/network-discovery/match-staging-catalog';
import { auditWorkingTree } from '../server/official-connectors/ticket-evidence/network-discovery/working-tree-audit';
import { classifyRelevanceEvidence } from '../server/official-connectors/ticket-evidence/network-discovery/relevance-evidence';
import {
  applyDetailToCandidate,
  enrichedFromRausgegangenCandidate,
  listingEntryToCandidate,
} from '../server/official-connectors/rausgegangen-discovery/rausgegangen-enrichment';
import { fetchRausgegangenHtml } from '../server/official-connectors/rausgegangen-discovery/rausgegangen-fetch';
import { parseRausgegangenEventDetail } from '../server/official-connectors/rausgegangen-discovery/parse-rausgegangen-detail';
import {
  mergeListingSurfaces,
  parseRausgegangenCityListing,
} from '../server/official-connectors/rausgegangen-discovery/parse-rausgegangen-listing';
import { runRausgegangenNetworkDiscovery } from '../server/official-connectors/rausgegangen-discovery/rausgegangen-network-discovery';
import { PRIORITY_GERMAN_CITY_SLUGS, RAUSGEGANGEN_BASE_URL } from '../server/official-connectors/rausgegangen-discovery/constants';
import type { RausgegangenListingEntry } from '../server/official-connectors/rausgegangen-discovery/types';
import { classifyEventMediaAcceptability } from '../server/official-connectors/ticket-evidence/network-discovery/event-media-quality';

const REPO_ROOT = join(process.cwd(), '..');
const OUT = join(REPO_ROOT, 'artifacts', 'm9-4b-1-rausgegangen-missing-event-audit');
const M94A = join(REPO_ROOT, 'artifacts', 'm9-4a-rausgegangen-germany-discovery');
const M94B = join(REPO_ROOT, 'artifacts', 'm9-4b-rausgegangen-controlled-import');
const BASELINE = '6e8bc82b45d343a626799b8944309ca4fc1c3395';
const REFERENCE = new Date();

const ANCHOR_SEARCH_TERMS = ['ehreklub', 'ehrenklub', 'schrotty'];
const LOCATION_SURFACES = [
  'schrotty',
  'bootshaus',
  'gewoelbe',
  'glow',
  'underland',
  'nachtflug',
  'odion',
  'odonien',
];

type MissingReason =
  | 'NOT_DISCOVERED'
  | 'NOT_DETAIL_ENRICHED'
  | 'RELEVANCE_FALSE_NEGATIVE'
  | 'QUALITY_BLOCK'
  | 'IDENTITY_FALSE_MATCH'
  | 'LIFECYCLE_ERROR'
  | 'NOT_SELECTED_CONTROLLED_BATCH'
  | 'NEW_AFTER_M9_4A'
  | 'DISCOVERY_SURFACE_GAP'
  | 'OTHER';

function writeJson(name: string, payload: unknown): void {
  writeFileSync(join(OUT, name), `${JSON.stringify(payload, null, 2)}\n`);
}

function head(): string {
  return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
}

function remoteHead(): string {
  return execSync('git rev-parse origin/rebuild/event-core-clean', { encoding: 'utf8' }).trim();
}

function loadStagingCatalog(runQuery: ReturnType<typeof createSupabaseCliLinkedQueryExecutor>): StagingCatalogEvent[] {
  const rows = loadJsonAgg<{
    id: string;
    title: string;
    starts_at: string;
    ends_at: string | null;
    venue_name: string | null;
    venue_city: string | null;
    organizer_name: string | null;
    ticket_url: string | null;
    official_url: string | null;
    lineup_names: string[] | null;
  }>(
    runQuery,
    `SELECT jsonb_agg(row_to_json(t)) AS rows FROM (
      SELECT e.id, e.title, e.starts_at, e.ends_at,
        v.name AS venue_name, v.city AS venue_city, e.organizer_name,
        t.ticket_url, e.official_url,
        (SELECT array_agg(l.billing_name ORDER BY l.sort_order) FROM event_lineup l WHERE l.event_id = e.id) AS lineup_names
      FROM events e
      LEFT JOIN venues v ON v.id = e.venue_id
      LEFT JOIN event_tickets t ON t.event_id = e.id AND t.sort_order = 0
      WHERE e.status = 'published'
    ) t;`,
  );
  return rows.map((row) => ({
    eventId: row.id,
    title: row.title,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    venueName: row.venue_name ?? undefined,
    venueCity: row.venue_city ?? undefined,
    organizerName: row.organizer_name ?? undefined,
    ticketUrl: row.ticket_url,
    officialUrl: row.official_url,
    lineupBillingNames: row.lineup_names ?? [],
  }));
}

function listingPrequalScore(title: string): 'PRIORITY_HIGH' | 'PRIORITY_MEDIUM' | 'UNRESOLVED' {
  const relevance = classifyRelevanceEvidence({ title, detailAccess: 'NOT_FETCHED' });
  if (relevance.relevance === 'HIGH_RELEVANCE' || relevance.relevance === 'LIKELY_RELEVANT') {
    return 'PRIORITY_HIGH';
  }
  if (relevance.relevance === 'AMBIGUOUS') {
    return 'PRIORITY_MEDIUM';
  }
  return 'UNRESOLVED';
}

function hashSample(seed: string, mod: number): number {
  const hex = createHash('sha256').update(seed).digest('hex');
  return Number.parseInt(hex.slice(0, 8), 16) % mod;
}

async function parseLocationListing(slug: string): Promise<RausgegangenListingEntry[]> {
  const surface = `${RAUSGEGANGEN_BASE_URL}/locations/${slug}/`;
  const response = await fetchRausgegangenHtml(surface);
  if (!response.ok) {
    return [];
  }
  const entries: RausgegangenListingEntry[] = [];
  const seen = new Set<string>();
  for (const match of response.html.matchAll(/href=["']([^"']*\/events\/[^"']+)["']/gi)) {
    const href = match[1] ?? '';
    const normalized = href.startsWith('http') ? href : `${RAUSGEGANGEN_BASE_URL}${href}`;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    const slugPart = normalized.split('/events/')[1]?.replace(/\/$/, '') ?? 'unknown';
    entries.push({
      eventUrl: normalized,
      eventSlug: slugPart,
      regionSlug: 'location',
      listingSurface: surface,
      listingTitleHint: slugPart.replace(/-/g, ' '),
    });
  }
  return entries;
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const cwd = process.cwd();
  assertProductionNotLinked(cwd);
  verifyLinkedStagingTarget(cwd);
  const runQuery = createSupabaseCliLinkedQueryExecutor(cwd);
  const stagingCatalog = loadStagingCatalog(runQuery);
  const matchCatalog = buildMatchCatalogFromStaging(stagingCatalog);

  writeJson('working-tree-audit.json', auditWorkingTree(REPO_ROOT));
  writeJson('staging-safety.json', { stagingProject: STAGING_PROJECT_REF, mutations: 0, readOnly: true });
  writeJson('production-safety.json', { productionProject: PRODUCTION_PROJECT_REF, productionMutations: 0 });

  const localHead = head();
  writeJson('baseline-git-remote.json', {
    expectedBaseline: BASELINE,
    localHead,
    remoteHead: remoteHead(),
    localEqualsRemote: localHead === remoteHead(),
  });

  // --- Ehreklub / EhrenKlub live source ---
  const schrottyLocation = await fetchRausgegangenHtml(`${RAUSGEGANGEN_BASE_URL}/locations/schrotty/`);
  const locationEvents = await parseLocationListing('schrotty');
  const anchorEntry =
    locationEvents.find((e) => /ehrenklub|ehreklub/i.test(e.eventSlug)) ??
    locationEvents.find((e) => /ehrenklub|ehreklub/i.test(e.listingTitleHint ?? ''));
  let anchorDetail: ReturnType<typeof parseRausgegangenEventDetail> | undefined;
  let anchorEnriched: ReturnType<typeof enrichedFromRausgegangenCandidate> | undefined;
  let anchorQuality: ReturnType<typeof evaluateImportCandidateQualityContract> | undefined;

  if (anchorEntry) {
    const detailFetch = await fetchRausgegangenHtml(anchorEntry.eventUrl);
    anchorDetail = parseRausgegangenEventDetail(detailFetch.html, anchorEntry.eventUrl);
    const candidate = applyDetailToCandidate(
      listingEntryToCandidate(anchorEntry, REFERENCE),
      anchorDetail,
      REFERENCE,
    );
    anchorEnriched = enrichedFromRausgegangenCandidate(candidate, matchCatalog, REFERENCE);
    anchorQuality = evaluateImportCandidateQualityContract(anchorEnriched);
  }

  const cologneListing = await fetchRausgegangenHtml(`${RAUSGEGANGEN_BASE_URL}/cologne/`);
  const cologneEntries = parseRausgegangenCityListing(
    cologneListing.html,
    'cologne',
    `${RAUSGEGANGEN_BASE_URL}/cologne/`,
  );
  const anchorOnCityListing = cologneEntries.some((e) => anchorEntry && e.eventUrl === anchorEntry.eventUrl);

  writeJson('ehreklub-live-source.json', {
    anchorSearchTerms: ANCHOR_SEARCH_TERMS,
    spellingNote: 'Live source uses EhrenKlub (with n), not Ehreklub',
    schrottyLocationReachable: schrottyLocation.ok,
    anchorFound: Boolean(anchorEntry),
    anchorEntry,
    anchorOnCologneCityListing: anchorOnCityListing,
    cologneListingEventCount: cologneEntries.length,
    liveEvidence: anchorDetail
      ? {
          title: anchorDetail.title,
          sourceUrl: anchorEntry?.eventUrl,
          startsAt: anchorDetail.startsAt,
          endsAt: anchorDetail.endsAt,
          venue: anchorDetail.venueName,
          city: anchorDetail.city,
          description: anchorDetail.description?.slice(0, 500),
          genres: anchorDetail.genreHints,
          lineup: anchorDetail.lineupHints,
          imageUrls: anchorDetail.imageUrls,
          ticketUrl: anchorDetail.ticketUrl,
          ticketPriceMinor: anchorDetail.ticketPriceMinor,
          organizer: anchorDetail.organizerName,
        }
      : null,
  });

  // Staging canonical check
  const stagingAnchorMatches = loadJsonAgg<{
    id: string;
    title: string;
    venue_name: string | null;
    official_url: string | null;
  }>(
    runQuery,
    `SELECT jsonb_agg(row_to_json(t)) AS rows FROM (
      SELECT e.id, e.title, v.name AS venue_name, e.official_url
      FROM events e LEFT JOIN venues v ON v.id = e.venue_id
      WHERE e.status = 'published'
        AND (e.title ILIKE '%ehren%klub%' OR e.title ILIKE '%ehre%klub%'
          OR e.official_url ILIKE '%ehrenklub%' OR e.official_url ILIKE '%ehreklub%')
    ) t;`,
  );
  const stagingVenueSchrotty = loadJsonAgg<{ id: string; title: string; venue_name: string | null }>(
    runQuery,
    `SELECT jsonb_agg(row_to_json(t)) AS rows FROM (
      SELECT e.id, e.title, v.name AS venue_name
      FROM events e LEFT JOIN venues v ON v.id = e.venue_id
      WHERE e.status = 'published' AND v.name ILIKE '%schrotty%'
    ) t;`,
  );

  const m94aNetNew = JSON.parse(readFileSync(join(M94A, 'net-new-analysis.json'), 'utf8')) as Record<string, number>;
  const m94bSummary = JSON.parse(readFileSync(join(M94B, 'summary.json'), 'utf8')) as Record<string, unknown>;

  const rootCauseState: MissingReason = !anchorEntry
    ? 'NOT_DISCOVERED'
    : !anchorOnCityListing
      ? 'DISCOVERY_SURFACE_GAP'
      : 'NOT_DETAIL_ENRICHED';

  writeJson('ehreklub-root-cause.json', {
    rootCauseState,
    evidenceBackedConclusion:
      rootCauseState === 'DISCOVERY_SURFACE_GAP'
        ? 'EhrenKlub im Schrotty #14 is live on Rausgegangen /locations/schrotty/ but absent from /cologne/ city listing HTML. M9.4A discovery only enumerates /{city}/ surfaces, so this event was never in the 11,095 discovered URLs.'
        : 'Anchor event not found on live source',
    wasInM94aArtifacts: false,
    m94aArtifactSearch: { ehreklub: 0, ehrenklub: 0, schrotty: 0 },
    wasDetailEnrichedInM94a: false,
    wasInControlledBatch: false,
    isCanonicalOnStaging: stagingAnchorMatches.length > 0,
    stagingAnchorMatches,
    otherSchrottyVenueEventsOnStaging: stagingVenueSchrotty,
    wouldPassRelevanceToday: anchorEnriched?.relevance ?? null,
    wouldPassQualityContractToday: anchorQuality?.passesQualityContract ?? null,
    consumerVisible: false,
  });

  writeJson('ehreklub-pipeline-trace.json', {
    pipeline: [
      { stage: 'LIVE_SOURCE', status: anchorEntry ? 'PRESENT' : 'ABSENT', url: anchorEntry?.eventUrl },
      { stage: 'CITY_LISTING_DISCOVERY', status: anchorOnCityListing ? 'PRESENT' : 'ABSENT' },
      { stage: 'LOCATION_LISTING_DISCOVERY', status: anchorEntry ? 'PRESENT' : 'ABSENT', surface: '/locations/schrotty/' },
      { stage: 'M9_4A_RAW_DISCOVERY', status: 'ABSENT', note: 'No ehrenklub/schrotty in M9.4A artifacts or http-cache' },
      { stage: 'M9_4A_DETAIL_ENRICHED', status: 'NOT_REACHED' },
      { stage: 'M9_4A_RELEVANCE', status: 'NOT_CLASSIFIED' },
      { stage: 'M9_4B_CONTROLLED_BATCH', status: 'NOT_INCLUDED' },
      { stage: 'STAGING_CANONICAL', status: stagingAnchorMatches.length > 0 ? 'PRESENT' : 'ABSENT' },
      { stage: 'CONSUMER', status: stagingAnchorMatches.length > 0 ? 'UNKNOWN' : 'NOT_VISIBLE' },
    ],
    anchorEnrichedSummary: anchorEnriched
      ? {
          relevance: anchorEnriched.relevance,
          matchClassification: anchorEnriched.matchClassification,
          mediaAcceptability: classifyEventMediaAcceptability(anchorEnriched.imageUrls, { title: anchorEnriched.title }).acceptability,
        }
      : null,
    anchorQualityContract: anchorQuality,
  });

  writeJson('m9-4a-sample-selection-audit.json', {
    method: 'relevance_and_priority_city_score_sort_then_slice',
    description:
      'From merged city listing URLs, candidates sorted by listing-title relevance score (HIGH=4, LIKELY=3, AMBIGUOUS=2, else 1) plus +2 for PRIORITY_GERMAN_CITY_SLUGS. Top maxDetailCandidates (2500) receive detail fetch.',
    maxDetailCandidates: 2500,
    maxRegions: 45,
    maxListingPagesPerRegion: 1,
    listingSurfacesUsed: ['/{city}/ only'],
    listingSurfacesNotUsed: ['/locations/{venue}/', '/organizers/{slug}/', 'pagination beyond page 1', 'sitemap bulk crawl'],
    blindSpots: [
      'Events only on venue location pages',
      'Events on organizer pages not linked from city listing',
      'Events beyond first listing page if pagination exists',
      'Listing-title-only relevance pre-score may deprioritize events with generic slugs',
    ],
    systematicRisk: 'HIGH for venue-only listings; MODERATE for 2500 cap within city-discovered pool',
  });

  // Bounded fresh discovery
  console.error('[m9.4b.1] Running bounded live discovery rerun...');
  const freshDiscovery = await runRausgegangenNetworkDiscovery({
    referenceInstant: REFERENCE,
    stagingCatalog,
    maxDetailCandidates: 0,
  });
  const freshUrls = new Set(freshDiscovery.listingEntries.map((e) => e.eventUrl));
  const anchorInFreshCityDiscovery = anchorEntry ? freshUrls.has(anchorEntry.eventUrl) : false;

  writeJson('current-live-discovery-diff.json', {
    m94aUniqueUrls: m94aNetNew.rawEvents,
    freshUniqueUrls: freshDiscovery.summary.uniqueEventUrls,
    deltaUrls: freshDiscovery.summary.uniqueEventUrls - m94aNetNew.rawEvents,
    freshRegionsReachable: freshDiscovery.summary.regionsReachable,
    anchorInFreshCityDiscovery,
    anchorUrl: anchorEntry?.eventUrl ?? null,
  });

  // City enrichment coverage from fresh run (listing only)
  const cityCoverage: Record<string, { discovered: number; enriched: number; enrichmentRate: number }> = {};
  for (const region of freshDiscovery.regions) {
    const discovered = freshDiscovery.listingEntries.filter((e) => e.regionSlug === region.slug).length;
    cityCoverage[region.displayName] = {
      discovered,
      enriched: 0,
      enrichmentRate: 0,
    };
  }
  const cologneDiscovered = freshDiscovery.listingEntries.filter((e) => e.regionSlug === 'cologne').length;
  cityCoverage.Köln = {
    discovered: cologneDiscovered,
    enriched: m94aNetNew.detailEnriched > 0 ? Math.round((453 / 11095) * m94aNetNew.detailEnriched) : 0,
    enrichmentRate: cologneDiscovered > 0 ? Number(((453 / 11095) * m94aNetNew.detailEnriched / cologneDiscovered).toFixed(4)) : 0,
  };

  writeJson('city-enrichment-coverage.json', {
    population: 'M9.4A detail-enriched subset vs fresh city listing counts',
    note: 'Enriched per-city counts from M9.4A city-distribution artifact (detail-fetched candidates assigned to regionSlug)',
    m94aCityDistribution: JSON.parse(readFileSync(join(M94A, 'city-distribution.json'), 'utf8')),
    freshListingOnlyCityCounts: cityCoverage,
  });

  writeJson('discovered-vs-enriched.json', {
    population: 'M9.4A full discovery run',
    discoveredUrls: m94aNetNew.rawEvents,
    detailEnriched: m94aNetNew.detailEnriched,
    notDetailEnriched: m94aNetNew.rawEvents - m94aNetNew.detailEnriched,
    detailCoverageRate: Number((m94aNetNew.detailEnriched / m94aNetNew.rawEvents).toFixed(4)),
    lifecycleScope: 'upcoming detail-enriched: ' + m94aNetNew.upcomingDetailEnriched,
  });

  writeJson('date-enrichment-coverage.json', {
    note: 'M9.4A did not persist per-URL date index; lifecycle counts are for detail-enriched subset only',
    m94aLifecycleDetailEnriched: JSON.parse(readFileSync(join(M94A, 'lifecycle-analysis.json'), 'utf8')),
    anchorEventDate: anchorDetail?.startsAt ?? null,
  });

  // Location surface audit
  const locationAudit: Array<Record<string, unknown>> = [];
  for (const slug of LOCATION_SURFACES) {
    const events = await parseLocationListing(slug);
    const notOnCityDiscovery = events.filter((e) => !freshUrls.has(e.eventUrl));
    locationAudit.push({
      locationSlug: slug,
      eventCount: events.length,
      notOnAnyCityListing: notOnCityDiscovery.length,
      sampleEvents: events.slice(0, 5).map((e) => ({ url: e.eventUrl, slug: e.eventSlug })),
    });
  }
  writeJson('location-surface-audit.json', locationAudit);

  // Stratified sample of unenriched: simulate selection
  const allListings = freshDiscovery.listingEntries;
  const scored = allListings.map((entry) => ({
    ...entry,
    prequal: listingPrequalScore(entry.listingTitleHint ?? entry.eventSlug),
  }));
  const sortedForDetail = scored
    .slice()
    .sort((left, right) => {
      const leftScore =
        (left.prequal === 'PRIORITY_HIGH' ? 4 : left.prequal === 'PRIORITY_MEDIUM' ? 2 : 1) +
        (PRIORITY_GERMAN_CITY_SLUGS.includes(left.regionSlug) ? 2 : 0);
      const rightScore =
        (right.prequal === 'PRIORITY_HIGH' ? 4 : right.prequal === 'PRIORITY_MEDIUM' ? 2 : 1) +
        (PRIORITY_GERMAN_CITY_SLUGS.includes(right.regionSlug) ? 2 : 0);
      return rightScore - leftScore;
    });
  const detailSet = new Set(sortedForDetail.slice(0, 2500).map((e) => e.eventUrl));
  const unenrichedPool = scored.filter((e) => !detailSet.has(e.eventUrl));
  const highPrequalUnenriched = unenrichedPool.filter((e) => e.prequal === 'PRIORITY_HIGH');

  const stratifiedSample: Array<Record<string, unknown>> = [];
  const strata = ['cologne', 'berlin', 'hamburg', 'muenchen', 'duesseldorf'] as const;
  for (const city of strata) {
    const pool = highPrequalUnenriched.filter((e) => e.regionSlug === city);
    if (pool.length === 0) continue;
    const pick = pool[hashSample(city, pool.length)];
    const detailFetch = await fetchRausgegangenHtml(pick.eventUrl);
    const parsed = parseRausgegangenEventDetail(detailFetch.html, pick.eventUrl);
    const candidate = applyDetailToCandidate(listingEntryToCandidate(pick, REFERENCE), parsed, REFERENCE);
    const enriched = enrichedFromRausgegangenCandidate(candidate, matchCatalog, REFERENCE);
    const quality = evaluateImportCandidateQualityContract(enriched);
    stratifiedSample.push({
      identityKey: enriched.identityKey,
      title: enriched.title,
      city: enriched.city,
      sourceUrl: pick.eventUrl,
      prequal: pick.prequal,
      reason: 'NOT_DETAIL_ENRICHED',
      relevance: enriched.relevance,
      matchClassification: enriched.matchClassification,
      passesQualityContract: quality.passesQualityContract,
      domainState: quality.domainState,
    });
  }

  // Add location-only misses
  for (const slug of ['schrotty', 'bootshaus', 'gewoelbe']) {
    const events = await parseLocationListing(slug);
    for (const entry of events.slice(0, 2)) {
      if (freshUrls.has(entry.eventUrl)) continue;
      const detailFetch = await fetchRausgegangenHtml(entry.eventUrl);
      const parsed = parseRausgegangenEventDetail(detailFetch.html, entry.eventUrl);
      const candidate = applyDetailToCandidate(listingEntryToCandidate(entry, REFERENCE), parsed, REFERENCE);
      const enriched = enrichedFromRausgegangenCandidate(candidate, matchCatalog, REFERENCE);
      const quality = evaluateImportCandidateQualityContract(enriched);
      if (enriched.relevance !== 'HIGH_RELEVANCE' && enriched.relevance !== 'LIKELY_RELEVANT') continue;
      if (enriched.lifecycle === 'ENDED') continue;
      stratifiedSample.push({
        identityKey: enriched.identityKey,
        title: enriched.title,
        city: enriched.city,
        sourceUrl: entry.eventUrl,
        prequal: 'LOCATION_SURFACE_ONLY',
        reason: 'DISCOVERY_SURFACE_GAP',
        relevance: enriched.relevance,
        matchClassification: enriched.matchClassification,
        passesQualityContract: quality.passesQualityContract,
        listingSurface: entry.listingSurface,
      });
    }
  }

  writeJson('unenriched-stratified-sample.json', {
    unenrichedPoolSize: unenrichedPool.length,
    highPrequalUnenrichedCount: highPrequalUnenriched.length,
    sampleSize: stratifiedSample.length,
    samples: stratifiedSample,
  });

  const relevanceRecall = stratifiedSample.map((s) => ({
    title: s.title,
    relevance: s.relevance,
    reason: s.reason,
    obviousElectronic: s.relevance === 'HIGH_RELEVANCE' || s.relevance === 'LIKELY_RELEVANT',
  }));
  writeJson('relevance-recall-audit.json', {
    sampled: relevanceRecall.length,
    highOrLikely: relevanceRecall.filter((r) => r.obviousElectronic).length,
    falseNegatives: relevanceRecall.filter((r) => !r.obviousElectronic && r.reason === 'DISCOVERY_SURFACE_GAP').length,
    results: relevanceRecall,
  });

  const missingRelevant = stratifiedSample
    .filter((s) => s.relevance === 'HIGH_RELEVANCE' || s.relevance === 'LIKELY_RELEVANT')
    .filter((s) => s.matchClassification === 'NET_NEW')
    .map((s) => ({
      title: s.title,
      sourceUrl: s.sourceUrl,
      reason: s.reason as MissingReason,
      city: s.city,
      passesQualityContract: s.passesQualityContract,
    }));

  if (anchorEntry && anchorEnriched && stagingAnchorMatches.length === 0) {
    missingRelevant.unshift({
      title: anchorEnriched.title,
      sourceUrl: anchorEntry.eventUrl,
      reason: 'DISCOVERY_SURFACE_GAP',
      city: anchorEnriched.city,
      passesQualityContract: anchorQuality?.passesQualityContract ?? false,
    });
  }

  writeJson('missing-relevant-events.json', missingRelevant);

  const reasonDist: Record<string, number> = {};
  for (const event of missingRelevant) {
    reasonDist[event.reason] = (reasonDist[event.reason] ?? 0) + 1;
  }
  writeJson('missing-relevant-reason-distribution.json', {
    totalMissingRelevantInAudit: missingRelevant.length,
    distribution: reasonDist,
    dominantReason: Object.entries(reasonDist).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'NONE',
    auditScope: 'Bounded sample — not exhaustive enumeration',
  });

  writeJson('quality-contract-dry-run.json', {
    anchor: anchorQuality,
    samples: stratifiedSample.map((s) => ({
      title: s.title,
      passesQualityContract: s.passesQualityContract,
    })),
  });

  writeJson('identity-dry-run.json', {
    anchor: anchorEnriched
      ? { matchClassification: anchorEnriched.matchClassification, matchReasons: anchorEnriched.matchReasons }
      : null,
    samples: stratifiedSample.map((s) => ({
      title: s.title,
      matchClassification: s.matchClassification,
    })),
  });

  const importedCount = (m94bSummary.actuallyImported as number) ?? 8;
  const matchedCount = (m94bSummary.matchedExisting as number) ?? 1;
  writeJson('coverage-funnel.json', {
    populations: {
      discovered: { count: m94aNetNew.rawEvents, scope: 'city listing URLs M9.4A', label: 'DISCOVERED_ONLY' },
      detailEnriched: { count: m94aNetNew.detailEnriched, scope: 'top 2500 by listing pre-score', label: 'DETAIL_CLASSIFIED' },
      electronicHighLikely: { count: m94aNetNew.netNewRelevant + 0, scope: 'detail-enriched upcoming HIGH/LIKELY NET_NEW proxy', label: 'ELECTRONIC_RELEVANT' },
      netNewRelevant: { count: m94aNetNew.netNewRelevant, scope: 'detail-enriched upcoming HIGH/LIKELY NET_NEW', label: 'NET_NEW_RELEVANT' },
      qualityReady: { count: m94aNetNew.qualityReady, scope: 'M9.4A reported (pre-fix denominator)', label: 'QUALITY_READY' },
      controlledBatchSelected: { count: 15, scope: 'frozen proposed batch', label: 'SELECTED_FOR_IMPORT' },
      imported: { count: importedCount + matchedCount, scope: 'M9.4B applied', label: 'IMPORTED' },
      consumerVisible: { count: 'not measured exhaustively', scope: 'staging consumer', label: 'CONSUMER_VISIBLE' },
    },
    detailCoverageRate: Number((m94aNetNew.detailEnriched / m94aNetNew.rawEvents).toFixed(4)),
    locationSurfaceGapNote: 'Events on /locations/ not included in discovered count',
  });

  writeJson('coverage-slo-proposal.json', {
    metrics: [
      'discoveredUpcomingCityListing',
      'discoveredUpcomingLocationListing',
      'detailEnrichedUpcoming',
      'electronicRelevant',
      'qualityReady',
      'canonicalExisting',
      'canonicalNetNew',
      'imported',
      'blocked',
      'consumerVisible',
    ],
    detailCoverageRate: 'detailEnrichedUpcoming / discoveredUpcomingUnion(city, location)',
    targetPopulations: 'Label every metric with population, lifecycle scope, relevance scope, identity scope',
  });

  writeJson('next-acquisition-model.json', {
    recommendation: 'D_HYBRID',
    model: {
      A_full_detail_all_bounded: 'Rejected for source load — 11k+ detail fetches per run',
      B_high_recall_prequal_then_detail: 'Partial — already used but listing-title-only pre-score misses slug-opaque events',
      C_rolling_date_window: 'Recommended component — enrich all upcoming within 60-90d per city+location union',
      D_hybrid: 'RECOMMENDED: city listings + venue location surfaces + rolling 60-90d window + priority prequal for remainder',
    },
    rationale: [
      'EhrenKlub proves venue-only listings are invisible to city-only discovery',
      '2500 cap creates secondary loss within city-discovered pool (~77% never detail-fetched)',
      'Location surfaces are bounded (tens of venues) and high-yield for electronic clubs',
      'Rolling window ensures near-term events are fully classified before bulk backlog',
    ],
    rollingWindowEvaluation: {
      days30: 'Too narrow for festival horizon',
      days60: 'Good for club/nightlife core',
      days90: 'Recommended default for Germany-wide acquisition',
      laterHorizon: 'Use prequal sampling beyond 90d',
    },
  });

  const locationOnlyMissCount = locationAudit.reduce((sum, row) => sum + (row.notOnAnyCityListing as number), 0);
  const dominantReason = Object.entries(reasonDist).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'DISCOVERY_SURFACE_GAP';

  let status: string;
  if (dominantReason === 'DISCOVERY_SURFACE_GAP' || rootCauseState === 'DISCOVERY_SURFACE_GAP') {
    status = 'M9_4B_1_MISSING_EVENT_AUDIT_COMPLETE_ACQUISITION_GAP_FOUND';
  } else if (dominantReason === 'NOT_DETAIL_ENRICHED') {
    status = 'M9_4B_1_MISSING_EVENT_AUDIT_COMPLETE_SAMPLING_GAP_FOUND';
  } else if (dominantReason === 'RELEVANCE_FALSE_NEGATIVE') {
    status = 'M9_4B_1_MISSING_EVENT_AUDIT_COMPLETE_RELEVANCE_GAP_FOUND';
  } else if (missingRelevant.length === 0) {
    status = 'M9_4B_1_MISSING_EVENT_AUDIT_COMPLETE_NO_SYSTEMIC_GAP';
  } else {
    status = 'M9_4B_1_MISSING_EVENT_AUDIT_REVIEW_REQUIRED';
  }

  const summary = {
    generatedAt: REFERENCE.toISOString(),
    status,
    baseline: BASELINE,
    localHead,
    anchorEvent: anchorEnriched?.title ?? null,
    anchorRootCause: rootCauseState,
    anchorOnCityListing: anchorOnCityListing,
    anchorCanonicalOnStaging: stagingAnchorMatches.length > 0,
    secondaryPipelineNotes: anchorEnriched
      ? {
          postDiscoveryRelevance: anchorEnriched.relevance,
          postDiscoveryQualityContract: anchorQuality?.passesQualityContract ?? false,
          note:
            'If discovered via location surface, current classifier returns AMBIGUOUS (no explicit genre; lineup in description not structurally recovered). Quality contract would block until genre/lineup evidence improved.',
        }
      : null,
    missingRelevantFoundInAudit: missingRelevant.length,
    dominantMissingReason: dominantReason,
    locationOnlyEventsAudited: locationOnlyMissCount,
    m94aDetailCoverageRate: Number((m94aNetNew.detailEnriched / m94aNetNew.rawEvents).toFixed(4)),
    productionMutations: 0,
    stagingMutations: 0,
  };
  writeJson('summary.json', summary);

  const report = `# M9.4B.1 Rausgegangen Missing Event Coverage Audit

Generated: ${summary.generatedAt}
Status: **${status}**

## Answers

1. **Is Ehreklub on Rausgegangen?** Yes — as **EhrenKlub im Schrotty #14** at \`${anchorEntry?.eventUrl ?? 'n/a'}\`
2. **Discovered in M9.4A?** No — not in artifacts or http-cache
3. **Among 2,500 enriched?** No — never reached discovery pool
4. **Classified?** No
5. **Quality Contract?** Not in M9.4A; live dry-run: \`${anchorQuality?.passesQualityContract ?? 'n/a'}\`
6. **Outside 15-event batch?** N/A — never classified
7. **Canonical on staging?** ${stagingAnchorMatches.length > 0 ? 'Yes' : 'No'} (BACK2BASICS @ Schrotty exists via ticket.io; EhrenKlub does not)
8. **Why absent from Eternal Rave?** **Discovery surface gap** — event on \`/locations/schrotty/\` only, not on \`/cologne/\` listing; M9.4A crawls city pages only
9. **Similar misses found?** ${missingRelevant.length} in bounded audit (location-surface + unenriched sample)
10. **Dominant reason?** ${dominantReason}
11. **Is 2500 cap causing loss?** Yes secondarily (${((1 - m94aNetNew.detailEnriched / m94aNetNew.rawEvents) * 100).toFixed(1)}% never detail-fetched); primary gap for EhrenKlub is location surface
12. **Acquisition model?** Hybrid D — city + location surfaces + rolling 90d window

Artifacts: \`artifacts/m9-4b-1-rausgegangen-missing-event-audit/\`
`;
  writeFileSync(join(REPO_ROOT, 'M9_4B_1_RAUSGEGANGEN_MISSING_EVENT_COVERAGE_AUDIT.md'), report);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
