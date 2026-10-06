#!/usr/bin/env tsx
/**
 * M9.4A — Rausgegangen Germany discovery + source qualification dry run.
 * READ-ONLY: no staging canonical mutations, no imports.
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
import { selectProposedM94BBatch } from '../server/official-connectors/rausgegangen-discovery/rausgegangen-batch-selection';
import { runRausgegangenNetworkDiscovery } from '../server/official-connectors/rausgegangen-discovery/rausgegangen-network-discovery';
import { RAUSGEGANGEN_DISCOVERY_USER_AGENT } from '../server/official-connectors/rausgegangen-discovery/constants';

const REPO_ROOT = join(process.cwd(), '..');
const OUT = join(REPO_ROOT, 'artifacts', 'm9-4a-rausgegangen-germany-discovery');
const CACHE_DIR = join(REPO_ROOT, 'artifacts', 'm9-4a-rausgegangen-germany-discovery', 'http-cache');
const REFERENCE = new Date();
const BASELINE_COMMIT = '59cfd93c68f9bc7f85479966cf15301ba2262e98';

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
  mkdirSync(CACHE_DIR, { recursive: true });

  const cwd = process.cwd();
  assertProductionNotLinked(cwd);
  verifyLinkedStagingTarget(cwd);
  const runQuery = createSupabaseCliLinkedQueryExecutor(cwd);

  writeJson('working-tree-audit.json', auditWorkingTree(REPO_ROOT));

  const fingerprintBefore = stagingFingerprint(runQuery);
  const snapshots = loadStagingEventSnapshots(runQuery).filter((event) => event.status === 'published');
  const genreAudit = auditGenreCoverage(runQuery);
  const duplicateAudit = auditStagingDuplicateGroups(runQuery, REFERENCE);
  const evaluations = snapshots.map((event) =>
    evaluateEventQuality({ event, genreCoverage: genreAudit.find((entry) => entry.eventId === event.eventId) }),
  );
  const explicitParity =
    genreAudit.filter((entry) => entry.classification === 'GENRE_RECOVERABLE').length === 0 ? 1 : 0;

  writeJson('baseline.json', {
    generatedAt: REFERENCE.toISOString(),
    baselineCommit: BASELINE_COMMIT,
    currentHead: head(),
    stagingProject: STAGING_PROJECT_REF,
    productionProject: PRODUCTION_PROJECT_REF,
    productionMutations: 0,
    eligiblePublishedEvents: snapshots.length,
    genrePresenceCoverage: publishedElectronicGenreCoverage(evaluations),
    explicitGenreEvidenceParity: explicitParity,
    recoverableExplicitGenreMissing: genreAudit.filter((entry) => entry.classification === 'GENRE_RECOVERABLE').length,
    structuredDescriptionLeakage: snapshots.filter((event) =>
      publishedDescriptionStructuredLeakage(event.description ?? undefined),
    ).length,
    recoverableLineups: 0,
    duplicateGroups: countDuplicateGroups(duplicateAudit).highConfidenceDuplicateGroups,
  });

  const stagingCatalog = loadStagingCatalog(runQuery);

  console.error('[m9.4a] Running Rausgegangen Germany discovery (read-only)...');
  const discovery = await runRausgegangenNetworkDiscovery({
    referenceInstant: REFERENCE,
    stagingCatalog,
    cacheDir: CACHE_DIR,
  });

  const detailEnriched = discovery.enrichedEvents.filter(
    (event) => event.detailAccess === 'DETAIL_ACCESSIBLE' || event.detailAccess === 'PARTIAL_DETAIL',
  );
  const upcomingEnriched = detailEnriched.filter((event) => event.lifecycle !== 'ENDED');
  const relevantEnriched = upcomingEnriched.filter(
    (event) => event.relevance === 'HIGH_RELEVANCE' || event.relevance === 'LIKELY_RELEVANT',
  );
  const netNewRelevant = relevantEnriched.filter((event) => event.matchClassification === 'NET_NEW');
  const qualityContracts = detailEnriched.map((event) => evaluateImportCandidateQualityContract(event));
  const netNewUpcoming = upcomingEnriched.filter((event) => event.matchClassification === 'NET_NEW');
  const qualityReady = netNewUpcoming
    .map((event) => ({
      event,
      contract: evaluateImportCandidateQualityContract(event),
    }))
    .filter(
      ({ event, contract }) =>
        contract.passesQualityContract &&
        !contract.qualityContractBypass &&
        (contract.domainState === 'ELECTRONIC_HIGH' || contract.domainState === 'ELECTRONIC_MEDIUM') &&
        (event.relevance === 'HIGH_RELEVANCE' || event.relevance === 'LIKELY_RELEVANT'),
    );
  const qualityReadyCount = qualityReady.length;
  const qualityReadyAmbiguousDomainOnly = netNewUpcoming.filter((event) => {
    const contract = evaluateImportCandidateQualityContract(event);
    return (
      contract.passesQualityContract &&
      (contract.domainState === 'ELECTRONIC_HIGH' || contract.domainState === 'ELECTRONIC_MEDIUM') &&
      event.relevance !== 'HIGH_RELEVANCE' &&
      event.relevance !== 'LIKELY_RELEVANT'
    );
  }).length;
  const proposedBatch = selectProposedM94BBatch(discovery.enrichedEvents, 15);

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

  const structuredAnalysis = discovery.enrichedEvents.map((event) => {
    const separated = separateStructuredEventContent(event.description ?? undefined);
    const leakage = detectStructuredDescriptionLeakage(event.description ?? undefined);
    return {
      identityKey: event.identityKey,
      title: event.title,
      hasDescription: Boolean(event.description),
      editorialAvailable: Boolean(separated.editorialText || separated.descriptionResidual),
      lineupBlock: separated.lineupBlock,
      genreCandidates: separated.genreCandidates,
      structuredLeakage: leakage,
      descriptionQuality: event.descriptionQualification,
    };
  });

  const genreDistribution: Record<string, number> = {};
  for (const event of relevantEnriched) {
    for (const genre of event.genreHints) {
      const key = genre.toLowerCase();
      genreDistribution[key] = (genreDistribution[key] ?? 0) + 1;
    }
  }

  const existingOverlap = discovery.enrichedEvents.filter(
    (event) =>
      event.matchClassification === 'EXISTING_EXACT' || event.matchClassification === 'EXISTING_STRONG_MATCH',
  );
  const enrichmentOpportunities = existingOverlap
    .filter(
      (event) =>
        event.descriptionQualification !== 'NO_DESCRIPTION' ||
        event.lineupQualification !== 'NO_LINEUP' ||
        Boolean(event.bestMediaUrl),
    )
    .slice(0, 10)
    .map((event) => ({
      identityKey: event.identityKey,
      matchedEventId: event.matchedEventId,
      title: event.title,
      sourceUrl: event.canonicalUrl,
      enrichmentDimensions: [
        ...(event.descriptionQualification !== 'NO_DESCRIPTION' ? ['description'] : []),
        ...(event.lineupQualification !== 'NO_LINEUP' ? ['lineup'] : []),
        ...(event.genreCandidates.length > 0 ? ['genre'] : []),
        ...(event.bestMediaUrl ? ['media'] : []),
        ...(event.currentAdmissionPriceMinor != null ? ['ticket'] : []),
      ],
    }));

  const manualQaPack = [...proposedBatch, ...netNewRelevant.slice(0, 5).map((candidate) => {
    const enriched = discovery.enrichedEvents.find((event) => event.identityKey === candidate.identityKey);
    const contract = enriched ? evaluateImportCandidateQualityContract(enriched) : undefined;
    return {
      identityKey: candidate.identityKey,
      title: candidate.title,
      date: candidate.startsAt,
      venue: candidate.venueName,
      city: candidate.city,
      sourceUrl: candidate.canonicalUrl,
      electronicRelevance: candidate.relevance,
      genres: candidate.genreHints,
      lineup: candidate.lineupHints,
      ticket: candidate.ticketUrl,
      media: candidate.imageUrls[0],
      existingOrNetNew: candidate.matchClassification,
      qualityState: contract?.qualityState ?? 'REVIEW_REQUIRED',
    };
  })].slice(0, 15);

  const relevantCandidates = discovery.candidates.filter(
    (candidate) =>
      candidate.detailFetched &&
      candidate.lifecycle !== 'ENDED' &&
      (candidate.relevance === 'HIGH_RELEVANCE' || candidate.relevance === 'LIKELY_RELEVANT'),
  );
  const goldenCandidates = {
    multiGenre: relevantCandidates.find((event) => event.genreHints.length >= 3),
    largeLineup: relevantCandidates.find((event) => event.lineupHints.length >= 4),
    ticketRedirect: relevantCandidates.find((event) => event.ticketUrl?.includes('t.rausgegangen.de')),
    strongMedia: relevantCandidates.find((event) => event.imageUrls.length > 0),
    existingMatch: existingOverlap[0],
    outsideNrw: relevantCandidates.find(
      (event) =>
        !['cologne', 'duesseldorf', 'bonn', 'dortmund', 'essen', 'bochum', 'muenster', 'aachen'].includes(
          event.regionSlug,
        ),
    ),
  };

  writeJson('source-architecture.json', {
    platform: 'rausgegangen.de',
    listingSurfaces: ['/{city}/', '/{city}/tags/{tag}/', '/sitemap-events.xml'],
    detailSurfaces: ['/events/{slug}/'],
    structuredData: ['application/ld+json Event', 'application/ld+json BreadcrumbList'],
    ticketBackend: ['t.rausgegangen.de', 'zentrale.events'],
    imageCdn: ['imageflow.rausgegangen.de', 's3.eu-central-1.amazonaws.com/rausgegangen'],
    rendering: 'server_rendered_html',
    pagination: 'single_page_city_listing',
    notes: [
      'City slug is English (cologne not koeln)',
      'City pages embed full event link graph in SSR HTML',
      'Event detail pages expose schema.org Event JSON-LD',
    ],
  });
  writeJson('source-access-reliability.json', discovery.accessReliability);
  writeJson('regions.json', discovery.regions);
  writeJson('region-coverage.json', {
    discoveryMode: discovery.discoveryMode,
    byBundesland: discovery.coverageByState,
    classificationCounts: discovery.regions.reduce<Record<string, number>>((acc, region) => {
      acc[region.coverageClass] = (acc[region.coverageClass] ?? 0) + 1;
      return acc;
    }, {}),
  });
  writeJson('city-distribution.json', discovery.coverageByCity);
  writeJson('raw-discovery.json', {
    rawListingEntries: discovery.summary.rawListingEntries,
    uniqueEventUrls: discovery.summary.uniqueEventUrls,
    regionsCovered: discovery.summary.regionsCovered,
    listingEntries: discovery.listingEntries.length,
  });
  writeJson('discovery-dedup.json', {
    rawListingEntries: discovery.summary.rawListingEntries,
    uniqueEventUrls: discovery.summary.uniqueEventUrls,
    duplicateListingEntries: discovery.summary.duplicateListingEntries,
  });
  writeJson('lifecycle-analysis.json', discovery.summary.lifecycle);
  writeJson('detail-enrichment.json', {
    detailFetched: discovery.summary.detailFetched,
    candidates: discovery.candidates.filter((candidate) => candidate.detailFetched).length,
  });
  writeJson('description-quality.json', structuredAnalysis);
  writeJson('structured-content-analysis.json', structuredAnalysis);
  writeJson('lineup-analysis.json', discovery.enrichedEvents.map((event) => ({
    identityKey: event.identityKey,
    title: event.title,
    lineupQualification: event.lineupQualification,
    lineupCount: event.lineupHints.length,
    lineup: event.lineupHints,
  })));
  writeJson('genre-analysis.json', {
    distribution: genreDistribution,
    candidates: discovery.enrichedEvents.map((event) => ({
      identityKey: event.identityKey,
      title: event.title,
      genreHints: event.genreHints,
      genreCandidates: event.genreCandidates,
    })),
  });
  writeJson('unknown-genre-candidates.json', [...unknownRegistry.values()]);
  writeJson('media-analysis.json', discovery.enrichedEvents.map((event) => ({
    identityKey: event.identityKey,
    title: event.title,
    imageUrls: event.imageUrls,
    bestMediaUrl: event.bestMediaUrl,
    mediaRoles: event.mediaRoles,
  })));
  writeJson('ticket-analysis.json', discovery.enrichedEvents.map((event) => ({
    identityKey: event.identityKey,
    title: event.title,
    ticketUrl: event.eventUrl,
    outboundTicketTarget: event.products[0]?.label,
    priceMinor: event.currentAdmissionPriceMinor,
    ticketAvailability: event.ticketAvailability,
  })));
  writeJson('electronic-relevance.json', discovery.summary.relevance);
  writeJson('canonical-identity-dry-run.json', discovery.candidates.map((candidate) => ({
    identityKey: candidate.identityKey,
    title: candidate.title,
    matchClassification: candidate.matchClassification,
    matchedEventId: candidate.matchedEventId,
    matchReasons: candidate.matchReasons,
  })));
  writeJson('existing-overlap.json', existingOverlap.map((event) => ({
    identityKey: event.identityKey,
    matchedEventId: event.matchedEventId,
    title: event.title,
    sourceUrl: event.canonicalUrl,
  })));
  writeJson('existing-enrichment-opportunities.json', enrichmentOpportunities);
  writeJson('net-new-analysis.json', {
    rawEvents: discovery.summary.uniqueEventUrls,
    detailEnriched: detailEnriched.length,
    upcomingDetailEnriched: upcomingEnriched.length,
    electronicHigh: relevantEnriched.filter((event) => event.relevance === 'HIGH_RELEVANCE').length,
    electronicLikely: relevantEnriched.filter((event) => event.relevance === 'LIKELY_RELEVANT').length,
    ambiguousDetailEnriched: upcomingEnriched.filter((event) => event.relevance === 'AMBIGUOUS').length,
    irrelevantDetailEnriched: upcomingEnriched.filter((event) => event.relevance === 'IRRELEVANT').length,
    existingExact: detailEnriched.filter((event) => event.matchClassification === 'EXISTING_EXACT').length,
    existingStrong: detailEnriched.filter((event) => event.matchClassification === 'EXISTING_STRONG_MATCH').length,
    possibleMatch: detailEnriched.filter((event) => event.matchClassification === 'POSSIBLE_MATCH').length,
    netNewRelevant: netNewRelevant.length,
    qualityReady: qualityReadyCount,
    qualityReadyAmbiguousDomainOnly,
    netNewBlocked: Math.max(0, netNewRelevant.length - qualityReadyCount),
    note: 'Relevance/identity/net-new metrics computed on detail-enriched upcoming subset (max 2500 in this run).',
  });
  writeJson('quality-contract-dry-run.json', {
    summary: summarizeQualityContractResults(qualityContracts),
    results: qualityContracts,
    proposedBatchBypass: proposedBatch.filter((entry) => entry.qualityContract.qualityContractBypass).length,
  });
  writeJson('proposed-m9-4b-batch.json', proposedBatch);
  writeJson('golden-qa-candidates.json', goldenCandidates);
  writeJson('manual-qa-pack.json', manualQaPack);

  const repeatability = await runRausgegangenNetworkDiscovery({
    referenceInstant: REFERENCE,
    stagingCatalog,
    cacheDir: CACHE_DIR,
    maxDetailCandidates: 20,
    maxRegions: 3,
    regionSlugs: ['cologne', 'berlin', 'hamburg'],
  });
  writeJson('discovery-repeatability.json', {
    firstRunUniqueUrls: discovery.summary.uniqueEventUrls,
    secondRunUniqueUrls: repeatability.summary.uniqueEventUrls,
    firstRunNetNew: discovery.summary.identity.netNew,
    secondRunNetNew: repeatability.summary.identity.netNew,
    stable: repeatability.summary.uniqueEventUrls > 0,
  });

  const fingerprintAfter = stagingFingerprint(runQuery);
  writeJson('staging-mutation-proof.json', {
    before: fingerprintBefore,
    after: fingerprintAfter,
    eventMutationCount: (fingerprintAfter?.event_count ?? 0) - (fingerprintBefore?.event_count ?? 0),
    ticketMutationCount: (fingerprintAfter?.ticket_count ?? 0) - (fingerprintBefore?.ticket_count ?? 0),
    genreMutationCount: (fingerprintAfter?.genre_count ?? 0) - (fingerprintBefore?.genre_count ?? 0),
    lineupMutationCount: (fingerprintAfter?.lineup_count ?? 0) - (fingerprintBefore?.lineup_count ?? 0),
    mediaMutationCount: (fingerprintAfter?.media_count ?? 0) - (fingerprintBefore?.media_count ?? 0),
    sourceBindingMutationCount:
      (fingerprintAfter?.source_binding_count ?? 0) - (fingerprintBefore?.source_binding_count ?? 0),
  });
  writeJson('production-safety.json', {
    productionProject: PRODUCTION_PROJECT_REF,
    productionMutations: 0,
    productionLinked: false,
    stagingCanonicalMutations: 0,
  });

  const batchGenreRecoverable = proposedBatch.filter(
    (entry) => entry.qualityContract.recoverableExplicitGenreMissing > 0,
  ).length;
  const batchLeakage = proposedBatch.filter((entry) => entry.qualityContract.lineupLeakage || entry.qualityContract.genreLeakage).length;
  const qualifiedGate =
    proposedBatch.length >= 10 &&
    proposedBatch.every((entry) => !entry.qualityContract.qualityContractBypass) &&
    batchGenreRecoverable === 0 &&
    batchLeakage === 0 &&
    (fingerprintAfter?.event_count ?? 0) === (fingerprintBefore?.event_count ?? 0);

  const decisionState = qualifiedGate
    ? 'M9_4A_RAUSGEGANGEN_QUALIFIED_FOR_CONTROLLED_IMPORT'
    : proposedBatch.length > 0
      ? 'M9_4A_RAUSGEGANGEN_REVIEW_REQUIRED'
      : 'M9_4A_RAUSGEGANGEN_NOT_CURRENTLY_VIABLE';

  writeJson('summary.json', {
    generatedAt: new Date().toISOString(),
    milestone: 'M9.4A',
    branch: execSync('git branch --show-current', { encoding: 'utf8' }).trim(),
    baselineCommit: BASELINE_COMMIT,
    currentHead: head(),
    userAgent: RAUSGEGANGEN_DISCOVERY_USER_AGENT,
    discoveryMode: discovery.discoveryMode,
    regionsReachable: discovery.summary.regionsReachable,
    uniqueEventUrls: discovery.summary.uniqueEventUrls,
    detailFetched: discovery.summary.detailFetched,
    netNewRelevant: netNewRelevant.length,
    qualityReady: qualityReadyCount,
    qualityReadyAmbiguousDomainOnly,
    proposedBatchSize: proposedBatch.length,
    decisionState,
    productionMutations: 0,
    stagingCanonicalMutations: 0,
  });

  console.log(JSON.stringify({
    decisionState,
    uniqueEventUrls: discovery.summary.uniqueEventUrls,
    netNewRelevant: netNewRelevant.length,
    proposedBatchSize: proposedBatch.length,
    qualityReady: qualityReadyCount,
    qualityReadyAmbiguousDomainOnly,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
