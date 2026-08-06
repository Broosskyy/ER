/**
 * Phase 4.8.6.5.1 — Controlled Underland price persistence.
 *
 * Apply requires --approve and PHASE48651_APPLY_APPROVED=true.
 */
import './bootstrap-ops-supabase';

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapEventRowToAdminRecord, type EventRow } from '@/data/mappers/event-mapper';
import type { AdminEventRecord } from '@/data/types/records';
import {
  extractNativeEventCheckoutUrl,
  parseTicketKingsCheckoutHtml,
} from '@/features/aggregation/connectors/ticket-platform/ticket-kings-public-checkout';
import { readCanonicalTicket } from '@/features/events/domain/canonical-ticket-read';
import { auditConsumerPricePresentation } from '@/features/events/domain/ticket-price-presentation-contract';
import { resolveEventPriceAvailabilitySemantics } from '@/features/events/domain/event-price-availability-semantics';
import { formatTicketAvailabilityLabelDe } from '@/features/events/domain/canonical-ticket-availability-label';
import {
  toTicketSummaryViewModel,
  toTicketTypeViewModels,
} from '@/features/events/formatting/ticket-phase-consumer-bridge';
import { projectCanonicalEventFields } from '@/features/events/formatting/canonical-event-projection';
import { invalidateConsumerEventCaches } from '@/features/events/formatting/consumer-cache-invalidation';
import {
  buildApprovedUnderlandAdmissionPhase,
  PHASE48651_APPLY_ENV,
  PHASE48651_EVENT_ID,
  PHASE48651_PHASE_AMOUNT,
  PHASE48651_PHASE_NAME,
  PHASE48651_PRICE_TEXT,
  PHASE48651_PROVENANCE_SOURCE_ID,
  PHASE48651_TICKET_URL,
  planUnderlandPriceMutations,
  phasesSemanticallyEqual,
} from '@/features/import/controlled-price-persistence/underland-price-persistence';
import { opsClient } from './ops-supabase-rows';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'docs/real-data');

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

function hasApproveFlag(): boolean {
  return process.argv.includes('--approve');
}

function assertApplyApproved(command: string): void {
  if (!hasApproveFlag()) throw new Error(`${command} requires --approve`);
  if (process.env[PHASE48651_APPLY_ENV] !== 'true') {
    throw new Error(`${command} requires ${PHASE48651_APPLY_ENV}=true`);
  }
}

async function loadEvent(): Promise<AdminEventRecord> {
  const { data, error } = await opsClient()
    .from('events')
    .select('*')
    .eq('id', PHASE48651_EVENT_ID)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`Event not found: ${PHASE48651_EVENT_ID}`);
  return mapEventRowToAdminRecord(data as EventRow);
}

async function fetchFreshEvidence() {
  const page = await fetch(PHASE48651_TICKET_URL, { headers: FETCH_HEADERS, redirect: 'follow' });
  const body = page.ok ? await page.text() : '';
  const checkoutUrl = extractNativeEventCheckoutUrl(body);
  let checkoutEvidence: ReturnType<typeof parseTicketKingsCheckoutHtml> | undefined;
  if (checkoutUrl) {
    const checkoutPage = await fetch(checkoutUrl, { headers: FETCH_HEADERS, redirect: 'follow' });
    if (checkoutPage.ok) {
      checkoutEvidence = parseTicketKingsCheckoutHtml(await checkoutPage.text());
    }
  }
  const earlyBird = checkoutEvidence?.releases.find((r) => r.name.includes('Early Bird'));
  const passed =
    page.ok &&
    checkoutEvidence?.priceAmount === PHASE48651_PHASE_AMOUNT &&
    earlyBird?.priceAmount === PHASE48651_PHASE_AMOUNT &&
    checkoutEvidence.excludedProducts.length >= 1;
  return {
    pageStatus: page.status,
    checkoutUrl,
    checkoutEvidence,
    earlyBird,
    passed,
  };
}

function forbiddenFingerprint(event: AdminEventRecord) {
  return {
    title: event.title,
    descriptionHash: hash(event.description),
    venueName: event.venueName,
    venueAddress: event.venueAddress,
    venueCity: event.venueCity,
    startDate: event.startDate,
    ticketUrl: event.ticketUrl,
    websiteUrl: event.websiteUrl,
    imageUrl: event.imageUrl,
    sourceId: event.sourceId,
    organizerName: event.organizerName,
    genreLabelsHash: hash(event.genreLabels),
    latitude: event.latitude,
    longitude: event.longitude,
  };
}

function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value ?? null)).digest('hex').slice(0, 16);
}

function buildConsumerSlots(event: AdminEventRecord) {
  const canonical = readCanonicalTicket({
    ticketUrl: event.ticketUrl,
    websiteUrl: event.websiteUrl,
    priceText: event.priceText,
    ticketStatus: event.ticketStatus,
    ticketPhases: event.ticketPhases,
  });
  const semantics = resolveEventPriceAvailabilitySemantics({
    priceText: event.priceText,
    ticketAvailability: event.ticketStatus,
    ticketPhases: event.ticketPhases?.map((p) => ({
      soldOut: p.soldOut,
      available: p.available,
      label: p.name,
    })),
  });
  const ticketTypes = toTicketTypeViewModels(event.ticketPhases);
  const summary = toTicketSummaryViewModel(event.ticketPhases);
  return {
    headerPrice:
      semantics.showPrice && semantics.displayPriceText
        ? semantics.displayPriceText
        : semantics.explanatoryLabel,
    sectionStandalonePrice: canonical.priceText ?? event.priceText,
    phasePrices: ticketTypes.map((t) => t.priceLabel),
    phaseNames: ticketTypes.map((t) => t.name),
    subtotal: summary?.subtotalLabel,
    total: summary?.totalLabel,
    ticketUrl: event.ticketUrl,
    ctaLabel: canonical.ctaLabel,
    availabilityLabel:
      canonical.availability !== 'unknown'
        ? formatTicketAvailabilityLabelDe(canonical.availability)
        : undefined,
  };
}

async function persistProvenance(
  event: AdminEventRecord,
  patch: { priceText: string; ticketPhases: AdminEventRecord['ticketPhases'] },
  checkoutUrl?: string,
): Promise<void> {
  const client = opsClient();
  const now = new Date().toISOString();
  const rows = [
    {
      id: `provenance-${event.id}-priceText`,
      canonical_event_id: event.id,
      field_path: 'priceText',
      selected_value: patch.priceText,
      selected_source_id: PHASE48651_PROVENANCE_SOURCE_ID,
      selected_at: now,
      selection_reason: 'phase48651_underland_admission_checkout',
      alternatives: [
        {
          sourceId: PHASE48651_PROVENANCE_SOURCE_ID,
          value: patch.priceText,
          freshnessAt: now,
          originExternalId: checkoutUrl ?? PHASE48651_TICKET_URL,
          mergeDecision: 'admission_only_summary',
        },
      ],
      manually_overridden: false,
      updated_at: now,
    },
    {
      id: `provenance-${event.id}-ticketPhases`,
      canonical_event_id: event.id,
      field_path: 'ticketPhases',
      selected_value: {
        phases: patch.ticketPhases ?? [],
        evidenceSource: 'nacht_manager_checkout',
        consumerCta: PHASE48651_TICKET_URL,
        checkoutUrl,
        repairedAt: now,
      },
      selected_source_id: PHASE48651_PROVENANCE_SOURCE_ID,
      selected_at: now,
      selection_reason: 'phase48651_underland_admission_checkout',
      alternatives: [],
      manually_overridden: false,
      updated_at: now,
    },
  ];
  for (const row of rows) {
    const { error } = await client.from('event_field_provenance').upsert(row, {
      onConflict: 'canonical_event_id,field_path',
    });
    if (error) throw new Error(`Provenance failed: ${error.message}`);
  }
}

export async function cmdPreflight(): Promise<Record<string, unknown>> {
  const evidence = await fetchFreshEvidence();
  const result = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6.5.1',
    productionMutationsInThisRun: 0,
    eventId: PHASE48651_EVENT_ID,
    passed: evidence.passed,
    evidence,
    abortReason: evidence.passed ? undefined : 'Fresh evidence no longer matches approved Early Bird 15 EUR',
  };
  writeJson('_phase48651_preflight.json', result);
  if (!evidence.passed) throw new Error(result.abortReason as string);
  return result;
}

export async function cmdBackup(): Promise<Record<string, unknown>> {
  const event = await loadEvent();
  const result = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6.5.1',
    productionMutationsInThisRun: 0,
    event: {
      id: event.id,
      title: event.title,
      priceText: event.priceText,
      ticketPhases: event.ticketPhases,
      ticketUrl: event.ticketUrl,
      ticketStatus: event.ticketStatus,
    },
    forbiddenFingerprint: forbiddenFingerprint(event),
  };
  writeJson('_phase48651_backup.json', result);
  return result;
}

export async function cmdPreview(): Promise<Record<string, unknown>> {
  const event = await loadEvent();
  const mutations = planUnderlandPriceMutations(event);
  const result = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6.5.1',
    productionMutationsInThisRun: 0,
    eventId: PHASE48651_EVENT_ID,
    mutations,
    candidateCount: mutations.length,
    approvalRequired: `apply --approve with ${PHASE48651_APPLY_ENV}=true`,
  };
  writeJson('_phase48651_preview.json', result);
  return result;
}

export async function cmdApply(pass: 1 | 2): Promise<Record<string, unknown>> {
  if (pass === 1) assertApplyApproved('apply');
  await cmdPreflight();
  const event = await loadEvent();
  const beforeForbidden = forbiddenFingerprint(event);
  const mutations = planUnderlandPriceMutations(event);

  if (pass === 2 && mutations.length > 0) {
    throw new Error(`Pass 2 expected 0 mutations, got ${mutations.length}`);
  }
  if (pass === 2) {
    return { pass: 2, mutationCount: 0, productionMutationsInThisRun };
  }

  if (mutations.length === 0) {
    return { pass: 1, mutationCount: 0, productionMutationsInThisRun };
  }

  const evidence = await fetchFreshEvidence();
  const phase = buildApprovedUnderlandAdmissionPhase();
  const patch = {
    price_text: PHASE48651_PRICE_TEXT,
    ticket_phases: [phase],
    updated_at: new Date().toISOString(),
  };

  const { error } = await opsClient()
    .from('events')
    .update(patch as never)
    .eq('id', PHASE48651_EVENT_ID);
  if (error) throw new Error(error.message);

  await persistProvenance(
    event,
    { priceText: PHASE48651_PRICE_TEXT, ticketPhases: [phase] },
    evidence.checkoutUrl,
  );

  productionMutationsInThisRun += 1;
  const after = await loadEvent();
  const afterForbidden = forbiddenFingerprint(after);
  if (JSON.stringify(beforeForbidden) !== JSON.stringify(afterForbidden)) {
    throw new Error('Forbidden domain fingerprint changed');
  }

  await invalidateConsumerEventCaches();
  return {
    pass: 1,
    mutationCount: mutations.length,
    mutations,
    productionMutationsInThisRun,
  };
}

export async function cmdVerifyConsumer(): Promise<Record<string, unknown>> {
  const event = await loadEvent();
  const slots = buildConsumerSlots(event);
  const uiAudit = auditConsumerPricePresentation({
    eventId: event.id,
    title: event.title,
    slots,
  });
  const canonical = readCanonicalTicket({
    ticketUrl: event.ticketUrl,
    websiteUrl: event.websiteUrl,
    priceText: event.priceText,
    ticketStatus: event.ticketStatus,
    ticketPhases: event.ticketPhases,
  });
  const projection = projectCanonicalEventFields({
    title: event.title,
    description: event.description ?? '',
    venue: event.venueName ?? '',
    city: event.venueCity ?? '',
    artists: [],
    priceText: event.priceText,
    source: event.sourceId ?? '',
    ticketUrl: event.ticketUrl,
    imageUrl: event.imageUrl,
    genres: event.genreLabels,
    ticketStatus: event.ticketStatus,
    ticketPhases: event.ticketPhases,
  });

  const checks = {
    ticketKingsCta: event.ticketUrl === PHASE48651_TICKET_URL,
    priceBadge: event.priceText === PHASE48651_PRICE_TEXT,
    displayPriceText: projection.displayPriceText === PHASE48651_PRICE_TEXT,
    oneAdmissionPhase: event.ticketPhases?.length === 1,
    phaseName: event.ticketPhases?.[0]?.name === PHASE48651_PHASE_NAME,
    phasePrice: event.ticketPhases?.[0]?.priceAmount === PHASE48651_PHASE_AMOUNT,
    noAddonPhases: !(event.ticketPhases ?? []).some((p) =>
      /hardticket|flex|postage|rabatt/i.test(p.name),
    ),
    canonicalPriceText: canonical.priceText === PHASE48651_PRICE_TEXT,
  };

  const result = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6.5.1',
    productionMutationsInThisRun: 0,
    checks,
    passed: Object.values(checks).every(Boolean),
    slots,
    uiAudit,
    projection: {
      displayPriceText: projection.displayPriceText,
      ticketUrl: projection.ticketUrl,
      ticketProviderLabel: projection.ticketProviderLabel,
    },
    note:
      'UI subtotal/total duplication is a separate Preview B scope — data layer has single admission phase only',
  };
  writeJson('_phase48651_consumer_verification.json', result);
  return result;
}

export async function cmdVerifyForbidden(): Promise<Record<string, unknown>> {
  const backup = readJson<{ forbiddenFingerprint: ReturnType<typeof forbiddenFingerprint> }>(
    '_phase48651_backup.json',
  );
  const event = await loadEvent();
  const current = forbiddenFingerprint(event);
  const violations: string[] = [];
  for (const [key, expected] of Object.entries(backup.forbiddenFingerprint)) {
    if (JSON.stringify(current[key as keyof typeof current]) !== JSON.stringify(expected)) {
      violations.push(key);
    }
  }
  const result = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6.5.1',
    passed: violations.length === 0,
    violations,
    productionMutationsInThisRun: 0,
  };
  writeJson('_phase48651_forbidden_verification.json', result);
  if (violations.length > 0) throw new Error(`Forbidden violations: ${violations.join(', ')}`);
  return result;
}

export async function cmdVerifyRollback(): Promise<Record<string, unknown>> {
  const backupExists = Boolean(readFileSync(join(OUT, '_phase48651_backup.json'), 'utf8'));
  const result = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6.5.1',
    backupPresent: backupExists,
    rollbackReady: backupExists,
    productionMutationsInThisRun: 0,
  };
  writeJson('_phase48651_rollback.json', result);
  return result;
}

export async function cmdReport(): Promise<void> {
  await cmdPreflight();
  await cmdBackup();
  await cmdPreview();
  console.log(JSON.stringify({ ok: true, phase: 'preflight-backup-preview', productionMutationsInThisRun: 0 }, null, 2));
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
    case 'preview':
      console.log(JSON.stringify(await cmdPreview(), null, 2));
      break;
    case 'apply': {
      const pass1 = await cmdApply(1);
      const preview2 = await cmdPreview();
      const pass2 = await cmdApply(2);
      await cmdVerifyConsumer();
      await cmdVerifyForbidden();
      await cmdVerifyRollback();
      console.log(JSON.stringify({ pass1, preview2, pass2 }, null, 2));
      break;
    }
    case 'verify-consumer':
      console.log(JSON.stringify(await cmdVerifyConsumer(), null, 2));
      break;
    case 'verify-forbidden':
      console.log(JSON.stringify(await cmdVerifyForbidden(), null, 2));
      break;
    case 'verify-rollback':
      console.log(JSON.stringify(await cmdVerifyRollback(), null, 2));
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
