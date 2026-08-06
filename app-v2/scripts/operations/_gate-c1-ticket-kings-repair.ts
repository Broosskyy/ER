/**
 * Gate C1 — Ticket Kings price / phase persistence repair (production).
 *
 * Scope: Ticket Kings events only. Persists price_text, ticket_phases, ticket_status.
 * minimumPrice and availability are derived at read time (not DB columns).
 *
 * Usage:
 *   npx tsx scripts/operations/_gate-c1-ticket-kings-repair.ts backup
 *   npx tsx scripts/operations/_gate-c1-ticket-kings-repair.ts repair [--pass=1]
 *   npx tsx scripts/operations/_gate-c1-ticket-kings-repair.ts cache-refresh
 *   npx tsx scripts/operations/_gate-c1-ticket-kings-repair.ts verify
 *   npx tsx scripts/operations/_gate-c1-ticket-kings-repair.ts full
 */
import './bootstrap-ops-supabase';

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapEventRowToAdminRecord } from '@/data/mappers/event-mapper';
import type { EventRow } from '@/data/mappers/event-mapper';
import type { AdminEventRecord } from '@/data/types/records';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import {
  enrichTicketKingsDetailFromPublicCheckout,
  parseTicketKingsCheckoutHtml,
} from '@/features/aggregation/connectors/ticket-platform/ticket-kings-public-checkout';
import { formatTicketAvailabilityLabelDe } from '@/features/events/domain/canonical-ticket-availability-label';
import { readCanonicalTicket } from '@/features/events/domain/canonical-ticket-read';
import { writeCanonicalTicketFields } from '@/features/events/domain/canonical-ticket-writer';
import { invalidateConsumerEventCaches } from '@/features/events/formatting/consumer-cache-invalidation';
import { opsClient } from './ops-supabase-rows';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const REAL_DATA = join(ROOT, 'docs/real-data');
const OUT_BACKUP = join(REAL_DATA, '_gate_c1_admission_repair_backup.json');
const OUT_RUNS = join(REAL_DATA, '_gate_c1_admission_repair_runs.json');
const OUT_RESULT = join(REAL_DATA, '_gate_c1_admission_repair_result.json');
const GATE_C1_SOURCE_ID = 'source-affenkaefig-ticket-kings';

const FETCH_HEADERS = {
  'User-Agent': 'EternalRave-SourceBot/1.0 (+https://eternalrave.app)',
  Accept: 'text/html,application/xhtml+xml',
};

const URL_LOCKS = new Set(['ticketUrl', 'websiteUrl']);

type LineupFingerprint = {
  structuredCount: number;
  legacyCount: number;
  artistNamesHash: string;
};

type ForbiddenDomainFingerprint = {
  ticketUrl: string;
  websiteUrl: string;
  venueId: string;
  venueName: string;
  venueCity: string;
  venueAddress: string;
  organizerId: string;
  organizerName: string;
  imageUrl: string;
  flyerUrl: string;
  sourceId: string;
};

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2));
}

function hashNames(names: string[]): string {
  return createHash('sha256').update(names.sort().join('|')).digest('hex').slice(0, 16);
}

function hashObject(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, { headers: FETCH_HEADERS, redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return response.text();
}

async function lineupFingerprint(eventId: string): Promise<LineupFingerprint> {
  const client = opsClient();
  const [{ count: structuredCount }, { count: legacyCount }, { data: legacy }] = await Promise.all([
    client.from('event_lineup_entries').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
    client.from('event_artists').select('artist_id', { count: 'exact', head: true }).eq('event_id', eventId),
    client
      .from('event_artists')
      .select('artists(name)')
      .eq('event_id', eventId)
      .order('sort_order'),
  ]);
  const names = (legacy ?? [])
    .map((row) => (row.artists as { name?: string } | null)?.name)
    .filter((name): name is string => Boolean(name));
  return {
    structuredCount: structuredCount ?? 0,
    legacyCount: legacyCount ?? 0,
    artistNamesHash: hashNames(names),
  };
}

function forbiddenDomainFingerprint(event: AdminEventRecord): ForbiddenDomainFingerprint {
  return {
    ticketUrl: event.ticketUrl ?? '',
    websiteUrl: event.websiteUrl ?? '',
    venueId: event.venueId ?? '',
    venueName: event.venueName ?? '',
    venueCity: event.venueCity ?? '',
    venueAddress: event.venueAddress ?? '',
    organizerId: event.organizerId ?? '',
    organizerName: event.organizerName ?? '',
    imageUrl: event.imageUrl ?? '',
    flyerUrl: event.flyerUrl ?? '',
    sourceId: event.sourceId ?? '',
  };
}

async function loadPublishedEvents(): Promise<AdminEventRecord[]> {
  const client = opsClient();
  const { data, error } = await client.from('events').select('*').eq('status', 'published');
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => mapEventRowToAdminRecord(row as EventRow));
}

function isTicketKingsTarget(event: AdminEventRecord): boolean {
  return /ticketkings\.de\/event\//i.test(event.ticketUrl ?? '');
}

function usesAddonPriceAsCanonical(
  event: AdminEventRecord,
  evidence: NonNullable<Awaited<ReturnType<typeof enrichTicketKingsDetailFromPublicCheckout>>>,
): boolean {
  return shouldReplaceCorruptPhases(event, evidence);
}

function serializeExcludedProducts(
  evidence: NonNullable<Awaited<ReturnType<typeof enrichTicketKingsDetailFromPublicCheckout>>>,
) {
  return evidence.excludedProducts.map((product) => ({
    rawProductName: product.rawProductName,
    rawPhaseName: product.rawPhaseName,
    rawPriceText: product.rawPriceText,
    priceAmount: product.priceAmount,
    currency: product.priceCurrency,
    classification: product.classification,
    exclusionReason: product.exclusionReason,
    sectionHeading: product.sectionHeading,
    optionalState: product.optionalState,
  }));
}

async function persistAdmissionProvenance(
  event: AdminEventRecord,
  evidence: NonNullable<Awaited<ReturnType<typeof enrichTicketKingsDetailFromPublicCheckout>>>,
  patch: {
    priceText?: string;
    ticketStatus?: AdminEventRecord['ticketStatus'];
    ticketPhases?: AdminEventRecord['ticketPhases'];
  },
): Promise<void> {
  const client = opsClient();
  const now = new Date().toISOString();
  const sourceId = event.sourceId ?? GATE_C1_SOURCE_ID;
  const provenanceRows = [
    {
      id: `provenance-${event.id}-priceText`,
      canonical_event_id: event.id,
      field_path: 'priceText',
      selected_value: patch.priceText ?? null,
      selected_source_id: sourceId,
      selected_at: now,
      selection_reason: 'gate_c1_admission_checkout_repair',
      alternatives: [
        {
          sourceId,
          value: patch.priceText,
          freshnessAt: now,
          originExternalId: evidence.checkoutUrl ?? event.ticketUrl,
          mergeDecision: 'admission_only_summary',
        },
      ],
      manually_overridden: false,
      updated_at: now,
    },
    {
      id: `provenance-${event.id}-ticketStatus`,
      canonical_event_id: event.id,
      field_path: 'ticketStatus',
      selected_value: patch.ticketStatus ?? null,
      selected_source_id: sourceId,
      selected_at: now,
      selection_reason: 'gate_c1_admission_checkout_repair',
      alternatives: [],
      manually_overridden: false,
      updated_at: now,
    },
    {
      id: `provenance-${event.id}-ticketPhases`,
      canonical_event_id: event.id,
      field_path: 'ticketPhases',
      selected_value: {
        phases: patch.ticketPhases ?? [],
        excludedAddOns: serializeExcludedProducts(evidence),
        evidenceSource: 'gate_c1_admission_checkout',
        checkoutUrl: evidence.checkoutUrl,
        admissionAvailability: evidence.availability,
        repairedAt: now,
      },
      selected_source_id: sourceId,
      selected_at: now,
      selection_reason: 'gate_c1_admission_checkout_repair',
      alternatives: [],
      manually_overridden: false,
      updated_at: now,
    },
  ];

  for (const row of provenanceRows) {
    const { error } = await client.from('event_field_provenance').upsert(row, {
      onConflict: 'canonical_event_id,field_path',
    });
    if (error) {
      throw new Error(`Provenance upsert failed for ${event.id}/${row.field_path}: ${error.message}`);
    }
  }
}

function shouldReplaceCorruptPhases(
  event: AdminEventRecord,
  evidence: Awaited<ReturnType<typeof enrichTicketKingsDetailFromPublicCheckout>>,
): boolean {
  if (!evidence?.priceAmount || !event.priceText?.trim()) {
    return false;
  }
  const dbAmount = Number.parseFloat(event.priceText.replace(/[^\d,.-]/g, '').replace(',', '.'));
  if (!Number.isFinite(dbAmount)) {
    return false;
  }
  if (Math.abs(dbAmount - evidence.priceAmount) < 0.01) {
    return false;
  }
  return evidence.excludedProducts.some(
    (product) =>
      product.priceAmount !== undefined && Math.abs(product.priceAmount - dbAmount) < 0.01,
  );
}

async function fetchTicketKingsCandidate(ticketUrl: string): Promise<{
  candidate?: CanonicalImportEvent;
  evidence?: Awaited<ReturnType<typeof enrichTicketKingsDetailFromPublicCheckout>>;
}> {
  try {
    const detailHtml = await fetchHtml(ticketUrl);
    const checkout = await enrichTicketKingsDetailFromPublicCheckout(detailHtml, fetchHtml);
    const evidence = checkout ?? parseTicketKingsCheckoutHtml(detailHtml);
    if (!evidence.priceText && evidence.priceAmount === undefined && evidence.releases.length === 0) {
      return {};
    }

    const ticketOffers = evidence.releases.map((release) => ({
      name: release.name,
      priceAmount: release.priceAmount,
      priceCurrency: release.priceCurrency ?? 'EUR',
      priceText: release.priceText,
      soldOut: release.soldOut ?? false,
      purchaseUrl: release.purchaseUrl ?? evidence.checkoutUrl,
    }));

    return {
      evidence,
      candidate: {
        ticketUrl,
        eventUrl: ticketUrl,
        priceText: evidence.priceText,
        priceAmount: evidence.priceAmount,
        sourceMetadata: {
          platform: 'ticket_king',
          evidenceSource: 'gate_c1_live_checkout',
          ticketOffers,
          soldOut: evidence.soldOut,
          excludedProducts: evidence.excludedProducts,
        },
      },
    };
  } catch {
    return {};
  }
}

function assertForbiddenDomainsUnchanged(
  eventId: string,
  before: { lineup: LineupFingerprint; forbidden: ForbiddenDomainFingerprint },
  after: { lineup: LineupFingerprint; forbidden: ForbiddenDomainFingerprint },
): void {
  if (JSON.stringify(before.lineup) !== JSON.stringify(after.lineup)) {
    throw new Error(`Lineup mutation detected for ${eventId}`);
  }
  if (JSON.stringify(before.forbidden) !== JSON.stringify(after.forbidden)) {
    throw new Error(`Forbidden domain mutation detected for ${eventId}`);
  }
}

async function runBackup(): Promise<void> {
  const events = (await loadPublishedEvents()).filter(isTicketKingsTarget);
  const backup = [];
  for (const event of events) {
    backup.push({
      id: event.id,
      title: event.title,
      ticketUrl: event.ticketUrl,
      websiteUrl: event.websiteUrl,
      priceText: event.priceText,
      ticketStatus: event.ticketStatus,
      ticketPhases: event.ticketPhases,
      lineupFingerprint: await lineupFingerprint(event.id),
      forbiddenDomainFingerprint: forbiddenDomainFingerprint(event),
    });
  }
  writeJson(OUT_BACKUP, { generatedAt: new Date().toISOString(), events: backup });
  console.log(`Gate C1 backup: ${backup.length} Ticket Kings events`);
}

async function runRepair(pass: number, dryRun: boolean, admissionOnly: boolean): Promise<number> {
  const events = await loadPublishedEvents();
  let mutations = 0;
  const details: Array<Record<string, unknown>> = [];

  for (const event of events) {
    if (!isTicketKingsTarget(event)) {
      continue;
    }

    const fetched = await fetchTicketKingsCandidate(event.ticketUrl ?? '');
    const candidate = fetched.candidate;
    const evidence = fetched.evidence;
    if (!candidate?.priceText?.trim() || !evidence || evidence.reviewRequired) {
      continue;
    }

    if (admissionOnly && !usesAddonPriceAsCanonical(event, evidence)) {
      continue;
    }

    const beforeLineup = await lineupFingerprint(event.id);
    const beforeForbidden = forbiddenDomainFingerprint(event);
    const existingForWrite = usesAddonPriceAsCanonical(event, evidence)
      ? { ...event, ticketPhases: [], priceText: undefined }
      : event;

    const write = writeCanonicalTicketFields({
      existing: existingForWrite,
      candidate,
      fillOnly: false,
      manualLocks: URL_LOCKS,
    });

    const allowedChanges = write.fieldChanges.filter(
      (field) => field === 'priceText' || field === 'ticketPhases' || field === 'ticketStatus',
    );

    if (allowedChanges.length === 0) {
      continue;
    }

    const dbPatch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (allowedChanges.includes('priceText') && write.patch.priceText !== undefined) {
      dbPatch.price_text = write.patch.priceText;
    }
    if (allowedChanges.includes('ticketPhases') && write.patch.ticketPhases !== undefined) {
      dbPatch.ticket_phases = write.patch.ticketPhases;
    }
    if (allowedChanges.includes('ticketStatus') && write.patch.ticketStatus !== undefined) {
      dbPatch.ticket_status = write.patch.ticketStatus;
    }

    if (!dryRun) {
      const { error } = await opsClient().from('events').update(dbPatch).eq('id', event.id);
      if (error) {
        throw new Error(error.message);
      }
      await persistAdmissionProvenance(event, evidence, {
        priceText: write.patch.priceText,
        ticketStatus: write.patch.ticketStatus,
        ticketPhases: write.patch.ticketPhases,
      });
    }

    const afterEvent = dryRun
      ? ({
          ...event,
          priceText: (dbPatch.price_text as string | undefined) ?? event.priceText,
          ticketPhases: (dbPatch.ticket_phases as AdminEventRecord['ticketPhases']) ?? event.ticketPhases,
          ticketStatus: (dbPatch.ticket_status as AdminEventRecord['ticketStatus']) ?? event.ticketStatus,
        } as AdminEventRecord)
      : (await loadPublishedEvents()).find((row) => row.id === event.id) ?? event;

    const afterLineup = dryRun ? beforeLineup : await lineupFingerprint(event.id);
    const afterForbidden = forbiddenDomainFingerprint(afterEvent);
    assertForbiddenDomainsUnchanged(event.id, { lineup: beforeLineup, forbidden: beforeForbidden }, {
      lineup: afterLineup,
      forbidden: afterForbidden,
    });

    const canonical = readCanonicalTicket({
      ticketUrl: afterEvent.ticketUrl,
      websiteUrl: afterEvent.websiteUrl,
      priceText: afterEvent.priceText,
      ticketStatus: afterEvent.ticketStatus,
      ticketPhases: afterEvent.ticketPhases,
    });

    mutations += allowedChanges.length;
    details.push({
      eventId: event.id,
      title: event.title,
      pass,
      dryRun,
      fieldChanges: allowedChanges,
      writtenPriceText: afterEvent.priceText,
      writtenMinimumPrice: canonical.minimumPrice,
      admissionPhases: afterEvent.ticketPhases,
      excludedAddOnEvidence: serializeExcludedProducts(evidence),
      availability: canonical.availability,
      ticketStatus: afterEvent.ticketStatus,
      before: {
        priceText: event.priceText,
        ticketStatus: event.ticketStatus,
        phaseCount: event.ticketPhases?.length ?? 0,
        ticketPhases: event.ticketPhases,
      },
      after: {
        priceText: afterEvent.priceText,
        minimumPrice: canonical.minimumPrice,
        maximumPrice: canonical.maximumPrice,
        currency: canonical.currency,
        availability: canonical.availability,
        ticketStatus: afterEvent.ticketStatus,
        phaseCount: afterEvent.ticketPhases?.length ?? 0,
        ticketPhases: afterEvent.ticketPhases,
      },
      mobileUi: {
        priceLabel: canonical.priceText,
        availabilityLabel:
          canonical.availability !== 'unknown'
            ? formatTicketAvailabilityLabelDe(canonical.availability)
            : undefined,
      },
      apiPayload: {
        priceText: canonical.priceText,
        minimumPrice: canonical.minimumPrice,
        maximumPrice: canonical.maximumPrice,
        currency: canonical.currency,
        availability: canonical.availability,
        ticketStatus: canonical.ticketStatus,
        ticketPhases: canonical.ticketPhases,
      },
      lineupFingerprint: afterLineup,
      forbiddenDomainFingerprint: afterForbidden,
    });
  }

  const runs = existsSync(OUT_RUNS)
    ? (JSON.parse(readFileSync(OUT_RUNS, 'utf8')) as { runs: [] }).runs
    : [];
  runs.push({ at: new Date().toISOString(), pass, dryRun, mutations, details });
  writeJson(OUT_RUNS, { runs });

  console.log(`Gate C1 repair pass ${pass}: ${mutations} field mutations (${dryRun ? 'dry-run' : 'live'})`);
  return mutations;
}

async function runVerify(): Promise<void> {
  const backup = existsSync(OUT_BACKUP)
    ? (JSON.parse(readFileSync(OUT_BACKUP, 'utf8')) as {
        events: Array<{
          id: string;
          title: string;
          priceText?: string;
          lineupFingerprint: LineupFingerprint;
          forbiddenDomainFingerprint: ForbiddenDomainFingerprint;
        }>;
      })
    : { events: [] };

  const events = await loadPublishedEvents();
  const affected = [];
  for (const before of backup.events) {
    const after = events.find((event) => event.id === before.id);
    if (!after) {
      continue;
    }
    const canonical = readCanonicalTicket({
      ticketUrl: after.ticketUrl,
      websiteUrl: after.websiteUrl,
      priceText: after.priceText,
      ticketStatus: after.ticketStatus,
      ticketPhases: after.ticketPhases,
    });
    const lineup = await lineupFingerprint(after.id);
    const forbidden = forbiddenDomainFingerprint(after);
    affected.push({
      eventId: after.id,
      title: after.title,
      ticketUrl: after.ticketUrl,
      priceGained: !before.priceText?.trim() && Boolean(after.priceText?.trim()),
      beforePriceText: before.priceText,
      afterPriceText: after.priceText,
      minimumPrice: canonical.minimumPrice,
      currency: canonical.currency,
      availability: canonical.availability,
      ticketStatus: after.ticketStatus,
      phaseCount: after.ticketPhases?.length ?? 0,
      ticketPhases: after.ticketPhases,
      mobileUi: {
        priceLabel: canonical.priceText,
        availabilityLabel:
          canonical.availability !== 'unknown'
            ? formatTicketAvailabilityLabelDe(canonical.availability)
            : undefined,
      },
      apiPayload: {
        priceText: canonical.priceText,
        minimumPrice: canonical.minimumPrice,
        maximumPrice: canonical.maximumPrice,
        currency: canonical.currency,
        availability: canonical.availability,
        ticketStatus: canonical.ticketStatus,
        ticketPhases: canonical.ticketPhases,
      },
      lineupFingerprintBefore: before.lineupFingerprint,
      lineupFingerprintAfter: lineup,
      lineupUnchanged: JSON.stringify(before.lineupFingerprint) === JSON.stringify(lineup),
      forbiddenDomainFingerprintBefore: before.forbiddenDomainFingerprint,
      forbiddenDomainFingerprintAfter: forbidden,
      forbiddenDomainUnchanged:
        JSON.stringify(before.forbiddenDomainFingerprint) === JSON.stringify(forbidden),
    });
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    ticketKingsEventsInBackup: backup.events.length,
    eventsWithPriceGained: affected.filter((row) => row.priceGained).length,
    lineupFingerprintsUnchanged: affected.every((row) => row.lineupUnchanged),
    forbiddenDomainsUnchanged: affected.every((row) => row.forbiddenDomainUnchanged),
    affected,
  };
  writeJson(OUT_RESULT, summary);
  console.log(JSON.stringify(summary, null, 2));
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'full';
  const passArg = process.argv.find((arg) => arg.startsWith('--pass='));
  const pass = passArg ? Number.parseInt(passArg.split('=')[1] ?? '1', 10) : 1;

  if (command === 'backup') {
    await runBackup();
    return;
  }
  if (command === 'repair') {
    const admissionOnly = process.argv.includes('--admission-only') || pass > 0;
    await runRepair(pass, false, admissionOnly);
    return;
  }
  if (command === 'cache-refresh') {
    await invalidateConsumerEventCaches();
    console.log('Consumer event caches invalidated');
    return;
  }
  if (command === 'verify') {
    await runVerify();
    return;
  }
  if (command === 'full' || command === 'admission-full') {
    writeJson(OUT_RUNS, { runs: [] });
    await runBackup();
    const pass1 = await runRepair(1, false, true);
    await invalidateConsumerEventCaches();
    await runVerify();
    const pass2 = await runRepair(2, false, true);
    if (pass2 !== 0) {
      throw new Error(`Idempotency failed: pass 2 produced ${pass2} mutations`);
    }
    await runVerify();
    console.log(`Gate C1 admission repair complete: pass1=${pass1}, pass2=${pass2}`);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
