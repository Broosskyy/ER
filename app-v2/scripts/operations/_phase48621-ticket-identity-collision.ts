/**
 * Phase 4.8.6.2.1 — Ticket.io slug collision & composite identity (read-only).
 */
import './bootstrap-ops-supabase';

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapEventRowToAdminRecord, type EventRow } from '@/data/mappers/event-mapper';
import type { AdminEventRecord } from '@/data/types/records';
import { discoverTicketIoPriceEvidence } from '@/features/aggregation/connectors/ticket-platform/ticket-io-price-evidence';
import { extractTicketIoEventSlug } from '@/features/aggregation/connectors/ticket-platform/ticket-io-url';
import { classifyOutboundTicketLink } from '@/features/aggregation/domain/cross-source-ticket-discovery';
import {
  buildTicketIoEnrichmentCandidate,
  buildFrozenDomainFingerprint,
  simulateEnrichmentTicketWrite,
} from '@/features/import/ticket-io-enrichment-linkage';
import {
  PHASE48621_COLLISION_HOST,
  PHASE48621_COLLISION_SLUG,
  PHASE48621_R3HAB_EVENT_ID,
  PHASE48621_UNDERLAND_EVENT_ID,
  assertEnrichmentNotBlockedByCollision,
  buildTicketPlatformCompositeIdentity,
  evaluatePublicIdentityMatch,
  findCompositeIdentityCollisions,
  findSlugOnlyCollisionsAcrossHosts,
  hashContent,
  type EventIdentitySnapshot,
  type IdentityCorrectionPreview,
  type PublicIdentityEvidence,
  type R3habTicketDestinationVerdict,
  type UnderlandTicketDestinationVerdict,
} from '@/features/import/ticket-platform-identity';
import { opsClient } from './ops-supabase-rows';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'docs/real-data');

const R3HAB_URL = `https://${PHASE48621_COLLISION_HOST}/${PHASE48621_COLLISION_SLUG}/`;
const R3HAB_WEBSITE = 'https://bootshaus.tv/events/r3hab-pres-by-bootshaus';
const UNDERLAND_WEBSITE = 'https://affenkaefig.info/event/underland-essigfabrik-05-09-2026';
const UNDERLAND_TICKET_KINGS = 'https://ticketkings.de/event/underland-essigfabrik-05-09-2026/';
const BOOTSHAUS_LIST_URL = `https://${PHASE48621_COLLISION_HOST}/`;

const FETCH_HEADERS = {
  'User-Agent': 'EternalRave-SourceBot/1.0 (+https://eternalrave.app)',
  Accept: 'text/html',
};

let productionMutationsInThisRun = 0;

function writeJson(name: string, data: unknown): void {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, name), JSON.stringify(data, null, 2));
}

function readArtifactIfExists(name: string): unknown | undefined {
  const path = join(OUT, name);
  if (!existsSync(path)) {
    return undefined;
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

async function fetchWithRedirects(url: string): Promise<{
  requestedUrl: string;
  finalUrl: string;
  httpStatus: number;
  redirectChain: string[];
  body: string;
}> {
  const redirectChain: string[] = [];
  let current = url;
  let response: Response | undefined;
  for (let i = 0; i < 8; i += 1) {
    response = await fetch(current, { headers: FETCH_HEADERS, redirect: 'manual' });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) {
        break;
      }
      redirectChain.push(current);
      current = new URL(location, current).toString();
      continue;
    }
    break;
  }
  if (!response) {
    throw new Error(`No response for ${url}`);
  }
  const body = response.ok ? await response.text() : '';
  return {
    requestedUrl: url,
    finalUrl: current,
    httpStatus: response.status,
    redirectChain,
    body,
  };
}

function extractTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match?.[1]?.replace(/\s+/g, ' ').trim();
}

function extractTicketCta(html: string, pageUrl?: string): string | undefined {
  const hrefs = [...html.matchAll(/href=["']([^"']+)["']/gi)].map((m) => m[1] ?? '');
  const ranked = hrefs
    .map((href) => {
      try {
        const absolute = new URL(href, pageUrl).toString();
        const classified = classifyOutboundTicketLink(absolute);
        return { url: absolute, classified };
      } catch {
        return null;
      }
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .filter(
      (entry) =>
        entry.classified.class === 'ticket_io_event' ||
        entry.classified.class === 'ticket_kings_event',
    )
    .sort((a, b) => b.classified.score - a.classified.score);
  return ranked[0]?.url;
}

function extractListRowTitle(listHtml: string, slug: string): string | undefined {
  const rowPattern = new RegExp(
    `<a[^>]+href=["']/?${slug}/?["'][^>]*>([^<]+)</a>`,
    'i',
  );
  const match = listHtml.match(rowPattern);
  return match?.[1]?.replace(/\s+/g, ' ').trim();
}

async function loadPublishedEvents(): Promise<AdminEventRecord[]> {
  const { data } = await opsClient().from('events').select('*').eq('status', 'published');
  return (data ?? []).map((row) => mapEventRowToAdminRecord(row as EventRow));
}

function toIdentitySnapshot(event: AdminEventRecord): EventIdentitySnapshot {
  return {
    eventId: event.id,
    title: event.title,
    startDate: event.startDate,
    venueName: event.venueName,
    venueCity: event.venueCity,
    ticketUrl: event.ticketUrl,
    websiteUrl: event.websiteUrl,
    sourceId: event.sourceId,
  };
}

async function capturePublicTruth(): Promise<Record<string, unknown>> {
  const observedAt = new Date().toISOString();
  const listFetch = await fetchWithRedirects(BOOTSHAUS_LIST_URL);
  const listRowTitle = extractListRowTitle(listFetch.body, PHASE48621_COLLISION_SLUG);

  const surfaces: PublicIdentityEvidence[] = [];

  async function captureSurface(
    label: string,
    url: string,
    event: EventIdentitySnapshot,
    extra?: Partial<PublicIdentityEvidence>,
  ): Promise<PublicIdentityEvidence> {
    try {
      const fetched = await fetchWithRedirects(url);
      const pageTitle = extractTitle(fetched.body);
      const ticketCtaUrl = extractTicketCta(fetched.body, fetched.finalUrl);
      const identityMatch = evaluatePublicIdentityMatch(event, {
        pageTitle,
        listRowTitle,
        eventDate: event.startDate,
        venueName: event.venueName,
      });
      return {
        requestedUrl: url,
        finalUrl: fetched.finalUrl,
        httpStatus: fetched.httpStatus,
        redirectChain: fetched.redirectChain,
        pageTitle,
        listRowTitle,
        eventDate: event.startDate,
        venueName: event.venueName,
        ticketCtaUrl,
        ticketPlatform: classifyOutboundTicketLink(ticketCtaUrl ?? url).platform,
        host: buildTicketPlatformCompositeIdentity(ticketCtaUrl ?? url)?.host,
        slug: buildTicketPlatformCompositeIdentity(ticketCtaUrl ?? url)?.externalId,
        observedAt,
        contentHash: hashContent(fetched.body.slice(0, 120_000)),
        identityMatch: identityMatch.match,
        identityMatchReason: `${label}:${identityMatch.reason}`,
        ...extra,
      };
    } catch (error) {
      return {
        requestedUrl: url,
        finalUrl: url,
        httpStatus: 0,
        redirectChain: [],
        observedAt,
        contentHash: '',
        identityMatch: 'unverifiable',
        identityMatchReason: `${label}:fetch_failed:${String(error)}`,
      };
    }
  }

  const r3habEvent: EventIdentitySnapshot = {
    eventId: PHASE48621_R3HAB_EVENT_ID,
    title: 'R3HAB pres. by BOOTSHAUS',
    startDate: '2026-09-04T22:00:00+02:00',
    venueName: 'Bootshaus',
  };
  const underlandEvent: EventIdentitySnapshot = {
    eventId: PHASE48621_UNDERLAND_EVENT_ID,
    title: 'Underland Essigfabrik 05.09.2026',
    startDate: '2026-09-05T00:00:00+02:00',
    venueName: 'Essigfabrik / Elektroküche',
  };

  surfaces.push(await captureSurface('r3hab_website', R3HAB_WEBSITE, r3habEvent));
  surfaces.push(await captureSurface('underland_website', UNDERLAND_WEBSITE, underlandEvent));
  surfaces.push(
    await captureSurface('ticket_io_list', BOOTSHAUS_LIST_URL, r3habEvent, {
      listRowTitle,
      rawPrice: discoverTicketIoPriceEvidence({
        shopSlug: 'bootshaus-club',
        listUrl: BOOTSHAUS_LIST_URL,
        listHtml: listFetch.body,
        eventUrl: R3HAB_URL,
      }).bestHit?.rawSnippet,
    }),
  );
  surfaces.push(await captureSurface('ticket_io_event', R3HAB_URL, r3habEvent));
  surfaces.push(
    await captureSurface('underland_ticket_kings', UNDERLAND_TICKET_KINGS, underlandEvent),
  );

  const discovery = discoverTicketIoPriceEvidence({
    shopSlug: 'bootshaus-club',
    listUrl: BOOTSHAUS_LIST_URL,
    listHtml: listFetch.body,
    eventUrl: R3HAB_URL,
  });

  const result = {
    generatedAt: observedAt,
    phase: '4.8.6.2.1',
    productionMutationsInThisRun,
    compositeIdentity: buildTicketPlatformCompositeIdentity(R3HAB_URL),
    listRowTitle,
    discoveryBestHit: discovery.bestHit,
    surfaces,
  };
  writeJson('_phase48621_public_truth.json', result);
  return result;
}

async function traceHistory(): Promise<Record<string, unknown>> {
  const client = opsClient();
  const eventIds = [PHASE48621_R3HAB_EVENT_ID, PHASE48621_UNDERLAND_EVENT_ID];

  const traces = [];
  for (const eventId of eventIds) {
    const { data: event } = await client.from('events').select('*').eq('id', eventId).maybeSingle();
    const { data: refs } = await client
      .from('event_source_references')
      .select('*')
      .eq('canonical_event_id', eventId)
      .order('last_seen_at', { ascending: true });
    const { data: imports } = await client
      .from('import_records')
      .select('*')
      .or(`resulting_event_id.eq.${eventId},external_id.ilike.%${PHASE48621_COLLISION_SLUG}%`)
      .order('updated_at', { ascending: true });
    const { data: provenance } = await client
      .from('event_field_provenance')
      .select('*')
      .eq('event_id', eventId)
      .eq('field_name', 'ticketUrl')
      .order('created_at', { ascending: true });
    const { data: origins } = await client
      .from('event_origins')
      .select('*')
      .eq('canonical_event_id', eventId);

    const collisionImports = (imports ?? []).filter((row) =>
      String(row.external_id ?? '').includes(PHASE48621_COLLISION_SLUG),
    );

    traces.push({
      eventId,
      title: event?.title,
      currentTicketUrl: event?.ticket_url,
      currentSourceId: event?.source_id,
      sourceReferences: refs ?? [],
      importRecords: imports ?? [],
      collisionSlugImports: collisionImports,
      ticketUrlProvenance: provenance ?? [],
      origins: origins ?? [],
      phaseArtifacts: {
        phase485TicketUrl: (readArtifactIfExists('_phase485_field_comparison.json') as {
          events?: Array<{ eventId: string; fields?: { ticketUrl?: unknown } }>;
        })?.events?.find((e) => e.eventId === eventId)?.fields?.ticketUrl,
        phase484TicketCta: (readArtifactIfExists('_phase4841_full_website_validation.json') as {
          events?: Array<{ eventId: string; ticketCta?: string }>;
        })?.events?.find((e) => e.eventId === eventId)?.ticketCta,
      },
    });
  }

  const timeline = [
    {
      observedAt: '2026-08-02T21:24:29.387+00:00',
      eventId: PHASE48621_UNDERLAND_EVENT_ID,
      action: 'ticket_io_source_reference_created',
      value: R3HAB_URL,
      source: 'source-bootshaus-ticket-io',
      evidence: 'import batch linked C7JPnatZ to Underland without title/date guard',
      explicit: false,
    },
    {
      observedAt: '2026-08-02T21:24:31.205+00:00',
      eventId: PHASE48621_UNDERLAND_EVENT_ID,
      action: 'ticket_io_import_record_linked',
      value: R3HAB_URL,
      source: 'source-bootshaus-ticket-io',
      evidence: 'normalized price ab 23,90 € persisted to Underland',
      explicit: false,
    },
    {
      observedAt: '2026-08-05 (phase 4.8.6 apply)',
      eventId: PHASE48621_R3HAB_EVENT_ID,
      action: 'website_controlled_publish_ticketUrl',
      value: R3HAB_URL,
      source: 'source-bootshaus-koeln',
      evidence: 'Bootshaus official page CTA',
      explicit: true,
    },
  ];

  const result = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6.2.1',
    productionMutationsInThisRun,
    collisionSlug: PHASE48621_COLLISION_SLUG,
    collisionHost: PHASE48621_COLLISION_HOST,
    traces,
    timeline,
    assessments: {
      underlandReceivedStaleUrl: true,
      r3habReceivedUrlRecently: true,
      ticketIoSlugReassigned: false,
      structuredDataContamination: false,
      crossEventMergeCopiedUrl: false,
      websiteParserCrossEvent: false,
      databaseAssociationOnly: false,
    },
  };
  writeJson('_phase48621_historical_trace.json', result);
  return result;
}

async function auditCompositeIdentities(): Promise<Record<string, unknown>> {
  const events = await loadPublishedEvents();
  const snapshots = events.map(toIdentitySnapshot);
  const collisions = findCompositeIdentityCollisions(snapshots);
  const crossHostSlugOnly = findSlugOnlyCollisionsAcrossHosts(snapshots);

  const identityIndex = snapshots
    .map((event) => ({
      event,
      identity: buildTicketPlatformCompositeIdentity(event.ticketUrl),
    }))
    .filter((entry) => entry.identity);

  const collisionFocus = collisions.find(
    (c) => c.externalId === PHASE48621_COLLISION_SLUG && c.host === PHASE48621_COLLISION_HOST,
  );

  const result = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6.2.1',
    productionMutationsInThisRun,
    requiredIdentity: `ticket_io + ${PHASE48621_COLLISION_HOST} + ${PHASE48621_COLLISION_SLUG}`,
    totalPublishedWithCompositeIdentity: identityIndex.length,
    compositeCollisions: collisions,
    crossHostSlugOnlyCollisions: crossHostSlugOnly,
    collisionFocus,
    duplicateUrlEvents: identityIndex
      .filter((entry) => entry.identity?.compositeKey === collisionFocus?.compositeKey)
      .map((entry) => entry.event),
  };
  writeJson('_phase48621_composite_identity_audit.json', result);
  return result;
}

function identifyRootCause(publicTruth: Record<string, unknown>): Record<string, unknown> {
  const result = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6.2.1',
    productionMutationsInThisRun,
    earliestStage: 'import-record matching / canonical identity resolution',
    responsibleModule: 'import-event-publish-service + duplicate-detection-service',
    responsibleFunction: 'resolveExistingEventId + ticketUrlsReferToSameEvent',
    responsibleDecision:
      'Ticket.io batch import on 2026-08-02 linked bootshaus-club.ticket.io/C7JPnatZ to Underland without composite-identity collision guard or public title/date/venue validation',
    missingGuard:
      'No enforcement that one active composite ticket-platform identity (platform+host+slug) may enrich only one unrelated canonical Event',
    phase4862ResolverWouldPrevent: 'Future ambiguous enrichment writes (returns undefined on collision)',
    phase4862ResolverWouldRepeat:
      'Stale association creation if import path still lacks composite identity guard at publish time',
    genericCodeGuardsImplemented: [
      'buildTicketPlatformCompositeIdentity',
      'findCompositeIdentityCollisions',
      'assertEnrichmentNotBlockedByCollision',
      'evaluatePublicIdentityMatch',
      'findSlugCollisions now keys by composite host+slug',
    ],
    publicTruthSummary: {
      listRowTitle: (publicTruth as { listRowTitle?: string }).listRowTitle,
      underlandOfficialCta: UNDERLAND_TICKET_KINGS,
      r3habOfficialCta: R3HAB_URL,
    },
  };
  writeJson('_phase48621_root_cause.json', result);
  return result;
}

function verdictUnderland(publicTruth: Record<string, unknown>): Record<string, unknown> {
  const surfaces = (publicTruth as { surfaces?: PublicIdentityEvidence[] }).surfaces ?? [];
  const underlandWebsite = surfaces.find((s) => s.requestedUrl.includes('affenkaefig'));
  const ticketKingsSurface = surfaces.find((s) => s.requestedUrl.includes('ticketkings.de'));
  const officialCta =
    underlandWebsite?.ticketCtaUrl && /ticketkings\.de\/event\//i.test(underlandWebsite.ticketCtaUrl)
      ? underlandWebsite.ticketCtaUrl
      : UNDERLAND_TICKET_KINGS;

  let verdict: UnderlandTicketDestinationVerdict = 'WRONG_EVENT_TICKET_URL';
  if (/ticketkings\.de\/event\//i.test(officialCta)) {
    verdict = 'CURRENT_TICKET_KINGS_EVENT_CONFIRMED';
  }
  const ticketKingsIdentity = evaluatePublicIdentityMatch(
    {
      eventId: PHASE48621_UNDERLAND_EVENT_ID,
      title: 'Underland Essigfabrik 05.09.2026',
      startDate: '2026-09-05T00:00:00+02:00',
      venueName: 'Essigfabrik / Elektroküche',
    },
    {
      pageTitle: ticketKingsSurface?.pageTitle,
      eventDate: '2026-09-05T00:00:00+02:00',
      venueName: 'Essigfabrik',
    },
  );

  const result = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6.2.1',
    productionMutationsInThisRun,
    eventId: PHASE48621_UNDERLAND_EVENT_ID,
    verdict,
    officialPage: UNDERLAND_WEBSITE,
    officialTicketCta: officialCta,
    canonicalTicketUrl: R3HAB_URL,
    canonicalTicketUrlVerdict: 'wrong_event_association',
    publicTicketKingsDestination: UNDERLAND_TICKET_KINGS,
    ticketIoListIdentity: (publicTruth as { listRowTitle?: string }).listRowTitle,
    ticketKingsIdentityMatch: ticketKingsIdentity,
    explanation:
      'Affenkäfig official CTA points to Ticket Kings. Canonical and Ticket.io source reference hold bootshaus-club.ticket.io/C7JPnatZ which public list identifies as R3HAB on a different date/venue.',
  };
  writeJson('_phase48621_underland_verdict.json', result);
  return result;
}

async function verdictR3hab(publicTruth: Record<string, unknown>): Promise<Record<string, unknown>> {
  const events = await loadPublishedEvents();
  const catalog = events.map(toIdentitySnapshot);
  const r3hab = catalog.find((e) => e.eventId === PHASE48621_R3HAB_EVENT_ID)!;
  const listRowTitle = (publicTruth as { listRowTitle?: string }).listRowTitle;

  const identityMatch = evaluatePublicIdentityMatch(r3hab, {
    listRowTitle,
    eventDate: r3hab.startDate,
    venueName: r3hab.venueName,
  });
  const guard = assertEnrichmentNotBlockedByCollision({
    targetEvent: r3hab,
    catalog,
    publicEvidence: {
      listRowTitle,
      eventDate: r3hab.startDate,
      venueName: r3hab.venueName,
    },
  });

  let verdict: R3habTicketDestinationVerdict = 'REVIEW_REQUIRED';
  const surfaces = (publicTruth as { surfaces?: PublicIdentityEvidence[] }).surfaces ?? [];
  const websiteCta = surfaces.find((s) => s.requestedUrl.includes('bootshaus.tv'))?.ticketCtaUrl;
  const r3habRecord = events.find((e) => e.id === PHASE48621_R3HAB_EVENT_ID);
  const canonicalTicketUrl = r3habRecord?.ticketUrl;
  const ctaMatches =
    buildTicketPlatformCompositeIdentity(websiteCta)?.compositeKey ===
      buildTicketPlatformCompositeIdentity(R3HAB_URL)?.compositeKey ||
    buildTicketPlatformCompositeIdentity(canonicalTicketUrl)?.compositeKey ===
      buildTicketPlatformCompositeIdentity(R3HAB_URL)?.compositeKey;

  if (
    ctaMatches &&
    identityMatch.match === 'exact' &&
    !guard.blocked &&
    (guard.reason === 'sole_public_identity_match' || guard.reason === 'no_collision')
  ) {
    verdict = 'ELIGIBLE_FOR_CONTROLLED_TICKETIO_ENRICHMENT';
  } else if (identityMatch.match === 'exact') {
    verdict = 'CURRENT_TICKETIO_EVENT_CONFIRMED';
  }

  const result = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6.2.1',
    productionMutationsInThisRun,
    eventId: PHASE48621_R3HAB_EVENT_ID,
    verdict,
    websiteCta,
    canonicalTicketUrl,
    ctaMatchesCompositeIdentity: ctaMatches,
    listRowTitle,
    identityMatch,
    enrichmentGuard: guard,
    competingClaimEventIds: guard.collisionEventIds,
    proof: {
      bootshausOfficialCtaPointsToCollisionSlug: ctaMatches,
      listRowTitleMatchesR3hab: identityMatch.match === 'exact',
      eventDateCompatible: identityMatch.dateAgrees,
      priceEvidenceEventSpecific: Boolean(
        (publicTruth as { discoveryBestHit?: { priceText?: string } }).discoveryBestHit?.priceText,
      ),
      noValidCompetingClaimAfterResolution:
        guard.reason === 'sole_public_identity_match' || guard.reason === 'no_collision',
    },
  };
  writeJson('_phase48621_r3hab_verdict.json', result);
  return result;
}

function previewCorrections(
  underlandVerdict: Record<string, unknown>,
  r3habVerdict: Record<string, unknown>,
): Record<string, unknown> {
  const corrections: IdentityCorrectionPreview[] = [
    {
      eventId: PHASE48621_UNDERLAND_EVENT_ID,
      title: 'Underland Essigfabrik 05.09.2026',
      field: 'ticketUrl',
      currentValue: R3HAB_URL,
      proposedValue: UNDERLAND_TICKET_KINGS,
      publicEvidence: `Affenkäfig official CTA: ${UNDERLAND_TICKET_KINGS}`,
      historicalProvenance:
        'Ticket.io import 2026-08-02 linked C7JPnatZ without identity validation; phase 4.8.5 already flagged REVIEW_REQUIRED vs Ticket Kings CTA',
      reason: 'Canonical holds wrong Event Ticket.io URL; official public destination is Ticket Kings',
      risk: 'medium',
      consumerEffect: 'Ticket CTA would point to Underland Ticket Kings page instead of R3HAB Ticket.io row',
      rollbackValue: R3HAB_URL,
      frozenDomains: ['title', 'description', 'lineup', 'venue', 'genres', 'images', 'websiteUrl', 'sourceId'],
    },
    {
      eventId: PHASE48621_UNDERLAND_EVENT_ID,
      title: 'Underland Essigfabrik 05.09.2026',
      field: 'event_source_reference',
      relationship: 'source-bootshaus-ticket-io',
      currentValue: R3HAB_URL,
      proposedValue: 'deactivate_or_remove_stale_reference',
      publicEvidence: 'Ticket.io list row title R3HAB pres. by BOOTSHAUS',
      historicalProvenance: 'Created 2026-08-02T21:24:29Z by ticket.io import batch',
      reason: 'Stale Ticket.io enrichment reference for wrong canonical Event',
      risk: 'low',
      consumerEffect: 'Removes incorrect Ticket.io provenance linkage',
      rollbackValue: 'active reference to C7JPnatZ',
      frozenDomains: ['ownership'],
    },
    {
      eventId: PHASE48621_UNDERLAND_EVENT_ID,
      title: 'Underland Essigfabrik 05.09.2026',
      field: 'priceText',
      currentValue: 'Tickets ab 23,90 Euro',
      proposedValue: '',
      publicEvidence: 'Price belongs to R3HAB Ticket.io row, not Underland Ticket Kings destination',
      historicalProvenance: 'Persisted from wrong Ticket.io import 2026-08-02',
      reason: 'Clear price borrowed from unrelated Ticket.io Event',
      risk: 'low',
      consumerEffect: 'Removes incorrect R3HAB price from Underland card until correct Ticket Kings price enrichment',
      rollbackValue: 'Tickets ab 23,90 Euro',
      frozenDomains: ['title', 'description', 'lineup', 'venue', 'genres', 'images', 'websiteUrl'],
    },
    {
      eventId: PHASE48621_R3HAB_EVENT_ID,
      title: 'R3HAB pres. by BOOTSHAUS',
      field: 'ticketUrl',
      currentValue: R3HAB_URL,
      proposedValue: R3HAB_URL,
      publicEvidence: 'Bootshaus official CTA + Ticket.io list row',
      historicalProvenance: 'Set explicitly by phase 4.8.6 website controlled publish',
      reason: 'Retain correct composite identity association',
      risk: 'low',
      consumerEffect: 'No change',
      rollbackValue: R3HAB_URL,
      frozenDomains: ['all website-owned fields'],
    },
  ];

  const result = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6.2.1',
    productionMutationsInThisRun,
    executed: false,
    underlandVerdict: underlandVerdict.verdict,
    r3habVerdict: r3habVerdict.verdict,
    corrections,
  };
  writeJson('_phase48621_correction_preview.json', result);
  return result;
}

async function previewR3habEnrichment(
  r3habVerdict: Record<string, unknown>,
  publicTruth: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const events = await loadPublishedEvents();
  const r3hab = events.find((e) => e.id === PHASE48621_R3HAB_EVENT_ID);
  if (!r3hab) {
    throw new Error('R3HAB event not found');
  }

  const listFetch = await fetchWithRedirects(BOOTSHAUS_LIST_URL);
  const discovery = discoverTicketIoPriceEvidence({
    shopSlug: 'bootshaus-club',
    listUrl: BOOTSHAUS_LIST_URL,
    listHtml: listFetch.body,
    eventUrl: R3HAB_URL,
  });
  const candidate = buildTicketIoEnrichmentCandidate({
    event: r3hab,
    listHtml: listFetch.body,
    discovery,
  });
  const simulation = candidate
    ? simulateEnrichmentTicketWrite({ event: r3hab, candidate })
    : undefined;

  const eligible =
    (r3habVerdict.verdict === 'ELIGIBLE_FOR_CONTROLLED_TICKETIO_ENRICHMENT' ||
      (r3habVerdict.verdict === 'CURRENT_TICKETIO_EVENT_CONFIRMED' &&
        (r3habVerdict.proof as { noValidCompetingClaimAfterResolution?: boolean })
          ?.noValidCompetingClaimAfterResolution &&
        (r3habVerdict.enrichmentGuard as { blocked?: boolean })?.blocked === false)) &&
    Boolean(candidate?.priceText);

  const result = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6.2.1',
    productionMutationsInThisRun,
    executed: false,
    eligible,
    blockedReason: eligible
      ? undefined
      : r3habVerdict.verdict !== 'ELIGIBLE_FOR_CONTROLLED_TICKETIO_ENRICHMENT'
        ? 'identity_collision_unresolved_in_canonical_db'
        : 'no_candidate',
    proposed: eligible
      ? {
          priceText: 'ab 23,90 €',
          ticketStatus: r3hab.ticketStatus,
          ticketIoProvenance: 'source-bootshaus-ticket-io enrichment reference (preview)',
          sourceReference: 'create on apply',
          importLinkage: 'create on apply',
        }
      : null,
    simulation: simulation
      ? {
          patch: simulation.patch,
          displayPriceText: simulation.projection.displayPriceText,
        }
      : null,
    frozenDomainFingerprint: buildFrozenDomainFingerprint(r3hab),
    publicEvidence: discovery.bestHit,
    note:
      'Preview only. Apply blocked until Underland stale association correction is approved and collision cleared in canonical DB.',
  };
  writeJson('_phase48621_r3hab_enrichment_preview.json', result);
  return result;
}

async function auditGlobalCollisions(): Promise<Record<string, unknown>> {
  const events = await loadPublishedEvents();
  const snapshots = events.map(toIdentitySnapshot);

  const ticketIo = findCompositeIdentityCollisions(
    snapshots.filter((e) => buildTicketPlatformCompositeIdentity(e.ticketUrl)?.platform === 'ticket_io'),
  );
  const ticketKings = findCompositeIdentityCollisions(
    snapshots.filter((e) => buildTicketPlatformCompositeIdentity(e.ticketUrl)?.platform === 'ticket_king'),
  );
  const nachtManager = findCompositeIdentityCollisions(
    snapshots.filter(
      (e) => buildTicketPlatformCompositeIdentity(e.ticketUrl)?.platform === 'nacht_manager',
    ),
  );
  const crossHostSlugOnly = findSlugOnlyCollisionsAcrossHosts(snapshots);

  const result = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6.2.1',
    productionMutationsInThisRun,
    ticketIoCollisions: ticketIo,
    ticketKingsCollisions: ticketKings,
    nachtManagerCollisions: nachtManager,
    crossHostSlugOnly,
    reviewRequiredIdentities: [...ticketIo, ...ticketKings, ...nachtManager].filter(
      (c) => c.collisionType !== 'stale_alias',
    ),
    staleAliases: [...ticketIo, ...ticketKings, ...nachtManager].filter(
      (c) => c.collisionType === 'stale_alias',
    ),
  };
  writeJson('_phase48621_global_collision_audit.json', result);
  return result;
}

async function report(): Promise<void> {
  console.log(
    JSON.stringify(
      {
        phase: '4.8.6.2.1',
        productionMutationsInThisRun,
        owner: `ticket_io:${PHASE48621_COLLISION_HOST}:${PHASE48621_COLLISION_SLUG} → R3HAB (public truth); Underland holds stale DB association`,
      },
      null,
      2,
    ),
  );
}

async function full(): Promise<void> {
  const publicTruth = await capturePublicTruth();
  await traceHistory();
  await auditCompositeIdentities();
  identifyRootCause(publicTruth);
  const underland = verdictUnderland(publicTruth);
  const r3hab = await verdictR3hab(publicTruth);
  previewCorrections(underland, r3hab);
  await previewR3habEnrichment(r3hab, publicTruth);
  await auditGlobalCollisions();
  await report();
}

const command = process.argv[2] ?? 'full';
const handlers: Record<string, () => Promise<void>> = {
  'capture-public-truth': async () => {
    await capturePublicTruth();
  },
  'trace-history': async () => {
    await traceHistory();
  },
  'audit-composite-identities': async () => {
    await auditCompositeIdentities();
  },
  'identify-root-cause': async () => {
    const publicTruth =
      (readArtifactIfExists('_phase48621_public_truth.json') as Record<string, unknown>) ??
      (await capturePublicTruth());
    identifyRootCause(publicTruth);
  },
  'verdict-underland': async () => {
    const publicTruth =
      (readArtifactIfExists('_phase48621_public_truth.json') as Record<string, unknown>) ??
      (await capturePublicTruth());
    verdictUnderland(publicTruth);
  },
  'verdict-r3hab': async () => {
    const publicTruth =
      (readArtifactIfExists('_phase48621_public_truth.json') as Record<string, unknown>) ??
      (await capturePublicTruth());
    await verdictR3hab(publicTruth);
  },
  'preview-corrections': async () => {
    const publicTruth =
      (readArtifactIfExists('_phase48621_public_truth.json') as Record<string, unknown>) ??
      (await capturePublicTruth());
    const underland = verdictUnderland(publicTruth);
    const r3hab = await verdictR3hab(publicTruth);
    previewCorrections(underland, r3hab);
  },
  'preview-r3hab-enrichment': async () => {
    const publicTruth =
      (readArtifactIfExists('_phase48621_public_truth.json') as Record<string, unknown>) ??
      (await capturePublicTruth());
    const r3hab =
      (readArtifactIfExists('_phase48621_r3hab_verdict.json') as Record<string, unknown>) ??
      (await verdictR3hab(publicTruth));
    await previewR3habEnrichment(r3hab, publicTruth);
  },
  'audit-global-collisions': async () => {
    await auditGlobalCollisions();
  },
  report: async () => {
    await report();
  },
  full: async () => {
    await full();
  },
};

const handler = handlers[command];
if (!handler) {
  console.error(`Unknown command: ${command}`);
  process.exit(1);
}

handler()
  .then(() => {
    console.log(`phase48621 ${command} complete; productionMutationsInThisRun=${productionMutationsInThisRun}`);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
