/**
 * Phase 4.8.6.5.5 — Restricted production apply preparation (read-only by default).
 *
 * Usage (plan only — default):
 *   ER_OPS_ENV_FILE=C:\ER\app-v2\.env npx tsx scripts/operations/_phase48655-restricted-apply.ts
 *
 * Future apply (not used in this phase):
 *   ER_OPS_ENV_FILE=... CONFIRM_PRODUCTION_MUTATION=exact:phase48655-restricted-correction \
 *     npx tsx scripts/operations/_phase48655-restricted-apply.ts --apply
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import './bootstrap-ops-supabase';

import { mapEventRowToAdminRecord, type EventRow } from '@/data/mappers/event-mapper';
import type { AdminEventRecord } from '@/data/types/records';
import { parseTicketKingsEventDetailHtml } from '@/features/aggregation/connectors/ticket-platform/adapters/ticket-kings-adapter';
import { parseTicketKingsCheckoutHtml } from '@/features/aggregation/connectors/ticket-platform/ticket-kings-public-checkout';
import { readCanonicalTicket } from '@/features/events/domain/canonical-ticket-read';
import { projectCanonicalEventFields } from '@/features/events/formatting/canonical-event-projection';
import {
  auditConsumerTicketPresentationForEvent,
  isConsumerEventTimeEnded,
  presentationToConsumerSlots,
} from '@/features/events/formatting/resolve-consumer-ticket-presentation';
import type { LineupEvidenceEntry } from '@/features/import/contracts/lineup-evidence-candidate';
import { mapLineupEvidenceToCanonical } from '@/features/import/publish/unified-website-controlled-publish';
import { loadMatchingCatalog } from '@/features/import/matching/matching-catalog';
import { resolveArtistIdsForNames } from '@/features/import/services/import-title-lineup-resolver';
import { invalidateConsumerEventCaches } from '@/features/events/formatting/consumer-cache-invalidation';
import { adminArtistRepository, eventLineupService } from '@/data/repositories/registry';
import { opsClient, updateEventRow } from './ops-supabase-rows';
import {
  computeStableManifestHash,
  createApplyWriteCounters,
  productionMutationsInThisRun as countProductionMutations,
  recordAttemptedWrite,
  recordRollbackWrite,
  recordSuccessfulWrite,
  stableHash,
  verifyApprovedManifestHash,
} from './phase48655-restricted-apply-security';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'docs/real-data');
const SOURCE_PLAN_FILE = join(OUT, '_phase48655_remaining_core_plan.json');
const RESTRICTED_PLAN_FILE = join(OUT, '_phase48655_restricted_plan.json');
const RESTRICTED_ROLLBACK_FILE = join(OUT, '_phase48655_restricted_rollback.json');
const RESTRICTED_PREVIEW_FILE = join(OUT, '_phase48655_restricted_preview.json');
const RESTRICTED_READINESS_FILE = join(OUT, '_phase48655_restricted_readiness.json');
const APPLY_RESULT_FILE = join(OUT, '_phase48655_restricted_apply_result.json');

const EXPECTED_MANIFEST_HASH = '0ed92be05955a6b88ae4a8904edc86eae56625ee3d5165aac06897d17e93009e';

const PHASE = '4.8.6.5.5';
const APPLY_ENV = 'CONFIRM_PRODUCTION_MUTATION';
const APPLY_TOKEN = 'exact:phase48655-restricted-correction';
const PARENT_MANIFEST_HASH = '70dfb9ae120d8e41ef3374e22ca007c468f51cfdc65980952e4ee05c9133f4fc';
const USER_AGENT = 'EternalRave-Phase48655Restricted/1.0 (+https://eternalrave.app; read-only)';
const CONSUMER_PREVIEW_NOW = new Date('2026-08-08T12:00:00.000Z');

const ELEKTROKUECHE_LINEUP = [
  'ASL∅',
  'ANNX',
  'BLACK ZUSHI',
  'BOUNCE MC',
  'HOTBOI2300',
  'HYPNOTIZED',
  'ICJ',
  'MAURO',
  'STIMULATE',
  'THE M∅VEMENT',
  'TOMMY LIBERA',
  'TURBO TIMOS',
  'JULEZ BRIXTON',
  'SEBI LIEMEN',
] as const;

const UNDERLAND_CLEAN_DESCRIPTION = `UNDERLAND ESSIGFABRIK – Der Start einer neuen Ära!

Bereit für den Vibe, der NRW zum Beben bringt? Rheinaudio präsentiert euch ein brandneues Kapitel in der Geschichte der härtesten Beats: UNDERLAND ESSIGFABRIK! Öffnen sich die Tore zu einer Dimension, die ihr so noch nicht erlebt habt. Das ist nicht nur ein Event, das ist der Auftakt von etwas ganz Großem! Seit 2010 stehen wir für „Quality Events", und jetzt zünden wir die nächste Stufe. Holt eure Rave-Crew zusammen, denn wir tauchen ab in das Underland der Essigfabrik!

Zwei Floors, Eine Mission: Abriss Total!

Die Essigfabrik Köln und die Elektroküche werden zu eurem persönlichen Spielplatz für Hardtechno und Uptempo. Zwei Floors, zwölf Artists – eine Mission: Euch in Ekstase zu versetzen. Erlebt die pure Energie und die rohe Kraft der Musik, die uns alle antreibt. Von den ersten Beats bis zum Morgengrauen wird hier keine Sekunde stillgestanden!

Packt eure Tanzschuhe ein, bereitet euch auf eine Nacht voller unvergesslicher Momente vor und lasst uns gemeinsam das Underland erobern. Die Essigfabrik wird zum Epizentrum der harten Sounds. Affenkäfig lädt ein – seid ihr bereit für den Abriss?`;

const ELEKTROKUECHE_CLEAN_DESCRIPTION = `Eventinfos

☀️ ELEKTROKÜCHE SOMMERFEST 2026 ☀️

Am 08.08. feiern wir gemeinsam das schönste Sommerfest des Jahres. 🔥

Freut euch auf 3 Floors, einen Open-Air-Bereich, treibenden Techno und eine Nacht voller unvergesslicher Momente. Schnappt euch eure Crew – wir sehen uns in der Elektroküche Köln. 🔊🖤

BEGINN: 17:00 UHR!

In & Outdoor · 3 Floors`;

type SlotKey = 'levi' | 'bootshaus_sommerfest' | 'underland' | 'sommerfest_elektrokueche' | 'mdma';
type FieldReadiness = 'apply_ready' | 'review_required' | 'skipped';

interface RestrictedSlot {
  eventId: string;
  allowedFields: Set<string>;
  forbiddenFields: Set<string>;
  lineupArtistNames: readonly string[];
  reviewOnly?: boolean;
}

const RESTRICTED_SLOTS: Record<SlotKey, RestrictedSlot> = {
  levi: {
    eventId: 'evt-1785339383539-0lxvjlp',
    allowedFields: new Set(['endDate']),
    forbiddenFields: new Set([
      'priceText',
      'ticketPhases',
      'ticketStatus',
      'ticketUrl',
      'websiteUrl',
      'description',
      'genreLabels',
      'startDate',
      'venueName',
    ]),
    lineupArtistNames: [],
  },
  bootshaus_sommerfest: {
    eventId: 'evt-1785339391167-tfaixrr',
    allowedFields: new Set(['genreLabels']),
    forbiddenFields: new Set([
      'description',
      'priceText',
      'ticketPhases',
      'ticketStatus',
      'ticketUrl',
      'websiteUrl',
      'startDate',
      'endDate',
      'venueName',
    ]),
    lineupArtistNames: [],
  },
  underland: {
    eventId: 'evt-1785389049895-4mb7dub',
    allowedFields: new Set(['startDate', 'endDate', 'description', 'genreLabels']),
    forbiddenFields: new Set([
      'priceText',
      'ticketPhases',
      'ticketStatus',
      'ticketUrl',
      'websiteUrl',
      'venueName',
      'venueEnvironment',
    ]),
    lineupArtistNames: [],
  },
  sommerfest_elektrokueche: {
    eventId: 'evt-1785389055557-ux20897',
    allowedFields: new Set(['venueName', 'description', 'genreLabels', 'venueEnvironment']),
    forbiddenFields: new Set([
      'ticketUrl',
      'ticketStatus',
      'websiteUrl',
      'startDate',
      'endDate',
    ]),
    lineupArtistNames: ELEKTROKUECHE_LINEUP,
  },
  mdma: {
    eventId: 'evt-1785443911160-owt97y3',
    allowedFields: new Set<string>(),
    forbiddenFields: new Set(['all']),
    lineupArtistNames: [],
    reviewOnly: true,
  },
};

const APPLY_SLOT_ORDER: SlotKey[] = [
  'levi',
  'bootshaus_sommerfest',
  'underland',
  'sommerfest_elektrokueche',
];

let applyWriteCounters = createApplyWriteCounters();

function resetApplyCounters(): void {
  applyWriteCounters = createApplyWriteCounters();
}

function writeJson(path: string, data: unknown): void {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2));
}

function rowFingerprint(event: AdminEventRecord): string {
  return stableHash({
    id: event.id,
    title: event.title,
    startDate: event.startDate,
    endDate: event.endDate,
    venueName: event.venueName,
    venueAddress: event.venueAddress,
    priceText: event.priceText,
    ticketUrl: event.ticketUrl,
    ticketStatus: event.ticketStatus,
    ticketPhases: event.ticketPhases,
    description: event.description,
    genreLabels: event.genreLabels,
    ageRestriction: event.ageRestriction,
    venueEnvironment: event.venueEnvironment,
    websiteUrl: event.websiteUrl,
  });
}

async function loadEvent(eventId: string, attempt = 0): Promise<AdminEventRecord | null> {
  const { data, error } = await opsClient().from('events').select('*').eq('id', eventId).maybeSingle();
  if (error) {
    if (/JWT issued at future/i.test(error.message) && attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
      return loadEvent(eventId, attempt + 1);
    }
    throw new Error(`events read failed for ${eventId}: ${error.message}`);
  }
  return data ? mapEventRowToAdminRecord(data as EventRow) : null;
}

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
    redirect: 'follow',
  });
  return {
    ok: response.ok,
    status: response.status,
    html: await response.text(),
    finalUrl: response.url,
  };
}

function buildLineupEntries(names: readonly string[]): LineupEvidenceEntry[] {
  return names.map((displayName, sortOrder) => ({
    sortOrder,
    displayName,
    rawSourceSpelling: displayName,
    normalizedName: displayName,
    billingRelation: 'SOLO' as const,
    isB2b: false,
    isF2f: false,
    isLiveSet: false,
    confidence: 0.9,
    reviewState: 'manual_review_verified' as const,
    inclusionReason: 'Phase 4.8.6.5.5 restricted manual lineup verification',
  }));
}

function buildConsumerSnapshot(
  event: AdminEventRecord,
  patch: Record<string, unknown>,
  lineupArtists: string[] = [],
  now = CONSUMER_PREVIEW_NOW,
) {
  const mergedEndDate = (patch.endDate as string | undefined) ?? event.endDate;
  const canonicalRead = readCanonicalTicket({
    ticketUrl: event.ticketUrl,
    websiteUrl: event.websiteUrl,
    priceText: (patch.priceText as string | undefined) ?? event.priceText,
    ticketStatus: event.ticketStatus,
    ticketPhases: (patch.ticketPhases as AdminEventRecord['ticketPhases']) ?? event.ticketPhases,
  });
  const projection = projectCanonicalEventFields({
    title: event.title,
    description: (patch.description as string | undefined) ?? event.description ?? '',
    venue: (patch.venueName as string | undefined) ?? event.venueName ?? '',
    city: event.venueCity ?? '',
    artists: lineupArtists,
    lineup: lineupArtists,
    priceText: (patch.priceText as string | undefined) ?? event.priceText,
    source: 'phase48655-restricted-plan',
    ticketUrl: canonicalRead.publicCtaUrl ?? event.ticketUrl,
    ticketDestinationClass: canonicalRead.destinationClass,
    ticketStatus: event.ticketStatus,
    ticketPhases: (patch.ticketPhases as AdminEventRecord['ticketPhases']) ?? event.ticketPhases,
    timezone: event.timezone,
    genres: (patch.genreLabels as string[] | undefined) ?? event.genreLabels,
  });
  const { presentation } = auditConsumerTicketPresentationForEvent(
    {
      id: event.id,
      title: event.title,
      priceText: (patch.priceText as string | undefined) ?? event.priceText,
      ticketUrl: canonicalRead.publicCtaUrl ?? event.ticketUrl,
      officialEventUrl: event.websiteUrl,
      ticketPhases: (patch.ticketPhases as AdminEventRecord['ticketPhases']) ?? event.ticketPhases,
      timezone: event.timezone,
      endDateTime: mergedEndDate,
      ticketAvailability: event.ticketStatus,
    },
    { mode: 'external', now },
  );
  return {
    canonicalProjection: projection,
    consumerPresentation: presentationToConsumerSlots(presentation),
    publicCtaUrl: canonicalRead.publicCtaUrl,
    checkoutEvidenceUrl: canonicalRead.checkoutEvidenceUrl,
    ended: isConsumerEventTimeEnded({ endDateTime: mergedEndDate }, now),
    availabilityLabel: presentation.availabilityLabel,
    ctaLabel: presentation.cta,
    ticketTypes: presentation.ticketTypes.map((ticket) => ({
      name: ticket.name,
      priceLabel: ticket.priceLabel,
      availabilityLabel: ticket.availabilityLabel,
    })),
  };
}

function buildRestrictedPatch(
  proposedPatch: Record<string, unknown>,
  slot: RestrictedSlot,
): Record<string, unknown> {
  const restricted: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(proposedPatch)) {
    if (slot.forbiddenFields.has(field) || slot.forbiddenFields.has('all')) continue;
    if (!slot.allowedFields.has(field)) continue;
    restricted[field] = value;
  }
  return restricted;
}

interface FieldPlanEntry {
  field: string;
  fieldGroup: string;
  before: unknown;
  proposed: unknown;
  readiness: FieldReadiness;
  sourceUrl: string;
  evidenceOrigin: string;
  rawEvidence: unknown;
  verifiedAt: string;
  reason: string;
}

function fieldEntry(
  field: string,
  fieldGroup: string,
  before: unknown,
  proposed: unknown,
  readiness: FieldReadiness,
  sourceUrl: string,
  evidenceOrigin: string,
  rawEvidence: unknown,
  verifiedAt: string,
  reason: string,
): FieldPlanEntry | null {
  if (JSON.stringify(before) === JSON.stringify(proposed)) return null;
  return {
    field,
    fieldGroup,
    before,
    proposed,
    readiness,
    sourceUrl,
    evidenceOrigin,
    rawEvidence,
    verifiedAt,
    reason,
  };
}

async function evaluateElektrokuechePriceDecision(observedAt: string) {
  const ticketUrl = 'https://ticketkings.de/event/sommerfest-elektrokueche-20-06-2026/';
  const checkoutUrl = 'https://nacht-manager.de/ticketing/native_event.php?id=41';
  const [ticketFetch, checkoutFetch] = await Promise.all([fetchHtml(ticketUrl), fetchHtml(checkoutUrl)]);
  const ticketParsed = ticketFetch.ok
    ? parseTicketKingsEventDetailHtml(ticketFetch.html, ticketFetch.finalUrl)
    : undefined;
  const checkoutParsed = checkoutFetch.ok ? parseTicketKingsCheckoutHtml(checkoutFetch.html) : undefined;
  const admission = checkoutParsed?.products?.find((p) => p.classification === 'admission_ticket');
  const doorRelease = checkoutParsed?.releases?.find((r) => /door sale/i.test(r.name ?? ''));
  const flexAddon = checkoutParsed?.excludedProducts?.find((p) => p.classification === 'insurance_or_flex');

  const doorPriceAmount = doorRelease?.priceAmount ?? admission?.priceAmount;
  const doorPriceText = doorRelease?.priceText ?? checkoutParsed?.priceText;
  const isMandatoryAdmission =
    admission?.optionalState === 'required' && admission?.classification === 'admission_ticket';
  const is1750Confirmed = doorPriceAmount === 17.5 || doorPriceText === 'ab 17,50 €' || doorPriceText === '17,50 €';

  return {
    ticketUrl,
    checkoutUrl,
    ticketParsed: ticketParsed
      ? { title: ticketParsed.title, priceText: ticketParsed.priceText, startDate: ticketParsed.startDate }
      : undefined,
    checkoutParsed: checkoutParsed
      ? {
          priceText: checkoutParsed.priceText,
          priceAmount: checkoutParsed.priceAmount,
          releases: checkoutParsed.releases,
          admissionProduct: admission,
          doorRelease,
          flexAddon,
          reviewRequired: checkoutParsed.reviewRequired,
          availability: checkoutParsed.availability,
        }
      : undefined,
    decision: {
      planPriceFields: false,
      readiness: 'review_required' as FieldReadiness,
      reason: is1750Confirmed
        ? 'live_door_sale_17_50_confirmed'
        : doorPriceAmount === 20
          ? 'live_door_sale_is_20_eur_not_17_50_exclude_from_restricted_plan'
          : 'live_admission_price_not_unambiguous',
      mandatoryAdmissionConfirmed: isMandatoryAdmission,
      doorPriceAmount,
      doorPriceText,
      flexAddonExcluded: Boolean(flexAddon),
      target17_50Confirmed: is1750Confirmed,
    },
    verifiedAt: observedAt,
  };
}

function buildManualPatches(
  observedAt: string,
  priceDecision: Awaited<ReturnType<typeof evaluateElektrokuechePriceDecision>>,
): Record<SlotKey, Record<string, unknown>> {
  const bootshausGenres = [
    'Electro',
    'EDM',
    'Deep House',
    'Tech House',
    'Techno',
    'DnB',
    'Trap',
    'Dubstep',
  ];

  const patches: Record<SlotKey, Record<string, unknown>> = {
    levi: { endDate: '2026-08-08T03:00:00.000Z' },
    bootshaus_sommerfest: { genreLabels: bootshausGenres },
    underland: {
      startDate: '2026-09-05T20:00:00.000Z',
      endDate: '2026-09-06T05:00:00.000Z',
      description: UNDERLAND_CLEAN_DESCRIPTION,
      genreLabels: ['Hardtechno', 'Uptempo'],
    },
    sommerfest_elektrokueche: {
      venueName: 'Essigfabrik / Elektroküche',
      description: ELEKTROKUECHE_CLEAN_DESCRIPTION,
      genreLabels: ['Techno', 'Bounce', 'Hardtechno'],
      venueEnvironment: 'hybrid',
    },
    mdma: {},
  };

  if (priceDecision.decision.planPriceFields) {
    patches.sommerfest_elektrokueche.priceText = priceDecision.decision.doorPriceText;
    patches.sommerfest_elektrokueche.ticketPhases = [
      {
        id: 'elektrokueche-door-sale-admission',
        kind: 'admission',
        name: 'Standard Ticket — DOOR SALE',
        soldOut: false,
        available: true,
        sortOrder: 0,
        priceLabel: priceDecision.decision.doorPriceText,
        priceAmount: priceDecision.decision.doorPriceAmount,
        priceCurrency: 'EUR',
      },
    ];
  }

  return patches;
}

function buildFieldPlansForSlot(
  key: SlotKey,
  event: AdminEventRecord,
  manualPatch: Record<string, unknown>,
  restrictedPatch: Record<string, unknown>,
  observedAt: string,
  priceDecision?: Awaited<ReturnType<typeof evaluateElektrokuechePriceDecision>>,
): FieldPlanEntry[] {
  const plans: FieldPlanEntry[] = [];

  if (key === 'levi') {
    plans.push(
      fieldEntry(
        'endDate',
        'schedule',
        event.endDate ?? null,
        manualPatch.endDate,
        'apply_ready',
        'https://bootshaus.tv/events/nightswithus-presents-levi/',
        'official_bootshaus_schedule',
        { endLocal: '2026-08-08T05:00:00+02:00', timezone: 'Europe/Berlin' },
        observedAt,
        'verified_official_schedule_end_only',
      )!,
    );
  }

  if (key === 'bootshaus_sommerfest') {
    plans.push(
      fieldEntry(
        'genreLabels',
        'genres',
        event.genreLabels,
        manualPatch.genreLabels,
        'apply_ready',
        'https://bootshaus.tv/events/bootshaus-sommerfest/',
        'official_floor_genre_mapping',
        { explicitGenres: manualPatch.genreLabels },
        observedAt,
        'explicit_floor_genre_mapping_no_description_change',
      )!,
    );
  }

  if (key === 'underland') {
    const officialUrl = 'https://affenkaefig.info/event/underland-essigfabrik-05-09-2026/';
    const ticketUrl = 'https://ticketkings.de/event/underland-essigfabrik-05-09-2026/';
    plans.push(
      fieldEntry(
        'startDate',
        'schedule',
        event.startDate,
        manualPatch.startDate,
        'apply_ready',
        officialUrl,
        'official_ticket_kings_schedule_alignment',
        { ticketKingsStart: '2026-09-05T22:00:00+02:00' },
        observedAt,
        'correct_local_calendar_day',
      )!,
      fieldEntry(
        'endDate',
        'schedule',
        event.endDate,
        manualPatch.endDate,
        'apply_ready',
        officialUrl,
        'official_ticket_kings_schedule_alignment',
        { ticketKingsEnd: '2026-09-06T07:00:00+02:00' },
        observedAt,
        'official_end_time',
      )!,
      fieldEntry(
        'description',
        'content',
        event.description ?? '',
        manualPatch.description,
        'apply_ready',
        ticketUrl,
        'manual_review_ticket_kings_body_cleaned',
        { removedSections: ['lineup_block', 'ticket_cta', 'checkout_embed'] },
        observedAt,
        'cleaned_official_event_body',
      )!,
      fieldEntry(
        'genreLabels',
        'genres',
        event.genreLabels,
        manualPatch.genreLabels,
        'apply_ready',
        ticketUrl,
        'public_ticket_kings_body',
        { evidencedGenres: ['Hardtechno', 'Uptempo'] },
        observedAt,
        'publicly_belegte_genres',
      )!,
    );
  }

  if (key === 'sommerfest_elektrokueche') {
    const officialUrl = 'https://affenkaefig.info/event/sommerfest-elektrokueche-08-08-2026/';
    const ticketUrl = 'https://ticketkings.de/event/sommerfest-elektrokueche-20-06-2026/';
    plans.push(
      fieldEntry(
        'venueName',
        'venue',
        event.venueName,
        manualPatch.venueName,
        'apply_ready',
        officialUrl,
        'official_json_ld_venue',
        { venueLabel: 'Essigfabrik / Elektroküche' },
        observedAt,
        'official_venue_label',
      )!,
      fieldEntry(
        'description',
        'content',
        event.description ?? '',
        manualPatch.description,
        'apply_ready',
        ticketUrl,
        'manual_review_ticket_kings_body_cleaned',
        { removedSections: ['lineup_block', 'location_block', 'genre_list', 'checkout_embed'] },
        observedAt,
        'full_official_body_without_structured_lineup',
      )!,
      fieldEntry(
        'genreLabels',
        'genres',
        event.genreLabels,
        manualPatch.genreLabels,
        'apply_ready',
        ticketUrl,
        'ticket_kings_structured_genres',
        { genres: manualPatch.genreLabels },
        observedAt,
        'retain_verified_genres',
      )!,
      fieldEntry(
        'venueEnvironment',
        'venue',
        event.venueEnvironment,
        manualPatch.venueEnvironment,
        'apply_ready',
        ticketUrl,
        'ticket_kings_body_indoor_outdoor',
        { hybrid: true, floors: 3 },
        observedAt,
        'official_indoor_outdoor_hybrid',
      )!,
    );

    if (priceDecision) {
      const proposedPriceText = priceDecision.decision.doorPriceText ?? event.priceText;
      const proposedPhases = [
        {
          id: 'elektrokueche-door-sale-admission-live',
          kind: 'admission',
          name: 'Standard Ticket — DOOR SALE',
          soldOut: false,
          available: true,
          sortOrder: 0,
          priceLabel: proposedPriceText,
          priceAmount: priceDecision.decision.doorPriceAmount,
          priceCurrency: 'EUR',
        },
      ];
      const priceReadiness: FieldReadiness = priceDecision.decision.planPriceFields
        ? 'apply_ready'
        : 'review_required';
      const pricePlan = fieldEntry(
        'priceText',
        'ticket_price_phases',
        event.priceText,
        proposedPriceText,
        priceReadiness,
        priceDecision.checkoutUrl,
        'live_nachtmanager_checkout',
        priceDecision.checkoutParsed,
        priceDecision.verifiedAt,
        priceDecision.decision.reason,
      );
      const phasesPlan = fieldEntry(
        'ticketPhases',
        'ticket_price_phases',
        event.ticketPhases,
        proposedPhases,
        priceReadiness,
        priceDecision.checkoutUrl,
        'live_nachtmanager_checkout',
        priceDecision.checkoutParsed,
        priceDecision.verifiedAt,
        priceDecision.decision.reason,
      );
      if (pricePlan) plans.push(pricePlan);
      if (phasesPlan) plans.push(phasesPlan);
    }
  }

  return plans.filter((entry): entry is FieldPlanEntry => entry != null);
}

async function buildRestrictedManifest(
  sourcePlan: Record<string, unknown>,
  observedAt: string,
): Promise<Record<string, unknown>> {
  const priceDecision = await evaluateElektrokuechePriceDecision(observedAt);
  const manualPatches = buildManualPatches(observedAt, priceDecision);
  const sourceEvents = Array.isArray(sourcePlan.events) ? sourcePlan.events : [];
  const events: Record<string, unknown>[] = [];

  for (const key of Object.keys(RESTRICTED_SLOTS) as SlotKey[]) {
    const slot = RESTRICTED_SLOTS[key];
    const source = sourceEvents.find((entry) => (entry as { key?: string }).key === key) as
      | Record<string, unknown>
      | undefined;

    if (key === 'mdma') {
      const mdmaSource = sourceEvents.find((entry) => (entry as { key?: string }).key === 'mdma');
      events.push({
        key,
        eventId: null,
        duplicateKeepEventId: 'evt-1785443911160-owt97y3',
        duplicateCandidateEventId: 'evt-1785389052337-0gv1iz1',
        reviewOnly: true,
        applyReady: false,
        restrictedPatch: {},
        fieldPlans: [],
        fieldGroups: {
          duplicate_resolution: { readiness: 'review_required', reason: 'separate_duplicate_resolution_package' },
        },
        duplicateResolutionProposal: mdmaSource?.duplicateResolutionProposal,
        blockedReasons: ['duplicate_canonical_collision', 'no_merge_delete_unpublish_in_restricted_plan'],
        sourceManifestHash: sourcePlan.manifestHash,
        parentManifestHash: PARENT_MANIFEST_HASH,
      });
      continue;
    }

    const event = await loadEvent(slot.eventId);
    if (!event) throw new Error(`Missing live event ${slot.eventId} for ${key}`);

    const manualPatch = manualPatches[key];
    const restrictedPatch = buildRestrictedPatch(manualPatch, slot);
    const fieldPlans = buildFieldPlansForSlot(key, event, manualPatch, restrictedPatch, observedAt, priceDecision);
    const applyReadyFields = fieldPlans.filter((f) => f.readiness === 'apply_ready');
    const reviewFields = fieldPlans.filter((f) => f.readiness === 'review_required');
    const contentApplyReady = fieldPlans.some(
      (f) => f.readiness === 'apply_ready' && f.fieldGroup !== 'ticket_price_phases',
    );

    const lineupApply =
      slot.lineupArtistNames.length > 0
        ? {
            table: 'event_structured_lineup',
            entries: buildLineupEntries(slot.lineupArtistNames),
            reason: 'manual_verified_lineup_restricted_apply',
          }
        : undefined;

    const consumerBefore = buildConsumerSnapshot(event, {});
    const consumerAfter = buildConsumerSnapshot(
      event,
      restrictedPatch,
      slot.lineupArtistNames.length > 0 ? [...slot.lineupArtistNames] : [],
    );

    const fieldGroups: Record<string, { readiness: FieldReadiness; fields: string[]; reason: string }> = {};
    for (const group of new Set(fieldPlans.map((f) => f.fieldGroup))) {
      const groupFields = fieldPlans.filter((f) => f.fieldGroup === group);
      const readiness: FieldReadiness = groupFields.some((f) => f.readiness === 'review_required')
        ? 'review_required'
        : groupFields.every((f) => f.readiness === 'apply_ready')
          ? 'apply_ready'
          : 'skipped';
      fieldGroups[group] = {
        readiness,
        fields: groupFields.map((f) => f.field),
        reason: groupFields.map((f) => f.reason).join('; '),
      };
    }

    if (key === 'sommerfest_elektrokueche' && priceDecision) {
      fieldGroups.ticket_price_phases = {
        readiness: priceDecision.decision.planPriceFields ? 'apply_ready' : 'review_required',
        fields: ['priceText', 'ticketPhases'],
        reason: priceDecision.decision.reason,
      };
    }

    events.push({
      key,
      eventId: slot.eventId,
      sourceManifestHash: sourcePlan.manifestHash,
      parentManifestHash: PARENT_MANIFEST_HASH,
      liveRowFingerprint: rowFingerprint(event),
      rowFingerprintAtPlanTime: rowFingerprint(event),
      restrictedPatch,
      lineupArtistNames: slot.lineupArtistNames,
      lineupApply,
      fieldPlans,
      fieldGroups,
      applyReady: contentApplyReady,
      reviewOnly: !contentApplyReady || reviewFields.length > 0,
      applyReadyFieldCount: applyReadyFields.length,
      reviewRequiredFieldCount: reviewFields.length,
      intentionallyOmitted: [...slot.forbiddenFields],
      identityGate: source?.gate,
      sourceEvidence: {
        ...(source?.sourceEvidence as Record<string, unknown> | undefined),
        restrictedScopeNote: 'ticket_and_schedule_fields_excluded_per_phase48655_restricted_plan',
        elektrokuechePriceDecision: key === 'sommerfest_elektrokueche' ? priceDecision : undefined,
      },
      consumer: { before: consumerBefore, after: consumerAfter },
      rollbackSnapshot: {
        endDate: event.endDate,
        startDate: event.startDate,
        genreLabels: event.genreLabels,
        description: event.description,
        venueName: event.venueName,
        venueEnvironment: event.venueEnvironment,
        priceText: event.priceText,
        ticketPhases: event.ticketPhases,
      },
      writePayload: {
        table: 'events',
        rowId: event.id,
        rowFingerprint: rowFingerprint(event),
        patch: restrictedPatch,
        lineupApply,
        provenanceNote: 'apply_requires_restricted_manifest_hash_and_live_fingerprint_match',
      },
    });
  }

  const body = {
    generatedAt: observedAt,
    phase: PHASE,
    productionMutationsInThisRun: 0,
    parentManifestHash: PARENT_MANIFEST_HASH,
    sourceManifestHash: sourcePlan.manifestHash,
    committedCodeSha: execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf8' }).trim(),
    consumerPreviewNow: CONSUMER_PREVIEW_NOW.toISOString(),
    applyRefusalDefault: true,
    applyToken: APPLY_TOKEN,
    events,
  };

  return { ...body, restrictedManifestHash: computeStableManifestHash(body) };
}

function assertApplyAuthorized(applyRequested: boolean): void {
  if (!applyRequested) return;
  if (process.env[APPLY_ENV] !== APPLY_TOKEN) {
    throw new Error(`${APPLY_ENV} must equal ${APPLY_TOKEN}`);
  }
}

function assertManifestHashApproved(plan: Record<string, unknown>): {
  ok: boolean;
  computedHash: string;
  expectedHash: string;
} {
  const verification = verifyApprovedManifestHash(plan, EXPECTED_MANIFEST_HASH);
  if (!verification.ok) {
    throw new Error(
      `manifest_hash_mismatch:expected=${verification.expectedHash}:computed=${verification.computedHash}`,
    );
  }
  return verification;
}

function patchToDbColumns(patch: Record<string, unknown>): Partial<EventRow> {
  const db: Record<string, unknown> = {};
  if (patch.startDate !== undefined) db.start_date = patch.startDate;
  if (patch.endDate !== undefined) db.end_date = patch.endDate;
  if (patch.ticketUrl !== undefined) db.ticket_url = patch.ticketUrl;
  if (patch.websiteUrl !== undefined) db.website_url = patch.websiteUrl;
  if (patch.description !== undefined) db.description = patch.description;
  if (patch.genreLabels !== undefined) db.genre_labels = patch.genreLabels;
  if (patch.priceText !== undefined) db.price_text = patch.priceText;
  if (patch.ticketStatus !== undefined) db.ticket_status = patch.ticketStatus;
  if (patch.ticketPhases !== undefined) db.ticket_phases = patch.ticketPhases;
  if (patch.venueName !== undefined) db.venue_name = patch.venueName;
  if (patch.venueEnvironment !== undefined) db.venue_environment = patch.venueEnvironment;
  return db as Partial<EventRow>;
}

function datesEquivalent(expected: unknown, actual: unknown): boolean {
  if (expected == null && (actual == null || actual === undefined)) return true;
  if (!expected || !actual) return false;
  const expectedMs = new Date(String(expected)).getTime();
  const actualMs = new Date(String(actual)).getTime();
  return !Number.isNaN(expectedMs) && !Number.isNaN(actualMs) && expectedMs === actualMs;
}

function valuesEquivalent(field: string, expected: unknown, actual: unknown): boolean {
  if (JSON.stringify(expected) === JSON.stringify(actual)) return true;
  if (field === 'startDate' || field === 'endDate') {
    return datesEquivalent(expected, actual);
  }
  if (field === 'ticketPhases') {
    const norm = (phases: unknown) =>
      Array.isArray(phases)
        ? phases.map((phase) => {
            const p = phase as Record<string, unknown>;
            return {
              name: p.name,
              priceAmount: p.priceAmount,
              priceCurrency: p.priceCurrency,
              priceLabel: p.priceLabel,
              kind: p.kind,
              sortOrder: p.sortOrder,
              soldOut: p.soldOut,
            };
          })
        : [];
    return JSON.stringify(norm(expected)) === JSON.stringify(norm(actual));
  }
  if (field === 'description') {
    return String(expected ?? '').trim() === String(actual ?? '').trim();
  }
  if (field === 'genreLabels') {
    return JSON.stringify(expected ?? []) === JSON.stringify(actual ?? []);
  }
  return false;
}

async function loadLineupSnapshot(eventId: string) {
  const structured = await eventLineupService.getStructuredLineupForEvent(eventId);
  const artistIds = await eventLineupService.getLineupArtistIds(eventId);
  return { structured, artistIds };
}

async function applyLineup(eventId: string, entries: LineupEvidenceEntry[]): Promise<boolean> {
  if (entries.length === 0) return false;
  const catalog = await loadMatchingCatalog();
  const allArtists = await adminArtistRepository.getAll();
  const canonical = mapLineupEvidenceToCanonical(entries);
  const resolved = [];
  for (const entry of canonical) {
    const resolvedArtists = await resolveArtistIdsForNames({
      names: entry.artists,
      record: {
        id: `phase48655-${eventId}`,
        importJobId: 'phase48655',
        sourceId: 'phase48655-restricted-apply',
        externalId: eventId,
        sourceType: 'website',
        retrievedAt: new Date().toISOString(),
        rawPayload: {},
      },
      catalog,
      allArtists,
      saveArtist: (artist) => adminArtistRepository.save(artist),
      createUnverifiedForUnmatched: true,
    });
    if (resolvedArtists.artistIds.length > 0) {
      resolved.push({ ...entry, artistIds: resolvedArtists.artistIds });
    }
  }
  if (resolved.length === 0) return false;
  await eventLineupService.replaceStructuredLineupFromImport(eventId, resolved, { forceReplace: true });
  return true;
}

async function rollbackEvent(
  snapshot: {
    event: Partial<EventRow>;
    lineup: Awaited<ReturnType<typeof loadLineupSnapshot>>;
  },
  eventId: string,
  lineupApplied: boolean,
): Promise<void> {
  if (Object.keys(snapshot.event).length > 0) {
    await updateEventRow(eventId, snapshot.event);
  }
  if (lineupApplied) {
    if (snapshot.lineup.structured.length > 0 || snapshot.lineup.artistIds.length > 0) {
      await eventLineupService.replaceStructuredLineupFromImport(eventId, snapshot.lineup.structured, {
        forceReplace: true,
      });
    } else {
      await eventLineupService.replaceStructuredLineupFromImport(eventId, [], { forceReplace: true });
    }
  }
}

function assertPatchAllowed(key: SlotKey, patch: Record<string, unknown>): void {
  const slot = RESTRICTED_SLOTS[key];
  for (const field of Object.keys(patch)) {
    if (slot.forbiddenFields.has(field) || slot.forbiddenFields.has('all')) {
      throw new Error(`forbidden_field_in_patch:${key}:${field}`);
    }
    if (!slot.allowedFields.has(field)) {
      throw new Error(`field_not_in_allowlist:${key}:${field}`);
    }
  }
}

async function revalidateSourcesReadOnly(key: SlotKey): Promise<Record<string, unknown>> {
  const urls: Record<string, string> = {
    levi: 'https://bootshaus.tv/events/nightswithus-presents-levi/',
    bootshaus_sommerfest: 'https://bootshaus.tv/events/bootshaus-sommerfest/',
    underland: 'https://ticketkings.de/event/underland-essigfabrik-05-09-2026/',
    sommerfest_elektrokueche: 'https://ticketkings.de/event/sommerfest-elektrokueche-20-06-2026/',
  };
  const url = urls[key];
  if (!url) return { skipped: true };
  const fetch = await fetchHtml(url);
  return { url, ok: fetch.ok, status: fetch.status, finalUrl: fetch.finalUrl };
}

function verifyExpectedPatches(plan: Record<string, unknown>): boolean {
  const events = Array.isArray(plan.events) ? plan.events : [];
  const byKey = Object.fromEntries(events.map((e) => [(e as { key: string }).key, e]));
  const levi = (byKey.levi as { restrictedPatch?: Record<string, unknown> })?.restrictedPatch;
  const boot = (byKey.bootshaus_sommerfest as { restrictedPatch?: Record<string, unknown> })?.restrictedPatch;
  const under = (byKey.underland as { restrictedPatch?: Record<string, unknown> })?.restrictedPatch;
  const elek = (byKey.sommerfest_elektrokueche as { restrictedPatch?: Record<string, unknown> })?.restrictedPatch;
  const elekLineup = (byKey.sommerfest_elektrokueche as { lineupArtistNames?: string[] })?.lineupArtistNames ?? [];

  return (
    levi?.endDate === '2026-08-08T03:00:00.000Z' &&
    JSON.stringify(boot?.genreLabels) ===
      JSON.stringify([
        'Electro',
        'EDM',
        'Deep House',
        'Tech House',
        'Techno',
        'DnB',
        'Trap',
        'Dubstep',
      ]) &&
    under?.startDate === '2026-09-05T20:00:00.000Z' &&
    under?.endDate === '2026-09-06T05:00:00.000Z' &&
    under?.description === UNDERLAND_CLEAN_DESCRIPTION &&
    JSON.stringify(under?.genreLabels) === JSON.stringify(['Hardtechno', 'Uptempo']) &&
    elek?.venueName === 'Essigfabrik / Elektroküche' &&
    elek?.description === ELEKTROKUECHE_CLEAN_DESCRIPTION &&
    JSON.stringify(elekLineup) === JSON.stringify([...ELEKTROKUECHE_LINEUP]) &&
    !elek?.priceText &&
    !elek?.ticketPhases
  );
}

async function runPreflightChecks(plan: Record<string, unknown>): Promise<Record<string, unknown>> {
  execSync('npm run typecheck:operations', { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
  try {
    execSync('git diff --check', { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
  } catch {
    throw new Error('git_diff_check_failed');
  }

  const hashReport = assertManifestHashApproved(plan);

  const preflight: Record<string, unknown> = { hashReport, sources: {}, events: {} };
  const planEvents = Array.isArray(plan.events) ? plan.events : [];

  for (const key of APPLY_SLOT_ORDER) {
    const planEntry = planEvents.find((entry) => (entry as { key?: string }).key === key) as
      | Record<string, unknown>
      | undefined;
    if (!planEntry?.eventId) continue;

    const eventId = planEntry.eventId as string;
    const event = await loadEvent(eventId);
    if (!event) {
      preflight.events = {
        ...(preflight.events as Record<string, unknown>),
        [key]: { ok: false, reason: 'event_not_found' },
      };
      continue;
    }

    const liveFingerprint = rowFingerprint(event);
    const plannedFingerprint = planEntry.rowFingerprintAtPlanTime as string;
    const fingerprintDrift = plannedFingerprint !== liveFingerprint;
    const sources = await revalidateSourcesReadOnly(key);

    preflight.sources = { ...(preflight.sources as Record<string, unknown>), [key]: sources };
    preflight.events = {
      ...(preflight.events as Record<string, unknown>),
      [key]: {
        eventId,
        liveFingerprint,
        plannedFingerprint,
        fingerprintDrift,
        ok: !fingerprintDrift,
        reason: fingerprintDrift ? 'fingerprint_drift' : 'ok',
        contaminationCheck: {
          ticketUrl: event.ticketUrl,
          priceText: event.priceText,
          ticketPhasesCount: event.ticketPhases?.length ?? 0,
        },
      },
    };
  }

  return preflight;
}

async function executeRestrictedApply(
  plan: Record<string, unknown>,
  preflight: Record<string, unknown>,
  onlyKeys?: SlotKey[],
  isRetryPass = false,
): Promise<void> {
  const slotOrder = onlyKeys ?? APPLY_SLOT_ORDER;
  const planEvents = Array.isArray(plan.events) ? plan.events : [];
  const appliedEvents: Array<Record<string, unknown>> = [];
  const skippedEvents: Array<Record<string, unknown>> = [];
  const rolledBackEvents: Array<Record<string, unknown>> = [];

  for (const key of slotOrder) {
    const planEntry = planEvents.find((entry) => (entry as { key?: string }).key === key) as
      | Record<string, unknown>
      | undefined;
    if (!planEntry?.eventId) {
      skippedEvents.push({ key, reason: 'missing_plan_entry' });
      continue;
    }

    const slot = RESTRICTED_SLOTS[key];
    const eventId = planEntry.eventId as string;
    const eventPreflight = (preflight.events as Record<string, Record<string, unknown>>)[key];
    if (!eventPreflight?.ok && !onlyKeys) {
      skippedEvents.push({ key, eventId, reason: eventPreflight?.reason ?? 'preflight_failed' });
      continue;
    }

    const restrictedPatch = planEntry.restrictedPatch as Record<string, unknown>;
    assertPatchAllowed(key, restrictedPatch);

    const beforeEvent = await loadEvent(eventId);
    if (!beforeEvent) {
      skippedEvents.push({ key, eventId, reason: 'event_missing_before_apply' });
      continue;
    }

    const rollbackSnapshot = {
      event: patchToDbColumns(
        Object.fromEntries(
          Object.keys(restrictedPatch).map((field) => [field, (beforeEvent as Record<string, unknown>)[field]]),
        ),
      ),
      lineup: await loadLineupSnapshot(eventId),
    };

    const mutations: Array<Record<string, unknown>> = [];
    let lineupApplied = false;

    try {
      recordAttemptedWrite(applyWriteCounters, isRetryPass || Boolean(onlyKeys));

      const dbPatch = patchToDbColumns(restrictedPatch);
      if (Object.keys(dbPatch).length > 0) {
        for (const [column, newValue] of Object.entries(dbPatch)) {
          const field =
            column === 'start_date'
              ? 'startDate'
              : column === 'end_date'
                ? 'endDate'
                : column === 'ticket_url'
                  ? 'ticketUrl'
                  : column === 'website_url'
                    ? 'websiteUrl'
                    : column === 'genre_labels'
                      ? 'genreLabels'
                      : column === 'price_text'
                        ? 'priceText'
                        : column === 'ticket_status'
                          ? 'ticketStatus'
                          : column === 'ticket_phases'
                            ? 'ticketPhases'
                            : column === 'venue_name'
                              ? 'venueName'
                              : column === 'venue_environment'
                                ? 'venueEnvironment'
                                : column;
          const previousValue = (beforeEvent as Record<string, unknown>)[field];
          if (JSON.stringify(previousValue) !== JSON.stringify(newValue)) {
            mutations.push({ field, previousValue, newValue, kind: 'event_field' });
          }
        }
        if (mutations.length > 0) {
          await updateEventRow(eventId, dbPatch);
        }
      }

      const lineupEntries = ((planEntry.lineupApply as { entries?: LineupEvidenceEntry[] } | undefined)?.entries ??
        []) as LineupEvidenceEntry[];
      if (lineupEntries.length > 0) {
        lineupApplied = await applyLineup(eventId, lineupEntries);
        if (lineupApplied) {
          mutations.push({
            field: 'lineup',
            kind: 'lineup',
            previousValue: rollbackSnapshot.lineup,
            newValue: planEntry.lineupArtistNames,
          });
        }
      }

      const fieldMutationCount = mutations.filter((entry) => entry.kind === 'event_field').length;
      const lineupMutationCount = mutations.filter((entry) => entry.kind === 'lineup').length;

      const afterEvent = await loadEvent(eventId);
      if (!afterEvent) throw new Error('readback_missing');

      for (const mutation of mutations.filter((entry) => entry.kind === 'event_field')) {
        const field = mutation.field as string;
        if (!valuesEquivalent(field, mutation.newValue, (afterEvent as Record<string, unknown>)[field])) {
          throw new Error(`readback_mismatch:${field}`);
        }
      }

      if (lineupApplied) {
        const structured = await eventLineupService.getStructuredLineupForEvent(eventId);
        const names = structured.flatMap((entry) => entry.artists);
        const expectedNames = (planEntry.lineupArtistNames as string[]) ?? [];
        if (names.length !== expectedNames.length) {
          throw new Error('readback_lineup_count_mismatch');
        }
        for (const expectedName of expectedNames) {
          if (!names.some((name) => name.toUpperCase() === expectedName.toUpperCase())) {
            throw new Error(`readback_lineup_missing:${expectedName}`);
          }
        }
      }

      if (key === 'levi') {
        for (const forbidden of ['priceText', 'ticketPhases', 'ticketStatus', 'ticketUrl', 'description']) {
          if ((afterEvent as Record<string, unknown>)[forbidden] !== (beforeEvent as Record<string, unknown>)[forbidden]) {
            throw new Error(`levi_forbidden_field_changed:${forbidden}`);
          }
        }
        const beforeGenres = JSON.stringify(beforeEvent.genreLabels ?? []);
        const afterGenres = JSON.stringify(afterEvent.genreLabels ?? []);
        if (beforeGenres.toLowerCase() !== afterGenres.toLowerCase()) {
          throw new Error('levi_forbidden_field_changed:genreLabels');
        }
      }

      if (key === 'sommerfest_elektrokueche') {
        if (afterEvent.priceText !== beforeEvent.priceText) {
          throw new Error('elektrokueche_forbidden_price_change');
        }
        if (JSON.stringify(afterEvent.ticketPhases) !== JSON.stringify(beforeEvent.ticketPhases)) {
          throw new Error('elektrokueche_forbidden_ticket_phases_change');
        }
        if (afterEvent.ticketUrl !== beforeEvent.ticketUrl || afterEvent.ticketStatus !== beforeEvent.ticketStatus) {
          throw new Error('elektrokueche_forbidden_ticket_url_or_status_change');
        }
      }

      recordSuccessfulWrite(applyWriteCounters, fieldMutationCount, lineupMutationCount);

      const lineupNames =
        lineupApplied ? ((planEntry.lineupArtistNames as string[]) ?? []) : [];
      const consumerAfter = buildConsumerSnapshot(afterEvent, restrictedPatch, lineupNames);

      appliedEvents.push({
        key,
        eventId,
        mutations,
        eventFieldMutations: mutations.filter((m) => m.kind === 'event_field').length,
        lineupMutations: mutations.filter((m) => m.kind === 'lineup').length,
        before: Object.fromEntries(
          mutations
            .filter((m) => m.kind === 'event_field')
            .map((m) => [m.field, m.previousValue]),
        ),
        after: {
          startDate: afterEvent.startDate,
          endDate: afterEvent.endDate,
          description: afterEvent.description,
          genreLabels: afterEvent.genreLabels,
          venueName: afterEvent.venueName,
          venueEnvironment: afterEvent.venueEnvironment,
          priceText: afterEvent.priceText,
          ticketPhases: afterEvent.ticketPhases,
          ticketUrl: afterEvent.ticketUrl,
          ticketStatus: afterEvent.ticketStatus,
          lineup: lineupNames,
        },
        consumerAfter,
      });
    } catch (error) {
      const rolledBackOps =
        mutations.filter((entry) => entry.kind === 'event_field').length +
        (lineupApplied ? 1 : 0);
      await rollbackEvent(rollbackSnapshot, eventId, lineupApplied);
      recordRollbackWrite(applyWriteCounters, rolledBackOps);
      rolledBackEvents.push({
        key,
        eventId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const productionMutationsInThisRun = countProductionMutations(applyWriteCounters);

  const { resetDatasourceBundle } = await import('@/data/datasources/supabase/supabase-datasource');
  resetDatasourceBundle();
  const registry = await import('@/data/repositories/registry');
  await invalidateConsumerEventCaches(registry.eventRepository);

  const result = {
    generatedAt: new Date().toISOString(),
    phase: PHASE,
    restrictedManifestHash: plan.restrictedManifestHash,
    expectedManifestHash: EXPECTED_MANIFEST_HASH,
    committedCodeSha: execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf8' }).trim(),
    preflight,
    appliedEvents,
    skippedEvents,
    rolledBackEvents,
    writeCounters: applyWriteCounters,
    eventFieldMutationsInThisRun: applyWriteCounters.finalCommittedFieldMutations,
    lineupMutationsInThisRun: applyWriteCounters.finalLineupOperations,
    productionMutationsInThisRun,
    rollbackAvailable: existsSync(RESTRICTED_ROLLBACK_FILE),
  };

  writeJson(APPLY_RESULT_FILE, result);
  console.log(JSON.stringify(result, null, 2));
  if (rolledBackEvents.length > 0) {
    process.exitCode = 1;
  }
}

async function run(): Promise<void> {
  resetApplyCounters();
  const applyRequested = process.argv.includes('--apply');

  if (applyRequested) {
    assertApplyAuthorized(true);
    if (!existsSync(RESTRICTED_PLAN_FILE)) {
      throw new Error(`Missing restricted plan at ${RESTRICTED_PLAN_FILE}`);
    }
    const plan = JSON.parse(readFileSync(RESTRICTED_PLAN_FILE, 'utf8')) as Record<string, unknown>;
    const onlyArg = process.argv.find((arg) => arg.startsWith('--only='));
    const onlyKeys = onlyArg
      ? (onlyArg
          .slice('--only='.length)
          .split(',')
          .map((entry) => entry.trim()) as SlotKey[])
      : undefined;
    const preflight = await runPreflightChecks(plan);
    await executeRestrictedApply(plan, preflight, onlyKeys, Boolean(onlyKeys));
    return;
  }

  if (!existsSync(SOURCE_PLAN_FILE)) {
    throw new Error(`Missing source plan at ${SOURCE_PLAN_FILE}`);
  }

  const sourcePlan = JSON.parse(readFileSync(SOURCE_PLAN_FILE, 'utf8')) as Record<string, unknown>;
  const observedAt = new Date().toISOString();
  const restricted = await buildRestrictedManifest(sourcePlan, observedAt);
  const restrictedHash = restricted.restrictedManifestHash as string;

  writeJson(RESTRICTED_PLAN_FILE, restricted);

  const rollback = {
    generatedAt: observedAt,
    phase: PHASE,
    productionMutationsInThisRun: 0,
    restrictedManifestHash: restrictedHash,
    parentManifestHash: PARENT_MANIFEST_HASH,
    events: (restricted.events as Record<string, unknown>[])
      .filter((entry) => entry.eventId)
      .map((entry) => ({
        key: entry.key,
        eventId: entry.eventId,
        table: 'events',
        rowFingerprint: entry.liveRowFingerprint,
        before: entry.rollbackSnapshot,
        lineupRollback: entry.lineupArtistNames,
      })),
    rollbackCoverage: 'all_restricted_patch_fields_plus_lineup_when_planned',
  };
  writeJson(RESTRICTED_ROLLBACK_FILE, rollback);

  const preview = {
    generatedAt: observedAt,
    phase: PHASE,
    productionMutationsInThisRun: 0,
    restrictedManifestHash: restrictedHash,
    events: (restricted.events as Record<string, unknown>[]).map((entry) => ({
      key: entry.key,
      eventId: entry.eventId,
      applyReady: entry.applyReady,
      reviewOnly: entry.reviewOnly,
      fieldGroups: entry.fieldGroups,
      consumer: entry.consumer,
      restrictedPatch: entry.restrictedPatch,
      lineupArtistNames: entry.lineupArtistNames,
      duplicateResolutionProposal: entry.duplicateResolutionProposal,
    })),
  };
  writeJson(RESTRICTED_PREVIEW_FILE, preview);

  const applyReadyEvents = (restricted.events as Record<string, unknown>[])
    .filter((entry) => entry.applyReady === true)
    .map((entry) => entry.key);
  const reviewRequiredEvents = (restricted.events as Record<string, unknown>[])
    .filter((entry) => entry.reviewOnly === true || entry.applyReady !== true)
    .map((entry) => entry.key);

  const exactPlannedMutations = (restricted.events as Record<string, unknown>[]).reduce((count, entry) => {
    const plans = Array.isArray(entry.fieldPlans) ? entry.fieldPlans : [];
    return count + plans.filter((plan) => (plan as FieldPlanEntry).readiness === 'apply_ready').length;
  }, 0);

  const readiness = {
    generatedAt: observedAt,
    phase: PHASE,
    productionMutationsInThisRun: 0,
    rolloutActivated: false,
    restrictedManifestHash: restrictedHash,
    parentManifestHash: PARENT_MANIFEST_HASH,
    applyReadyEvents,
    reviewRequiredEvents,
    exactPlannedMutations,
    applyRefusalRules: [
      'default_read_only_plan_generation',
      'CONFIRM_PRODUCTION_MUTATION_required_for_apply',
      'restricted_manifest_hash_must_match',
      'live_row_fingerprint_must_match_plan_time_snapshot',
      'field_group_skip_on_review_required_without_blocking_independent_groups',
      'productionMutationsInThisRun_must_remain_0_in_read_only_phase',
    ],
    elektrokuechePriceDecision: (restricted.events as Record<string, unknown>[]).find(
      (e) => e.key === 'sommerfest_elektrokueche',
    )?.sourceEvidence?.elektrokuechePriceDecision,
  };
  writeJson(RESTRICTED_READINESS_FILE, readiness);

  console.log(JSON.stringify(readiness, null, 2));
}

void run().catch((error) => {
  console.error(error);
  process.exit(1);
});
