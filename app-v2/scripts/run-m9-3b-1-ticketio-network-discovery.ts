#!/usr/bin/env tsx
/**
 * M9.3B.1 — Read-only ticket.io network discovery dry run.
 * No DB writes, no staging mutations, no production access.
 */
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  assertProductionNotLinked,
  createSupabaseCliLinkedQueryExecutor,
  loadJsonAgg,
  verifyLinkedStagingTarget,
} from '../server/ingestion/sync/linked-db';
import type { StagingCatalogEvent } from '../server/official-connectors/ticket-evidence/network-discovery/match-staging-catalog';
import {
  mediaEvidenceMetrics,
  runTicketIoNetworkDiscovery,
  ticketEvidenceMetrics,
} from '../server/official-connectors/ticket-evidence/network-discovery/ticket-io-network-discovery';

const OUT = join(process.cwd(), '..', 'artifacts', 'm9-3b-1-ticketio-network-discovery');
const REFERENCE = new Date('2026-09-02T12:00:00+02:00');

const GOLDEN_ANCHORS = [
  { pattern: /chris\s+stas{1,2}y/i, label: 'Chris Stussy' },
  { pattern: /nye|new\s+years?\s+eve|silvester/i, label: 'NYE 2026' },
  { pattern: /zaagstep/i, label: 'ZAAGSTEP' },
  { pattern: /unreal\s+weekender.*night\s+i/i, label: 'Unreal Weekender Night I' },
];

function baselineHead(): string {
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
        t.ticket_url,
        e.official_url,
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

async function main() {
  mkdirSync(OUT, { recursive: true });
  const cwd = process.cwd();
  assertProductionNotLinked(cwd);
  verifyLinkedStagingTarget(cwd);
  const runQuery = createSupabaseCliLinkedQueryExecutor(cwd);
  const stagingCatalog = loadStagingCatalog(runQuery);

  const result = await runTicketIoNetworkDiscovery({
    referenceInstant: REFERENCE,
    stagingCatalog,
    baselineHead: baselineHead(),
    sampleDetailCountPerShop: 3,
  });

  const relevance = result.events.map((event) => ({
    identityKey: event.identityKey,
    title: event.title,
    relevance: event.relevance,
    reasons: event.relevanceReasons,
    lifecycle: event.lifecycle,
  }));

  const matches = result.events.map((event) => ({
    identityKey: event.identityKey,
    title: event.title,
    matchClassification: event.matchClassification,
    matchedEventId: event.matchedEventId,
    matchedEventTitle: event.matchedEventTitle,
    matchReasons: event.matchReasons,
  }));

  const goldenRegression = GOLDEN_ANCHORS.map((anchor) => {
    const hits = result.events.filter((event) => anchor.pattern.test(event.title));
    return {
      anchor: anchor.label,
      discovered: hits.length,
      classifications: hits.map((event) => ({
        title: event.title,
        matchClassification: event.matchClassification,
        matchedEventId: event.matchedEventId,
        ticketUrl: event.ticketUrl,
      })),
      duplicateRisk: hits.some((event) => event.matchClassification === 'NET_NEW'),
    };
  });

  const ticketEvidence = {
    metrics: ticketEvidenceMetrics(result.events),
    samples: result.events
      .filter((event) => event.lifecycle !== 'ENDED' && event.relevance !== 'IRRELEVANT')
      .slice(0, 20)
      .map((event) => ({
        title: event.title,
        ticketUrl: event.ticketUrl,
        listRawPrice: event.listRawPrice,
        listAmountMinor: event.listAmountMinor,
        listTicketStatus: event.listTicketStatus,
        visibleProducts: event.visibleProducts,
      })),
  };

  const mediaEvidence = {
    metrics: mediaEvidenceMetrics(result.events),
    samples: result.events
      .filter((event) => event.imageUrls.length > 0)
      .slice(0, 20)
      .map((event) => ({
        title: event.title,
        imageUrls: event.imageUrls,
        mediaRoles: event.mediaRoles,
      })),
  };

  writeFileSync(join(OUT, 'shops.json'), JSON.stringify(result.shops, null, 2));
  writeFileSync(join(OUT, 'events.json'), JSON.stringify(result.events, null, 2));
  writeFileSync(join(OUT, 'relevance.json'), JSON.stringify(relevance, null, 2));
  writeFileSync(join(OUT, 'matches.json'), JSON.stringify({ matches, goldenRegression }, null, 2));
  writeFileSync(
    join(OUT, 'coverage.json'),
    JSON.stringify(
      {
        coverageByCity: result.summary.coverageByCity,
        coverageByGenre: result.summary.coverageByGenre,
        shopScores: result.shopScores,
      },
      null,
      2,
    ),
  );
  writeFileSync(join(OUT, 'ticket-evidence.json'), JSON.stringify(ticketEvidence, null, 2));
  writeFileSync(join(OUT, 'media-evidence.json'), JSON.stringify(mediaEvidence, null, 2));
  writeFileSync(join(OUT, 'outbound-source-graph.json'), JSON.stringify(result.outboundGraph, null, 2));
  writeFileSync(
    join(OUT, 'summary.json'),
    JSON.stringify(
      {
        ...result.summary,
        stagingPublishedEventCount: stagingCatalog.length,
        goldenRegression,
        topShops: result.shopScores
          .filter((shop) => shop.tier !== 'REJECT')
          .sort((left, right) => right.netNewRelevantCount - left.netNewRelevantCount)
          .slice(0, 8),
      },
      null,
      2,
    ),
  );

  console.log(JSON.stringify(result.summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
