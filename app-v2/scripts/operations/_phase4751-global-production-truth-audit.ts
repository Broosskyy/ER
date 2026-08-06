/**
 * Phase 4.7.5.1 — Global production truth audit (READ ONLY).
 *
 * Usage:
 *   npx tsx scripts/operations/_phase4751-global-production-truth-audit.ts <command>
 *
 * Commands: audit | report | full
 */
import './bootstrap-ops-supabase';

process.env.EXPO_PUBLIC_GENERIC_SOURCE_FIELD_TRUST_MERGE = 'true';
process.env.EXPO_PUBLIC_USE_SUPABASE = 'true';

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapEventRowToAdminRecord, type EventRow } from '@/data/mappers/event-mapper';
import type { AdminEventRecord } from '@/data/types/records';
import { isSuspiciousArtistName } from '@/features/aggregation/audit/lineup-audit-signals';
import {
  classifyLineupDisplayGap,
  classifyTicketBadgeGap,
  classifyVenueLabelGap,
  isCanonicalEvidenceGap,
  isTrueProjectionDefect,
  type RepairabilityClass,
} from '@/features/aggregation/audit/audit-issue-taxonomy';
import { extractFlyerTextWithProviders } from '@/features/aggregation/connectors/framework/detail-extraction/flyer-ocr-provider';
import { isTicketIoShopRootUrl } from '@/features/aggregation/connectors/ticket-platform/ticket-io-url';
import {
  classifyPersistedNachtManagerUrl,
  isBrokenTicketKingsCheckoutClass,
} from '@/features/aggregation/connectors/ticket-platform/ticket-kings-checkout-url-integrity';
import { isCollapsedLineupArtistName } from '@/features/aggregation/domain/lineup-billing-parser';
import type { BillingRelation, ResolvedCanonicalLineupEntry } from '@/features/aggregation/domain/canonical-lineup-entry';
import { projectEventAttributeBadges } from '@/features/events/domain/event-attribute-badge-projection';
import {
  classifyTicketAcceptanceState,
  readCanonicalTicket,
} from '@/features/events/domain/canonical-ticket-read';
import { classifyTicketDestination } from '@/features/events/domain/ticket-destination-classification';
import { readCanonicalLineup } from '@/features/events/domain/canonical-lineup-read';
import { evaluateArtistCandidate } from '@/features/events/domain/artist-candidate-quality-gate';
import { projectCanonicalEventFields } from '@/features/events/formatting/canonical-event-projection';
import { buildConsumerGalleryImageUrls } from '@/features/events/formatting/consumer-gallery-projection';
import { mapCanonicalAvailabilityToTicketBadge } from '@/features/events/formatting/ticket-badge-projection';
import { getEffectiveCandidate } from '@/features/import/admin/import-utils';
import { extractPrioritizedLineupEntries } from '@/features/import/services/import-structured-lineup-from-record';
import type { ImportRecord } from '@/features/import/models/types';
import { opsClient } from './ops-supabase-rows';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'docs/real-data');
const REPORT = join(ROOT, 'docs/PHASE_4751_GLOBAL_PRODUCTION_TRUTH_AUDIT.md');

const REFERENCE_EVENT_ID = 'evt-1785339420043-obhyeev';

const REPRESENTATIVE_PATTERNS = [
  { label: 'Bootshaus on a Ship Vol. III', pattern: /bootshaus\s+on\s+a\s+ship\s+vol\.\s*iii/i },
  { label: 'LEVI', pattern: /presents\s+levi\b|\blevi\b/i },
  { label: 'Underland', pattern: /underland/i },
  { label: 'Sommerfest Elektroküche', pattern: /sommerfest.*elektroküche/i },
  { label: 'MDMA', pattern: /\bmdma\b/i },
  { label: 'Affenkäfig', pattern: /affenkäfig|affenkaefig/i },
  { label: 'PROTON Stuttgart', pattern: /proton.*stuttgart|stuttgart.*proton/i },
  { label: 'Unreal Weekender I', pattern: /unreal\s+weekender\s+night\s+i/i },
  { label: 'Unreal Weekender II', pattern: /unreal\s+weekender\s+night\s+ii/i },
  { label: 'Blacklist Festival', pattern: /blacklist\s+festival/i },
  { label: 'Mallorca Events', pattern: /mallorca/i },
  { label: 'Technodampfer Events', pattern: /technodampfer|techno\s+dampfer/i },
] as const;

type RootCauseStage =
  | 'Source'
  | 'Import'
  | 'Normalization'
  | 'Matching'
  | 'Canonical Merge'
  | 'Persistence'
  | 'Canonical Read'
  | 'Projection'
  | 'API'
  | 'ViewModel'
  | 'Consumer UI'
  | 'Cache';

interface AuditIssue {
  domain: 'ticket' | 'lineup' | 'badge' | 'venue' | 'media' | 'consumer';
  code: string;
  message: string;
  rootCauseStage: RootCauseStage;
  repairability: RepairabilityClass;
}

interface DomainScores {
  ticket: number;
  venue: number;
  lineup: number;
  badge: number;
  media: number;
  consumer: number;
  overall: number;
}

interface EventTruthRecord {
  eventId: string;
  title: string;
  representativeLabels: string[];
  issues: AuditIssue[];
  firstDivergenceStage?: RootCauseStage;
  scores: DomainScores;
  meetsReference: boolean;
  ticket: Record<string, unknown>;
  lineup: Record<string, unknown>;
  badge: Record<string, unknown>;
  venue: Record<string, unknown>;
  media: Record<string, unknown>;
  consumer: Record<string, unknown>;
}

function writeJson(name: string, data: unknown): void {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, name), JSON.stringify(data, null, 2));
}

async function loadPublishedEvents(): Promise<AdminEventRecord[]> {
  const { data, error } = await opsClient().from('events').select('*').eq('status', 'published');
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => mapEventRowToAdminRecord(row as EventRow));
}

async function loadStructuredEntries(eventId: string) {
  const { data } = await opsClient()
    .from('event_lineup_entries')
    .select(
      'id, sort_order, billing_relation, stage, event_lineup_entry_artists(artist_id, sort_order, artists(name))',
    )
    .eq('event_id', eventId)
    .order('sort_order', { ascending: true });
  return (data ?? []).map((entry) => ({
    id: entry.id,
    order: entry.sort_order,
    billingRelation: entry.billing_relation,
    stage: entry.stage,
    artists: (
      (entry.event_lineup_entry_artists as Array<{ artists: { name?: string } | null }>) ?? []
    ).map((row) => row.artists?.name).filter((name): name is string => Boolean(name)),
  }));
}

function toResolvedEntries(
  structured: Awaited<ReturnType<typeof loadStructuredEntries>>,
): ResolvedCanonicalLineupEntry[] {
  return structured.map((entry, index) => ({
    order: entry.order ?? index,
    artists: entry.artists,
    artistIds: [],
    entryId: entry.id,
    billingRelation: (entry.billingRelation ?? 'SOLO') as BillingRelation,
    stage: entry.stage,
  }));
}

async function loadCompatibilityArtists(eventId: string) {
  const { data } = await opsClient()
    .from('event_artists')
    .select('artists(name, id, lineup_legacy_artifact)')
    .eq('event_id', eventId)
    .order('sort_order');
  return (data ?? []).map((row) => {
    const artist = row.artists as { name?: string; id?: string; lineup_legacy_artifact?: boolean } | null;
    return {
      name: artist?.name ?? '',
      id: artist?.id,
      legacyArtifact: artist?.lineup_legacy_artifact ?? false,
    };
  }).filter((row) => row.name);
}

async function loadImportRecords(eventId: string): Promise<ImportRecord[]> {
  const { data } = await opsClient()
    .from('import_records')
    .select('*')
    .eq('canonical_event_id', eventId)
    .order('updated_at', { ascending: false });
  return (data ?? []) as ImportRecord[];
}

async function loadVenueRow(venueId?: string) {
  if (!venueId) {
    return null;
  }
  const { data } = await opsClient().from('venues').select('*').eq('id', venueId).maybeSingle();
  return data;
}

function matchRepresentatives(title: string): string[] {
  return REPRESENTATIVE_PATTERNS.filter((rep) => rep.pattern.test(title)).map((rep) => rep.label);
}

function scoreTicketDomain(input: {
  hasPrice: boolean;
  hasBadge: boolean;
  acceptanceOk: boolean;
  hasProviderLabel: boolean;
  hasPhases: boolean;
  destinationOk: boolean;
}): number {
  let score = 0;
  if (input.hasPrice) score += 25;
  if (input.hasBadge) score += 15;
  if (input.acceptanceOk) score += 25;
  if (input.hasProviderLabel) score += 10;
  if (input.hasPhases) score += 10;
  if (input.destinationOk) score += 15;
  return score;
}

function scoreLineupDomain(input: {
  structured: boolean;
  displayed: boolean;
  noInvalid: boolean;
  completeness: 'full' | 'partial' | 'none';
}): number {
  let score = 0;
  if (input.structured) score += 40;
  if (input.displayed) score += 30;
  if (input.noInvalid) score += 20;
  if (input.completeness === 'full') score += 10;
  else if (input.completeness === 'partial') score += 5;
  return score;
}

async function auditEvent(
  event: AdminEventRecord,
  referenceScores: DomainScores,
): Promise<EventTruthRecord> {
  const issues: AuditIssue[] = [];
  const push = (
    domain: AuditIssue['domain'],
    code: string,
    message: string,
    rootCauseStage: RootCauseStage,
    repairability: RepairabilityClass,
  ) => {
    issues.push({ domain, code, message, rootCauseStage, repairability });
  };

  const structured = await loadStructuredEntries(event.id);
  const compatibility = await loadCompatibilityArtists(event.id);
  const importRecords = await loadImportRecords(event.id);
  const importCandidate = importRecords[0] ? getEffectiveCandidate(importRecords[0]) : undefined;
  const importLineup = importRecords[0] ? extractPrioritizedLineupEntries(importRecords[0]) : undefined;

  const lineup = readCanonicalLineup({
    structuredEntries: toResolvedEntries(structured),
    eventTitle: event.title,
  });
  const artistNames =
    lineup.artistNames.length > 0
      ? lineup.artistNames
      : compatibility.map((a) => a.name).filter((name) => !isCollapsedLineupArtistName(name));

  const canonicalTicket = readCanonicalTicket({
    ticketUrl: event.ticketUrl,
    websiteUrl: event.websiteUrl,
    priceText: event.priceText,
    ticketStatus: event.ticketStatus,
    ticketPhases: event.ticketPhases,
  });
  const purchaseDest = canonicalTicket.purchaseUrl
    ? classifyTicketDestination(canonicalTicket.purchaseUrl)
    : undefined;
  const publicDest = canonicalTicket.publicCtaUrl
    ? classifyTicketDestination(canonicalTicket.publicCtaUrl)
    : undefined;
  const acceptance = classifyTicketAcceptanceState(canonicalTicket);
  const ticketBadge = mapCanonicalAvailabilityToTicketBadge(
    canonicalTicket.availability,
    canonicalTicket.ticketStatus,
  );

  const gallery = buildConsumerGalleryImageUrls({
    flyerUrl: event.flyerUrl,
    imageUrl: event.imageUrl,
  });

  const canonical = projectCanonicalEventFields({
    title: event.title,
    description: event.description ?? '',
    venue: event.venueName ?? '',
    city: event.venueCity ?? '',
    artists: artistNames,
    priceText: canonicalTicket.priceText ?? event.priceText,
    source: event.sourceId ?? 'supabase',
    ticketUrl: canonicalTicket.publicCtaUrl ?? event.ticketUrl,
    ticketStatus: canonicalTicket.ticketStatus ?? event.ticketStatus,
    ticketPhases: event.ticketPhases,
    imageUrl: event.imageUrl,
    imageUrls: gallery,
    latitude: event.latitude,
    longitude: event.longitude,
    organizer: event.organizerName,
    lineupEntries: structured.map((entry, index) => ({
      order: entry.order ?? index,
      artists: entry.artists,
      billingRelation: entry.billingRelation ?? 'SOLO',
      stage: entry.stage,
    })),
  });

  const attributeBadges = projectEventAttributeBadges(event.eventAttributes, {
    floorCount: structured.filter((e) => e.stage).length > 1 ? 2 : undefined,
  });

  const venueRow = await loadVenueRow(event.venueId);
  const imageUrl = event.flyerUrl ?? event.imageUrl ?? '';
  const ocr = imageUrl
    ? await extractFlyerTextWithProviders({
        eventId: event.id,
        title: event.title,
        imageUrl,
        description: event.description,
        importArtistNames: importCandidate?.artistNames,
      })
    : null;

  // --- TICKET ---
  if (!canonicalTicket.publicCtaUrl && !event.websiteUrl) {
    push('ticket', 'missing_ticket_url', 'No public CTA or official event URL', 'Source', 'blocked_by_missing_public_evidence');
  }
  if (canonicalTicket.purchaseUrl && isTicketIoShopRootUrl(canonicalTicket.purchaseUrl)) {
    push('ticket', 'shop_root_purchase_url', 'Purchase URL is generic ticket.io shop root', 'Canonical Merge', 'repairable_now');
  }
  if (publicDest && publicDest.destinationClass === 'ticket_platform_root') {
    push('ticket', 'shop_root_cta', 'Public CTA resolves to shop root', 'Canonical Merge', 'repairable_now');
  }
  if (acceptance === 'incorrect' || acceptance === 'shop_root_fallback_only') {
    push('ticket', 'wrong_ticket_destination', `Ticket acceptance: ${acceptance}`, 'Canonical Merge', 'repairable_now');
  }
  if (canonicalTicket.purchaseUrl) {
    const tkClass = classifyPersistedNachtManagerUrl(canonicalTicket.purchaseUrl);
    if (isBrokenTicketKingsCheckoutClass(tkClass)) {
      push('ticket', 'broken_checkout_url', 'Ticket Kings checkout URL integrity failure', 'Import', 'repairable_now');
    }
  }
  if (!canonicalTicket.priceText && !canonical.displayPriceText) {
    push('ticket', 'missing_price', 'No canonical or projected ticket price', 'Source', 'requires_external_source');
  } else if (canonicalTicket.priceText && !canonical.displayPriceText) {
    push('ticket', 'price_projection_gap', 'Price in DB but not projected to consumer', 'Projection', 'repairable_now');
  }
  if (!canonical.ticketProviderLabel) {
    push('ticket', 'missing_provider_label', 'Ticket provider label missing', 'Projection', 'repairable_now');
  }

  // --- LINEUP ---
  if (lineup.state === 'empty' && artistNames.length === 0) {
    push('lineup', 'missing_lineup', 'No structured or compatibility lineup', 'Source', 'blocked_by_missing_public_evidence');
  } else if (lineup.state !== 'structured' && artistNames.length > 0) {
    push('lineup', 'compatibility_only', 'Lineup is compatibility-only, not structured', 'Persistence', 'requires_connector');
  }
  if (compatibility.some((a) => a.legacyArtifact || isCollapsedLineupArtistName(a.name))) {
    push('lineup', 'collapsed_artist_entity', 'Collapsed or legacy artifact artist on event', 'Persistence', 'requires_review');
  }
  if (artistNames.some(isSuspiciousArtistName)) {
    push('lineup', 'invalid_artist_names', 'Suspicious artist names in canonical lineup', 'Import', 'requires_review');
  }
  if (artistNames.length > 0 && canonical.knownArtistNames.length === 0) {
    const qualityRejected = artistNames.filter(
      (name) => !evaluateArtistCandidate({ name, sourceField: 'lineup' }).accepted,
    );
    const lineupGap = classifyLineupDisplayGap({
      persistedArtistNames: artistNames,
      displayedArtistNames: canonical.knownArtistNames,
      suspiciousArtistNames: [...artistNames.filter(isSuspiciousArtistName), ...qualityRejected],
      legacyArtifactNames: compatibility.filter((a) => a.legacyArtifact).map((a) => a.name),
      structuredEntryCount: structured.length,
    });
    if (lineupGap) {
      push(lineupGap.domain, lineupGap.code, lineupGap.message, lineupGap.rootCauseStage, lineupGap.repairability);
    }
  }
  if (importLineup && importLineup.entries.length > 0 && structured.length === 0) {
    push('lineup', 'import_not_persisted', 'Import has lineup entries but structured DB empty', 'Persistence', 'repairable_now');
  }
  if (ocr?.status === 'pending_external' && imageUrl && structured.length === 0) {
    push('lineup', 'ocr_pending', 'Flyer OCR candidate exists but lineup not extracted', 'Source', 'requires_OCR');
  }

  // --- BADGES ---
  if (!ticketBadge) {
    const badgeGap = classifyTicketBadgeGap({
      hasTicketBadge: false,
      availability: canonicalTicket.availability,
      ticketStatus: canonicalTicket.ticketStatus,
      priceText: canonicalTicket.priceText,
      ticketUrl: event.ticketUrl,
      websiteUrl: event.websiteUrl,
    });
    if (badgeGap && !issues.some((i) => i.code === badgeGap.code)) {
      push(badgeGap.domain, badgeGap.code, badgeGap.message, badgeGap.rootCauseStage, badgeGap.repairability);
    }
  }
  const expectedAttributeTypes = new Set((event.eventAttributes ?? []).map((a) => a.type));
  if (expectedAttributeTypes.size > 0 && attributeBadges.length === 0) {
    push('badge', 'missing_attribute_badges', 'Event attributes exist but no consumer badges', 'Projection', 'repairable_now');
  }
  const badgeIds = attributeBadges.map((b) => b.id);
  if (new Set(badgeIds).size !== badgeIds.length) {
    push('badge', 'duplicated_badges', 'Duplicate attribute badge IDs', 'Projection', 'repairable_now');
  }

  // --- VENUE ---
  if (!event.venueName && !event.venueCity) {
    push('venue', 'missing_venue', 'No venue name or city', 'Source', 'blocked_by_missing_public_evidence');
  }
  if (event.organizerName && event.venueName?.toLowerCase() === event.organizerName.toLowerCase()) {
    push('venue', 'promoter_as_venue', 'Venue label matches promoter (possible inference)', 'Canonical Merge', 'requires_review');
  }
  if (importCandidate?.venueName && event.venueName && importCandidate.venueName.toLowerCase() !== event.venueName.toLowerCase()) {
    push('venue', 'import_venue_mismatch', `Import venue "${importCandidate.venueName}" differs from canonical`, 'Canonical Merge', 'requires_review');
  }
  if (!canonical.hasCoordinates && event.venueCity) {
    push('venue', 'missing_coordinates', 'City present but no map coordinates', 'Persistence', 'requires_connector');
  }
  if (event.venueId && !venueRow) {
    push('venue', 'orphan_venue_id', 'venueId points to missing venue row', 'Persistence', 'repairable_now');
  }

  // --- MEDIA ---
  if (gallery.length === 0) {
    push('media', 'missing_gallery', 'No gallery images projected', 'Source', 'blocked_by_missing_public_evidence');
  }
  if (imageUrl && ocr?.status === 'pending_external') {
    push('media', 'ocr_not_evaluated', 'Flyer image present but OCR pending', 'Source', 'requires_OCR');
  }

  // --- CONSUMER ---
  // Title is read directly from persisted event row in ViewModel — not a separate projection field.
  if (!canonical.venueLabel) {
    const venueGap = classifyVenueLabelGap({
      title: event.title,
      eventVenueName: event.venueName,
      eventVenueCity: event.venueCity,
      projectedVenueLabel: canonical.venueLabel,
      venueRowName: venueRow?.name,
      organizerName: event.organizerName,
      importVenueName: importCandidate?.venueName,
    });
    if (venueGap) {
      push(venueGap.domain, venueGap.code, venueGap.message, venueGap.rootCauseStage, venueGap.repairability);
    }
  }
  if (canonicalTicket.priceText && canonical.displayPriceText !== canonicalTicket.priceText && !canonical.displayPriceText?.includes('€')) {
    push('consumer', 'price_display_mismatch', 'Consumer price display diverges from canonical', 'Projection', 'repairable_now');
  }

  const ticketScore = scoreTicketDomain({
    hasPrice: Boolean(canonicalTicket.priceText || canonical.displayPriceText),
    hasBadge: Boolean(ticketBadge),
    acceptanceOk: ['direct_purchase_correct', 'ticket_event_page_correct', 'official_event_page_only'].includes(acceptance),
    hasProviderLabel: Boolean(canonical.ticketProviderLabel),
    hasPhases: (event.ticketPhases?.length ?? 0) > 0,
    destinationOk: publicDest ? publicDest.destinationClass !== 'ticket_platform_root' : false,
  });
  const lineupScore = scoreLineupDomain({
    structured: lineup.state === 'structured',
    displayed: canonical.knownArtistNames.length > 0,
    noInvalid: !artistNames.some(isSuspiciousArtistName),
    completeness: canonical.lineupCompleteness,
  });
  const badgeScore =
    (ticketBadge ? 50 : 0) +
    Math.min(50, attributeBadges.length * 10);
  const venueScore =
    (event.venueName ? 30 : 0) +
    (event.venueCity ? 20 : 0) +
    (canonical.hasCoordinates ? 30 : 0) +
    (event.venueId ? 20 : 0);
  const mediaScore = (gallery.length > 0 ? 60 : 0) + (imageUrl ? 40 : 0);
  const hasCanonicalVenueEvidence = Boolean(event.venueName?.trim() || venueRow?.name?.trim());
  const venueProjectionHealthy = hasCanonicalVenueEvidence ? Boolean(canonical.venueLabel) : true;
  const consumerScore =
    (canonical.knownArtistNames.length > 0 || artistNames.length === 0 ? 25 : 0) +
    (canonical.displayPriceText || !canonicalTicket.priceText ? 25 : 0) +
    (venueProjectionHealthy ? 25 : 0) +
    (gallery.length > 0 ? 25 : 0);

  const scores: DomainScores = {
    ticket: ticketScore,
    venue: venueScore,
    lineup: lineupScore,
    badge: badgeScore,
    media: mediaScore,
    consumer: consumerScore,
    overall: Math.round((ticketScore + venueScore + lineupScore + badgeScore + mediaScore + consumerScore) / 6),
  };

  const meetsReference = scores.overall >= referenceScores.overall;
  const firstDivergenceStage = issues[0]?.rootCauseStage;

  return {
    eventId: event.id,
    title: event.title,
    representativeLabels: matchRepresentatives(event.title),
    issues,
    firstDivergenceStage,
    scores,
    meetsReference,
    ticket: {
      provider: publicDest?.ticketPlatform,
      providerLabel: canonical.ticketProviderLabel,
      officialEventUrl: canonicalTicket.officialEventUrl,
      purchaseUrl: canonicalTicket.purchaseUrl,
      publicCtaUrl: canonicalTicket.publicCtaUrl,
      destinationClass: canonicalTicket.destinationClass,
      acceptanceState: acceptance,
      priceText: canonicalTicket.priceText,
      displayPriceText: canonical.displayPriceText,
      availability: canonicalTicket.availability,
      ticketStatus: canonicalTicket.ticketStatus,
      ticketPhasesCount: event.ticketPhases?.length ?? 0,
      ticketBadge,
      shopRoot: Boolean(publicDest && publicDest.destinationClass === 'ticket_platform_root'),
    },
    lineup: {
      state: lineup.state,
      structuredEntryCount: structured.length,
      compatibilityCount: compatibility.length,
      displayedArtists: canonical.knownArtistNames,
      importLineupCount: importLineup?.entries.length ?? 0,
      importLineupSource: importLineup?.source,
      ocrStatus: ocr?.status,
      flyerHasArtists: (ocr?.rawText?.toLowerCase().includes('lineup') || importLineup?.entries.length) ? true : false,
    },
    badge: {
      ticketBadge,
      attributeBadges: attributeBadges.map((b) => b.label),
      attributeBadgeCount: attributeBadges.length,
    },
    venue: {
      venueName: event.venueName,
      venueCity: event.venueCity,
      venueId: event.venueId,
      mappedVenueName: venueRow?.name,
      coordinates: canonical.hasCoordinates,
      latitude: event.latitude,
      longitude: event.longitude,
      organizerName: event.organizerName,
    },
    media: {
      flyerUrl: event.flyerUrl,
      imageUrl: event.imageUrl,
      galleryCount: gallery.length,
      galleryUrls: gallery,
      ocrStatus: ocr?.status,
    },
    consumer: {
      qualityState: canonical.qualityState,
      lineupCompleteness: canonical.lineupCompleteness,
      hasKnownLineup: canonical.hasKnownLineup,
      displayPriceText: canonical.displayPriceText,
      ticketAvailability: canonical.ticketAvailability,
      isSoldOut: canonical.isSoldOut,
      surfaces: {
        eventDetail: Boolean(canonical.title && canonical.venueLabel),
        home: Boolean(canonical.heroImageUrl || gallery.length),
        discovery: Boolean(ticketBadge || canonical.displayPriceText),
        search: Boolean(canonical.knownArtistNames.length || event.title),
        map: canonical.hasCoordinates,
        saved: true,
      },
    },
  };
}

async function buildGoldStandardDiff(
  reference: EventTruthRecord,
  events: EventTruthRecord[],
): Promise<unknown> {
  const representatives = events.filter((e) => e.representativeLabels.length > 0);
  const diffs = representatives.map((event) => {
    const fieldDiffs: Array<{ field: string; reference: unknown; actual: unknown; firstStage: RootCauseStage }> = [];

    const compare = (field: string, ref: unknown, actual: unknown, stage: RootCauseStage) => {
      if (JSON.stringify(ref) !== JSON.stringify(actual)) {
        fieldDiffs.push({ field, reference: ref, actual, firstStage: stage });
      }
    };

    compare('lineup.state', reference.lineup.state, event.lineup.state, 'Persistence');
    compare('lineup.structuredEntryCount', reference.lineup.structuredEntryCount, event.lineup.structuredEntryCount, 'Persistence');
    compare('ticket.destinationClass', reference.ticket.destinationClass, event.ticket.destinationClass, 'Canonical Merge');
    compare('ticket.priceText', reference.ticket.priceText, event.ticket.priceText, 'Source');
    compare('ticket.ticketBadge', reference.ticket.ticketBadge, event.ticket.ticketBadge, 'Projection');
    compare('media.galleryCount', reference.media.galleryCount, event.media.galleryCount, 'Projection');
    compare('venue.coordinates', reference.venue.coordinates, event.venue.coordinates, 'Persistence');
    compare('consumer.qualityState', reference.consumer.qualityState, event.consumer.qualityState, 'Projection');

    return {
      eventId: event.eventId,
      title: event.title,
      labels: event.representativeLabels,
      referenceOverall: reference.scores.overall,
      actualOverall: event.scores.overall,
      firstDivergenceStage: fieldDiffs[0]?.firstStage ?? event.firstDivergenceStage,
      fieldDiffs,
      issues: event.issues.map((i) => ({ code: i.code, stage: i.rootCauseStage, repairability: i.repairability })),
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    referenceEventId: REFERENCE_EVENT_ID,
    referenceTitle: reference.title,
    referenceScores: reference.scores,
    representativeCount: diffs.length,
    representatives: diffs,
  };
}

function buildRepairability(events: EventTruthRecord[]): unknown {
  const byClass: Record<RepairabilityClass, Array<{ eventId: string; title: string; code: string }>> = {
    repairable_now: [],
    requires_external_source: [],
    requires_OCR: [],
    requires_connector: [],
    requires_review: [],
    blocked_by_missing_public_evidence: [],
  };

  for (const event of events) {
    for (const issue of event.issues) {
      byClass[issue.repairability].push({
        eventId: event.eventId,
        title: event.title,
        code: issue.code,
      });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    totals: Object.fromEntries(
      Object.entries(byClass).map(([key, value]) => [key, value.length]),
    ),
    byClass,
  };
}

function buildRootCauseSummary(events: EventTruthRecord[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const event of events) {
    for (const issue of event.issues) {
      counts[issue.rootCauseStage] = (counts[issue.rootCauseStage] ?? 0) + 1;
    }
  }
  return counts;
}

async function runAudit(): Promise<void> {
  const events = await loadPublishedEvents();
  const referenceEvent = events.find((e) => e.id === REFERENCE_EVENT_ID);
  if (!referenceEvent) {
    throw new Error(`Reference event not found: ${REFERENCE_EVENT_ID}`);
  }

  const referenceRecord = await auditEvent(referenceEvent, {
    ticket: 100,
    venue: 100,
    lineup: 100,
    badge: 100,
    media: 100,
    consumer: 100,
    overall: 100,
  });

  const records: EventTruthRecord[] = [referenceRecord];
  for (const event of events.filter((e) => e.id !== REFERENCE_EVENT_ID)) {
    records.push(await auditEvent(event, referenceRecord.scores));
  }

  records.sort((a, b) => a.scores.overall - b.scores.overall);
  const worst25 = records.filter((e) => e.eventId !== REFERENCE_EVENT_ID).slice(0, 25);
  const meetsReference = records.filter((r) => r.meetsReference).length;

  const ticketIssues = records.flatMap((e) => e.issues.filter((i) => i.domain === 'ticket'));
  const lineupIssues = records.flatMap((e) => e.issues.filter((i) => i.domain === 'lineup'));
  const badgeIssues = records.flatMap((e) => e.issues.filter((i) => i.domain === 'badge'));
  const venueIssues = records.flatMap((e) => e.issues.filter((i) => i.domain === 'venue'));
  const mediaIssues = records.flatMap((e) => e.issues.filter((i) => i.domain === 'media'));
  const consumerIssues = records.flatMap((e) => e.issues.filter((i) => i.domain === 'consumer'));

  const repairability = buildRepairability(records) as {
    totals: Record<RepairabilityClass, number>;
  };
  const rootCauses = buildRootCauseSummary(records);
  const goldDiff = await buildGoldStandardDiff(referenceRecord, records);

  const phase48Blockers = {
    ticketDomain: ticketIssues.filter((i) =>
      ['wrong_ticket_destination', 'shop_root_cta', 'shop_root_purchase_url', 'broken_checkout_url', 'missing_price', 'price_projection_gap'].includes(i.code),
    ).length,
    consumerProjection: [
      ...consumerIssues,
      ...lineupIssues.filter((i) => i.code === 'lineup_projection_gap'),
      ...badgeIssues.filter((i) => i.code === 'ticket_badge_projection_gap'),
    ].filter((i) => isTrueProjectionDefect(i)).length,
    trueProjectionDefects: records.flatMap((e) => e.issues).filter((i) => isTrueProjectionDefect(i)).length,
    canonicalEvidenceGaps: records.flatMap((e) => e.issues).filter((i) => isCanonicalEvidenceGap(i)).length,
    venueProjection: venueIssues.length,
    badgeProjection: badgeIssues.length,
    mediaProjection: mediaIssues.length,
    urlRouting: ticketIssues.filter((i) => i.code.includes('shop_root') || i.code === 'broken_checkout_url').length,
    phase48Ready: false,
    remainingWork: [] as string[],
  };

  if (phase48Blockers.ticketDomain > 0) {
    phase48Blockers.remainingWork.push(`${phase48Blockers.ticketDomain} ticket domain issues remain`);
  }
  if (phase48Blockers.consumerProjection > 0) {
    phase48Blockers.remainingWork.push(`${phase48Blockers.consumerProjection} consumer projection gaps remain`);
  }
  if (phase48Blockers.venueProjection > 0) {
    phase48Blockers.remainingWork.push(`${phase48Blockers.venueProjection} venue issues remain`);
  }
  if (phase48Blockers.badgeProjection > 0) {
    phase48Blockers.remainingWork.push(`${phase48Blockers.badgeProjection} badge projection issues remain`);
  }
  if (phase48Blockers.mediaProjection > 0) {
    phase48Blockers.remainingWork.push(`${phase48Blockers.mediaProjection} media issues remain`);
  }
  if (repairability.totals.requires_OCR > 0) {
    phase48Blockers.remainingWork.push(`${repairability.totals.requires_OCR} issues require OCR (connector/backfill scope)`);
  }
  if (repairability.totals.blocked_by_missing_public_evidence > 0) {
    phase48Blockers.remainingWork.push(`${repairability.totals.blocked_by_missing_public_evidence} issues blocked by missing public evidence`);
  }
  phase48Blockers.phase48Ready =
    phase48Blockers.remainingWork.length === 0 &&
    meetsReference === records.length;

  const summary = {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    totalPublished: events.length,
    referenceEventId: REFERENCE_EVENT_ID,
    referenceScores: referenceRecord.scores,
    meetsReferenceCount: meetsReference,
    meetsReferencePercent: Math.round((meetsReference / events.length) * 100),
    worst25: worst25.map((e) => ({
      eventId: e.eventId,
      title: e.title,
      overall: e.scores.overall,
      firstStage: e.firstDivergenceStage,
      topIssues: e.issues.slice(0, 3).map((i) => i.code),
    })),
    ticketIssueCount: ticketIssues.length,
    wrongDestinations: ticketIssues.filter((i) => i.code.includes('destination') || i.code.includes('shop_root')).length,
    missingPrices: ticketIssues.filter((i) => i.code === 'missing_price').length,
    missingLineups: lineupIssues.filter((i) => i.code === 'missing_lineup').length,
    missingBadges: badgeIssues.filter((i) => i.code.includes('missing')).length,
    wrongVenues: venueIssues.filter((i) => i.code.includes('mismatch') || i.code === 'promoter_as_venue').length,
    mediaIssueCount: mediaIssues.length,
    rootCauses,
    repairabilityTotals: repairability.totals,
    phase48Readiness: phase48Blockers,
  };

  writeJson('_phase4751_global_truth.json', { summary, events: records });
  writeJson('_phase4751_ticket_truth.json', {
    generatedAt: new Date().toISOString(),
    issueCount: ticketIssues.length,
    events: records.map((e) => ({ eventId: e.eventId, title: e.title, ticket: e.ticket, issues: e.issues.filter((i) => i.domain === 'ticket') })),
  });
  writeJson('_phase4751_lineup_truth.json', {
    generatedAt: new Date().toISOString(),
    issueCount: lineupIssues.length,
    events: records.map((e) => ({ eventId: e.eventId, title: e.title, lineup: e.lineup, issues: e.issues.filter((i) => i.domain === 'lineup') })),
  });
  writeJson('_phase4751_badge_truth.json', {
    generatedAt: new Date().toISOString(),
    issueCount: badgeIssues.length,
    events: records.map((e) => ({ eventId: e.eventId, title: e.title, badge: e.badge, issues: e.issues.filter((i) => i.domain === 'badge') })),
  });
  writeJson('_phase4751_venue_truth.json', {
    generatedAt: new Date().toISOString(),
    issueCount: venueIssues.length,
    events: records.map((e) => ({ eventId: e.eventId, title: e.title, venue: e.venue, issues: e.issues.filter((i) => i.domain === 'venue') })),
  });
  writeJson('_phase4751_media_truth.json', {
    generatedAt: new Date().toISOString(),
    issueCount: mediaIssues.length,
    events: records.map((e) => ({ eventId: e.eventId, title: e.title, media: e.media, issues: e.issues.filter((i) => i.domain === 'media') })),
  });
  writeJson('_phase4751_consumer_truth.json', {
    generatedAt: new Date().toISOString(),
    issueCount: consumerIssues.length,
    events: records.map((e) => ({ eventId: e.eventId, title: e.title, consumer: e.consumer, issues: e.issues.filter((i) => i.domain === 'consumer') })),
  });
  writeJson('_phase4751_gold_standard_diff.json', goldDiff);
  writeJson('_phase4751_quality_scores.json', {
    generatedAt: new Date().toISOString(),
    referenceScores: referenceRecord.scores,
    rankings: records.map((e, index) => ({
      rank: index + 1,
      eventId: e.eventId,
      title: e.title,
      scores: e.scores,
      meetsReference: e.meetsReference,
      representative: e.representativeLabels,
    })),
    worst25: worst25.map((e, index) => ({ rank: index + 1, eventId: e.eventId, title: e.title, scores: e.scores })),
  });
  writeJson('_phase4751_repairability.json', repairability);

  console.log(JSON.stringify(summary, null, 2));
}

async function runReport(): Promise<void> {
  const global = JSON.parse(readFileSync(join(OUT, '_phase4751_global_truth.json'), 'utf8')) as {
    summary: Record<string, unknown>;
  };
  const s = global.summary;

  const lines = [
    '# Phase 4.7.5.1 — Global Production Truth Audit',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '**READ ONLY — no production mutations.**',
    '',
    '## Summary',
    '',
    `- Published events: **${s.totalPublished}**`,
    `- Reference: Bootshaus on a Ship Vol. III (\`${REFERENCE_EVENT_ID}\`)`,
    `- Events matching reference quality: **${s.meetsReferenceCount}** (${s.meetsReferencePercent}%)`,
    `- Ticket issues: **${s.ticketIssueCount}**`,
    `- Wrong ticket destinations: **${s.wrongDestinations}**`,
    `- Missing prices: **${s.missingPrices}**`,
    `- Missing lineups: **${s.missingLineups}**`,
    `- Missing badges: **${s.missingBadges}**`,
    `- Wrong venues: **${s.wrongVenues}**`,
    `- Media issues: **${s.mediaIssueCount}**`,
    '',
    '## Phase 4.8 readiness',
    '',
    `**Ready:** ${(s.phase48Readiness as { phase48Ready: boolean }).phase48Ready ? 'YES' : 'NO'}`,
    '',
    '### Remaining work before Connector SDK',
    '',
    ...((s.phase48Readiness as { remainingWork: string[] }).remainingWork.map((w) => `- ${w}`)),
    '',
    '## Artifacts',
    '',
    '- `docs/real-data/_phase4751_global_truth.json`',
    '- `docs/real-data/_phase4751_ticket_truth.json`',
    '- `docs/real-data/_phase4751_lineup_truth.json`',
    '- `docs/real-data/_phase4751_badge_truth.json`',
    '- `docs/real-data/_phase4751_venue_truth.json`',
    '- `docs/real-data/_phase4751_media_truth.json`',
    '- `docs/real-data/_phase4751_consumer_truth.json`',
    '- `docs/real-data/_phase4751_gold_standard_diff.json`',
    '- `docs/real-data/_phase4751_quality_scores.json`',
    '- `docs/real-data/_phase4751_repairability.json`',
  ];

  writeFileSync(REPORT, lines.join('\n'));
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'full';
  switch (command) {
    case 'audit':
      await runAudit();
      break;
    case 'report':
      await runReport();
      break;
    case 'full':
      await runAudit();
      await runReport();
      break;
    default:
      console.error('Usage: audit | report | full');
      process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
