/**
 * Phase 4.8.6.5.6 — Final bounded core corrections (read-only).
 *
 * Usage:
 *   ER_OPS_ENV_FILE=C:\ER\app-v2\.env npx tsx scripts/operations/_phase48656-final-bounded-core.ts
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import './bootstrap-ops-supabase';

import { mapEventRowToAdminRecord, type EventRow } from '@/data/mappers/event-mapper';
import type { AdminEventRecord } from '@/data/types/records';
import { parseTicketKingsCheckoutHtml } from '@/features/aggregation/connectors/ticket-platform/ticket-kings-public-checkout';
import { readCanonicalTicket } from '@/features/events/domain/canonical-ticket-read';
import { projectCanonicalEventFields } from '@/features/events/formatting/canonical-event-projection';
import {
  auditConsumerTicketPresentationForEvent,
  presentationToConsumerSlots,
} from '@/features/events/formatting/resolve-consumer-ticket-presentation';
import {
  evaluateEventVenueIdentity,
  resolveTrustedLinkedVenue,
} from '@/features/event-detail/utils/event-venue-identity';
import {
  resolveEventDetailAddressValidity,
  toOrganizerDetailViewModel,
  toVenueDetailViewModel,
} from '@/features/event-detail/utils/event-detail-view-model';
import { opsClient } from './ops-supabase-rows';
import { computeStableManifestHash, stableHash } from './phase48655-restricted-apply-security';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'docs/real-data');
const PLAN_FILE = join(OUT, '_phase48656_bounded_restricted_plan.json');
const PREVIEW_FILE = join(OUT, '_phase48656_bounded_restricted_preview.json');
const ROLLBACK_FILE = join(OUT, '_phase48656_bounded_restricted_rollback.json');
const READINESS_FILE = join(OUT, '_phase48656_bounded_readiness.json');
const DIAGNOSIS_FILE = join(OUT, '_phase48656_bounded_diagnosis.json');

const PHASE = '4.8.6.5.6';
const USER_AGENT = 'EternalRave-Phase48656/1.0 (+https://eternalrave.app; read-only)';
const CONSUMER_PREVIEW_NOW = new Date('2026-08-08T12:00:00.000Z');
const PARENT_MANIFEST_HASH = '83c62cde728180ac7a7c52b956b4e9b2d81ca1b39d51789d773793c5f4336f06';

const BC173_EVENT_ID = 'evt-1785339410908-9691748';
const ELEKTROKUECHE_EVENT_ID = 'evt-1785389055557-ux20897';

const productionMutationsInThisRun = 0;

function writeJson(path: string, data: unknown): void {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2));
}

function rowFingerprint(event: AdminEventRecord): string {
  return stableHash({
    id: event.id,
    title: event.title,
    venueName: event.venueName,
    venueId: event.venueId,
    venueAddress: event.venueAddress,
    venuePostalCode: event.venuePostalCode,
    latitude: event.latitude,
    longitude: event.longitude,
    priceText: event.priceText,
    ticketPhases: event.ticketPhases,
    ticketUrl: event.ticketUrl,
    ticketStatus: event.ticketStatus,
  });
}

function coordinatesMatchBootshausVenue(
  latitude?: number | null,
  longitude?: number | null,
  bootshausVenue?: { latitude?: number | null; longitude?: number | null } | null,
): boolean {
  if (latitude == null || longitude == null || !bootshausVenue) {
    return false;
  }
  const bootLat = bootshausVenue.latitude;
  const bootLng = bootshausVenue.longitude;
  if (bootLat == null || bootLng == null) {
    return false;
  }
  return Math.abs(latitude - bootLat) < 0.0001 && Math.abs(longitude - bootLng) < 0.0001;
}

function buildBc173CleanupPatch(
  event: AdminEventRecord,
  eventRow: EventRow,
  venueIdentity: ReturnType<typeof evaluateEventVenueIdentity>,
  bootshausVenue?: { latitude?: number | null; longitude?: number | null } | null,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  if (event.venueId) {
    patch.venueId = null;
  }

  if (venueIdentity.staleInlineAddress && event.venueAddress) {
    patch.venueAddress = null;
  }

  const rowLat = typeof eventRow.latitude === 'number' ? eventRow.latitude : event.latitude;
  const rowLng = typeof eventRow.longitude === 'number' ? eventRow.longitude : event.longitude;
  if (coordinatesMatchBootshausVenue(rowLat, rowLng, bootshausVenue)) {
    patch.latitude = null;
    patch.longitude = null;
  }

  if (
    venueIdentity.staleInlineAddress &&
    event.venuePostalCode === '51063' &&
    event.venueName?.toLowerCase().includes('moxy')
  ) {
    patch.venuePostalCode = null;
  }

  return patch;
}

async function loadEvent(eventId: string): Promise<AdminEventRecord | null> {
  const { data, error } = await opsClient().from('events').select('*').eq('id', eventId).maybeSingle();
  if (error) throw new Error(`events read failed: ${error.message}`);
  return data ? mapEventRowToAdminRecord(data as EventRow) : null;
}

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
    redirect: 'follow',
  });
  return { ok: response.ok, status: response.status, html: await response.text(), finalUrl: response.url };
}

async function loadVenueEntity(venueId?: string | null) {
  if (!venueId) return null;
  const { data } = await opsClient()
    .from('venues')
    .select('*')
    .eq('id', venueId)
    .maybeSingle();
  return data;
}

async function loadOrganizerEntity(organizerId?: string | null) {
  if (!organizerId) return null;
  const { data } = await opsClient().from('organizers').select('*').eq('id', organizerId).maybeSingle();
  return data;
}

function mapEventToDisplay(eventRow: EventRow) {
  const projection = projectCanonicalEventFields({
    title: eventRow.title,
    description: eventRow.description ?? '',
    venue: eventRow.venue_name ?? '',
    city: eventRow.venue_city ?? '',
    artists: [],
    priceText: eventRow.price_text,
    ticketUrl: eventRow.ticket_url,
    ticketStatus: eventRow.ticket_status,
    ticketPhases: eventRow.ticket_phases,
    timezone: eventRow.timezone ?? 'Europe/Berlin',
    source: 'phase48656-diagnosis',
  });

  return {
    id: eventRow.id,
    slug: eventRow.slug ?? eventRow.id,
    title: eventRow.title,
    description: eventRow.description ?? '',
    image: { uri: '' },
    date: '',
    startTime: '',
    venue: eventRow.venue_name ?? '',
    city: eventRow.venue_city ?? '',
    country: eventRow.venue_country_code ?? 'DE',
    address: eventRow.venue_address,
    genres: eventRow.genre_labels ?? [],
    artists: [],
    organizer: eventRow.organizer_name,
    organizerId: eventRow.organizer_id,
    venueId: eventRow.venue_id,
    priceText: eventRow.price_text,
    ticketUrl: eventRow.ticket_url,
    ticketPhases: eventRow.ticket_phases,
    ticketAvailability: eventRow.ticket_status,
    websiteUrl: eventRow.website_url,
    source: 'supabase',
    sourceLabel: 'supabase',
    startsAt: eventRow.start_date,
    startDateTime: eventRow.start_date,
    endDateTime: eventRow.end_date,
    timezone: eventRow.timezone ?? 'Europe/Berlin',
    status: eventRow.status,
    createdAt: eventRow.created_at,
    updatedAt: eventRow.updated_at,
    publishedAt: eventRow.published_at,
    latitude: eventRow.latitude,
    longitude: eventRow.longitude,
    venueLabel: projection.venueLabel,
    cityLabel: projection.cityLabel,
    locationLabelComma: projection.locationLabelComma,
    locationLabelDot: projection.locationLabelDot,
    knownArtistNames: [],
    lineupCompleteness: 'none' as const,
    ticketProviderLabel: eventRow.ticket_url?.includes('ticketkings') ? 'TicketKings' : 'Ticket.io',
  };
}

function buildConsumerSnapshot(event: AdminEventRecord, patch: Record<string, unknown> = {}) {
  const merged = { ...event, ...patch };
  const canonicalRead = readCanonicalTicket({
    ticketUrl: merged.ticketUrl,
    websiteUrl: merged.websiteUrl,
    priceText: merged.priceText,
    ticketStatus: merged.ticketStatus,
    ticketPhases: merged.ticketPhases,
  });
  const projection = projectCanonicalEventFields({
    title: merged.title,
    description: merged.description ?? '',
    venue: merged.venueName ?? '',
    city: merged.venueCity ?? '',
    artists: [],
    priceText: merged.priceText,
    ticketUrl: canonicalRead.publicCtaUrl ?? merged.ticketUrl,
    ticketDestinationClass: canonicalRead.destinationClass,
    ticketStatus: merged.ticketStatus,
    ticketPhases: merged.ticketPhases,
    timezone: merged.timezone,
    source: 'phase48656-plan',
  });
  const { presentation } = auditConsumerTicketPresentationForEvent(
    {
      id: merged.id,
      title: merged.title,
      priceText: merged.priceText,
      ticketUrl: canonicalRead.publicCtaUrl ?? merged.ticketUrl,
      officialEventUrl: merged.websiteUrl,
      ticketPhases: merged.ticketPhases,
      timezone: merged.timezone,
      endDateTime: merged.endDate,
      ticketAvailability: merged.ticketStatus,
      ticketProviderLabel: canonicalRead.publicCtaUrl?.includes('ticketkings') ? 'TicketKings' : 'Ticket.io',
    },
    { mode: 'external', now: CONSUMER_PREVIEW_NOW },
  );
  return {
    canonicalProjection: projection,
    consumerPresentation: presentationToConsumerSlots(presentation),
    publicCtaUrl: canonicalRead.publicCtaUrl,
    checkoutEvidenceUrl: canonicalRead.checkoutEvidenceUrl,
    ticketTypes: presentation.ticketTypes.map((ticket) => ({
      name: ticket.name,
      priceLabel: ticket.priceLabel,
      availabilityLabel: ticket.availabilityLabel,
    })),
  };
}

async function evaluateElektrokuecheTicketTruth(observedAt: string) {
  const officialUrl = 'https://affenkaefig.info/event/sommerfest-elektrokueche-08-08-2026/';
  const ticketUrl = 'https://ticketkings.de/event/sommerfest-elektrokueche-20-06-2026/';
  const checkoutUrl = 'https://nacht-manager.de/ticketing/native_event.php?id=41';

  const [officialFetch, ticketFetch, checkoutFetch] = await Promise.all([
    fetchHtml(officialUrl),
    fetchHtml(ticketUrl),
    fetchHtml(checkoutUrl),
  ]);

  const checkoutParsed = checkoutFetch.ok ? parseTicketKingsCheckoutHtml(checkoutFetch.html) : undefined;
  const admission = checkoutParsed?.products?.find((p) => p.classification === 'admission_ticket');
  const doorRelease = checkoutParsed?.releases?.find((r) => /door sale/i.test(r.name ?? ''));
  const flexAddon = checkoutParsed?.excludedProducts?.find((p) => p.classification === 'insurance_or_flex');

  const doorPriceAmount = doorRelease?.priceAmount ?? admission?.priceAmount;
  const doorPriceText = doorRelease?.priceText ?? checkoutParsed?.priceText;
  const mandatoryAdmission =
    admission?.optionalState === 'required' && admission?.classification === 'admission_ticket';
  const doorSaleConfirmed = doorPriceAmount === 20 && mandatoryAdmission;

  return {
    observedAt,
    sources: {
      official: { url: officialUrl, ok: officialFetch.ok, status: officialFetch.status },
      ticketKings: { url: ticketUrl, ok: ticketFetch.ok, status: ticketFetch.status },
      checkout: { url: checkoutUrl, ok: checkoutFetch.ok, status: checkoutFetch.status },
    },
    checkoutParsed: checkoutParsed
      ? {
          priceText: checkoutParsed.priceText,
          priceAmount: checkoutParsed.priceAmount,
          reviewRequired: checkoutParsed.reviewRequired,
          availability: checkoutParsed.availability,
          admissionProduct: admission,
          doorRelease,
          flexAddon,
        }
      : undefined,
    decision: {
      applyReady: doorSaleConfirmed,
      readiness: doorSaleConfirmed ? 'apply_ready' : 'review_required',
      admissionLabel: 'Standard Ticket — DOOR SALE',
      mandatoryAdmissionPrice: doorPriceAmount,
      mandatoryAdmissionPriceText: doorPriceText ?? 'ab 20,00 €',
      flexAddonExcluded: Boolean(flexAddon),
      flexAddonPrice: flexAddon?.priceAmount,
      publicCtaRemainsTicketKings: true,
      checkoutRemainsEvidence: true,
      reason: doorSaleConfirmed
        ? 'live_door_sale_20_eur_mandatory_admission_confirmed'
        : 'checkout_not_unambiguous_for_atomic_price_apply',
    },
    proposedPhase: doorSaleConfirmed
      ? {
          id: 'elektrokueche-door-sale-admission-live',
          kind: 'admission',
          name: 'Standard Ticket — DOOR SALE',
          soldOut: false,
          available: true,
          sortOrder: 0,
          priceLabel: doorPriceText ?? 'ab 20,00 €',
          priceAmount: doorPriceAmount,
          priceCurrency: 'EUR',
        }
      : undefined,
  };
}

async function run(): Promise<void> {
  const observedAt = new Date().toISOString();
  const bc173Row = await opsClient().from('events').select('*').eq('id', BC173_EVENT_ID).maybeSingle();
  const elektroRow = await opsClient().from('events').select('*').eq('id', ELEKTROKUECHE_EVENT_ID).maybeSingle();
  if (!bc173Row.data || !elektroRow.data) {
    throw new Error('required_events_missing');
  }

  const bc173 = mapEventRowToAdminRecord(bc173Row.data as EventRow);
  const elektro = mapEventRowToAdminRecord(elektroRow.data as EventRow);
  const bc173VenueEntity = await loadVenueEntity(bc173.venueId);
  const bc173OrganizerEntity = await loadOrganizerEntity(bc173.organizerId);
  const moxyVenues = (
    await opsClient().from('venues').select('id,name,city,address,latitude,longitude').ilike('name', '%Moxy%')
  ).data ?? [];

  const bc173Display = mapEventToDisplay(bc173Row.data as EventRow);
  const bc173VenueIdentity = evaluateEventVenueIdentity({
    canonicalVenueName: bc173Display.venueLabel,
    linkedVenue: bc173VenueEntity,
    inlineAddress: bc173Display.address,
    organizerName: bc173OrganizerEntity?.name ?? bc173.organizerName,
  });
  const trustedVenue = resolveTrustedLinkedVenue(bc173VenueIdentity, bc173VenueEntity);
  const bc173VenueVm = toVenueDetailViewModel(bc173Display, {
    venue: bc173VenueEntity,
    organizer: bc173OrganizerEntity,
  });
  const bc173OrganizerVm = toOrganizerDetailViewModel(bc173Display, {
    venue: bc173VenueEntity,
    organizer: bc173OrganizerEntity,
  });
  const bc173AddressValidity = resolveEventDetailAddressValidity(bc173Display, {
    venue: bc173VenueEntity,
    organizer: bc173OrganizerEntity,
  });

  const elektroTicketTruth = await evaluateElektrokuecheTicketTruth(observedAt);
  const elektroPatch: Record<string, unknown> = {};
  if (elektroTicketTruth.decision.applyReady) {
    elektroPatch.priceText = elektroTicketTruth.decision.mandatoryAdmissionPriceText;
    elektroPatch.ticketPhases = [elektroTicketTruth.proposedPhase];
    elektroPatch.ticketStatus = 'on_sale';
  }

  const bc173Patch = buildBc173CleanupPatch(
    bc173,
    bc173Row.data as EventRow,
    bc173VenueIdentity,
    bc173VenueEntity,
  );

  const diagnosis = {
    generatedAt: observedAt,
    phase: PHASE,
    productionMutationsInThisRun,
    rootCauseBc173: {
      summary:
        'Header uses canonical event venueName (Moxy); venue card used stale venueId relation to Bootshaus entity.',
      eventVenueName: bc173.venueName,
      eventVenueId: bc173.venueId,
      linkedVenueEntityName: bc173VenueEntity?.name,
      linkedVenueEntityId: bc173VenueEntity?.id,
      eventVenueAddress: bc173.venueAddress,
      organizerName: bc173OrganizerEntity?.name,
      venueIdentityEvaluation: bc173VenueIdentity,
      consumerBeforeVenueCard: {
        name: bc173VenueVm.name,
        verified: bc173VenueVm.verified,
        profileNavigable: bc173VenueVm.profileNavigable,
        addressLabel: bc173VenueVm.addressLabel,
      },
      consumerAfterCodeFixVenueCard: bc173VenueVm,
      organizerCard: bc173OrganizerVm?.organizer.name,
      routeValidity: bc173AddressValidity,
      moxyVenueDatasetExists: moxyVenues.length > 0,
      moxyVenues,
    },
    elektrokuecheTicketTruth: elektroTicketTruth,
  };
  writeJson(DIAGNOSIS_FILE, diagnosis);

  const events = [
    {
      key: 'bc173',
      eventId: BC173_EVENT_ID,
      liveRowFingerprint: rowFingerprint(bc173),
      rowFingerprintAtPlanTime: rowFingerprint(bc173),
      restrictedPatch: bc173Patch,
      fieldPlans: [
        {
          field: 'venueId',
          fieldGroup: 'venue_relation',
          before: bc173.venueId,
          proposed: null,
          readiness: 'apply_ready',
          sourceUrl: 'https://bootshaus-club.ticket.io/BcDqml12/',
          evidenceOrigin: 'stale_bootshaus_venue_relation_with_moxy_canonical_label',
          verifiedAt: observedAt,
          reason: 'clear_stale_bootshaus_venue_id_without_moxy_entity_match',
        },
        {
          field: 'venueAddress',
          fieldGroup: 'venue_address',
          before: bc173.venueAddress,
          proposed: bc173Patch.venueAddress ?? bc173.venueAddress,
          readiness: bc173Patch.venueAddress === null ? 'apply_ready' : 'skipped',
          sourceUrl: 'https://bootshaus-club.ticket.io/BcDqml12/',
          evidenceOrigin: 'stale_bootshaus_inline_address_with_moxy_label',
          verifiedAt: observedAt,
          reason:
            bc173Patch.venueAddress === null
              ? 'remove_stale_bootshaus_auenweg_address'
              : 'venue_address_not_stale_bootshaus_evidence',
        },
        {
          field: 'latitude',
          fieldGroup: 'venue_coordinates',
          before: bc173.latitude ?? (bc173Row.data as EventRow).latitude,
          proposed: bc173Patch.latitude,
          readiness: bc173Patch.latitude === null ? 'apply_ready' : 'skipped',
          sourceUrl: 'https://bootshaus-club.ticket.io/BcDqml12/',
          evidenceOrigin: 'stale_bootshaus_venue_coordinates',
          verifiedAt: observedAt,
          reason:
            bc173Patch.latitude === null
              ? 'remove_bootshaus_entity_coordinates_from_event'
              : 'no_bootshaus_coordinates_on_event',
        },
        {
          field: 'longitude',
          fieldGroup: 'venue_coordinates',
          before: bc173.longitude ?? (bc173Row.data as EventRow).longitude,
          proposed: bc173Patch.longitude,
          readiness: bc173Patch.longitude === null ? 'apply_ready' : 'skipped',
          sourceUrl: 'https://bootshaus-club.ticket.io/BcDqml12/',
          evidenceOrigin: 'stale_bootshaus_venue_coordinates',
          verifiedAt: observedAt,
          reason:
            bc173Patch.longitude === null
              ? 'remove_bootshaus_entity_coordinates_from_event'
              : 'no_bootshaus_coordinates_on_event',
        },
        {
          field: 'venuePostalCode',
          fieldGroup: 'venue_address',
          before: bc173.venuePostalCode,
          proposed: bc173Patch.venuePostalCode,
          readiness: bc173Patch.venuePostalCode === null ? 'apply_ready' : 'skipped',
          sourceUrl: 'https://bootshaus-club.ticket.io/BcDqml12/',
          evidenceOrigin: 'stale_bootshaus_postal_with_moxy_label',
          verifiedAt: observedAt,
          reason:
            bc173Patch.venuePostalCode === null
              ? 'remove_bootshaus_postal_code_from_moxy_event'
              : 'postal_code_not_stale_bootshaus_evidence',
        },
      ],
      applyReady: Object.keys(bc173Patch).length > 0,
      reviewOnly: false,
      intentionallyOmitted: ['title', 'description', 'ticketUrl', 'ticketPhases', 'priceText', 'organizerId'],
      consumer: {
        before: buildConsumerSnapshot(bc173),
        after: buildConsumerSnapshot(bc173, bc173Patch),
      },
      rollbackSnapshot: {
        venueId: bc173.venueId,
        venueAddress: bc173.venueAddress,
        venuePostalCode: bc173.venuePostalCode,
        latitude: bc173.latitude ?? (bc173Row.data as EventRow).latitude ?? null,
        longitude: bc173.longitude ?? (bc173Row.data as EventRow).longitude ?? null,
      },
    },
    {
      key: 'sommerfest_elektrokueche',
      eventId: ELEKTROKUECHE_EVENT_ID,
      liveRowFingerprint: rowFingerprint(elektro),
      rowFingerprintAtPlanTime: rowFingerprint(elektro),
      restrictedPatch: elektroPatch,
      fieldPlans: [
        {
          field: 'priceText',
          fieldGroup: 'ticket_price_phases',
          before: elektro.priceText,
          proposed: elektroPatch.priceText,
          readiness: elektroTicketTruth.decision.readiness,
          sourceUrl: 'https://nacht-manager.de/ticketing/native_event.php?id=41',
          evidenceOrigin: 'live_nachtmanager_checkout',
          rawEvidence: elektroTicketTruth.checkoutParsed,
          verifiedAt: observedAt,
          reason: elektroTicketTruth.decision.reason,
        },
        {
          field: 'ticketPhases',
          fieldGroup: 'ticket_price_phases',
          before: elektro.ticketPhases,
          proposed: elektroPatch.ticketPhases,
          readiness: elektroTicketTruth.decision.readiness,
          sourceUrl: 'https://nacht-manager.de/ticketing/native_event.php?id=41',
          evidenceOrigin: 'live_nachtmanager_checkout',
          rawEvidence: elektroTicketTruth.proposedPhase,
          verifiedAt: observedAt,
          reason: 'replace_phase3_with_atomic_door_sale_no_union',
        },
        {
          field: 'ticketStatus',
          fieldGroup: 'ticket_price_phases',
          before: elektro.ticketStatus,
          proposed: elektroPatch.ticketStatus,
          readiness: elektroTicketTruth.decision.readiness,
          sourceUrl: 'https://nacht-manager.de/ticketing/native_event.php?id=41',
          evidenceOrigin: 'live_nachtmanager_checkout',
          verifiedAt: observedAt,
          reason: 'align_with_live_availability',
        },
      ],
      applyReady: elektroTicketTruth.decision.applyReady,
      reviewOnly: !elektroTicketTruth.decision.applyReady,
      intentionallyOmitted: [
        'venueName',
        'description',
        'ticketUrl',
        'websiteUrl',
        'genreLabels',
        'lineup',
      ],
      consumer: {
        before: buildConsumerSnapshot(elektro),
        after: buildConsumerSnapshot(elektro, elektroPatch),
      },
      rollbackSnapshot: {
        priceText: elektro.priceText,
        ticketPhases: elektro.ticketPhases,
        ticketStatus: elektro.ticketStatus,
      },
      ticketProvenanceAudit: elektroTicketTruth.decision.applyReady
        ? {
            publicCtaUrl: 'https://ticketkings.de/event/sommerfest-elektrokueche-20-06-2026/',
            checkoutEvidenceUrl:
              'https://nacht-manager.de/ticketing/native_event.php?id=41&embed=1&embed_layout=checkout&embed_flow=stepped&return_url=https%3A%2F%2Fticketkings.de%2Forder_success%2F',
            verifiedAt: observedAt,
            admissionProduct: elektroTicketTruth.checkoutParsed?.admissionProduct,
            excludedAddons: elektroTicketTruth.checkoutParsed?.flexAddon
              ? [elektroTicketTruth.checkoutParsed.flexAddon]
              : [],
            priceSource: 'live_nachtmanager_checkout',
            identityDecision: elektroTicketTruth.decision.reason,
          }
        : undefined,
    },
  ];

  const planBody = {
    generatedAt: observedAt,
    phase: PHASE,
    productionMutationsInThisRun,
    parentManifestHash: PARENT_MANIFEST_HASH,
    committedCodeSha: execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf8' }).trim(),
    consumerPreviewNow: CONSUMER_PREVIEW_NOW.toISOString(),
    applyRefusalDefault: true,
    applyToken: 'exact:phase48656-bounded-correction',
    events,
  };
  const boundedManifestHash = computeStableManifestHash(planBody);
  const plan = { ...planBody, boundedManifestHash };
  writeJson(PLAN_FILE, plan);

  writeJson(ROLLBACK_FILE, {
    generatedAt: observedAt,
    phase: PHASE,
    productionMutationsInThisRun,
    boundedManifestHash,
    events: events.map((entry) => ({
      key: entry.key,
      eventId: entry.eventId,
      before: entry.rollbackSnapshot,
      rowFingerprint: entry.liveRowFingerprint,
    })),
  });

  writeJson(PREVIEW_FILE, {
    generatedAt: observedAt,
    phase: PHASE,
    productionMutationsInThisRun,
    boundedManifestHash,
    events: events.map((entry) => ({
      key: entry.key,
      eventId: entry.eventId,
      applyReady: entry.applyReady,
      reviewOnly: entry.reviewOnly,
      restrictedPatch: entry.restrictedPatch,
      consumer: entry.consumer,
    })),
  });

  writeJson(READINESS_FILE, {
    generatedAt: observedAt,
    phase: PHASE,
    productionMutationsInThisRun,
    boundedManifestHash,
    applyReadyEvents: events.filter((e) => e.applyReady).map((e) => e.key),
    reviewRequiredEvents: events.filter((e) => e.reviewOnly).map((e) => e.key),
    allowedMutations: {
      bc173: [
        'venueId: null',
        'venueAddress: null when stale Bootshaus Auenweg',
        'latitude/longitude: null when Bootshaus entity coords',
        'venuePostalCode: null when stale Bootshaus postal with Moxy label',
      ],
      sommerfest_elektrokueche: elektroTicketTruth.decision.applyReady
        ? ['priceText', 'ticketPhases (atomic door sale replace)', 'ticketStatus']
        : ['review_required — no price apply'],
    },
    codeFixes: [
      'event-venue-identity.ts stale relation guard',
      'event-detail-view-model inline venue fallback',
      'phase48655 apply manifest hash stability',
      'apply write counters include rollbacks and retries',
    ],
    erOpsEnvFileSupport: {
      implemented: true,
      mechanism: 'ER_OPS_ENV_FILE loads explicit .env before Supabase bootstrap',
      secretsCommitted: false,
    },
  });

  console.log(
    JSON.stringify({
      boundedManifestHash,
      productionMutationsInThisRun,
      diagnosisFile: DIAGNOSIS_FILE,
      planFile: PLAN_FILE,
    }),
  );
}

void run().catch((error) => {
  console.error(error);
  process.exit(1);
});
