/**
 * Phase 4.8.6.5.2 — Generic ticket price UI deduplication (read-only).
 */
import './bootstrap-ops-supabase';

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapEventRowToAdminRecord, type EventRow } from '@/data/mappers/event-mapper';
import type { AdminEventRecord } from '@/data/types/records';
import { readCanonicalTicket } from '@/features/events/domain/canonical-ticket-read';
import {
  auditConsumerPricePresentation,
  detectDuplicatePriceSurfaces,
  TICKET_PRICE_CONTRACT_RULES,
  type ConsumerPricePresentationSlots,
} from '@/features/events/domain/ticket-price-presentation-contract';
import { resolveEventPriceAvailabilitySemantics } from '@/features/events/domain/event-price-availability-semantics';
import { formatTicketAvailabilityLabelDe } from '@/features/events/domain/canonical-ticket-availability-label';
import { projectCanonicalEventFields } from '@/features/events/formatting/canonical-event-projection';
import { resolveTicketProviderPresentationLabel } from '@/features/events/formatting/ticket-platform-presentation';
import {
  auditConsumerTicketPresentationForEvent,
  presentationToConsumerSlots,
  resolveConsumerTicketPresentation,
  type ConsumerTicketPresentationSource,
} from '@/features/events/formatting/resolve-consumer-ticket-presentation';
import {
  toTicketTypeViewModels,
} from '@/features/events/formatting/ticket-phase-consumer-bridge';
import { formatGermanTicketPrice } from '@/features/aggregation/connectors/ticket-platform/format-ticket-price';
import { deriveSummaryPriceTextFromPhases } from '@/features/import/domain/canonical-ticket-phase';
import type { CanonicalTicketPhase } from '@/features/import/domain/canonical-ticket-phase';
import { opsClient } from './ops-supabase-rows';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'docs/real-data');

export const PHASE48652_UNDERLAND_EVENT_ID = 'evt-1785389049895-4mb7dub';
export const PHASE48652_LEVI_EVENT_ID = 'evt-1785339383539-0lxvjlp';
export const PHASE48652_ELEKTROKUECHE_EVENT_ID = 'evt-1785389055557-ux20897';
export const PHASE48652_MDMA_EVENT_ID = 'evt-1785389052337-0gv1iz1';
export const PHASE48652_BC173_EVENT_ID = 'evt-1785339410908-9691748';
export const PHASE48652_R3HAB_EVENT_ID = 'evt-1785339421539-k3swcrl';
export const PHASE48652_SOMMERFEST_EVENT_ID = 'evt-1785339391167-tfaixrr';

const ACCEPTANCE_EVENT_IDS = [
  PHASE48652_UNDERLAND_EVENT_ID,
  PHASE48652_LEVI_EVENT_ID,
  PHASE48652_ELEKTROKUECHE_EVENT_ID,
  PHASE48652_MDMA_EVENT_ID,
  PHASE48652_BC173_EVENT_ID,
  PHASE48652_R3HAB_EVENT_ID,
  PHASE48652_SOMMERFEST_EVENT_ID,
];

let productionMutationsInThisRun = 0;

function writeJson(name: string, data: unknown): void {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, name), JSON.stringify(data, null, 2));
}

async function loadEventRow(eventId: string): Promise<EventRow | null> {
  const { data, error } = await opsClient().from('events').select('*').eq('id', eventId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as EventRow | null) ?? null;
}

function adminToPresentationSource(event: AdminEventRecord): ConsumerTicketPresentationSource {
  const canonical = readCanonicalTicket({
    ticketUrl: event.ticketUrl,
    websiteUrl: event.websiteUrl,
    priceText: event.priceText,
    ticketStatus: event.ticketStatus,
    ticketPhases: event.ticketPhases,
  });
  const projection = projectCanonicalEventFields({
    title: event.title,
    description: event.description,
    venue: event.venueName,
    city: event.venueCity,
    artists: [],
    priceText: canonical.priceText ?? event.priceText,
    source: event.sourceId,
    ticketUrl: canonical.publicCtaUrl ?? event.ticketUrl,
    ticketPlatform: canonical.ticketPlatform,
    ticketDestinationClass: canonical.destinationClass,
    ticketStatus: canonical.ticketStatus ?? event.ticketStatus,
    ticketPhases: event.ticketPhases,
    genres: event.genreLabels ?? [],
  });

  return {
    id: event.id,
    title: event.title,
    priceText: canonical.priceText ?? event.priceText,
    displayPriceText: projection.displayPriceText,
    ticketUrl: canonical.publicCtaUrl ?? event.ticketUrl,
    officialEventUrl: event.websiteUrl,
    ticketAvailability: projection.ticketAvailability,
    ticketPhases: event.ticketPhases,
    ticketProviderLabel:
      projection.ticketProviderLabel ??
      resolveTicketProviderPresentationLabel({
        ticketPlatform: canonical.ticketPlatform,
        ticketUrl: event.ticketUrl,
      }),
    timezone: event.timezone,
  };
}

function buildCurrentDisplaySlots(event: AdminEventRecord): ConsumerPricePresentationSlots & {
  phaseNames?: string[];
  ticketUrl?: string;
} {
  const source = adminToPresentationSource(event);
  const presentation = resolveConsumerTicketPresentation(source, { mode: 'external' });
  const slots = presentationToConsumerSlots(presentation);
  return {
    ...slots,
    phaseNames: presentation.ticketTypes.map((ticketType) => ticketType.name),
    ticketUrl: source.ticketUrl,
  };
}

function buildPre48652Summary(phases: CanonicalTicketPhase[] | undefined) {
  if (!phases?.length) return undefined;
  const priced = phases.filter((phase) => phase.priceAmount !== undefined && !phase.soldOut);
  if (priced.length === 0) {
    const summaryText = deriveSummaryPriceTextFromPhases(phases);
    if (!summaryText) return undefined;
    return { subtotalLabel: summaryText, totalLabel: summaryText };
  }
  const amounts = priced.map((phase) => phase.priceAmount!).filter(Number.isFinite);
  const currency = priced.find((phase) => phase.priceCurrency)?.priceCurrency ?? 'EUR';
  const min = Math.min(...amounts);
  const max = Math.max(...amounts);
  const subtotalLabel =
    min === max
      ? formatGermanTicketPrice(min, currency) ?? `${min}`
      : `${formatGermanTicketPrice(min, currency, { prefix: 'ab' }) ?? `${min}`} – ${formatGermanTicketPrice(max, currency) ?? `${max}`}`;
  return { subtotalLabel, totalLabel: subtotalLabel };
}

/** Pre-48652 slot projection (legacy duplication path). */
function buildLegacyDisplaySlots(event: AdminEventRecord): ConsumerPricePresentationSlots {
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
    ticketPhases: event.ticketPhases?.map((phase) => ({
      soldOut: phase.soldOut,
      available: phase.available,
      label: phase.name,
    })),
  });
  const ticketTypes = toTicketTypeViewModels(event.ticketPhases);
  const summary = buildPre48652Summary(event.ticketPhases);
  const headerPrice =
    semantics.showPrice && semantics.displayPriceText
      ? semantics.displayPriceText
      : semantics.explanatoryLabel;

  return {
    headerPrice,
    sectionStandalonePrice: canonical.priceText ?? event.priceText,
    phasePrices: ticketTypes.map((ticketType) => ticketType.priceLabel),
    subtotal: summary?.subtotalLabel,
    total: summary?.totalLabel,
    availabilityLabel:
      canonical.availability !== 'unknown'
        ? formatTicketAvailabilityLabelDe(canonical.availability)
        : undefined,
    ctaLabel: canonical.ctaLabel,
  };
}

const RENDER_INVENTORY = [
  {
    id: 'EventHero',
    file: 'src/components/event-detail/EventHero.tsx',
    field: 'ticketLabel',
    source: 'toEventHeroViewModel → resolveConsumerTicketPresentation.headerPriceLabel',
  },
  {
    id: 'TicketPriceLabel',
    file: 'src/components/event-detail/TicketPriceLabel.tsx',
    field: 'label',
    source: 'EventHero.ticketLabel',
  },
  {
    id: 'EventTicketSection',
    file: 'src/components/event-detail/EventTicketSection.tsx',
    field: 'priceLabel, ticketTypes, summary, ctaLabel',
    source: 'toEventTicketSectionViewModel',
  },
  {
    id: 'TicketTypeCard',
    file: 'src/components/ticketing/TicketTypeCard.tsx',
    field: 'priceLabel',
    source: 'resolveConsumerTicketPresentation.ticketTypes',
  },
  {
    id: 'TicketSummary',
    file: 'src/components/ticketing/TicketSummary.tsx',
    field: 'subtotalLabel, totalLabel',
    source: 'section.showSummary && section.summary (native cart only)',
  },
  {
    id: 'resolveConsumerTicketPresentation',
    file: 'src/features/events/formatting/resolve-consumer-ticket-presentation.ts',
    field: 'headerPriceLabel, sectionPriceLabel, ticketTypes, summary, showSummary',
    source: 'canonical ticket + semantics + deduped phases',
  },
];

export async function auditRendering(): Promise<Record<string, unknown>> {
  const events = [];
  for (const eventId of ACCEPTANCE_EVENT_IDS) {
    const row = await loadEventRow(eventId);
    if (!row) continue;
    const admin = mapEventRowToAdminRecord(row);
    const source = adminToPresentationSource(admin);
    const legacy = buildLegacyDisplaySlots(admin);
    const current = buildCurrentDisplaySlots(admin);
    const presentation = resolveConsumerTicketPresentation(source, { mode: 'external' });
    events.push({
      eventId,
      title: admin.title,
      legacySlots: legacy,
      currentSlots: current,
      presentationSlots: presentationToConsumerSlots(presentation),
      legacyDuplicates: detectDuplicatePriceSurfaces(legacy),
      currentDuplicates: detectDuplicatePriceSurfaces(current),
    });
  }

  const result = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6.5.2',
    productionMutationsInThisRun,
    components: RENDER_INVENTORY,
    duplicateRootCause:
      'Legacy path projected priceText to header, section.priceLabel, phase cards, and TicketSummary subtotal/total without cart state',
    events,
    contractRules: TICKET_PRICE_CONTRACT_RULES,
  };
  writeJson('_phase48652_render_inventory.json', result);
  return result;
}

export async function buildPresentationModel(): Promise<Record<string, unknown>> {
  const models = [];
  for (const eventId of ACCEPTANCE_EVENT_IDS) {
    const row = await loadEventRow(eventId);
    if (!row) continue;
    const admin = mapEventRowToAdminRecord(row);
    const source = adminToPresentationSource(admin);
    const { presentation } = auditConsumerTicketPresentationForEvent(source, { mode: 'external' });
    models.push({ eventId, title: admin.title, presentation });
  }

  const result = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6.5.2',
    productionMutationsInThisRun,
    models,
  };
  return result;
}

export async function validateAcceptanceEvents(): Promise<Record<string, unknown>> {
  const expectations: Record<string, { header?: string; phaseName?: string; noPrice?: boolean }> = {
    [PHASE48652_UNDERLAND_EVENT_ID]: { header: 'ab 15,00 €', phaseName: 'E-Ticket — Early Bird' },
    [PHASE48652_ELEKTROKUECHE_EVENT_ID]: { header: 'ab 15,00 €', phaseName: 'Standard Ticket — Phase 3' },
    [PHASE48652_BC173_EVENT_ID]: { header: 'ab 23,00 €', phaseName: 'Admission' },
    [PHASE48652_R3HAB_EVENT_ID]: { header: 'ab 23,90 €' },
    [PHASE48652_SOMMERFEST_EVENT_ID]: { header: 'ab 11,90 €' },
    [PHASE48652_MDMA_EVENT_ID]: { header: 'ab 34,90 €' },
    [PHASE48652_LEVI_EVENT_ID]: { noPrice: true },
  };

  const results = [];
  let passed = true;

  for (const eventId of ACCEPTANCE_EVENT_IDS) {
    const row = await loadEventRow(eventId);
    if (!row) {
      passed = false;
      results.push({ eventId, passed: false, reason: 'event_not_found' });
      continue;
    }

    const admin = mapEventRowToAdminRecord(row);
    const source = adminToPresentationSource(admin);
    const presentation = resolveConsumerTicketPresentation(source, { mode: 'external' });
    const slots = buildCurrentDisplaySlots(admin);
    const duplicates = detectDuplicatePriceSurfaces(slots);
    const expected = expectations[eventId];

    const checks = {
      headerPrice: expected?.header ? presentation.headerPriceLabel === expected.header : true,
      noSectionStandalone: !presentation.sectionPriceLabel,
      noSummary: !presentation.showSummary && !presentation.summary,
      noSubtotalTotal: !slots.subtotal && !slots.total,
      noStandaloneDuplicate: !duplicates.some((group) => group.surfaces.includes('section_standalone')),
      noSubtotalDuplicate: !duplicates.some((group) => group.surfaces.includes('subtotal')),
      phaseCount: expected?.phaseName ? presentation.ticketTypes.length === 1 : true,
      phaseName: expected?.phaseName ? presentation.ticketTypes[0]?.name === expected.phaseName : true,
      noPrice: expected?.noPrice ? !presentation.headerPriceLabel && !presentation.sectionPriceLabel : true,
      noDiagnosticStrings: !JSON.stringify(slots).match(/surface:/i),
      ctaPresent: Boolean(presentation.cta),
    };

    const eventPassed = Object.values(checks).every(Boolean);
    if (!eventPassed) passed = false;

    results.push({
      eventId,
      title: admin.title,
      passed: eventPassed,
      checks,
      slots,
      duplicates,
    });
  }

  const result = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6.5.2',
    productionMutationsInThisRun,
    passed,
    results,
  };
  writeJson('_phase48652_acceptance_events.json', result);
  return result;
}

export async function verifyVisualLayout(): Promise<Record<string, unknown>> {
  const layouts = [];
  for (const eventId of ACCEPTANCE_EVENT_IDS) {
    const row = await loadEventRow(eventId);
    if (!row) continue;
    const admin = mapEventRowToAdminRecord(row);
    const source = adminToPresentationSource(admin);
    const presentation = resolveConsumerTicketPresentation(source, { mode: 'external' });
    layouts.push({
      eventId,
      title: admin.title,
      mobile: {
        hasStandalonePrice: Boolean(presentation.sectionPriceLabel),
        phaseCardCount: presentation.ticketTypes.length,
        hasSummaryBlock: Boolean(presentation.showSummary && presentation.summary),
        hasCta: Boolean(presentation.cta),
        hasProvider: Boolean(presentation.providerLabel),
        hasAvailability: Boolean(presentation.availabilityLabel),
      },
      web: {
        sameAsMobile: true,
        note: 'EventTicketSection is shared between mobile and web layouts',
      },
      balanced:
        !presentation.sectionPriceLabel &&
        !(presentation.showSummary && presentation.summary) &&
        presentation.ticketTypes.length <= (admin.ticketPhases?.length ?? 0),
    });
  }

  const result = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6.5.2',
    productionMutationsInThisRun,
    layouts,
    layoutContractPassed: layouts.every(
      (layout) =>
        !layout.mobile.hasStandalonePrice &&
        !layout.mobile.hasSummaryBlock &&
        layout.balanced,
    ),
    browserVerified: false,
    verificationMode: 'not_browser_verified',
  };
  writeJson('_phase48652_visual_verification.json', result);
  return result;
}

export async function readiness(): Promise<Record<string, unknown>> {
  const acceptance = await validateAcceptanceEvents();
  const visual = await verifyVisualLayout();

  const layoutContractPassed = visual.layoutContractPassed === true;

  const result = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6.5.2',
    productionMutationsInThisRun,
    verdict:
      acceptance.passed && layoutContractPassed
        ? 'READY_FOR_MANUAL_VISUAL_REVIEW'
        : 'BLOCKED',
    acceptancePassed: acceptance.passed,
    layoutContractPassed,
    browserVerified: false,
    manualReviewPending: true,
    verificationMode: 'not_browser_verified',
    dataMutations: 0,
    consumerOnly: true,
    rolloutActivated: false,
  };
  writeJson('_phase48652_readiness.json', result);
  return result;
}

export async function beforeAfterMatrix(): Promise<Record<string, unknown>> {
  const matrix = [];
  for (const eventId of ACCEPTANCE_EVENT_IDS) {
    const row = await loadEventRow(eventId);
    if (!row) continue;
    const admin = mapEventRowToAdminRecord(row);
    const before = buildLegacyDisplaySlots(admin);
    const after = buildCurrentDisplaySlots(admin);
    matrix.push({
      eventId,
      title: admin.title,
      before,
      after,
      duplicatesBefore: detectDuplicatePriceSurfaces(before),
      duplicatesAfter: detectDuplicatePriceSurfaces(after),
    });
  }

  const result = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6.5.2',
    productionMutationsInThisRun,
    matrix,
  };
  writeJson('_phase48652_before_after_matrix.json', result);
  return result;
}

export async function report(): Promise<void> {
  const inventory = await auditRendering();
  await buildPresentationModel();
  await beforeAfterMatrix();
  const acceptance = await validateAcceptanceEvents();
  const visual = await verifyVisualLayout();
  const ready = await readiness();

  console.log(
    JSON.stringify(
      {
        phase: '4.8.6.5.2',
        productionMutationsInThisRun,
        acceptancePassed: acceptance.passed,
        layoutContractPassed: ready.layoutContractPassed,
        manualReviewPending: ready.manualReviewPending,
        verdict: ready.verdict,
        eventsAudited: (inventory.events as unknown[]).length,
      },
      null,
      2,
    ),
  );
}

export async function full(): Promise<void> {
  productionMutationsInThisRun = 0;
  await report();
}

const command = process.argv[2] ?? 'report';

void (async () => {
  switch (command) {
    case 'audit-rendering':
      console.log(JSON.stringify(await auditRendering(), null, 2));
      break;
    case 'build-presentation-model':
      console.log(JSON.stringify(await buildPresentationModel(), null, 2));
      break;
    case 'validate-acceptance-events':
      console.log(JSON.stringify(await validateAcceptanceEvents(), null, 2));
      break;
    case 'verify-visual-layout':
      console.log(JSON.stringify(await verifyVisualLayout(), null, 2));
      break;
    case 'readiness':
      console.log(JSON.stringify(await readiness(), null, 2));
      break;
    case 'before-after-matrix':
      console.log(JSON.stringify(await beforeAfterMatrix(), null, 2));
      break;
    case 'full':
      await full();
      break;
    case 'report':
    default:
      await report();
      break;
  }
})();
