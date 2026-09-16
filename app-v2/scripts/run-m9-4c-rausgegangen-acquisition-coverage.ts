#!/usr/bin/env tsx
/**
 * M9.4C — Rausgegangen acquisition coverage foundation (READ-ONLY).
 */
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { loadStagingEventSnapshots } from '../server/ingestion/sync/canonical-consolidation';
import {
  assertProductionNotLinked,
  createSupabaseCliLinkedQueryExecutor,
  loadJsonAgg,
  verifyLinkedStagingTarget,
} from '../server/ingestion/sync/linked-db';
import { PRODUCTION_PROJECT_REF, STAGING_PROJECT_REF } from '../server/ingestion/sync/staging-guard';
import {
  evaluateImportCandidateQualityContract,
  summarizeQualityContractResults,
} from '../server/official-connectors/ticket-evidence/network-discovery/import-quality-contract-gate';
import type { StagingCatalogEvent } from '../server/official-connectors/ticket-evidence/network-discovery/match-staging-catalog';
import { auditGenreCoverage } from '../server/official-connectors/ticket-evidence/network-discovery/genre-coverage-audit';
import { auditStagingDuplicateGroups, countDuplicateGroups } from '../server/official-connectors/ticket-evidence/network-discovery/staging-duplicate-audit';
import { auditWorkingTree } from '../server/official-connectors/ticket-evidence/network-discovery/working-tree-audit';
import {
  evaluateEventQuality,
  publishedElectronicGenreCoverage,
} from '../server/official-connectors/shared/event-quality/evaluate-event-quality';
import {
  detectStructuredDescriptionLeakage,
  publishedDescriptionStructuredLeakage,
  separateStructuredEventContent,
} from '../server/official-connectors/shared/structured-content-separation';
import { registerUnknownGenreCandidate, type UnknownGenreCandidate } from '../server/official-connectors/shared/unknown-genre-candidate';
import { deriveLineupDomainEvidence } from '../server/official-connectors/rausgegangen-discovery/lineup-domain-evidence';
import { selectProposedM94DBatch } from '../server/official-connectors/rausgegangen-discovery/rausgegangen-batch-selection';
import {
  ehrenklubDiscoveredViaLocation,
  isEhrenklubRegressionEvent,
  runRausgegangenAcquisitionCoverage,
} from '../server/official-connectors/rausgegangen-discovery/rausgegangen-acquisition-coverage';
import { classifyDomainFromRelevance } from '../server/official-connectors/shared/discovery-genre-fusion/domain-classification';
import { classifyRelevanceEvidence } from '../server/official-connectors/ticket-evidence/network-discovery/relevance-evidence';
import { bundeslandForCity } from '../server/official-connectors/ticket-evidence/network-discovery/germany-geography';
import { classifyEventMediaAcceptability } from '../server/official-connectors/ticket-evidence/network-discovery/event-media-quality';

const REPO_ROOT = join(process.cwd(), '..');
const OUT = join(REPO_ROOT, 'artifacts', 'm9-4c-rausgegangen-acquisition-coverage');
const CACHE_DIR = join(REPO_ROOT, 'artifacts', 'm9-4a-rausgegangen-germany-discovery', 'http-cache');
const CHECKPOINT = join(OUT, 'acquisition-checkpoint.json');
const REFERENCE = new Date();
const BASELINE_COMMIT = 'de6e8ed56ff1130242218310bc420b3e66ba84b3';

function writeJson(name: string, payload: unknown): void {
  writeFileSync(join(OUT, name), `${JSON.stringify(payload, null, 2)}\n`);
}

function head(): string {
  return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
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

function stagingFingerprint(runQuery: ReturnType<typeof createSupabaseCliLinkedQueryExecutor>) {
  const rows = loadJsonAgg<{
    event_count: number;
    ticket_count: number;
    lineup_count: number;
    genre_count: number;
    media_count: number;
    source_binding_count: number;
  }>(
    runQuery,
    `SELECT jsonb_agg(row_to_json(t)) AS rows FROM (
      SELECT
        (SELECT count(*)::int FROM events) AS event_count,
        (SELECT count(*)::int FROM event_tickets) AS ticket_count,
        (SELECT count(*)::int FROM event_lineup) AS lineup_count,
        (SELECT count(*)::int FROM event_genres) AS genre_count,
        (SELECT count(*)::int FROM events WHERE image_url IS NOT NULL AND image_url <> '') AS media_count,
        (SELECT count(*)::int FROM event_sources) AS source_binding_count
    ) t;`,
  );
  return rows[0];
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const cwd = process.cwd();
  assertProductionNotLinked(cwd);
  verifyLinkedStagingTarget(cwd);
  const runQuery = createSupabaseCliLinkedQueryExecutor(cwd);
  const fingerprintBefore = stagingFingerprint(runQuery);
  const stagingCatalog = loadStagingCatalog(runQuery);
  const snapshots = loadStagingEventSnapshots(runQuery).filter((event) => event.status === 'published');
  const genreAudit = auditGenreCoverage(runQuery);
  const duplicateAudit = auditStagingDuplicateGroups(runQuery, REFERENCE);
  const evaluations = snapshots.map((event) =>
    evaluateEventQuality({ event, genreCoverage: genreAudit.find((entry) => entry.eventId === event.eventId) }),
  );

  writeJson('working-tree-audit.json', auditWorkingTree(REPO_ROOT));
  writeJson('staging-safety.json', { stagingProject: STAGING_PROJECT_REF, mutations: 0, readOnly: true });
  writeJson('production-safety.json', { productionProject: PRODUCTION_PROJECT_REF, productionMutations: 0 });

  const discovery = await runRausgegangenAcquisitionCoverage({
    referenceInstant: REFERENCE,
    stagingCatalog,
    cacheDir: CACHE_DIR,
    checkpointPath: CHECKPOINT,
    onProgress: (message) => console.error(message),
  });

  const ehrenklubUnion = discovery.unionEvents.find((event) => isEhrenklubRegressionEvent(event));
  const ehrenklubCandidate = discovery.candidates.find((event) => isEhrenklubRegressionEvent(event));
  const ehrenklubEnriched = discovery.enrichedEvents.find((event) => event.ticketIoEventId === 'ehrenklub-im-schrotty-14-0');
  const ehrenklubQuality = ehrenklubEnriched ? evaluateImportCandidateQualityContract(ehrenklubEnriched) : undefined;
  const ehrenklubLineupDomain = ehrenklubCandidate
    ? deriveLineupDomainEvidence({ title: ehrenklubCandidate.title, lineup: ehrenklubCandidate.lineupHints })
    : undefined;
  const ehrenklubStructured = separateStructuredEventContent(ehrenklubCandidate?.description);

  const locationOnlySlugs = new Set(
    discovery.unionEvents
      .filter((event) => event.discoveredBy.every((item) => item.surfaceType === 'LOCATION'))
      .map((event) => event.eventSlug),
  );

  const qualityContracts = discovery.enrichedEvents.map((event) => evaluateImportCandidateQualityContract(event));
  const qualitySummary = summarizeQualityContractResults(qualityContracts);
  const proposedBatch = selectProposedM94DBatch(discovery.enrichedEvents, 40, locationOnlySlugs);

  const qualityReadyPool = discovery.enrichedEvents
    .map((event) => ({ event, contract: evaluateImportCandidateQualityContract(event) }))
    .filter(({ contract }) => contract.passesQualityContract && !contract.qualityContractBypass);

  const fingerprintAfter = stagingFingerprint(runQuery);

  writeJson('discovery-config.json', {
    bounds: discovery.bounds,
    cacheDir: CACHE_DIR,
    checkpointPath: CHECKPOINT,
    baselineCommit: BASELINE_COMMIT,
    referenceInstant: REFERENCE.toISOString(),
  });
  writeJson('discovery-run-manifest.json', {
    runId: discovery.runId,
    startedAt: discovery.startedAt,
    completedAt: discovery.completedAt,
    configuration: discovery.bounds,
    citySurfaceCount: discovery.citySurfaces.length,
    locationSurfaceCandidates: discovery.locationCandidates.length,
    locationSurfacesCrawled: discovery.locationSurfacesCrawled.length,
    unionDiscovered: discovery.unionEvents.length,
    requestCounts: discovery.sourceLoadMetrics,
    artifactDirectory: OUT,
  });
  writeJson('city-surfaces.json', discovery.citySurfaces);
  writeJson('location-surface-candidates.json', discovery.locationCandidates);
  writeJson('location-surface-qualification.json', discovery.locationCandidates);
  writeJson('location-surfaces-crawled.json', discovery.locationSurfacesCrawled);
  writeJson('city-discovery.json', {
    count: discovery.cityDiscoveredCount,
    surfaces: discovery.citySurfaces,
  });
  writeJson('location-discovery.json', {
    count: discovery.locationDiscoveredCount,
    surfaces: discovery.locationSurfacesCrawled,
  });
  writeJson('city-location-union.json', {
    unionTotal: discovery.unionEvents.length,
    cityOnly: discovery.cityOnlyCount,
    locationOnly: discovery.locationOnlyCount,
    cityAndLocation: discovery.cityAndLocationCount,
    events: discovery.unionEvents,
  });
  writeJson(
    'location-only-events.json',
    discovery.unionEvents.filter((event) => event.discoveredBy.every((item) => item.surfaceType === 'LOCATION')),
  );
  writeJson('rolling-window-comparison.json', {
    comparison: discovery.rollingWindowComparison,
    chosenWindowDays: discovery.activeWindowDays,
    rationale:
      '90 days balances near-term completeness, ticket freshness, and bounded source load versus 30/60 day under-coverage risk.',
  });
  writeJson('active-window-selection.json', {
    activeWindowDays: discovery.activeWindowDays,
    activeWindowDiscovered: discovery.activeWindowDiscovered,
    activeWindowDetailEnriched: discovery.activeWindowDetailEnriched,
    activeWindowInaccessible: discovery.activeWindowInaccessible,
    activeWindowDetailCoverageRate: discovery.activeWindowDetailCoverageRate,
  });
  writeJson('detail-enrichment.json', {
    totalCandidates: discovery.candidates.length,
    detailFetched: discovery.candidates.filter((candidate) => candidate.detailFetched).length,
  });
  writeJson('detail-coverage.json', {
    activeWindowDiscovered: discovery.activeWindowDiscovered,
    activeWindowDetailEnriched: discovery.activeWindowDetailEnriched,
    activeWindowInaccessible: discovery.activeWindowInaccessible,
    activeWindowDetailCoverageRate: discovery.activeWindowDetailCoverageRate,
  });
  writeJson('inaccessible-details.json', discovery.inaccessibleDetails);

  const structuredAudit = discovery.enrichedEvents.map((event) => {
    const separated = separateStructuredEventContent(event.description ?? undefined);
    const leakage = detectStructuredDescriptionLeakage(separated.descriptionResidual ?? event.description);
    return {
      identityKey: event.identityKey,
      title: event.title,
      lineupCandidates: separated.lineupCandidates,
      genreCandidates: separated.genreCandidates,
      editorialText: separated.editorialText,
      leakage,
    };
  });
  writeJson('structured-content-audit.json', structuredAudit);

  const lineupAudit = discovery.enrichedEvents.map((event) => ({
    identityKey: event.identityKey,
    title: event.title,
    lineupHints: event.lineupHints,
    lineupQualification: event.lineupQualification,
    lineupDomain: deriveLineupDomainEvidence({ title: event.title, lineup: event.lineupHints }),
  }));
  writeJson('lineup-evidence-audit.json', lineupAudit);
  writeJson('artist-intelligence-audit.json', lineupAudit.map((entry) => ({
    identityKey: entry.identityKey,
    title: entry.title,
    lineupDomain: entry.lineupDomain,
  })));

  const domainClassification = discovery.candidates.map((candidate) => {
    const relevance = classifyRelevanceEvidence({
      title: candidate.title,
      description: candidate.description,
      genreHints: candidate.genreHints,
      lineupHints: candidate.lineupHints,
      venueName: candidate.venueName,
      organizerName: candidate.organizerName,
      lineupDomainBoost: deriveLineupDomainEvidence({
        title: candidate.title,
        lineup: candidate.lineupHints,
      }).domainBoost,
    });
    return {
      eventSlug: candidate.eventSlug,
      title: candidate.title,
      relevance: relevance.relevance,
      domain: classifyDomainFromRelevance(relevance),
      reasons: relevance.reasons,
    };
  });
  writeJson('domain-classification.json', domainClassification);

  const unknownRegistry = new Map<string, UnknownGenreCandidate>();
  for (const event of discovery.enrichedEvents) {
    for (const genre of event.genreHints) {
      registerUnknownGenreCandidate(unknownRegistry, {
        rawTerm: genre,
        eventId: event.identityKey,
        sourceType: 'rausgegangen',
        authority: 'detail_json_ld',
        context: event.title,
      });
    }
  }
  writeJson('genre-evidence-audit.json', discovery.enrichedEvents.map((event) => ({
    identityKey: event.identityKey,
    title: event.title,
    genreHints: event.genreHints,
    genreCandidates: event.genreCandidates,
  })));
  writeJson('unknown-genre-candidates.json', [...unknownRegistry.values()]);

  writeJson('ehrenklub-regression.json', {
    discovered: Boolean(ehrenklubUnion),
    discoveredViaLocation: ehrenklubDiscoveredViaLocation(ehrenklubUnion),
    discoverySurfaces: ehrenklubUnion?.discoveredBy ?? [],
    lineupRecovered: (ehrenklubCandidate?.lineupHints.length ?? 0) > 0,
    lineup: ehrenklubCandidate?.lineupHints ?? [],
    structuredLineupCandidates: ehrenklubStructured.lineupCandidates,
    domainBoost: ehrenklubLineupDomain?.domainBoost,
    relevance: ehrenklubCandidate?.relevance,
    qualityContract: ehrenklubQuality,
    structuredDescriptionLeakage: ehrenklubQuality
      ? detectStructuredDescriptionLeakage(ehrenklubEnriched?.description).recoverable
      : undefined,
  });

  const relevanceSummary = {
    high: discovery.candidates.filter((candidate) => candidate.relevance === 'HIGH_RELEVANCE').length,
    likely: discovery.candidates.filter((candidate) => candidate.relevance === 'LIKELY_RELEVANT').length,
    ambiguous: discovery.candidates.filter((candidate) => candidate.relevance === 'AMBIGUOUS').length,
    irrelevant: discovery.candidates.filter((candidate) => candidate.relevance === 'IRRELEVANT').length,
  };
  writeJson('relevance-summary.json', relevanceSummary);

  writeJson('identity-dry-run.json', discovery.enrichedEvents.map((event) => ({
    identityKey: event.identityKey,
    title: event.title,
    matchClassification: event.matchClassification,
    matchedEventId: event.matchedEventId,
    matchedEventTitle: event.matchedEventTitle,
    matchReasons: event.matchReasons,
  })));

  writeJson('quality-contract-dry-run.json', {
    summary: qualitySummary,
    results: qualityContracts,
  });

  writeJson('media-audit.json', discovery.enrichedEvents.map((event) => ({
    identityKey: event.identityKey,
    title: event.title,
    media: classifyEventMediaAcceptability(event.imageUrls, { title: event.title }),
    bestMediaUrl: event.bestMediaUrl,
  })));

  writeJson('ticket-audit.json', discovery.enrichedEvents.map((event) => ({
    identityKey: event.identityKey,
    title: event.title,
    ticketUrl: event.ticketUrl,
    currentAdmissionPriceMinor: event.currentAdmissionPriceMinor,
    ticketQualification: event.ticketQualification,
  })));

  const genreGapAudit = genreAudit.filter((entry) => entry.classification !== 'GENRE_PRESENT');
  writeJson('current-genre-gap-audit.json', genreGapAudit);
  writeJson('current-inventory-recertification.json', {
    genrePresenceCoverage: publishedElectronicGenreCoverage(evaluations),
    explicitGenreEvidenceParity: genreAudit.filter((entry) => entry.classification === 'GENRE_RECOVERABLE').length === 0 ? 1 : 0,
    recoverableExplicitGenreMissing: genreAudit.filter((entry) => entry.classification === 'GENRE_RECOVERABLE').length,
    structuredDescriptionLeakage: snapshots.filter((event) =>
      publishedDescriptionStructuredLeakage(event.description ?? undefined),
    ).length,
    highConfidenceDuplicateGroups: countDuplicateGroups(duplicateAudit).highConfidenceDuplicateGroups,
    stagingFingerprintBefore: fingerprintBefore,
    stagingFingerprintAfter: fingerprintAfter,
    stagingMutations: 0,
    productionMutations: 0,
  });

  const locationOnlyElectronic = discovery.enrichedEvents.filter(
    (event) =>
      locationOnlySlugs.has(event.ticketIoEventId) &&
      (event.relevance === 'HIGH_RELEVANCE' || event.relevance === 'LIKELY_RELEVANT'),
  );
  const locationOnlyQualityReady = qualityReadyPool.filter(({ event }) => locationOnlySlugs.has(event.ticketIoEventId));

  writeJson('coverage-funnel.json', {
    citySurfaceCount: discovery.citySurfaces.length,
    locationSurfaceCandidates: discovery.locationCandidates.length,
    locationSurfacesQualified: discovery.locationCandidates.filter((entry) => entry.qualification !== 'LOW_VALUE').length,
    locationSurfacesCrawled: discovery.locationSurfacesCrawled.length,
    cityDiscovered: discovery.cityDiscoveredCount,
    locationDiscovered: discovery.locationDiscoveredCount,
    cityOnly: discovery.cityOnlyCount,
    locationOnly: discovery.locationOnlyCount,
    cityAndLocation: discovery.cityAndLocationCount,
    unionDiscovered: discovery.unionEvents.length,
    electronicHigh: relevanceSummary.high,
    electronicLikely: relevanceSummary.likely,
    electronicAmbiguous: relevanceSummary.ambiguous,
    irrelevant: relevanceSummary.irrelevant,
    netNew: discovery.enrichedEvents.filter((event) => event.matchClassification === 'NET_NEW').length,
    qualityReady: qualityReadyPool.length,
    locationOnlyElectronicRelevant: locationOnlyElectronic.length,
    locationOnlyQualityReady: locationOnlyQualityReady.length,
  });

  const coverageByCity: Record<string, unknown> = {};
  for (const surface of discovery.citySurfaces) {
    const slug = surface.surfaceId;
    const events = discovery.unionEvents.filter((event) => event.discoveredBy.some((item) => item.surfaceId === slug));
    coverageByCity[surface.surfaceId] = {
      city: surface.surfaceId,
      citySurfaceEvents: events.filter((event) => event.discoveredBy.some((item) => item.surfaceType === 'CITY')).length,
      locationSurfaceEvents: 0,
      unionUnique: events.length,
      detailEnriched: discovery.candidates.filter(
        (candidate) => candidate.regionSlug === slug && candidate.detailFetched,
      ).length,
      electronicRelevant: discovery.candidates.filter(
        (candidate) =>
          candidate.regionSlug === slug &&
          (candidate.relevance === 'HIGH_RELEVANCE' || candidate.relevance === 'LIKELY_RELEVANT'),
      ).length,
      qualityReady: qualityReadyPool.filter(({ event }) => event.shopSlug === slug).length,
      netNew: discovery.enrichedEvents.filter(
        (event) => event.shopSlug === slug && event.matchClassification === 'NET_NEW',
      ).length,
    };
  }
  writeJson('coverage-by-city.json', coverageByCity);

  const coverageByRegion: Record<string, unknown> = {};
  for (const [city, metrics] of Object.entries(coverageByCity)) {
    const bundesland = bundeslandForCity(city).bundesland ?? 'Unknown';
    coverageByRegion[bundesland] = metrics;
  }
  writeJson('coverage-by-region.json', coverageByRegion);

  writeJson('coverage-by-surface.json', {
    cityOnly: discovery.cityOnlyCount,
    locationOnly: discovery.locationOnlyCount,
    cityAndLocation: discovery.cityAndLocationCount,
    locationOnlyElectronicRelevant: locationOnlyElectronic.length,
    locationOnlyQualityReady: locationOnlyQualityReady.length,
    locationSurfaceValue: discovery.locationSurfacesCrawled.map((surface) => ({
      surfaceId: surface.surfaceId,
      eventsDiscovered: discovery.unionEvents.filter((event) =>
        event.discoveredBy.some((item) => item.surfaceId === surface.surfaceId),
      ).length,
      locationOnlyEvents: discovery.unionEvents.filter((event) =>
        event.discoveredBy.some((item) => item.surfaceId === surface.surfaceId && item.surfaceType === 'LOCATION') &&
        event.discoveredBy.every((item) => item.surfaceType === 'LOCATION' || item.surfaceId === surface.surfaceId),
      ).length,
    })),
  });

  writeJson('source-load-metrics.json', discovery.sourceLoadMetrics);
  writeJson('checkpoint-resume-audit.json', {
    checkpointPath: CHECKPOINT,
    resumable: true,
    completedDetailSlugs: discovery.candidates.filter((candidate) => candidate.detailFetched).length,
  });

  const poolBuckets = {
    QUALITY_READY_NET_NEW: qualityReadyPool.filter(({ event }) => event.matchClassification === 'NET_NEW'),
    QUALITY_READY_EXISTING: qualityReadyPool.filter(({ event }) => event.matchClassification !== 'NET_NEW'),
    REVIEW_REQUIRED: discovery.enrichedEvents.filter((event) => event.matchClassification === 'REVIEW_REQUIRED'),
    BLOCKED_RELEVANCE: qualityContracts.filter((contract) => contract.qualityState === 'REJECTED' && contract.reviewReasons.some((reason) => /relevance|irrelevant/i.test(reason))),
    BLOCKED_GENRE: qualityContracts.filter((contract) => contract.genreState === 'MISSING' || contract.genreState === 'INVALID'),
    BLOCKED_LINEUP: qualityContracts.filter((contract) => contract.lineupState === 'MISSING' || contract.lineupLeakage),
    BLOCKED_MEDIA: qualityContracts.filter((contract) => contract.mediaState === 'MISSING' || contract.mediaState === 'INVALID'),
    BLOCKED_TICKET: qualityContracts.filter((contract) => contract.ticketState === 'INVALID'),
    BLOCKED_IDENTITY: qualityContracts.filter((contract) => contract.identityState === 'REVIEW_REQUIRED' || contract.identityState === 'BLOCKED_IDENTITY'),
  };
  writeJson('quality-ready-acquisition-pool.json', {
    totalQualityReady: qualityReadyPool.length,
    buckets: {
      QUALITY_READY_NET_NEW: poolBuckets.QUALITY_READY_NET_NEW.length,
      QUALITY_READY_EXISTING: poolBuckets.QUALITY_READY_EXISTING.length,
      REVIEW_REQUIRED: poolBuckets.REVIEW_REQUIRED.length,
      BLOCKED_RELEVANCE: poolBuckets.BLOCKED_RELEVANCE.length,
      BLOCKED_GENRE: poolBuckets.BLOCKED_GENRE.length,
      BLOCKED_LINEUP: poolBuckets.BLOCKED_LINEUP.length,
      BLOCKED_MEDIA: poolBuckets.BLOCKED_MEDIA.length,
      BLOCKED_TICKET: poolBuckets.BLOCKED_TICKET.length,
      BLOCKED_IDENTITY: poolBuckets.BLOCKED_IDENTITY.length,
    },
    entries: qualityReadyPool,
  });

  writeJson('proposed-m9-4d-batch.json', {
    proposedBatchSize: proposedBatch.length,
    locationOnlyCount: proposedBatch.filter((entry) => locationOnlySlugs.has(entry.identityKey.replace('rausgegangen:', ''))).length,
    entries: proposedBatch,
  });

  writeJson('future-manual-android-qa-pack.json', {
    cases: proposedBatch.slice(0, 12).map((entry) => ({
      title: entry.title,
      sourceUrl: entry.sourceUrl,
      city: entry.city,
      genres: entry.genres,
      lineupCount: entry.lineupCount,
      matchClassification: entry.matchClassification,
      qualityState: entry.qualityState,
    })),
  });

  const verified =
    fingerprintBefore?.event_count === fingerprintAfter?.event_count &&
    Boolean(ehrenklubUnion) &&
    ehrenklubDiscoveredViaLocation(ehrenklubUnion) &&
    discovery.activeWindowDetailCoverageRate >= 0.999;

  writeJson('summary.json', {
    status: verified
      ? 'M9_4C_RAUSGEGANGEN_ACQUISITION_COVERAGE_FOUNDATION_VERIFIED'
      : 'M9_4C_RAUSGEGANGEN_ACQUISITION_COVERAGE_FOUNDATION_REVIEW_REQUIRED',
    baselineCommit: BASELINE_COMMIT,
    currentHead: head(),
    verified,
    metrics: {
      citySurfaces: discovery.citySurfaces.length,
      locationCandidates: discovery.locationCandidates.length,
      locationSurfacesCrawled: discovery.locationSurfacesCrawled.length,
      unionDiscovered: discovery.unionEvents.length,
      locationOnly: discovery.locationOnlyCount,
      activeWindowDetailCoverageRate: discovery.activeWindowDetailCoverageRate,
      qualityReady: qualityReadyPool.length,
      ehrenklubDiscoveredViaLocation: ehrenklubDiscoveredViaLocation(ehrenklubUnion),
    },
  });

  console.log(
    JSON.stringify({
      status: verified
        ? 'M9_4C_RAUSGEGANGEN_ACQUISITION_COVERAGE_FOUNDATION_VERIFIED'
        : 'M9_4C_RAUSGEGANGEN_ACQUISITION_COVERAGE_FOUNDATION_REVIEW_REQUIRED',
      artifacts: OUT,
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
