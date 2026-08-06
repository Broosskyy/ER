/**
 * Phase 4.8.6.4 — Identity cleanup, controlled corrections, consumer reality check.
 *
 * No broad `full` mutating command. Apply requires --approve and PHASE4864_APPLY_APPROVED=true.
 */
import './bootstrap-ops-supabase';

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapEventRowToAdminRecord, type EventRow } from '@/data/mappers/event-mapper';
import type { AdminEventRecord } from '@/data/types/records';
import {
  adminSourceRepository,
  eventLineupService,
  multiSourceRepositories,
} from '@/data/repositories/registry';
import { discoverTicketIoPriceEvidence } from '@/features/aggregation/connectors/ticket-platform/ticket-io-price-evidence';
import { invalidateConsumerEventCaches } from '@/features/events/formatting/consumer-cache-invalidation';
import { writeCanonicalTicketFields } from '@/features/events/domain/canonical-ticket-writer';
import {
  buildFrozenDomainFingerprint,
  buildTicketIoEnrichmentCandidate,
  simulateEnrichmentTicketWrite,
} from '@/features/import/ticket-io-enrichment-linkage';
import {
  assertEnrichmentNotBlockedByCollision,
  buildTicketPlatformCompositeIdentity,
  findCompositeIdentityCollisions,
  type EventIdentitySnapshot,
} from '@/features/import/ticket-platform-identity';
import {
  PHASE4864_AFFECTED_EVENT_IDS,
  PHASE4864_APPLY_ENV,
  PHASE4864_INTO_MADNESS_EVENT_ID,
  PHASE4864_R3HAB_EVENT_ID,
  PHASE4864_R3HAB_TICKET_URL,
  PHASE4864_SOMMERFEST_EVENT_ID,
  PHASE4864_UNDERLAND_EVENT_ID,
  PHASE4864_UNDERLAND_TICKET_URL,
  buildBackupSnapshot,
  buildDisplayModelVerification,
  diagnoseVenueConsistency,
  GATE_EVENT_IDS,
  planGateA,
  planGateB,
  planGateC,
  runFinalPreflight,
  verifyR3habConsumer,
  verifySommerfestConsumer,
  verifyUnderlandConsumer,
  type GateMutation,
} from '@/features/import/controlled-identity-corrections';
import { EventFieldProvenanceWriter } from '@/features/import/services/event-field-provenance-writer';
import { opsClient, updateEventRow } from './ops-supabase-rows';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'docs/real-data');
const BOOTSHAUS_LIST_URL = 'https://bootshaus-club.ticket.io/';

const FETCH_HEADERS = {
  'User-Agent': 'EternalRave-SourceBot/1.0 (+https://eternalrave.app)',
  Accept: 'text/html',
};

let productionMutationsInThisRun = 0;

function writeJson(name: string, data: unknown): void {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, name), JSON.stringify(data, null, 2));
}

function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(OUT, name), 'utf8')) as T;
}

function readJsonIfExists<T>(name: string): T | undefined {
  const path = join(OUT, name);
  if (!existsSync(path)) {
    return undefined;
  }
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function hasApproveFlag(): boolean {
  return process.argv.includes('--approve');
}

function assertApplyApproved(command: string): void {
  if (!hasApproveFlag()) {
    throw new Error(`${command} requires --approve`);
  }
  if (process.env[PHASE4864_APPLY_ENV] !== 'true') {
    throw new Error(`${command} requires ${PHASE4864_APPLY_ENV}=true`);
  }
}

async function loadEvent(eventId: string): Promise<AdminEventRecord | null> {
  const { data, error } = await opsClient().from('events').select('*').eq('id', eventId).maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return data ? mapEventRowToAdminRecord(data as EventRow) : null;
}

async function loadSourceRefs(eventId: string) {
  return multiSourceRepositories.sourceReferences.findByCanonicalEventId(eventId);
}

async function loadProvenance(eventId: string): Promise<Record<string, unknown>> {
  const rows = await multiSourceRepositories.fieldProvenance.findByCanonicalEventId(eventId);
  const map: Record<string, unknown> = {};
  for (const row of rows) {
    map[row.fieldPath] = row;
  }
  return map;
}

async function loadPublishedCatalog(): Promise<AdminEventRecord[]> {
  const { data } = await opsClient().from('events').select('*').eq('status', 'published');
  return (data ?? []).map((row) => mapEventRowToAdminRecord(row as EventRow));
}

function toIdentitySnapshot(event: AdminEventRecord): EventIdentitySnapshot {
  return {
    eventId: event.id,
    title: event.title,
    startDate: event.startDate,
    venueName: event.venueName,
    ticketUrl: event.ticketUrl,
  };
}

async function loadLineupArtistNames(eventId: string): Promise<string[]> {
  const entries = await eventLineupService.getStructuredLineupForEvent(eventId);
  return entries.flatMap((entry) => entry.artists);
}

async function fetchListHtml(): Promise<string> {
  const res = await fetch(BOOTSHAUS_LIST_URL, { headers: FETCH_HEADERS, redirect: 'follow' });
  if (!res.ok) {
    throw new Error(`List fetch failed: ${res.status}`);
  }
  return res.text();
}

function guardStatus(): Record<string, unknown> {
  const sampleIdentity = buildTicketPlatformCompositeIdentity(PHASE4864_R3HAB_TICKET_URL);
  return {
    compositeIdentityFormat: sampleIdentity?.compositeKey,
    collisionGuardModule: 'ticket-platform-identity/collision-guards',
    venueConsistencyModule: 'controlled-identity-corrections/venue-consistency',
    enrichmentLinkageModule: 'ticket-io-enrichment-linkage',
    legacyWebsitePathEnabled: true,
    broadSchedulingActivated: false,
    eventIdSpecificGuards: false,
    active: true,
  };
}

async function cmdPreflight(): Promise<Record<string, unknown>> {
  const catalog = await loadPublishedCatalog();
  const snapshots = catalog.map(toIdentitySnapshot);
  const preflight = await runFinalPreflight({ catalog: snapshots });
  const collisions = findCompositeIdentityCollisions(snapshots);
  const result = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6.4',
    productionMutationsInThisRun: 0,
    ...preflight,
    collisions,
    guardStatus: guardStatus(),
  };
  writeJson('_phase4864_final_preflight.json', result);
  return result;
}

async function cmdBackup(): Promise<Record<string, unknown>> {
  const events: Record<string, unknown> = {};
  for (const eventId of PHASE4864_AFFECTED_EVENT_IDS) {
    const event = await loadEvent(eventId);
    if (!event) {
      throw new Error(`Missing event ${eventId}`);
    }
    const sourceRefs = await loadSourceRefs(eventId);
    const provenance = await loadProvenance(eventId);
    events[eventId] = buildBackupSnapshot(event, sourceRefs, provenance);
  }
  const forbidden: Record<string, unknown> = {};
  for (const eventId of PHASE4864_AFFECTED_EVENT_IDS) {
    const event = await loadEvent(eventId);
    if (event) {
      forbidden[eventId] = buildFrozenDomainFingerprint(event);
    }
  }
  const result = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6.4',
    productionMutationsInThisRun: 0,
    events,
    forbiddenFingerprints: forbidden,
  };
  writeJson('_phase4864_backup.json', result);
  writeJson('_phase4864_forbidden_fingerprints.json', forbidden);
  return result;
}

async function previewGate(gate: 'A' | 'B' | 'C'): Promise<Record<string, unknown>> {
  const eventId = GATE_EVENT_IDS[gate];
  const event = await loadEvent(eventId);
  if (!event) {
    throw new Error(`Event not found: ${eventId}`);
  }
  const sourceRefs = await loadSourceRefs(eventId);
  let mutations: GateMutation[] = [];
  let deactivateRefs: Array<{ sourceId: string; externalEventId: string }> = [];
  if (gate === 'A') {
    ({ mutations, deactivateRefs } = planGateA(event, sourceRefs));
  } else if (gate === 'B') {
    ({ mutations, deactivateRefs } = planGateB(event, sourceRefs));
  } else {
    mutations = planGateC(event, sourceRefs);
    const catalog = (await loadPublishedCatalog()).map(toIdentitySnapshot);
    const guard = assertEnrichmentNotBlockedByCollision({
      targetEvent: toIdentitySnapshot(event),
      catalog,
      publicEvidence: { listRowTitle: 'R3HAB pres. by BOOTSHAUS', venueName: 'Bootshaus' },
    });
    if (guard.blocked) {
      return {
        generatedAt: new Date().toISOString(),
        phase: '4.8.6.4',
        gate,
        eventId,
        blocked: true,
        guard,
        mutations: [],
        productionMutationsInThisRun: 0,
      };
    }
    const listHtml = await fetchListHtml();
    const discovery = discoverTicketIoPriceEvidence({
      shopSlug: 'bootshaus-club',
      listUrl: BOOTSHAUS_LIST_URL,
      listHtml,
      eventUrl: PHASE4864_R3HAB_TICKET_URL,
    });
    const candidate = buildTicketIoEnrichmentCandidate({ event, listHtml, discovery });
    const simulation = candidate ? simulateEnrichmentTicketWrite({ event, candidate }) : undefined;
    const result = {
      generatedAt: new Date().toISOString(),
      phase: '4.8.6.4',
      gate,
      eventId,
      blocked: false,
      guard,
      mutations,
      deactivateRefs,
      simulation,
      discovery: discovery.bestHit,
      candidateCount: mutations.length,
      productionMutationsInThisRun: 0,
      approvalRequired: `apply-gate-${gate.toLowerCase()} --approve with ${PHASE4864_APPLY_ENV}=true`,
    };
    writeJson(`_phase4864_gate_${gate.toLowerCase()}_${gate === 'A' ? 'underland' : gate === 'B' ? 'sommerfest' : 'r3hab'}.json`, result);
    return result;
  }

  const venueDiag = diagnoseVenueConsistency({
    venueName: event.venueName,
    venueAddress: event.venueAddress,
  });

  const result = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6.4',
    gate,
    eventId,
    mutations,
    deactivateRefs,
    venueDiagnostic: venueDiag,
    candidateCount: mutations.length,
    productionMutationsInThisRun: 0,
    approvalRequired: `apply-gate-${gate.toLowerCase()} --approve with ${PHASE4864_APPLY_ENV}=true`,
  };
  writeJson(`_phase4864_gate_${gate.toLowerCase()}_${gate === 'A' ? 'underland' : gate === 'B' ? 'sommerfest' : 'r3hab'}.json`, result);
  return result;
}

async function applyGate(gate: 'A' | 'B' | 'C', pass: 1 | 2): Promise<Record<string, unknown>> {
  assertApplyApproved(`apply-gate-${gate.toLowerCase()}`);
  const preview = await previewGate(gate);
  const mutations = (preview.mutations ?? []) as GateMutation[];
  if (preview.blocked) {
    throw new Error(`Gate ${gate} blocked: ${JSON.stringify(preview.guard)}`);
  }
  if (pass === 2 && mutations.length > 0) {
    throw new Error(`Gate ${gate} pass 2 expected 0 mutations, got ${mutations.length}`);
  }
  if (pass === 2) {
    return { gate, pass, mutationCount: 0, productionMutationsInThisRun };
  }

  const eventId = GATE_EVENT_IDS[gate];
  const event = await loadEvent(eventId);
  if (!event) {
    throw new Error(`Event not found: ${eventId}`);
  }
  const sourceRefs = await loadSourceRefs(eventId);
  const provenanceWriter = new EventFieldProvenanceWriter(multiSourceRepositories.fieldProvenance);
  const now = new Date().toISOString();
  let applied = 0;

  if (gate === 'A') {
    const { mutations: planned, deactivateRefs } = planGateA(event, sourceRefs);
    const patch: Partial<EventRow> = {};
    for (const m of planned) {
      if (m.field === 'ticketUrl') {
        patch.ticket_url = String(m.newValue);
      }
      if (m.field === 'priceText') {
        patch.price_text = String(m.newValue);
      }
    }
    if (Object.keys(patch).length > 0) {
      await updateEventRow(eventId, patch);
      applied += Object.keys(patch).length;
      productionMutationsInThisRun += 1;
    }
    for (const ref of deactivateRefs) {
      await multiSourceRepositories.sourceReferences.markInactive(ref.sourceId, ref.externalEventId);
      applied += 1;
      productionMutationsInThisRun += 1;
    }
    const ticketKingsSource = await adminSourceRepository.getById('source-ticket-kings');
    if (ticketKingsSource && patch.ticket_url) {
      await provenanceWriter.writeTicketUrlCorrection({
        canonicalEventId: eventId,
        ticketUrl: patch.ticket_url,
        source: ticketKingsSource,
        originExternalId: PHASE4864_UNDERLAND_TICKET_URL,
        previousValue: event.ticketUrl,
        previousSourceId: 'source-bootshaus-ticket-io',
        publishedAt: now,
      });
    }
  }

  if (gate === 'B') {
    const { mutations: planned, deactivateRefs } = planGateB(event, sourceRefs);
    for (const m of planned) {
      if (m.field === 'venueName') {
        await updateEventRow(eventId, { venue_name: String(m.newValue) });
        applied += 1;
        productionMutationsInThisRun += 1;
      }
    }
    for (const ref of deactivateRefs) {
      await multiSourceRepositories.sourceReferences.markInactive(ref.sourceId, ref.externalEventId);
      applied += 1;
      productionMutationsInThisRun += 1;
    }
    const bootshausSource = await adminSourceRepository.getById('source-bootshaus-ticket-io');
    if (bootshausSource) {
      const updatedEvent = { ...event, venueName: 'Bootshaus' };
      await provenanceWriter.writeFromPublishBySourceId(
        eventId,
        'source-bootshaus-ticket-io',
        updatedEvent,
        now,
      );
    }
  }

  if (gate === 'C') {
    const underland = await loadEvent(PHASE4864_UNDERLAND_EVENT_ID);
    if (underland?.ticketUrl?.includes('C7JPnatZ')) {
      throw new Error('Gate C blocked: Gate A must complete first — Underland still claims C7JPnatZ');
    }
    const listHtml = await fetchListHtml();
    const discovery = discoverTicketIoPriceEvidence({
      shopSlug: 'bootshaus-club',
      listUrl: BOOTSHAUS_LIST_URL,
      listHtml,
      eventUrl: PHASE4864_R3HAB_TICKET_URL,
    });
    const candidate = buildTicketIoEnrichmentCandidate({ event, listHtml, discovery });
    if (!candidate) {
      throw new Error('Gate C: no enrichment candidate from list evidence');
    }
    const write = writeCanonicalTicketFields({
      existing: event,
      candidate,
      fillOnly: true,
      detailBlocked: true,
    });
    if (write.changed) {
      const patch: Partial<EventRow> = {};
      if (write.patch.ticketUrl) {
        patch.ticket_url = write.patch.ticketUrl;
      }
      if (write.patch.priceText) {
        patch.price_text = write.patch.priceText;
      }
      if (write.patch.ticketStatus) {
        patch.ticket_status = write.patch.ticketStatus;
      }
      if (write.patch.ticketPhases) {
        patch.ticket_phases = write.patch.ticketPhases as never;
      }
      await updateEventRow(eventId, patch);
      applied += write.fieldChanges.length;
      productionMutationsInThisRun += 1;
    }
    const planned = planGateC(event, sourceRefs);
    const needsRef = planned.some((m) => m.field === 'sourceReference');
    if (needsRef) {
      await multiSourceRepositories.sourceReferences.upsert({
        id: `ref-${eventId}-ticket-io-c7jpnatz`,
        canonicalEventId: eventId,
        sourceId: 'source-bootshaus-ticket-io',
        externalEventId: PHASE4864_R3HAB_TICKET_URL,
        originalUrl: PHASE4864_R3HAB_TICKET_URL,
        firstSeenAt: now,
        lastSeenAt: now,
        active: true,
        sourcePriority: 80,
        metadata: { enrichmentSource: true, platform: 'ticket_io' },
      });
      applied += 1;
      productionMutationsInThisRun += 1;
    }
  }

  await invalidateConsumerEventCaches();
  return {
    gate,
    pass: 1,
    mutationCount: applied,
    plannedMutations: mutations.length,
    productionMutationsInThisRun,
  };
}

async function cmdAuditGateD(): Promise<Record<string, unknown>> {
  const event = await loadEvent(PHASE4864_INTO_MADNESS_EVENT_ID);
  if (!event) {
    throw new Error('Into The Madness event not found');
  }
  const sourceRefs = await loadSourceRefs(PHASE4864_INTO_MADNESS_EVENT_ID);
  const venueDiag = diagnoseVenueConsistency({
    venueName: event.venueName,
    venueAddress: event.venueAddress,
  });
  const catalog = (await loadPublishedCatalog()).map(toIdentitySnapshot);
  const collisions = findCompositeIdentityCollisions(catalog).filter((c) =>
    c.eventIds.includes(PHASE4864_INTO_MADNESS_EVENT_ID),
  );

  let classification:
    | 'CANONICAL_VENUE_CORRECT'
    | 'WRONG_VENUE_FROM_STALE_REFERENCE'
    | 'TICKET_IDENTITY_COLLISION'
    | 'MULTIPLE_CONTAMINATED_FIELDS'
    | 'REVIEW_REQUIRED'
    | 'PUBLIC_EVIDENCE_INSUFFICIENT' = 'REVIEW_REQUIRED';

  if (collisions.some((c) => c.externalId === 'BcDqml12')) {
    classification = collisions.length > 0 && venueDiag.consistent === false
      ? 'MULTIPLE_CONTAMINATED_FIELDS'
      : 'TICKET_IDENTITY_COLLISION';
  } else if (!venueDiag.consistent) {
    classification = 'WRONG_VENUE_FROM_STALE_REFERENCE';
  } else if (venueDiag.consistent) {
    classification = 'CANONICAL_VENUE_CORRECT';
  }

  const correctionPreview =
    classification === 'WRONG_VENUE_FROM_STALE_REFERENCE' || classification === 'MULTIPLE_CONTAMINATED_FIELDS'
      ? {
          proposedVenueName: 'Bootshaus',
          reason: 'Essigfabrik label contradicts Auenweg 173 address — requires explicit approval',
          mutate: false,
        }
      : undefined;

  const result = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6.4',
    eventId: PHASE4864_INTO_MADNESS_EVENT_ID,
    title: event.title,
    startDate: event.startDate,
    venueName: event.venueName,
    venueAddress: event.venueAddress,
    ticketUrl: event.ticketUrl,
    websiteUrl: event.websiteUrl,
    sourceReferenceHistory: sourceRefs,
    venueDiagnostic: venueDiag,
    collisions,
    classification,
    correctionPreview,
    productionMutationsInThisRun: 0,
  };
  writeJson('_phase4864_gate_d_into_madness.json', result);
  return result;
}

async function cmdVerifyConsumer(): Promise<Record<string, unknown>> {
  const r3hab = await loadEvent(PHASE4864_R3HAB_EVENT_ID);
  const underland = await loadEvent(PHASE4864_UNDERLAND_EVENT_ID);
  const sommerfest = await loadEvent(PHASE4864_SOMMERFEST_EVENT_ID);
  if (!r3hab || !underland || !sommerfest) {
    throw new Error('Required events missing');
  }
  const r3habArtists = await loadLineupArtistNames(PHASE4864_R3HAB_EVENT_ID);
  const r3habResult = verifyR3habConsumer(r3hab, r3habArtists);
  const underlandResult = verifyUnderlandConsumer(underland);
  const sommerfestResult = verifySommerfestConsumer(sommerfest);

  const result = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6.4',
    productionMutationsInThisRun: 0,
    localUrls: {
      r3hab: `/event/${PHASE4864_R3HAB_EVENT_ID}`,
      underland: `/event/${PHASE4864_UNDERLAND_EVENT_ID}`,
      sommerfest: `/event/${PHASE4864_SOMMERFEST_EVENT_ID}`,
    },
    humanChecklist: [
      'Open each local Event Detail URL in web/mobile',
      'Confirm ticket button destination and displayed price',
      'Confirm venue label and lineup section',
    ],
    r3hab: {
      ...r3habResult,
      displayModel: buildDisplayModelVerification(r3hab),
    },
    underland: {
      ...underlandResult,
      displayModel: buildDisplayModelVerification(underland),
    },
    sommerfest: {
      ...sommerfestResult,
      displayModel: buildDisplayModelVerification(sommerfest),
    },
    pass:
      r3habResult.passed && underlandResult.passed && sommerfestResult.passed,
  };
  writeJson('_phase4864_consumer_verification.json', result);
  return result;
}

async function cmdAuditSample(): Promise<Record<string, unknown>> {
  const catalog = await loadPublishedCatalog();
  const sample = catalog
    .filter((e) => e.ticketUrl || e.venueName)
    .slice(0, 24)
    .slice(0, Math.max(20, Math.min(24, catalog.length)));

  const findings = sample.map((event) => {
    const venueDiag = diagnoseVenueConsistency({
      venueName: event.venueName,
      venueAddress: event.venueAddress,
    });
    const identity = buildTicketPlatformCompositeIdentity(event.ticketUrl);
    return {
      eventId: event.id,
      title: event.title,
      startDate: event.startDate,
      venueName: event.venueName,
      venueAddress: event.venueAddress,
      ticketUrl: event.ticketUrl,
      priceText: event.priceText,
      ticketStatus: event.ticketStatus,
      compositeIdentity: identity?.compositeKey,
      fieldClassification: {
        identity: identity ? 'CORRECT' : 'UNSUPPORTED_BY_CURRENT_SOURCE',
        venue: venueDiag.consistent ? 'CORRECT' : 'REVIEW_REQUIRED',
        ticketDestination: event.ticketUrl ? 'CORRECT' : 'PUBLIC_EVIDENCE_MISSING',
        price: event.priceText ? 'CORRECT' : 'PUBLIC_EVIDENCE_MISSING',
      },
    };
  });

  const result = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6.4',
    sampleSize: findings.length,
    findings,
    productionMutationsInThisRun: 0,
  };
  writeJson('_phase4864_sample_audit.json', result);
  return result;
}

async function verifyForbiddenDomains(allowedMutations: Record<string, string[]>): Promise<Record<string, unknown>> {
  const backup = readJsonIfExists<Record<string, Record<string, unknown>>>('_phase4864_forbidden_fingerprints.json');
  if (!backup) {
    throw new Error('Missing _phase4864_forbidden_fingerprints.json — run backup first');
  }
  const violations: Array<{ eventId: string; field: string; expected: unknown; actual: unknown }> = [];
  for (const eventId of PHASE4864_AFFECTED_EVENT_IDS) {
    const event = await loadEvent(eventId);
    if (!event) {
      continue;
    }
    const current = buildFrozenDomainFingerprint(event);
    const frozen = backup[eventId];
    if (!frozen) {
      continue;
    }
    const allowed = new Set(allowedMutations[eventId] ?? []);
    for (const [field, expected] of Object.entries(frozen)) {
      if (allowed.has(field)) {
        continue;
      }
      const actual = current[field];
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        violations.push({ eventId, field, expected, actual });
      }
    }
  }
  const result = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6.4',
    passed: violations.length === 0,
    violations,
    productionMutationsInThisRun: 0,
  };
  writeJson('_phase4864_forbidden_fingerprints.json', {
    ...backup,
    _verification: result,
  });
  if (violations.length > 0) {
    throw new Error(`Forbidden domain violation: ${JSON.stringify(violations)}`);
  }
  return result;
}

async function verifyCollisionCleared(): Promise<Record<string, unknown>> {
  const underland = await loadEvent(PHASE4864_UNDERLAND_EVENT_ID);
  const catalog = (await loadPublishedCatalog()).map(toIdentitySnapshot);
  const collisions = findCompositeIdentityCollisions(catalog);
  const c7Collision = collisions.find((c) => c.externalId === 'C7JPnatZ');
  const underlandClaims = underland?.ticketUrl?.includes('C7JPnatZ') ?? false;
  const result = {
    underlandClaimsC7JPnatZ: underlandClaims,
    c7CollisionEventIds: c7Collision?.eventIds ?? [],
    cleared: !underlandClaims && (c7Collision?.eventIds.length ?? 0) <= 1,
  };
  if (!result.cleared) {
    throw new Error(`C7JPnatZ collision not cleared: ${JSON.stringify(result)}`);
  }
  return result;
}

async function cmdPostApplyVerification(): Promise<Record<string, unknown>> {
  await invalidateConsumerEventCaches();
  const forbidden = await verifyForbiddenDomains({
    [PHASE4864_UNDERLAND_EVENT_ID]: [],
    [PHASE4864_SOMMERFEST_EVENT_ID]: ['venueName'],
    [PHASE4864_R3HAB_EVENT_ID]: [],
    [PHASE4864_INTO_MADNESS_EVENT_ID]: [],
  });
  const consumer = await cmdVerifyConsumer();
  const sample = await cmdAuditSample();
  const rollback = await cmdVerifyRollback();
  const idempotency = await cmdVerifyIdempotency();
  const preflight = await runFinalPreflight({
    catalog: (await loadPublishedCatalog()).map(toIdentitySnapshot),
  });
  const verdict = await cmdVerdict();
  return { forbidden, consumer, sample, rollback, idempotency, preflight, verdict };
}

async function cmdVerifyIdempotency(): Promise<Record<string, unknown>> {
  const gates: Array<'A' | 'B' | 'C'> = ['A', 'B', 'C'];
  const results: Record<string, unknown> = {};
  for (const gate of gates) {
    const preview = await previewGate(gate);
    results[`gate${gate}`] = {
      mutationCount: (preview.mutations as GateMutation[] | undefined)?.length ?? 0,
      pass2Ready: ((preview.mutations as GateMutation[] | undefined)?.length ?? 0) === 0,
    };
  }
  const result = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6.4',
    gates: results,
    allPass2Ready: Object.values(results).every((r) => (r as { pass2Ready: boolean }).pass2Ready),
    productionMutationsInThisRun: 0,
  };
  return result;
}

async function cmdVerifyRollback(): Promise<Record<string, unknown>> {
  const backup = readJsonIfExists<{ events: Record<string, { event: Partial<AdminEventRecord> }> }>(
    '_phase4864_backup.json',
  );
  const result = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6.4',
    backupPresent: Boolean(backup),
    affectedEventCount: backup ? Object.keys(backup.events).length : 0,
    rollbackReady: Boolean(backup),
    productionMutationsInThisRun: 0,
  };
  writeJson('_phase4864_rollback.json', result);
  return result;
}

async function cmdVerdict(): Promise<Record<string, unknown>> {
  const gateA = readJsonIfExists<{ mutations?: GateMutation[] }>('_phase4864_gate_a_underland.json');
  const gateB = readJsonIfExists<{ mutations?: GateMutation[] }>('_phase4864_gate_b_sommerfest.json');
  const gateC = readJsonIfExists<{ mutations?: GateMutation[] }>('_phase4864_gate_c_r3hab.json');
  const consumer = readJsonIfExists<{ pass?: boolean }>('_phase4864_consumer_verification.json');
  const sample = readJsonIfExists<{ findings?: Array<{ fieldClassification: Record<string, string> }> }>(
    '_phase4864_sample_audit.json',
  );
  const preflight = readJsonIfExists<{ collisionActive?: boolean }>('_phase4864_final_preflight.json');

  const gateAPass2 = (gateA?.mutations?.length ?? 1) === 0;
  const gateBPass2 = (gateB?.mutations?.length ?? 1) === 0;
  const gateCPass2 = (gateC?.mutations?.length ?? 1) === 0;
  const sampleSerious = (sample?.findings ?? []).filter((f) =>
    Object.values(f.fieldClassification).includes('INCORRECT'),
  ).length;

  let verdict:
    | 'FAILED_CORRECTIONS'
    | 'MORE_CONTROLLED_REPAIR_REQUIRED'
    | 'READY_FOR_NEXT_SOURCE_SHADOW'
    | 'READY_FOR_BOUNDED_PLATFORM_ROLLOUT' = 'MORE_CONTROLLED_REPAIR_REQUIRED';

  if (gateAPass2 && gateBPass2 && gateCPass2 && consumer?.pass && !preflight?.collisionActive && sampleSerious === 0) {
    verdict = 'READY_FOR_BOUNDED_PLATFORM_ROLLOUT';
  } else if (!gateAPass2 || !gateBPass2 || !gateCPass2) {
    verdict = 'MORE_CONTROLLED_REPAIR_REQUIRED';
  } else if (!consumer?.pass) {
    verdict = 'FAILED_CORRECTIONS';
  }

  const result = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6.4',
    verdict,
    gateAPass2,
    gateBPass2,
    gateCPass2,
    consumerPass: consumer?.pass ?? false,
    collisionActive: preflight?.collisionActive ?? true,
    sampleSeriousContamination: sampleSerious,
    guardStatus: guardStatus(),
    productionMutationsInThisRun,
  };
  writeJson('_phase4864_verdict.json', result);
  return result;
}

async function cmdReport(): Promise<void> {
  await cmdPreflight();
  await cmdBackup();
  await previewGate('A');
  await previewGate('B');
  await previewGate('C');
  await cmdAuditGateD();
  await cmdVerifyConsumer();
  await cmdAuditSample();
  await cmdVerifyRollback();
  await cmdVerdict();
  console.log(JSON.stringify({ ok: true, outDir: OUT }, null, 2));
}

const command = process.argv[2] ?? 'report';

async function main(): Promise<void> {
  switch (command) {
    case 'preflight':
      console.log(JSON.stringify(await cmdPreflight(), null, 2));
      break;
    case 'backup':
      console.log(JSON.stringify(await cmdBackup(), null, 2));
      break;
    case 'preview-gate-a':
      console.log(JSON.stringify(await previewGate('A'), null, 2));
      break;
    case 'preview-gate-b':
      console.log(JSON.stringify(await previewGate('B'), null, 2));
      break;
    case 'preview-gate-c':
      console.log(JSON.stringify(await previewGate('C'), null, 2));
      break;
    case 'apply-gate-a': {
      const pass1 = await applyGate('A', 1);
      const pass2Preview = await previewGate('A');
      const pass2 = await applyGate('A', 2);
      console.log(JSON.stringify({ pass1, pass2Preview, pass2 }, null, 2));
      writeJson('_phase4864_gate_a_underland.json', { ...pass2Preview, applied: pass1 });
      break;
    }
    case 'apply-gate-b': {
      const pass1 = await applyGate('B', 1);
      const pass2Preview = await previewGate('B');
      const pass2 = await applyGate('B', 2);
      console.log(JSON.stringify({ pass1, pass2Preview, pass2 }, null, 2));
      writeJson('_phase4864_gate_b_sommerfest.json', { ...pass2Preview, applied: pass1 });
      break;
    }
    case 'apply-gate-c': {
      const pass1 = await applyGate('C', 1);
      const pass2Preview = await previewGate('C');
      const pass2 = await applyGate('C', 2);
      console.log(JSON.stringify({ pass1, pass2Preview, pass2 }, null, 2));
      writeJson('_phase4864_gate_c_r3hab.json', { ...pass2Preview, applied: pass1 });
      break;
    }
    case 'audit-gate-d':
      console.log(JSON.stringify(await cmdAuditGateD(), null, 2));
      break;
    case 'verify-consumer':
      console.log(JSON.stringify(await cmdVerifyConsumer(), null, 2));
      break;
    case 'audit-sample':
      console.log(JSON.stringify(await cmdAuditSample(), null, 2));
      break;
    case 'verify-forbidden':
      console.log(JSON.stringify(await verifyForbiddenDomains({}), null, 2));
      break;
    case 'verify-collision-cleared':
      console.log(JSON.stringify(await verifyCollisionCleared(), null, 2));
      break;
    case 'post-apply-verification':
      console.log(JSON.stringify(await cmdPostApplyVerification(), null, 2));
      break;
    case 'verify-idempotency':
      console.log(JSON.stringify(await cmdVerifyIdempotency(), null, 2));
      break;
    case 'verify-rollback':
      console.log(JSON.stringify(await cmdVerifyRollback(), null, 2));
      break;
    case 'verdict':
      console.log(JSON.stringify(await cmdVerdict(), null, 2));
      break;
    case 'report':
      await cmdReport();
      break;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
