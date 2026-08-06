/**
 * Phase 4.8.6.5 — Ticket price truth & consumer presentation contract (read-only).
 */
import './bootstrap-ops-supabase';

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapEventRowToAdminRecord, type EventRow } from '@/data/mappers/event-mapper';
import type { AdminEventRecord } from '@/data/types/records';
import { discoverTicketIoPriceEvidence } from '@/features/aggregation/connectors/ticket-platform/ticket-io-price-evidence';
import {
  extractNativeEventCheckoutUrl,
  parseTicketKingsCheckoutHtml,
} from '@/features/aggregation/connectors/ticket-platform/ticket-kings-public-checkout';
import { readCanonicalTicket } from '@/features/events/domain/canonical-ticket-read';
import {
  auditConsumerPricePresentation,
  TICKET_PRICE_CONTRACT_RULES,
  type ConsumerPricePresentationSlots,
  type NormalizedTicketPriceModel,
  type TicketPriceMissingCause,
} from '@/features/events/domain/ticket-price-presentation-contract';
import { resolveEventPriceAvailabilitySemantics } from '@/features/events/domain/event-price-availability-semantics';
import { formatTicketAvailabilityLabelDe } from '@/features/events/domain/canonical-ticket-availability-label';
import {
  toTicketSummaryViewModel,
  toTicketTypeViewModels,
} from '@/features/events/formatting/ticket-phase-consumer-bridge';
import { opsClient } from './ops-supabase-rows';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'docs/real-data');

export const PHASE4865_UNDERLAND_EVENT_ID = 'evt-1785389049895-4mb7dub';
export const PHASE4865_UNDERLAND_TICKET_URL =
  'https://ticketkings.de/event/underland-essigfabrik-05-09-2026/';
export const PHASE4865_LEVI_EVENT_ID = 'evt-1785339383539-0lxvjlp';
export const PHASE4865_LEVI_TICKET_URL = 'https://bootshaus-tickets.ticket.io/YvJnLSXd/';
export const PHASE4865_ELEKTROKUECHE_EVENT_ID = 'evt-1785389055557-ux20897';
export const PHASE4865_MDMA_EVENT_ID = 'evt-1785389052337-0gv1iz1';
export const PHASE4865_BC173_EVENT_ID = 'evt-1785339410908-9691748';
export const PHASE4865_R3HAB_EVENT_ID = 'evt-1785339421539-k3swcrl';
export const PHASE4865_SOMMERFEST_EVENT_ID = 'evt-1785339391167-tfaixrr';

const ACCEPTANCE_EVENT_IDS = [
  PHASE4865_UNDERLAND_EVENT_ID,
  PHASE4865_LEVI_EVENT_ID,
  PHASE4865_ELEKTROKUECHE_EVENT_ID,
  PHASE4865_MDMA_EVENT_ID,
  PHASE4865_BC173_EVENT_ID,
  PHASE4865_R3HAB_EVENT_ID,
  PHASE4865_SOMMERFEST_EVENT_ID,
];

const FETCH_HEADERS = {
  'User-Agent': 'EternalRave-SourceBot/1.0 (+https://eternalrave.app)',
  Accept: 'text/html',
};

let productionMutationsInThisRun = 0;

function writeJson(name: string, data: unknown): void {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, name), JSON.stringify(data, null, 2));
}

async function fetchHtml(url: string): Promise<{ status: number; finalUrl: string; body: string }> {
  const res = await fetch(url, { headers: FETCH_HEADERS, redirect: 'follow' });
  return { status: res.status, finalUrl: res.url, body: res.ok ? await res.text() : '' };
}

async function loadEvent(eventId: string): Promise<AdminEventRecord | null> {
  const { data, error } = await opsClient().from('events').select('*').eq('id', eventId).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapEventRowToAdminRecord(data as EventRow) : null;
}

function classifyUnderlandMissingCause(input: {
  pageOk: boolean;
  checkoutUrl?: string;
  checkoutEvidence?: ReturnType<typeof parseTicketKingsCheckoutHtml>;
}): TicketPriceMissingCause {
  if (!input.pageOk) return 'PUBLIC_PRICE_NOT_AVAILABLE';
  if (!input.checkoutUrl) return 'CHECKOUT_NOT_LINKED';
  if (!input.checkoutEvidence) return 'PRICE_EXTRACTION_FAILED';
  if (input.checkoutEvidence.reviewRequired) return 'REVIEW_REQUIRED';
  if (input.checkoutEvidence.releases.length === 0 && input.checkoutEvidence.products.length === 0) {
    return 'ADMISSION_PRODUCT_NOT_FOUND';
  }
  if (
    input.checkoutEvidence.priceAmount === undefined &&
    !input.checkoutEvidence.soldOut
  ) {
    return 'PUBLIC_PRICE_NOT_AVAILABLE';
  }
  return 'VALID_EVIDENCE_NOT_PERSISTED';
}

export async function traceUnderlandPrice(): Promise<Record<string, unknown>> {
  const event = await loadEvent(PHASE4865_UNDERLAND_EVENT_ID);
  const page = await fetchHtml(PHASE4865_UNDERLAND_TICKET_URL);
  const checkoutUrl = extractNativeEventCheckoutUrl(page.body);
  let checkoutHtml: string | undefined;
  let checkoutEvidence: ReturnType<typeof parseTicketKingsCheckoutHtml> | undefined;
  if (checkoutUrl) {
    const checkoutPage = await fetchHtml(checkoutUrl);
    checkoutHtml = checkoutPage.body;
    checkoutEvidence = parseTicketKingsCheckoutHtml(checkoutHtml);
  }

  const missingCause = classifyUnderlandMissingCause({
    pageOk: page.status === 200,
    checkoutUrl,
    checkoutEvidence,
  });

  const publicVerifiable = Boolean(
    checkoutEvidence?.priceAmount !== undefined || checkoutEvidence?.soldOut,
  );

  const result = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6.5',
    productionMutationsInThisRun: 0,
    eventId: PHASE4865_UNDERLAND_EVENT_ID,
    ticketUrl: PHASE4865_UNDERLAND_TICKET_URL,
    page: { status: page.status, finalUrl: page.finalUrl, title: page.body.match(/<title[^>]*>([^<]+)/i)?.[1] },
    checkoutUrl,
    checkoutEvidence,
    publicPriceVerifiable: publicVerifiable,
    publicTruth: publicVerifiable
      ? {
          rawPriceText: checkoutEvidence?.priceText,
          minimumPrice: checkoutEvidence?.priceAmount,
          maximumPrice: checkoutEvidence?.maximumPrice,
          currency: checkoutEvidence?.priceCurrency ?? 'EUR',
          availability: checkoutEvidence?.availability,
          admissionProducts: checkoutEvidence?.releases,
          excludedAddOns: checkoutEvidence?.excludedProducts?.length ?? 0,
        }
      : null,
    earliestMissingCause: publicVerifiable ? undefined : missingCause,
    canonical: event
      ? {
          priceText: event.priceText,
          ticketStatus: event.ticketStatus,
          ticketPhasesCount: event.ticketPhases?.length ?? 0,
          ticketUrl: event.ticketUrl,
        }
      : null,
    classification: publicVerifiable ? 'VALID_EVIDENCE_NOT_PERSISTED' : missingCause,
  };
  writeJson('_phase4865_underland_price_trace.json', result);
  return result;
}

export async function traceLeviPrice(): Promise<Record<string, unknown>> {
  const event = await loadEvent(PHASE4865_LEVI_EVENT_ID);
  const listUrl = 'https://bootshaus-tickets.ticket.io/';
  const listPage = await fetchHtml(listUrl);
  const detailPage = await fetchHtml(PHASE4865_LEVI_TICKET_URL);
  const discovery = discoverTicketIoPriceEvidence({
    shopSlug: 'bootshaus-tickets',
    listUrl,
    listHtml: listPage.body,
    eventUrl: PHASE4865_LEVI_TICKET_URL,
    detailHtml: detailPage.body,
  });

  let earliestCause: TicketPriceMissingCause = 'REVIEW_REQUIRED';
  if (!discovery.listAccessible && !discovery.detailAccessible) {
    earliestCause = 'PUBLIC_PRICE_NOT_AVAILABLE';
  } else if (discovery.detailAltchaBlocked && !discovery.bestHit) {
    earliestCause = 'PRICE_EXTRACTION_FAILED';
  } else if (discovery.bestHit?.priceText) {
    earliestCause = 'VALID_EVIDENCE_NOT_PERSISTED';
  } else if (!discovery.bestHit) {
    earliestCause = 'PUBLIC_PRICE_NOT_AVAILABLE';
  }

  const result = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6.5',
    productionMutationsInThisRun: 0,
    eventId: PHASE4865_LEVI_EVENT_ID,
    title: event?.title ?? 'NIGHTSWITHUS presents LEVI',
    ticketUrl: PHASE4865_LEVI_TICKET_URL,
    compositeIdentity: 'ticket_io:bootshaus-tickets.ticket.io:YvJnLSXd',
    listAccessible: discovery.listAccessible,
    detailAccessible: discovery.detailAccessible,
    detailAltchaBlocked: discovery.detailAltchaBlocked,
    discovery,
    publicTruth: discovery.bestHit
      ? {
          priceText: discovery.bestHit.priceText,
          priceAmount: discovery.bestHit.priceAmount,
          surface: discovery.bestHit.surface,
          soldOut: discovery.bestHit.soldOut,
        }
      : null,
    earliestMissingCause: discovery.bestHit ? undefined : earliestCause,
    canonical: event
      ? {
          priceText: event.priceText,
          ticketStatus: event.ticketStatus,
          ticketPhasesCount: event.ticketPhases?.length ?? 0,
          ticketUrl: event.ticketUrl,
        }
      : null,
    classification: earliestCause,
  };
  writeJson('_phase4865_levi_price_trace.json', result);
  return result;
}

function buildDisplaySlots(event: AdminEventRecord): ConsumerPricePresentationSlots {
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
  const summary = toTicketSummaryViewModel(event.ticketPhases);
  const headerPrice =
    semantics.showPrice && semantics.displayPriceText
      ? semantics.displayPriceText
      : semantics.explanatoryLabel;

  return {
    headerPrice,
    sectionStandalonePrice: canonical.priceText ?? event.priceText,
    phasePrices: ticketTypes.map((t) => t.priceLabel),
    subtotal: summary?.subtotalLabel,
    total: summary?.totalLabel,
    availabilityLabel:
      canonical.availability !== 'unknown'
        ? formatTicketAvailabilityLabelDe(canonical.availability)
        : undefined,
    ctaLabel: canonical.ctaLabel,
  };
}

export async function auditConsumerUi(): Promise<Record<string, unknown>> {
  const components = [
    { id: 'EventHero', file: 'src/components/event-detail/EventHero.tsx', renders: 'header ticketLabel via TicketPriceLabel' },
    { id: 'EventTicketSection', file: 'src/components/event-detail/EventTicketSection.tsx', renders: 'section.priceLabel, availability, phase cards, summary, CTA' },
    { id: 'TicketTypeCard', file: 'src/components/ticketing/TicketTypeCard.tsx', renders: 'phase priceLabel, availability badges' },
    { id: 'TicketSummary', file: 'src/components/ticketing/TicketSummary.tsx', renders: 'Zwischensumme + Gesamt rows' },
    { id: 'toEventTicketSectionViewModel', file: 'src/features/event-detail/utils/event-detail-view-model.ts', renders: 'priceLabel + summary from phases' },
    { id: 'toTicketSummaryViewModel', file: 'src/features/events/formatting/ticket-phase-consumer-bridge.ts', renders: 'subtotalLabel=totalLabel for single phase' },
  ];

  const eventAudits = [];
  for (const eventId of ACCEPTANCE_EVENT_IDS) {
    const event = await loadEvent(eventId);
    if (!event) continue;
    const slots = buildDisplaySlots(event);
    eventAudits.push(auditConsumerPricePresentation({ eventId, title: event.title, slots }));
  }

  const duplicateRootCause =
    'priceText/displayPriceText projected to header (EventHero) AND section.priceLabel (EventTicketSection) AND phase cards AND TicketSummary subtotal/total when ticketPhases exist';

  const result = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6.5',
    productionMutationsInThisRun: 0,
    components,
    duplicateRootCause,
    eventAudits,
    genericRule: TICKET_PRICE_CONTRACT_RULES,
  };
  writeJson('_phase4865_current_ui_audit.json', result);
  return result;
}

export async function buildPriceContract(): Promise<Record<string, unknown>> {
  const contract: NormalizedTicketPriceModel['evidence'] & {
    model: Omit<NormalizedTicketPriceModel, 'evidence'>;
    rules: typeof TICKET_PRICE_CONTRACT_RULES;
  } = {
    model: {
      displayPriceText: undefined,
      availability: 'unknown',
      soldOut: false,
    },
    rules: TICKET_PRICE_CONTRACT_RULES,
    source: 'phase4865-contract',
    reviewState: 'verified',
    confidence: 1,
  };

  const result = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6.5',
    productionMutationsInThisRun: 0,
    normalizedModel: {
      displayPriceText: 'string | undefined',
      minimumPrice: 'number | undefined',
      maximumPrice: 'number | undefined',
      currency: 'ISO-4217',
      availability: 'available | sold_out | unknown | external_link',
      soldOut: 'boolean',
      ticketPhases: 'CanonicalTicketPhase[]',
      admissionProducts: 'admission-only normalized products',
      checkoutUrl: 'provider checkout when distinct from CTA',
      consumerCtaUrl: 'public ticket destination',
      provider: 'Ticket.io | Ticket Kings | …',
      evidence: {
        source: 'connector surface + freshness',
        confidence: '0-1',
        reviewState: 'verified | missing | review_required | sold_out',
        missingCause: 'generic taxonomy',
      },
    },
    rules: TICKET_PRICE_CONTRACT_RULES,
    implementationBoundary: {
      dataCorrections: ['missing canonical price', 'missing phases', 'admission/add-on classification'],
      consumerOnly: ['hide redundant subtotal/total', 'hide duplicate section price', 'sanitize phase notes'],
    },
  };
  writeJson('_phase4865_ticket_price_contract.json', result);
  return result;
}

export async function auditTicketModel(): Promise<Record<string, unknown>> {
  const events = [];
  for (const eventId of ACCEPTANCE_EVENT_IDS) {
    const event = await loadEvent(eventId);
    if (!event) continue;
    const canonical = readCanonicalTicket({
      ticketUrl: event.ticketUrl,
      websiteUrl: event.websiteUrl,
      priceText: event.priceText,
      ticketStatus: event.ticketStatus,
      ticketPhases: event.ticketPhases,
    });
    const slots = buildDisplaySlots(event);
    events.push({
      eventId,
      title: event.title,
      ticketUrl: event.ticketUrl,
      publicPriceTruth: 'see trace artifacts for Underland/LEVI',
      canonical: {
        priceText: canonical.priceText,
        minimumPrice: canonical.minimumPrice,
        maximumPrice: canonical.maximumPrice,
        availability: canonical.availability,
        phases: event.ticketPhases,
      },
      consumerSlots: slots,
      uiAudit: auditConsumerPricePresentation({ eventId, title: event.title, slots }),
    });
  }
  const result = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6.5',
    productionMutationsInThisRun: 0,
    events,
  };
  return result;
}

export async function previewData(): Promise<Record<string, unknown>> {
  const underland = await traceUnderlandPrice();
  const levi = await traceLeviPrice();
  const previews = [];

  if (underland.publicPriceVerifiable && underland.publicTruth) {
    previews.push({
      eventId: PHASE4865_UNDERLAND_EVENT_ID,
      field: 'priceText',
      proposed: (underland.publicTruth as { rawPriceText?: string }).rawPriceText,
      reason: 'Persist verified Ticket Kings/Nacht-Manager admission minimum',
      requiresApproval: true,
    });
  }

  if (levi.publicTruth) {
    previews.push({
      eventId: PHASE4865_LEVI_EVENT_ID,
      field: 'priceText',
      proposed: (levi.publicTruth as { priceText?: string }).priceText,
      reason: 'Persist verified Ticket.io list/detail evidence',
      requiresApproval: true,
    });
  }

  const result = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6.5',
    productionMutationsInThisRun: 0,
    previews,
    note: 'Preview only — no apply command in this phase',
  };
  writeJson('_phase4865_data_preview.json', result);
  return result;
}

export async function previewUi(): Promise<Record<string, unknown>> {
  const uiAudit = await auditConsumerUi();
  const proposedMatrix = (uiAudit.eventAudits as Array<ReturnType<typeof auditConsumerPricePresentation>>).map(
    (audit) => ({
      eventId: audit.eventId,
      title: audit.title,
      current: audit.slots,
      proposed: audit.proposedSlots,
      duplicatesRemoved: audit.duplicateGroups.map((g) => g.surfaces),
      affectedComponents: [
        'EventTicketSection.tsx — omit section.priceLabel when phases present',
        'ticket-phase-consumer-bridge.ts — return undefined summary for single-phase external CTA',
        'TicketSummary.tsx — hide when no cart selection',
      ],
      regressionRisk: 'low — presentation only',
      rollback: 'revert view-model guards',
    }),
  );

  const result = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6.5',
    productionMutationsInThisRun: 0,
    proposedMatrix,
    acceptanceChecklist: [
      'Header keeps compact ab X €',
      'Ticket section shows one phase card per admission phase',
      'No Zwischensumme/Gesamt without cart',
      'No diagnostic surface strings in phase description',
    ],
  };
  writeJson('_phase4865_proposed_ui_matrix.json', result);
  writeJson('_phase4865_ui_preview.json', result);
  return result;
}

export async function validateCases(): Promise<Record<string, unknown>> {
  const uiAudit = await auditConsumerUi();
  const underland = await traceUnderlandPrice();
  const levi = await traceLeviPrice();

  const cases = [
    {
      key: 'underland',
      eventId: PHASE4865_UNDERLAND_EVENT_ID,
      expected: 'Ticket Kings CTA; price only if public evidence proves it; no borrowed price',
      result: underland.publicPriceVerifiable ? 'DATA_PREVIEW_REQUIRED' : 'HONEST_NO_PRICE_OK',
    },
    {
      key: 'levi',
      eventId: PHASE4865_LEVI_EVENT_ID,
      expected: 'Ticket.io CTA; verified price or honest blocker',
      result: levi.publicTruth ? 'DATA_PREVIEW_REQUIRED' : levi.classification,
    },
    {
      key: 'elektrokueche',
      eventId: PHASE4865_ELEKTROKUECHE_EVENT_ID,
      expected: 'header ab 15; one phase card; no duplicate subtotal/total',
    },
    { key: 'mdma', eventId: PHASE4865_MDMA_EVENT_ID, expected: 'header + one phase; no duplicate summary' },
    { key: 'bc173', eventId: PHASE4865_BC173_EVENT_ID, expected: 'header ab 23; one phase; no diagnostic text' },
  ];

  for (const c of cases) {
    const audit = (uiAudit.eventAudits as Array<ReturnType<typeof auditConsumerPricePresentation>>).find(
      (a) => a.eventId === c.eventId,
    );
    if (audit) {
      (c as Record<string, unknown>).duplicateCount = audit.duplicateGroups.length;
      (c as Record<string, unknown>).uiFixRequired = audit.duplicateGroups.length > 0 || audit.redundantSubtotalTotal;
    }
  }

  return { generatedAt: new Date().toISOString(), phase: '4.8.6.5', productionMutationsInThisRun: 0, cases };
}

export async function readiness(): Promise<Record<string, unknown>> {
  const underland = await traceUnderlandPrice();
  const levi = await traceLeviPrice();
  const ui = await auditConsumerUi();
  const dataPreview = await previewData();
  const uiPreview = await previewUi();

  const result = {
    generatedAt: new Date().toISOString(),
    phase: '4.8.6.5',
    productionMutationsInThisRun: 0,
    readyForBoundedRollout: false,
    blockers: [
      'Missing-price truth must be classified and optionally persisted (Preview A)',
      'Duplicate consumer price presentation must be fixed generically (Preview B)',
    ],
    underlandCause: underland.classification,
    leviCause: levi.classification,
    duplicateEvents: (ui.eventAudits as Array<{ duplicateGroups: unknown[] }>).filter(
      (a) => a.duplicateGroups.length > 0,
    ).length,
    dataPreviewCount: (dataPreview.previews as unknown[])?.length ?? 0,
    uiPreviewReady: Boolean(uiPreview.proposedMatrix),
    approvalsRequired: [
      'Preview A: explicit approval per Event with verified public admission price',
      'Preview B: generic UI contract rollout (no per-Event hacks)',
    ],
  };
  writeJson('_phase4865_readiness.json', result);
  return result;
}

export async function report(): Promise<void> {
  await traceUnderlandPrice();
  await traceLeviPrice();
  await buildPriceContract();
  await auditTicketModel();
  await auditConsumerUi();
  await previewData();
  await previewUi();
  await validateCases();
  await readiness();
  console.log(JSON.stringify({ ok: true, productionMutationsInThisRun: 0, outDir: OUT }, null, 2));
}

const command = process.argv[2] ?? 'report';

async function main(): Promise<void> {
  switch (command) {
    case 'trace-underland':
      console.log(JSON.stringify(await traceUnderlandPrice(), null, 2));
      break;
    case 'trace-levi':
      console.log(JSON.stringify(await traceLeviPrice(), null, 2));
      break;
    case 'audit-ticket-model':
      console.log(JSON.stringify(await auditTicketModel(), null, 2));
      break;
    case 'audit-consumer-ui':
      console.log(JSON.stringify(await auditConsumerUi(), null, 2));
      break;
    case 'build-price-contract':
      console.log(JSON.stringify(await buildPriceContract(), null, 2));
      break;
    case 'preview-data':
      console.log(JSON.stringify(await previewData(), null, 2));
      break;
    case 'preview-ui':
      console.log(JSON.stringify(await previewUi(), null, 2));
      break;
    case 'validate-cases':
      console.log(JSON.stringify(await validateCases(), null, 2));
      break;
    case 'readiness':
      console.log(JSON.stringify(await readiness(), null, 2));
      break;
    case 'full':
    case 'report':
      await report();
      break;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
