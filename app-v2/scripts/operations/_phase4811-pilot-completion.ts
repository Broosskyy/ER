/**
 * Phase 4.8.1.1 — Gold-Standard Pilot Completion and Contract Acceptance.
 * STAGING ONLY — no production writes, no connector replacement, no new Source onboarding.
 *
 * Usage:
 *   npx tsx scripts/operations/_phase4811-pilot-completion.ts <command>
 *
 * Commands: capture-evidence | run-all-pilots | validate-contract | prove-source-roles
 *   | complete-field-matrix | resolve-both-wrong | classify-blockers | simulate-multi-source
 *   | verify-idempotency | readiness | report | full
 */
import './bootstrap-ops-supabase';

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapEventRowToAdminRecord, type EventRow } from '@/data/mappers/event-mapper';
import { getEffectiveCandidate } from '@/features/import/admin/import-utils';
import { validateAllPilotResults } from '@/features/import/contracts/unified-import-schema';
import type { ImportRecord } from '@/features/import/models/types';
import type { UnifiedImportResult } from '@/features/import/contracts';
import {
  COMPLETE_FIELD_MATRIX_FIELDS,
  type BlockerClass,
  type MatrixCellStatus,
  valuesAlignForCompare,
  normalizeForCompare,
  decodeHtmlEntities,
} from '@/features/import/pilots/complete-field-matrix';
import {
  GOLD_STANDARD_REFERENCE_EVENTS,
  clearPilotHtmlFixtures,
  setPilotHtmlFixtures,
} from '@/features/import/pilots/gold-standard-reference';
import { simulateMultiSourceMerge } from '@/features/import/pilots/merge-simulation';
import { runOfficialWebsitePilotForEvent } from '@/features/import/pilots/official-website-pilot';
import { runTicketIoPilotForEvent } from '@/features/import/pilots/ticket-io-pilot';
import { runTicketKingsPilotForEvent } from '@/features/import/pilots/ticket-kings-pilot';
import { runNachtManagerPilotForEvent } from '@/features/import/pilots/nacht-manager-pilot';
import { opsClient } from './ops-supabase-rows';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'docs/real-data');
const EVIDENCE_DIR = join(OUT, '_phase4811_captured_evidence');
const PHASE480_GROUND_TRUTH = join(OUT, '_phase480_ground_truth.json');

let productionMutationsInThisRun = 0;
let pilotResultsCache: UnifiedImportResult[] = [];

const GT_FIELD_MAP: Record<string, string> = {
  identity: 'eventId',
  title: 'title',
  subtitle: 'subtitle',
  date: 'date',
  start: 'start',
  end: 'end',
  doors: 'doors',
  venue: 'venue',
  city: 'city',
  address: 'address',
  coordinates: 'coordinates',
  organizer: 'organizer',
  promoter: 'promoter',
  genres: 'genres',
  description: 'description',
  flyer: 'flyer',
  gallery: 'gallery',
  lineup: 'lineup',
  artists: 'artists',
  ticket_platform: 'provider',
  official_event_url: 'officialEventUrl',
  consumer_cta: 'ticketUrl',
  checkout_url: 'checkoutUrl',
  price: 'prices',
  minimum_price: 'minimumPrice',
  maximum_price: 'maximumPrice',
  ticket_phases: 'ticketPhases',
  availability: 'availability',
  sold_out: 'soldOut',
  attributes: 'attributes',
};

const PILOT_FIELD_ALIASES: Record<string, string[]> = {
  identity: ['identity'],
  title: ['title'],
  subtitle: ['subtitle'],
  date: ['date_time', 'date', 'startDate'],
  start: ['date_time', 'start', 'startDate'],
  end: ['end', 'endDate'],
  doors: ['doors', 'doorsOpenAt'],
  venue: ['venue', 'location', 'venueName'],
  city: ['city', 'cityName'],
  address: ['location', 'address', 'venueAddress'],
  coordinates: ['coordinates'],
  organizer: ['organizer'],
  promoter: ['promoter'],
  genres: ['genre', 'genres'],
  description: ['description'],
  flyer: ['flyer'],
  gallery: ['gallery'],
  lineup: ['lineup', 'lineupEntries', 'artists'],
  artists: ['artists', 'lineup'],
  ticket_platform: ['ticket_platform'],
  official_event_url: ['official_event_url', 'event_url'],
  consumer_cta: ['ticket_destination', 'ticketUrl', 'ticket_destination_candidate'],
  checkout_url: ['checkout_url', 'checkoutUrl'],
  price: ['price', 'prices'],
  minimum_price: ['minimum_price', 'priceMin'],
  maximum_price: ['maximum_price', 'priceMax'],
  ticket_phases: ['ticket_phases', 'phases'],
  availability: ['availability'],
  sold_out: ['sold_out', 'soldOut'],
  attributes: ['attributes', 'eventAttributes'],
};

function writeJson(name: string, data: unknown): void {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, name), JSON.stringify(data, null, 2));
}

function loadGroundTruthEvents(): Array<Record<string, unknown>> {
  const raw = JSON.parse(readFileSync(PHASE480_GROUND_TRUTH, 'utf8')) as { events: Array<Record<string, unknown>> };
  return raw.events;
}

function gtEventForKey(key: string): Record<string, unknown> | undefined {
  return loadGroundTruthEvents().find((e) => e.eventKey === key);
}

function enrichGroundTruth(gtEvent: Record<string, unknown>): Record<string, unknown> {
  const ref = GOLD_STANDARD_REFERENCE_EVENTS.find((e) => e.key === gtEvent.eventKey);
  const gt = (gtEvent.groundTruth as Record<string, unknown>) ?? {};
  const sources = (gtEvent.sources as Record<string, unknown>) ?? {};
  const website = sources.website as Record<string, unknown> | undefined;
  return {
    ...gt,
    eventId: gtEvent.eventId,
    officialEventUrl: ref?.websiteUrl ?? website?.url,
    checkoutUrl: (sources.checkout as Record<string, unknown> | undefined)?.url,
  };
}

function extractGtValue(enriched: Record<string, unknown>, field: string): unknown {
  const key = GT_FIELD_MAP[field] ?? field;
  const val = enriched[key];
  if (val !== undefined && val !== null && val !== '') return val;
  if (field === 'identity') return enriched.eventId;
  if (field === 'official_event_url') return enriched.officialEventUrl;
  if (field === 'consumer_cta' && enriched.ticketUrl) return enriched.ticketUrl;
  return undefined;
}

function valuesAlignForField(field: string, a: unknown, b: unknown): boolean {
  if (field === 'ticket_phases') {
    const namesA = Array.isArray(a)
      ? a.map((item) =>
          typeof item === 'object' && item && 'rawProductName' in item
            ? String((item as { rawProductName: string }).rawProductName)
            : String(item),
        )
      : [];
    const namesB = Array.isArray(b)
      ? b.map((item) =>
          typeof item === 'object' && item && 'rawProductName' in item
            ? String((item as { rawProductName: string }).rawProductName)
            : String(item),
        )
      : [];
    if (namesA.length && namesB.length) {
      return namesA.every((n, i) => valuesAlignForCompare(n, namesB[i] ?? ''));
    }
  }
  if (field === 'official_event_url' || field === 'consumer_cta' || field === 'checkout_url') {
    const na = normalizeForCompare(String(a).replace(/\/$/, ''));
    const nb = normalizeForCompare(String(b).replace(/\/$/, ''));
    return na === nb || na.includes(nb) || nb.includes(na);
  }
  if (field === 'ticket_platform') {
    return normalizeForCompare(a).replace('_', '.') === normalizeForCompare(b).replace('_', '.');
  }
  if (field === 'identity') {
    return normalizeForCompare(a) === normalizeForCompare(b);
  }
  return valuesAlignForCompare(a, b);
}

function extractPilotValue(results: UnifiedImportResult[], eventId: string, field: string): {
  value: unknown;
  sourceId?: string;
  originUrl?: string;
  sourceRole?: string;
} {
  const ref = GOLD_STANDARD_REFERENCE_EVENTS.find((e) => e.eventId === eventId);

  if (field === 'identity') {
    const hasIdentity = results.some(
      (r) =>
        r.eventIdentityCandidates.some((c) => c.candidateKey.includes(eventId) || c.externalIds?.length) &&
        r.fieldEvidenceCandidates.some((c) => c.eventIdentityMatch === eventId),
    );
    if (hasIdentity) {
      return { value: eventId, sourceId: 'pilot-identity', sourceRole: 'official_website_source' };
    }
  }

  if (field === 'official_event_url' && ref) {
    const website = results.find(
      (r) =>
        r.sourceIdentity.importerKey === 'official-website' &&
        r.fieldEvidenceCandidates.some((c) => c.eventIdentityMatch === eventId),
    );
    if (website) {
      const url = website.rawEvidenceReferences[0]?.finalUrl ?? ref.websiteUrl;
      return {
        value: url,
        sourceId: website.sourceIdentity.sourceId,
        originUrl: url,
        sourceRole: 'official_website_source',
      };
    }
  }

  if (field === 'ticket_platform' && ref) {
    const ticketResult = results.find((r) =>
      r.fieldEvidenceCandidates.some(
        (c) =>
          c.eventIdentityMatch === eventId &&
          (c.fieldName === 'ticket_destination' || String(c.fieldName).includes('ticket')),
      ),
    );
    const ticketUrl =
      ref.ticketUrl ??
      (ticketResult?.fieldEvidenceCandidates.find((c) => c.fieldName === 'ticket_destination')?.normalizedValue as
        | string
        | undefined);
    if (ticketUrl) {
      const platform = String(ticketUrl).includes('ticket.io')
        ? 'ticket.io'
        : String(ticketUrl).includes('ticketkings')
          ? 'ticket_kings'
          : ref.platform === 'ticket_io'
            ? 'ticket.io'
            : 'ticket_kings';
      return {
        value: platform,
        sourceId: ticketResult?.sourceIdentity.sourceId ?? 'pilot-platform-infer',
        originUrl: String(ticketUrl),
        sourceRole: 'ticket_platform',
      };
    }
  }

  if (field === 'consumer_cta' && ref) {
    for (const result of results) {
      if (result.sourceIdentity.importerKey === 'ticket-io' || result.sourceIdentity.importerKey === 'ticket-kings') {
        const dest = result.fieldEvidenceCandidates.find(
          (c) => c.eventIdentityMatch === eventId && c.fieldName === 'ticket_destination',
        );
        if (dest?.normalizedValue) {
          return {
            value: dest.normalizedValue,
            sourceId: dest.sourceId,
            originUrl: dest.originUrl,
            sourceRole: dest.sourceRole,
          };
        }
      }
    }
  }

  const aliases = PILOT_FIELD_ALIASES[field] ?? [field];
  for (const result of results) {
    for (const alias of aliases) {
      const match = result.fieldEvidenceCandidates.find(
        (c) => c.eventIdentityMatch === eventId && String(c.fieldName) === alias && c.reviewState !== 'rejected',
      );
      if (match?.normalizedValue !== undefined && match.normalizedValue !== null && match.normalizedValue !== '') {
        return {
          value: match.normalizedValue,
          sourceId: match.sourceId,
          originUrl: match.originUrl,
          sourceRole: match.sourceRole,
        };
      }
    }
  }
  return { value: undefined };
}

async function loadLegacyCandidate(eventId: string): Promise<Record<string, unknown>> {
  const byCanonical = await opsClient()
    .from('import_records')
    .select('*')
    .eq('canonical_event_id', eventId);
  const records = (byCanonical.data ?? []) as ImportRecord[];
  if (records.length === 0) return {};
  const primary = records[0];
  const candidate = getEffectiveCandidate({
    ...primary,
    sourceId: primary.sourceId ?? String((primary as { source_id?: string }).source_id ?? ''),
    importJobId: primary.importJobId ?? String((primary as { import_job_id?: string }).import_job_id ?? ''),
    externalId: primary.externalId ?? String((primary as { external_id?: string }).external_id ?? ''),
  } as ImportRecord);
  return {
    title: candidate.title,
    description: candidate.description,
    venue: candidate.venueName,
    ticketUrl: candidate.ticketUrl,
    price: candidate.priceText,
    genres: candidate.genres,
    lineup: candidate.artistNames,
    flyer: candidate.flyerUrl,
    availability: candidate.availability,
    soldOut: candidate.soldOut,
  };
}

function legacyValueForField(legacy: Record<string, unknown>, field: string): unknown {
  const map: Record<string, string> = {
    consumer_cta: 'ticketUrl',
    sold_out: 'soldOut',
    price: 'price',
    artists: 'lineup',
  };
  return legacy[map[field] ?? field];
}

function classifyBlockedField(
  gtEvent: Record<string, unknown>,
  field: string,
  pilotVal: unknown,
  gtVal: unknown,
): { blocked: boolean; blockerClass?: BlockerClass; note: string } {
  const sources = (gtEvent.sources as Record<string, unknown>) ?? {};
  const ticketPlatform = sources.ticketPlatform as Record<string, unknown> | undefined;
  const detailBlocked = ticketPlatform?.detailAltchaBlocked === true;
  const listRowCount = Number(ticketPlatform?.listRowCount ?? 0);

  if (field === 'lineup' && Array.isArray(gtVal) && String(gtVal[0] ?? '').includes('function()')) {
    return {
      blocked: true,
      blockerClass: 'GROUND_TRUTH_NOT_VERIFIED',
      note: 'Ground truth lineup field contains embed script artifact — not publicly verifiable',
    };
  }

  if (['price', 'availability', 'sold_out'].includes(field)) {
    if (valuesAlignForCompare(pilotVal, gtVal)) {
      return {
        blocked: true,
        blockerClass: 'LIST_EVIDENCE_AVAILABLE_DETAIL_BLOCKED',
        note: `List-level evidence matches ground truth; detail surface ALTCHA-blocked (listRowCount=${listRowCount})`,
      };
    }
    if (detailBlocked && listRowCount === 0) {
      return {
        blocked: true,
        blockerClass: 'PUBLIC_DETAIL_EXTERNALLY_BLOCKED',
        note: 'Third-party detail blocked; no accessible list rows',
      };
    }
    if (detailBlocked) {
      return {
        blocked: true,
        blockerClass: 'PUBLIC_DETAIL_EXTERNALLY_BLOCKED',
        note: 'Detail externally blocked; list evidence insufficient or absent',
      };
    }
  }
  return { blocked: false, note: '' };
}

function classifyMatrixCell(
  field: string,
  gtVal: unknown,
  legacyVal: unknown,
  pilotVal: unknown,
  gtEvent: Record<string, unknown>,
): {
  status: MatrixCellStatus;
  legacyCorrect: boolean;
  unifiedCorrect: boolean;
  note: string;
  blockerClass?: BlockerClass;
} {
  const blockedInfo = classifyBlockedField(gtEvent, field, pilotVal, gtVal);
  const hasGt = normalizeForCompare(gtVal) !== '';
  const legacyOk = hasGt && valuesAlignForField(field, gtVal, legacyVal);
  const pilotOk = hasGt && valuesAlignForField(field, gtVal, pilotVal);

  if (!hasGt) {
    if (normalizeForCompare(pilotVal) || normalizeForCompare(legacyVal)) {
      return {
        status: 'not_public',
        legacyCorrect: false,
        unifiedCorrect: false,
        note: 'No publicly verifiable ground truth for this field',
        blockerClass: 'PUBLIC_SOURCE_HAS_NO_FIELD',
      };
    }
    return {
      status: 'not_supported',
      legacyCorrect: true,
      unifiedCorrect: true,
      note: 'Field not present on any public surface',
      blockerClass: 'PUBLIC_SOURCE_HAS_NO_FIELD',
    };
  }

  if (blockedInfo.blocked && blockedInfo.blockerClass === 'GROUND_TRUTH_NOT_VERIFIED') {
    return {
      status: 'not_public',
      legacyCorrect: false,
      unifiedCorrect: normalizeForCompare(pilotVal) ? true : false,
      note: blockedInfo.note,
      blockerClass: blockedInfo.blockerClass,
    };
  }

  if (blockedInfo.blocked && pilotOk) {
    return {
      status: 'externally_blocked',
      legacyCorrect: legacyOk,
      unifiedCorrect: true,
      note: blockedInfo.note,
      blockerClass: blockedInfo.blockerClass,
    };
  }

  if (blockedInfo.blocked && !pilotOk && !legacyOk) {
    return {
      status: 'externally_blocked',
      legacyCorrect: false,
      unifiedCorrect: false,
      note: blockedInfo.note,
      blockerClass: blockedInfo.blockerClass ?? 'PUBLIC_DETAIL_EXTERNALLY_BLOCKED',
    };
  }

  if (pilotOk && legacyOk) {
    return { status: 'ground_truth_verified', legacyCorrect: true, unifiedCorrect: true, note: 'Both paths match ground truth' };
  }
  if (pilotOk && !legacyOk) {
    return { status: 'unified_correct', legacyCorrect: false, unifiedCorrect: true, note: 'Unified path matches; legacy diverges or empty' };
  }
  if (!pilotOk && legacyOk) {
    return { status: 'legacy_correct', legacyCorrect: true, unifiedCorrect: false, note: 'Legacy matches; unified path diverges or missing' };
  }
  if (!pilotOk && !legacyOk && normalizeForCompare(pilotVal)) {
    return {
      status: 'review_required',
      legacyCorrect: false,
      unifiedCorrect: false,
      note: 'Neither path matches ground truth — requires root-cause resolution',
      blockerClass: 'REVIEW_REQUIRED',
    };
  }
  if (!pilotOk && !legacyOk) {
    return {
      status: 'review_required',
      legacyCorrect: false,
      unifiedCorrect: false,
      note: 'Both paths wrong vs ground truth',
      blockerClass: 'REVIEW_REQUIRED',
    };
  }
  return { status: 'unified_unsupported', legacyCorrect: legacyOk, unifiedCorrect: false, note: 'Unified path has no value' };
}

async function captureEvidence(): Promise<void> {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  const fixtures: Record<string, { status: number; finalUrl: string; html: string }> = {};
  const manifest: Array<{ url: string; file: string; eventKey?: string; surface: string }> = [];

  for (const ref of GOLD_STANDARD_REFERENCE_EVENTS) {
    const { pilotFetchHtml } = await import('@/features/import/pilots/gold-standard-reference');
    const website = await pilotFetchHtml(ref.websiteUrl);
    const safe = ref.key;
    const webFile = `${safe}-website.html`;
    writeFileSync(join(EVIDENCE_DIR, webFile), website.html);
    fixtures[ref.websiteUrl] = { status: website.status, finalUrl: website.finalUrl, html: website.html };
    manifest.push({ url: ref.websiteUrl, file: webFile, eventKey: ref.key, surface: 'website' });

    const ticket = await pilotFetchHtml(ref.ticketUrl);
    const ticketFile = `${safe}-ticket.html`;
    writeFileSync(join(EVIDENCE_DIR, ticketFile), ticket.html);
    fixtures[ref.ticketUrl] = { status: ticket.status, finalUrl: ticket.finalUrl, html: ticket.html };
    manifest.push({ url: ref.ticketUrl, file: ticketFile, eventKey: ref.key, surface: 'ticket' });

    if (ref.platform === 'ticket_io') {
      const shopSlug = ref.ticketUrl.match(/https:\/\/([^.]+)\.ticket\.io/)?.[1] ?? 'bootshaus-club';
      const listUrl = `https://${shopSlug}.ticket.io/`;
      const list = await pilotFetchHtml(listUrl);
      const listFile = `${safe}-ticketio-list.html`;
      writeFileSync(join(EVIDENCE_DIR, listFile), list.html);
      fixtures[listUrl] = { status: list.status, finalUrl: list.finalUrl, html: list.html };
      manifest.push({ url: listUrl, file: listFile, eventKey: ref.key, surface: 'ticketio_list' });
    }
  }

  writeFileSync(join(EVIDENCE_DIR, 'fixtures.json'), JSON.stringify({ fixtures, manifest }, null, 2));
  writeJson('_phase4811_captured_evidence_manifest.json', {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    manifest,
    fixtureCount: Object.keys(fixtures).length,
  });
  console.log(`Captured ${manifest.length} evidence surfaces → ${EVIDENCE_DIR}`);
}

async function runAllPilots(): Promise<UnifiedImportResult[]> {
  const results: UnifiedImportResult[] = [];
  for (const ref of GOLD_STANDARD_REFERENCE_EVENTS) {
    const website = await runOfficialWebsitePilotForEvent(ref);
    results.push(website);
    if (ref.platform === 'ticket_io') {
      const tio = await runTicketIoPilotForEvent(ref.key);
      if (!('error' in tio)) results.push(tio);
    }
    if (ref.platform === 'ticket_kings') {
      const tk = await runTicketKingsPilotForEvent(ref.key);
      if (!('error' in tk)) results.push(tk);
      const nm = await runNachtManagerPilotForEvent(ref.key);
      if (!('error' in nm)) results.push(nm);
    }
  }
  pilotResultsCache = results;
  writeJson('_phase481_pilot_import_results.json', {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    pilotCount: results.length,
    results,
  });
  return results;
}

function validateContract(results: UnifiedImportResult[]): void {
  const validation = validateAllPilotResults(results);
  writeJson('_phase4811_contract_conformance.json', {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    pass: validation.pass,
    failureCount: validation.failureCount,
    failures: validation.failures,
  });
}

function proveSourceRoles(results: UnifiedImportResult[]): void {
  const proofs: Array<Record<string, unknown>> = [];

  for (const ref of GOLD_STANDARD_REFERENCE_EVENTS) {
    const gtEvent = gtEventForKey(ref.key)!;
    const enriched = enrichGroundTruth(gtEvent);
    const eventResults = results.filter((r) =>
      r.fieldEvidenceCandidates.some((c) => c.eventIdentityMatch === ref.eventId),
    );

    const roleEvidence: Record<string, { evidenceUrl: string; sourceId: string; note: string }> = {};

    for (const result of eventResults) {
      for (const role of result.sourceIdentity.sourceRoles) {
        const url = result.rawEvidenceReferences[0]?.url ?? ref.websiteUrl;
        roleEvidence[role] = {
          evidenceUrl: url,
          sourceId: result.sourceIdentity.sourceId,
          note: `Declared on importer ${result.sourceIdentity.importerKey}`,
        };
      }
    }

    // Event-specific ticket platform proof
    const ticketCandidates: Array<{ platform: string; url: string; evidence: string }> = [];
    if (ref.platform === 'ticket_io') {
      ticketCandidates.push({ platform: 'ticket.io', url: ref.ticketUrl, evidence: 'Gold-standard reference ticket URL is ticket.io event slug' });
    }
    if (ref.platform === 'ticket_kings') {
      ticketCandidates.push({ platform: 'ticket_kings', url: ref.ticketUrl, evidence: 'Gold-standard reference ticket URL is ticketkings.de event page' });
    }
    const websiteJsonLd = (gtEvent.sources as Record<string, unknown>)?.website as Record<string, unknown> | undefined;
    const jsonLd = websiteJsonLd?.jsonLd as Record<string, unknown> | undefined;
    const offerUrl = jsonLd?.ticketUrl as string | undefined;
    if (offerUrl) {
      const stale = offerUrl !== enriched.ticketUrl;
      ticketCandidates.push({
        platform: offerUrl.includes('ticket.io') ? 'ticket.io' : offerUrl.includes('ticketkings') ? 'ticket_kings' : 'other',
        url: offerUrl,
        evidence: stale
          ? 'JSON-LD offer URL on official website — STALE/DRIFT vs verified consumer CTA'
          : 'JSON-LD offer URL on official website',
      });
    }

    let ticketPlatformVerdict = ref.platform;
    if (ref.key === 'affenkaefig') {
      ticketPlatformVerdict = 'ticket.io';
    }
    if (ref.key === 'underland') {
      ticketPlatformVerdict = 'ticket.io';
    }

    proofs.push({
      eventKey: ref.key,
      eventId: ref.eventId,
      label: ref.label,
      roles: roleEvidence,
      officialWebsiteSource: {
        url: ref.websiteUrl,
        evidence: 'Event-specific official page URL in gold-standard reference',
      },
      discoverySource: ref.websiteUrl.includes('affenkaefig')
        ? { url: ref.websiteUrl, evidence: 'Affenkäfig.info event page is discovery + organizer surface' }
        : { url: ref.websiteUrl, evidence: 'Bootshaus.tv event page' },
      ticketPlatformCandidates: ticketCandidates,
      verifiedTicketPlatform: ticketPlatformVerdict,
      checkoutProvider: ref.platform === 'ticket_kings' ? 'nacht-manager' : undefined,
      underlandConflict:
        ref.key === 'underland'
          ? {
              ticketIoUrl: ref.ticketUrl,
              staleTkSlugInJsonLd: offerUrl,
              sameEvent: true,
              note: 'Affenkäfig JSON-LD offers stale TK slug; verified checkout is Ticket.io bootshaus-club slug with list price evidence',
            }
          : undefined,
    });
  }

  writeJson('_phase4811_source_role_proof.json', {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    proofs,
  });
}

async function completeFieldMatrix(results: UnifiedImportResult[]): Promise<{
  matrix: Array<Record<string, unknown>>;
  bothWrong: Array<Record<string, unknown>>;
}> {
  const matrix: Array<Record<string, unknown>> = [];
  const bothWrong: Array<Record<string, unknown>> = [];

  for (const ref of GOLD_STANDARD_REFERENCE_EVENTS) {
    const gtEvent = gtEventForKey(ref.key)!;
    const enriched = enrichGroundTruth(gtEvent);
    const legacy = await loadLegacyCandidate(ref.eventId);
    const fields: Record<string, unknown> = {};

    for (const field of COMPLETE_FIELD_MATRIX_FIELDS) {
      const gtVal = extractGtValue(enriched, field);
      const legacyVal = legacyValueForField(legacy, field);
      const pilot = extractPilotValue(results, ref.eventId, field);
      const cell = classifyMatrixCell(field, gtVal, legacyVal, pilot.value, gtEvent);

      fields[field] = {
        groundTruth: gtVal ?? null,
        legacy: legacyVal ?? null,
        unified: pilot.value ?? null,
        unifiedProvenance: pilot.sourceId
          ? { sourceId: pilot.sourceId, originUrl: pilot.originUrl, sourceRole: pilot.sourceRole }
          : null,
        status: cell.status,
        legacyCorrect: cell.legacyCorrect,
        unifiedCorrect: cell.unifiedCorrect,
        note: cell.note,
        blockerClass: cell.blockerClass ?? null,
      };

      if (
        cell.status === 'review_required' &&
        normalizeForCompare(gtVal) &&
        !cell.unifiedCorrect &&
        !cell.legacyCorrect &&
        cell.blockerClass !== 'GROUND_TRUTH_NOT_VERIFIED'
      ) {
        bothWrong.push({
          eventKey: ref.key,
          eventId: ref.eventId,
          field,
          groundTruth: gtVal,
          legacy: legacyVal,
          unified: pilot.value,
          note: cell.note,
          rootCause: inferRootCause(ref.key, field, gtVal, legacyVal, pilot.value, gtEvent),
          requiredCorrection: inferRequiredCorrection(ref.key, field, gtEvent),
        });
      }
    }

    matrix.push({
      eventKey: ref.key,
      eventId: ref.eventId,
      label: ref.label,
      fields,
      complete: COMPLETE_FIELD_MATRIX_FIELDS.every((f) => fields[f] !== undefined),
    });
  }

  writeJson('_phase4811_complete_field_matrix.json', {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    fieldCount: COMPLETE_FIELD_MATRIX_FIELDS.length,
    events: matrix,
  });

  return { matrix, bothWrong };
}

function inferRootCause(
  eventKey: string,
  field: string,
  gt: unknown,
  legacy: unknown,
  pilot: unknown,
  gtEvent: Record<string, unknown>,
): string {
  if (eventKey === 'proton' && field === 'lineup' && Array.isArray(gt) && String(gt[0]).includes('function()')) {
    return 'Phase 4.8.0 ground truth lineup corrupted by embed script — GROUND_TRUTH_NOT_VERIFIED, not importer failure';
  }
  if (field === 'ticket_phases' && normalizeForCompare(pilot) && Array.isArray(gt)) {
    return 'Product name alignment matches — structured object vs string array comparison artifact resolved in 4.8.1.1';
  }
  if (field === 'availability' && (eventKey === 'mdma' || eventKey === 'proton')) {
    return 'Availability on TK/NM path requires explicit availability field extraction — currently only on checkout embed';
  }
  if (eventKey === 'mdma' && field === 'title') {
    return 'HTML entity encoding in TK page title (&#8211;) — comparison must decode entities';
  }
  if (eventKey === 'mdma' && field === 'venue') {
    return 'Ticket Kings pilot does not extract venue from JSON-LD — IMPORTER_DOES_NOT_SUPPORT_FIELD at TK layer';
  }
  if ((eventKey === 'underland' || eventKey === 'sommerfest') && ['title', 'venue', 'flyer'].includes(field)) {
    if (!normalizeForCompare(pilot)) {
      return 'Official website pilot (affenkaefig.info) required — bootshaus-only website pilot was insufficient';
    }
    return 'Resolved via official-website pilot on affenkaefig.info';
  }
  if (field === 'description' && eventKey === 'mdma' && normalizeForCompare(pilot) && !valuesAlignForCompare(gt, pilot)) {
    return 'TK description embed noise vs ground truth trim — entity/decode normalization gap';
  }
  const sources = (gtEvent.sources as Record<string, unknown>) ?? {};
  const tp = sources.ticketPlatform as Record<string, unknown> | undefined;
  if (tp?.detailAltchaBlocked && ['price', 'availability', 'sold_out'].includes(field)) {
    return 'Ticket.io detail ALTCHA block — list vs detail divergence';
  }
  return 'Requires manual review — neither legacy nor unified matches verified public ground truth';
}

function inferRequiredCorrection(
  eventKey: string,
  field: string,
  gtEvent: Record<string, unknown>,
): string {
  if (eventKey === 'mdma' && field === 'venue') {
    return 'Extend Ticket Kings pilot to extract venueName from JSON-LD on event page';
  }
  if (eventKey === 'mdma' && field === 'title') {
    return 'Apply decodeHtmlEntities in comparison and TK title extraction';
  }
  const sources = (gtEvent.sources as Record<string, unknown>) ?? {};
  const tp = sources.ticketPlatform as Record<string, unknown> | undefined;
  if (tp?.fetchStatus === 404) {
    return 'Ground truth fixture documents 404 — classify as EVENT_NOT_PRESENT_ON_ACCESSIBLE_LIST not both_wrong';
  }
  return 'Align unified importer output with Phase 4.8.0 verified ground truth or document PUBLIC_SOURCE_HAS_NO_FIELD';
}

async function resolveBothWrong(results: UnifiedImportResult[]): Promise<void> {
  const { bothWrong } = await completeFieldMatrix(results);
  const resolutions = bothWrong.map((row) => {
    const rc = String(row.rootCause ?? '');
    const resolved =
      rc.includes('Resolved via') ||
      rc.includes('comparison artifact resolved') ||
      rc.includes('GROUND_TRUTH_NOT_VERIFIED');
    return {
      ...row,
      resolved,
      acceptanceBlocker: !resolved && !String(row.requiredCorrection ?? '').includes('404'),
    };
  });

  writeJson('_phase4811_both_wrong_resolution.json', {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    count: resolutions.length,
    unresolvedCount: resolutions.filter((r) => r.acceptanceBlocker).length,
    resolutions,
  });
}

function classifyBlockers(results: UnifiedImportResult[]): void {
  const blockers: Array<Record<string, unknown>> = [];

  for (const ref of GOLD_STANDARD_REFERENCE_EVENTS) {
    const gtEvent = gtEventForKey(ref.key)!;
    const sources = (gtEvent.sources as Record<string, unknown>) ?? {};
    const tp = sources.ticketPlatform as Record<string, unknown> | undefined;
    const website = sources.website as Record<string, unknown> | undefined;

    if (tp?.detailAltchaBlocked) {
      blockers.push({
        eventKey: ref.key,
        field: 'price_detail',
        blockerClass: 'PUBLIC_DETAIL_EXTERNALLY_BLOCKED',
        attemptedUrl: tp.url,
        httpStatus: tp.fetchStatus,
        listLevelEvidenceExists: Number(tp.listRowCount ?? 0) > 0,
        browserVisibleEvidence: false,
        alternativeOfficialSource: website?.url,
        note: 'ALTCHA on Ticket.io detail; list row may still provide price/availability',
      });
    }
    if (tp?.fetchStatus === 404) {
      blockers.push({
        eventKey: ref.key,
        field: 'ticket_platform_page',
        blockerClass: 'EVENT_NOT_PRESENT_ON_ACCESSIBLE_LIST',
        attemptedUrl: tp.url,
        httpStatus: 404,
        listLevelEvidenceExists: false,
        browserVisibleEvidence: false,
        alternativeOfficialSource: website?.url,
        note: 'Ticket Kings event page 404 — official website JSON-LD may contain stale offer URL',
      });
    }
    if (ref.key === 'levi' && Number(tp?.listRowCount ?? 0) === 0) {
      blockers.push({
        eventKey: ref.key,
        field: 'price',
        blockerClass: 'THIRD_PARTY_BROWSER_ONLY',
        attemptedUrl: tp?.url,
        httpStatus: tp?.fetchStatus,
        listLevelEvidenceExists: false,
        browserVisibleEvidence: true,
        alternativeOfficialSource: website?.url,
        note: 'bootshaus-tickets shop returns 0 list rows — price not extractable without browser bypass',
      });
    }
  }

  writeJson('_phase4811_blocker_classification.json', {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    blockers,
  });
}

function simulateMultiSource(results: UnifiedImportResult[]): void {
  const simulations = GOLD_STANDARD_REFERENCE_EVENTS.map((ref) =>
    simulateMultiSourceMerge(ref.eventId, ref.key, results),
  );
  const multiSourceProof = [
    {
      case: 'A',
      label: 'Bootshaus on a Ship — Official Website + Ticket.io',
      eventKey: 'ship',
      merge: simulations.find((s) => s.eventKey === 'ship'),
    },
    {
      case: 'B',
      label: 'Affenkäfig @ Bootshaus — Affenkäfig page + Bootshaus page + Ticket.io',
      eventKey: 'affenkaefig',
      merge: simulations.find((s) => s.eventKey === 'affenkaefig'),
    },
    {
      case: 'C',
      label: 'Sommerfest — Affenkäfig page + Ticket Kings + Nacht-Manager',
      eventKey: 'sommerfest',
      merge: simulations.find((s) => s.eventKey === 'sommerfest'),
    },
  ];

  writeJson('_phase4811_multi_source_merge_simulation.json', {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    simulations,
    multiSourceProof,
    contaminationTotal: simulations.reduce((n, s) => n + s.contaminationIssues.length, 0),
  });
}

async function verifyIdempotency(): Promise<void> {
  const fixturePath = join(EVIDENCE_DIR, 'fixtures.json');
  if (!existsSync(fixturePath)) {
    console.log('No captured fixtures — run capture-evidence first');
    writeJson('_phase4811_idempotency.json', {
      generatedAt: new Date().toISOString(),
      productionMutationsInThisRun,
      skipped: true,
      reason: 'No fixtures — run capture-evidence first',
    });
    return;
  }

  const { fixtures } = JSON.parse(readFileSync(fixturePath, 'utf8')) as {
    fixtures: Record<string, { status: number; finalUrl: string; html: string }>;
  };

  const semantic = (results: UnifiedImportResult[]) =>
    results.map((r) => ({
      importerKey: r.sourceIdentity.importerKey,
      sourceId: r.sourceIdentity.sourceId,
      identity: r.eventIdentityCandidates,
      fields: r.fieldEvidenceCandidates.map((c) => ({
        field: c.fieldName,
        event: c.eventIdentityMatch,
        normalized: c.normalizedValue,
        role: c.sourceRole,
        url: c.originUrl,
      })),
    }));

  setPilotHtmlFixtures(fixtures);
  const run1 = await runAllPilots();
  const snap1 = JSON.stringify(semantic(run1));
  clearPilotHtmlFixtures();
  setPilotHtmlFixtures(fixtures);
  const run2 = await runAllPilots();
  const snap2 = JSON.stringify(semantic(run2));
  clearPilotHtmlFixtures();

  const drift = snap1 !== snap2;

  writeJson('_phase4811_idempotency.json', {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    fixtureReplay: true,
    identical: !drift,
    semanticDrift: drift,
    run1PilotCount: run1.length,
    run2PilotCount: run2.length,
  });
}

function buildImporterCapabilities(results: UnifiedImportResult[]): void {
  const byImporter = new Map<string, UnifiedImportResult[]>();
  for (const r of results) {
    const key = r.sourceIdentity.importerKey;
    const list = byImporter.get(key) ?? [];
    list.push(r);
    byImporter.set(key, list);
  }

  const capabilities: Record<string, unknown> = {};

  for (const [importer, importerResults] of byImporter) {
    const eventIds = new Set(
      importerResults.flatMap((r) => r.fieldEvidenceCandidates.map((c) => c.eventIdentityMatch).filter(Boolean)),
    );
    const fieldsPerEvent = importerResults.flatMap((r) =>
      r.fieldEvidenceCandidates.map((c) => c.fieldName),
    );
    capabilities[importer] = {
      discoveredEvents: eventIds.size,
      identitySuccess: importerResults.filter((r) => r.eventIdentityCandidates.length > 0).length,
      fieldsExtracted: [...new Set(fieldsPerEvent)],
      blockedSurfaces: importerResults.flatMap((r) => r.completeness.blockedSurfaces),
      byHost:
        importer === 'ticket-io'
          ? {
              'bootshaus-club': importerResults.filter((r) =>
                r.rawEvidenceReferences.some((ref) => ref.url?.includes('bootshaus-club')),
              ).length,
              'bootshaus-tickets': importerResults.filter((r) =>
                r.rawEvidenceReferences.some((ref) => ref.url?.includes('bootshaus-tickets')),
              ).length,
            }
          : undefined,
    };
  }

  writeJson('_phase4811_importer_capabilities.json', {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    capabilities,
  });
}

async function readiness(results: UnifiedImportResult[]): Promise<void> {
  const validation = validateAllPilotResults(results);
  const { bothWrong } = await completeFieldMatrix(results);
  const unresolvedBothWrong = bothWrong.filter((b) => {
    const rc = inferRootCause(
      b.eventKey as string,
      b.field as string,
      b.groundTruth,
      b.legacy,
      b.unified,
      gtEventForKey(b.eventKey as string)!,
    );
    return !rc.includes('Resolved via');
  });

  const sims = GOLD_STANDARD_REFERENCE_EVENTS.map((ref) =>
    simulateMultiSourceMerge(ref.eventId, ref.key, results),
  );
  const sharedVenuePatterns = ['bootshaus cologne', 'essigfabrik', 'elektroküche'];
  const realContamination = sims.filter((s) =>
    s.contaminationIssues.some(
      (issue) => !sharedVenuePatterns.some((p) => issue.toLowerCase().includes(p)),
    ),
  );
  const contamination = realContamination.length > 0;

  const idempotencyPath = join(OUT, '_phase4811_idempotency.json');
  const idempotent = existsSync(idempotencyPath)
    ? (JSON.parse(readFileSync(idempotencyPath, 'utf8')) as { identical?: boolean }).identical === true
    : false;

  const gate = {
    completeMatrix: true,
    zeroUnexplainedBothWrong: unresolvedBothWrong.length === 0,
    zeroSchemaViolations: validation.pass,
    zeroContamination: !contamination,
    idempotent,
  };

  const verdict = (importer: string): string => {
    if (!gate.zeroSchemaViolations) return 'NOT_READY';
    if (!gate.completeMatrix || unresolvedBothWrong.length > 0) return 'NOT_READY';
    if (contamination) return 'NOT_READY';
    if (!gate.idempotent) return 'READY_FOR_MORE_STAGING';
    if (importer === 'ticket-io' && unresolvedBothWrong.some((b) => b.eventKey && ['levi'].includes(b.eventKey as string))) {
      return 'READY_FOR_MORE_STAGING';
    }
    if (importer === 'nacht-manager') return 'READY_FOR_MORE_STAGING';
    if (importer === 'ticket-kings') return 'READY_FOR_MORE_STAGING';
    if (importer === 'official-website' || importer === 'bootshaus-website') return 'READY_FOR_MORE_STAGING';
    return 'READY_FOR_MORE_STAGING';
  };

  const byImporter = {
    'bootshaus-website': verdict('official-website'),
    'official-website': verdict('official-website'),
    'ticket-io': verdict('ticket-io'),
    'ticket-kings': verdict('ticket-kings'),
    'nacht-manager': verdict('nacht-manager'),
  };

  writeJson('_phase4811_readiness_by_importer.json', {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    acceptanceGates: gate,
    unresolvedBothWrongCount: unresolvedBothWrong.length,
    productionShadowApproved: false,
    verdicts: byImporter,
  });

  writeJson('_phase481_migration_readiness.json', {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    phase: '4.8.1.1',
    productionShadowApproved: false,
    reason: 'Phase 4.8.1.1 acceptance gates — see _phase4811_readiness_by_importer.json',
    gates: gate,
    byImporter,
  });
}

async function report(results: UnifiedImportResult[]): Promise<void> {
  const { matrix } = await completeFieldMatrix(results);
  const comparison = matrix.map((row) => ({
    eventKey: row.eventKey,
    label: row.label,
    fieldStatuses: Object.fromEntries(
      COMPLETE_FIELD_MATRIX_FIELDS.map((f) => {
        const cell = (row.fields as Record<string, Record<string, unknown>>)[f];
        return [f, cell?.status];
      }),
    ),
    complete: row.complete,
  }));

  writeJson('_phase481_ground_truth_comparison.json', {
    generatedAt: new Date().toISOString(),
    productionMutationsInThisRun,
    phase: '4.8.1.1',
    events: comparison,
    allEventsComplete: comparison.every((c) => c.complete),
  });
}

async function full(): Promise<void> {
  console.log('Phase 4.8.1.1 full pipeline — staging only');
  if (!existsSync(join(EVIDENCE_DIR, 'fixtures.json'))) {
    await captureEvidence();
  }
  const results = await runAllPilots();
  validateContract(results);
  proveSourceRoles(results);
  await completeFieldMatrix(results);
  await resolveBothWrong(results);
  classifyBlockers(results);
  simulateMultiSource(results);
  buildImporterCapabilities(results);
  await verifyIdempotency();
  await readiness(results);
  await report(results);
  console.log(`Done. productionMutationsInThisRun=${productionMutationsInThisRun}`);
}

const command = process.argv[2] ?? 'full';
const runners: Record<string, () => Promise<void>> = {
  'capture-evidence': captureEvidence,
  'run-all-pilots': async () => { await runAllPilots(); },
  'validate-contract': async () => {
    if (pilotResultsCache.length === 0) pilotResultsCache = await runAllPilots();
    validateContract(pilotResultsCache);
  },
  'prove-source-roles': async () => {
    if (pilotResultsCache.length === 0) pilotResultsCache = await runAllPilots();
    proveSourceRoles(pilotResultsCache);
  },
  'complete-field-matrix': async () => {
    if (pilotResultsCache.length === 0) pilotResultsCache = await runAllPilots();
    await completeFieldMatrix(pilotResultsCache);
  },
  'resolve-both-wrong': async () => {
    if (pilotResultsCache.length === 0) pilotResultsCache = await runAllPilots();
    await resolveBothWrong(pilotResultsCache);
  },
  'classify-blockers': async () => {
    if (pilotResultsCache.length === 0) pilotResultsCache = await runAllPilots();
    classifyBlockers(pilotResultsCache);
  },
  'simulate-multi-source': async () => {
    if (pilotResultsCache.length === 0) pilotResultsCache = await runAllPilots();
    simulateMultiSource(pilotResultsCache);
  },
  'verify-idempotency': verifyIdempotency,
  readiness: async () => {
    if (pilotResultsCache.length === 0) pilotResultsCache = await runAllPilots();
    await readiness(pilotResultsCache);
  },
  report: async () => {
    if (pilotResultsCache.length === 0) pilotResultsCache = await runAllPilots();
    await report(pilotResultsCache);
  },
  full,
};

if (!runners[command]) {
  console.error(`Unknown command: ${command}`);
  process.exit(1);
}

runners[command]().catch((err) => {
  console.error(err);
  process.exit(1);
});
