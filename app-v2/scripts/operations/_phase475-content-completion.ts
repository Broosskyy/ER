/**
 * Phase 4.7.5 — Content completion and canonical quality finalization.
 *
 * Usage:
 *   npx tsx scripts/operations/_phase475-content-completion.ts <command>
 *
 * Commands:
 *   audit | preflight | backup | repair-lineups | repair-flyers | repair-artists
 *   verify-gallery | verify-consumer | audit-after | report | full
 */
import './bootstrap-ops-supabase';

process.env.EXPO_PUBLIC_GENERIC_SOURCE_FIELD_TRUST_MERGE = 'true';
process.env.EXPO_PUBLIC_USE_SUPABASE = 'true';

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapEventRowToAdminRecord, type EventRow } from '@/data/mappers/event-mapper';
import type { AdminEventRecord } from '@/data/types/records';
import { hashFlyerImageContent } from '@/features/aggregation/connectors/framework/detail-extraction/flyer-lineup-enrichment';
import { extractFlyerTextWithProviders } from '@/features/aggregation/connectors/framework/detail-extraction/flyer-ocr-provider';
import { classifyStructuredFlyerEvidence } from '@/features/aggregation/connectors/framework/detail-extraction/structured-flyer-evidence';
import { isCollapsedLineupArtistName } from '@/features/aggregation/domain/lineup-billing-parser';
import { readCanonicalTicket } from '@/features/events/domain/canonical-ticket-read';
import { projectCanonicalEventFields } from '@/features/events/formatting/canonical-event-projection';
import { buildConsumerGalleryImageUrls } from '@/features/events/formatting/consumer-gallery-projection';
import { mapCanonicalAvailabilityToTicketBadge } from '@/features/events/formatting/ticket-badge-projection';
import { resolveArtistSpellingConflict } from '@/features/aggregation/domain/artist-identity-evidence';
import { isSuspiciousArtistName } from '@/features/aggregation/audit/lineup-audit-signals';
import { readCanonicalLineup } from '@/features/events/domain/canonical-lineup-read';
import type { ResolvedCanonicalLineupEntry, BillingRelation } from '@/features/aggregation/domain/canonical-lineup-entry';
import { invalidateConsumerEventCaches } from '@/features/events/formatting/consumer-cache-invalidation';
import { getEffectiveCandidate } from '@/features/import/admin/import-utils';
import { attachFlyerLineupEvidenceToRecord } from '@/features/import/services/flyer-evidence-metadata';
import { extractPrioritizedLineupEntries } from '@/features/import/services/import-structured-lineup-from-record';
import { pickBestImportRecordForLineupRepair } from '@/features/import/services/lineup-projection-integrity';
import type { ImportRecord } from '@/features/import/models/types';
import { opsClient } from './ops-supabase-rows';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'docs/real-data');
const REPORT = join(ROOT, 'docs/PHASE_475_CONTENT_COMPLETION_REPORT.md');

const REFERENCE_EVENT_ID = 'evt-1785339420043-obhyeev';

const VENUE_REPRESENTATIVE_PATTERNS = [
  { label: 'Mallorca Events', pattern: /mallorca/i },
  { label: 'Ship Events', pattern: /bootshaus\s+on\s+a\s+ship/i },
  { label: 'External Bootshaus Events', pattern: /122\s+pres\./i },
  { label: 'Festival Events', pattern: /sommerfest|festival|open\s+air/i },
] as const;

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

async function loadStructuredEntries(eventId: string) {
  const { data } = await opsClient()
    .from('event_lineup_entries')
    .select(
      'id, sort_order, billing_relation, stage, start_time, end_time, running_order, confidence, provenance, event_lineup_entry_artists(artist_id, sort_order, artists(name))',
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

type RepairRun = {
  command: string;
  pass: number;
  generatedAt: string;
  mutations: number;
  events: unknown[];
};

let beforeSnapshot: Record<string, unknown> | null = null;

function writeJson(name: string, data: unknown): void {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, name), JSON.stringify(data, null, 2));
}

function hashValue(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value ?? null)).digest('hex').slice(0, 16);
}

async function loadPublishedEvents(): Promise<AdminEventRecord[]> {
  const { data, error } = await opsClient().from('events').select('*').eq('status', 'published');
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => mapEventRowToAdminRecord(row as EventRow));
}

async function loadCompatibilityArtists(eventId: string) {
  const { data } = await opsClient()
    .from('event_artists')
    .select('artists(name)')
    .eq('event_id', eventId)
    .order('sort_order');
  return (data ?? [])
    .map((row) => (row.artists as { name?: string } | null)?.name)
    .filter((name): name is string => Boolean(name));
}

async function loadImportRecordsForEvent(eventId: string): Promise<ImportRecord[]> {
  const { data } = await opsClient()
    .from('import_records')
    .select('*')
    .eq('canonical_event_id', eventId)
    .order('updated_at', { ascending: false });
  return (data ?? []) as ImportRecord[];
}

function ticketFingerprint(event: AdminEventRecord) {
  return {
    ticketUrl: event.ticketUrl ?? '',
    websiteUrl: event.websiteUrl ?? '',
    priceText: event.priceText ?? '',
    ticketStatus: event.ticketStatus ?? '',
    ticketPhasesHash: hashValue(event.ticketPhases),
  };
}

function forbiddenFingerprint(event: AdminEventRecord) {
  return {
    descriptionHash: hashValue(event.description),
    genreLabelsHash: hashValue(event.genreLabels),
    venueId: event.venueId ?? '',
    organizerId: event.organizerId ?? '',
    imageUrl: event.imageUrl ?? '',
    flyerUrl: event.flyerUrl ?? '',
    sourceId: event.sourceId ?? '',
    eventAttributesHash: hashValue(event.eventAttributes),
    ownershipHash: hashValue({ sourceId: event.sourceId, organizerId: event.organizerId }),
  };
}

function assessLineupCompleteness(
  structuredCount: number,
  compatibilityNames: string[],
): { complete: boolean; reason: string; collapsed: boolean } {
  const collapsed = compatibilityNames.some((name) => isCollapsedLineupArtistName(name));
  if (structuredCount > 0 && !collapsed) {
    return { complete: true, reason: 'structured_lineup_present', collapsed: false };
  }
  if (structuredCount > 0 && collapsed) {
    return { complete: false, reason: 'structured_present_but_legacy_collapsed', collapsed: true };
  }
  if (compatibilityNames.length === 1 && !collapsed) {
    return { complete: true, reason: 'single_artist_intentional', collapsed: false };
  }
  if (compatibilityNames.length > 0 && !collapsed) {
    return { complete: false, reason: 'compatibility_only_no_structured', collapsed: false };
  }
  return { complete: false, reason: 'no_lineup', collapsed };
}

function referenceQualityScore(input: {
  structuredCount: number;
  hasGallery: boolean;
  hasPrice: boolean;
  hasBadge: boolean;
  hasTicketUrl: boolean;
  hasVenue: boolean;
  collapsed: boolean;
}): number {
  let score = 0;
  if (input.structuredCount > 0) score += 30;
  if (input.hasGallery) score += 15;
  if (input.hasPrice) score += 20;
  if (input.hasBadge) score += 15;
  if (input.hasTicketUrl) score += 10;
  if (input.hasVenue) score += 10;
  if (!input.collapsed) score += 10;
  return score;
}

async function auditFlyers(events: AdminEventRecord[]): Promise<void> {
  const reports = [];
  for (const event of events) {
    const imageUrl = event.flyerUrl ?? event.imageUrl ?? '';
    const records = await loadImportRecordsForEvent(event.id);
    const record = records[0];
    const candidate = record ? getEffectiveCandidate(record) : undefined;
    const ocr = await extractFlyerTextWithProviders({
      eventId: event.id,
      title: event.title,
      imageUrl,
      description: event.description,
      importArtistNames: candidate?.artistNames,
    });
    const evidence = classifyStructuredFlyerEvidence({
      eventId: event.id,
      imageUrl,
      ocr,
      eventTitle: event.title,
      venueName: event.venueName,
      organizerName: event.organizerName,
    });
    reports.push({
      eventId: event.id,
      title: event.title,
      imageUrl,
      flyerUrl: event.flyerUrl,
      galleryUrls: buildConsumerGalleryImageUrls({
        flyerUrl: event.flyerUrl,
        imageUrl: event.imageUrl,
      }),
      ocr,
      evidence,
    });
  }

  writeJson('_phase475_flyer_completion.json', {
    generatedAt: new Date().toISOString(),
    totalPublished: events.length,
    ocrCandidates: reports.filter((row) => row.imageUrl).length,
    textExtracted: reports.filter((row) => row.ocr.status === 'text_extracted').length,
    pendingExternal: reports.filter((row) => row.ocr.status === 'pending_external').length,
    autoPublishEligible: reports.filter((row) => row.evidence.reviewDecision === 'auto_publish').length,
    reviewRequired: reports.filter((row) => row.evidence.reviewDecision === 'review_required').length,
    events: reports,
  });
}

async function auditLineups(events: AdminEventRecord[]): Promise<void> {
  const reports = [];
  let complete = 0;
  let incomplete = 0;

  for (const event of events) {
    const structured = await loadStructuredEntries(event.id);
    const compatibility = await loadCompatibilityArtists(event.id);
    const assessment = assessLineupCompleteness(structured.length, compatibility);
    if (assessment.complete) {
      complete += 1;
    } else {
      incomplete += 1;
    }

    const records = await loadImportRecordsForEvent(event.id);
    const prioritized = records[0] ? extractPrioritizedLineupEntries(records[0]) : undefined;

    reports.push({
      eventId: event.id,
      title: event.title,
      structuredEntryCount: structured.length,
      compatibilityArtistCount: compatibility.length,
      billingRelations: structured
        .map((entry) => entry.billingRelation)
        .filter((value): value is string => Boolean(value)),
      collapsedLegacy: assessment.collapsed,
      complete: assessment.complete,
      reason: assessment.reason,
      importLineupSource: prioritized?.source,
      importLineupCompleteness: prioritized?.completeness,
      importEntryCount: prioritized?.entries.length ?? 0,
      structuredEntries: structured,
    });
  }

  writeJson('_phase475_lineup_completion.json', {
    generatedAt: new Date().toISOString(),
    complete,
    incomplete,
    total: events.length,
    referenceEventId: REFERENCE_EVENT_ID,
    events: reports,
  });
}

async function auditArtistIdentity(events: AdminEventRecord[]): Promise<void> {
  const conflicts = [];
  const { data: artists } = await opsClient()
    .from('artists')
    .select('id, name, lineup_legacy_artifact, verification_status');
  const artistRows = artists ?? [];
  const publishedEventIds = new Set(events.map((event) => event.id));

  const { data: eventArtistRows } = await opsClient()
    .from('event_artists')
    .select('event_id, artist_id, artists(id, name, lineup_legacy_artifact)')
    .in('event_id', [...publishedEventIds]);

  const linkedArtistIds = new Set<string>();
  for (const row of eventArtistRows ?? []) {
    const artist = row.artists as {
      id?: string;
      name?: string;
      lineup_legacy_artifact?: boolean;
    } | null;
    if (!artist?.id) {
      continue;
    }
    linkedArtistIds.add(artist.id);

    if (artist.lineup_legacy_artifact) {
      conflicts.push({
        eventId: row.event_id,
        kind: 'legacy_lineup_artifact',
        artistId: artist.id,
        value: artist.name,
        action: 'review_required',
        reason: 'legacy_collapsed_artist_entity',
      });
    } else if (artist.name && isSuspiciousArtistName(artist.name)) {
      conflicts.push({
        eventId: row.event_id,
        kind: 'suspicious_artist_entity',
        artistId: artist.id,
        value: artist.name,
        action: 'review_required',
        reason: 'invalid_artist_signals_detected',
      });
    }
  }

  for (const event of events) {
    const names = await loadCompatibilityArtists(event.id);
    for (const name of names) {
      if (isCollapsedLineupArtistName(name)) {
        conflicts.push({
          eventId: event.id,
          title: event.title,
          kind: 'collapsed_lineup_identity',
          value: name,
          action: 'review_required',
          reason: 'legacy_collapsed_artist_blob',
        });
      }
    }
  }

  for (let index = 0; index < artistRows.length; index += 1) {
    for (let inner = index + 1; inner < artistRows.length; inner += 1) {
      const left = artistRows[index]!;
      const right = artistRows[inner]!;
      if (!linkedArtistIds.has(left.id) || !linkedArtistIds.has(right.id)) {
        continue;
      }
      const resolution = resolveArtistSpellingConflict([
        { spelling: left.name, source: 'verified_canonical', confidence: 1 },
        { spelling: right.name, source: 'verified_canonical', confidence: 1 },
      ]);
      if (
        resolution.action === 'review' &&
        resolution.reason !== 'no_candidates' &&
        left.name.toLowerCase() !== right.name.toLowerCase()
      ) {
        const normalizedLeft = left.name.toLowerCase().replace(/\s+/g, '');
        const normalizedRight = right.name.toLowerCase().replace(/\s+/g, '');
        if (normalizedLeft === normalizedRight) {
          conflicts.push({
            kind: 'duplicate_spelling_variant',
            artistIds: [left.id, right.id],
            left: left.name,
            right: right.name,
            action: 'review_required',
            reason: 'spelling_variant_not_auto_merged',
          });
        }
      }
    }
  }

  writeJson('_phase475_artist_identity.json', {
    generatedAt: new Date().toISOString(),
    conflictCount: conflicts.length,
    collapsedLineupConflicts: conflicts.filter((row) => row.kind === 'collapsed_lineup_identity').length,
    legacyArtifactConflicts: conflicts.filter((row) => row.kind === 'legacy_lineup_artifact').length,
    suspiciousArtistConflicts: conflicts.filter((row) => row.kind === 'suspicious_artist_entity').length,
    duplicateVariants: conflicts.filter((row) => row.kind === 'duplicate_spelling_variant').length,
    conflicts,
  });
}

async function auditVenueQuality(events: AdminEventRecord[]): Promise<void> {
  const reports = [];

  for (const rep of VENUE_REPRESENTATIVE_PATTERNS) {
    const matched = events.filter((event) => rep.pattern.test(event.title));
    for (const event of matched) {
      const records = await loadImportRecordsForEvent(event.id);
      const candidate = records[0] ? getEffectiveCandidate(records[0]) : undefined;
      const explicitVenueFromImport = candidate?.venueName?.trim() || undefined;
      const promoterInferredVenue =
        !explicitVenueFromImport &&
        Boolean(event.organizerName) &&
        event.venueName?.toLowerCase() === event.organizerName?.toLowerCase();
      const venueMismatch =
        explicitVenueFromImport &&
        event.venueName &&
        explicitVenueFromImport.toLowerCase() !== event.venueName.toLowerCase();

      reports.push({
        representative: rep.label,
        eventId: event.id,
        title: event.title,
        canonicalVenue: event.venueName ?? '',
        canonicalVenueCity: event.venueCity ?? '',
        organizerName: event.organizerName ?? '',
        explicitVenueFromImport: explicitVenueFromImport ?? null,
        promoterInferredVenue,
        venueMismatch,
        action: venueMismatch
          ? 'review_required_stronger_explicit_evidence_only'
          : promoterInferredVenue
            ? 'review_promoter_venue_inference'
            : 'verified',
      });
    }
  }

  writeJson('_phase475_venue_verification.json', {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    note: 'venue_relationships_not_mutated_without_stronger_explicit_evidence',
    representativeCount: reports.length,
    promoterInferred: reports.filter((row) => row.promoterInferredVenue).length,
    explicitMismatch: reports.filter((row) => row.venueMismatch).length,
    events: reports,
  });
}

async function auditCanonicalQuality(events: AdminEventRecord[]): Promise<unknown> {
  const traces = [];
  const reference = events.find((event) => event.id === REFERENCE_EVENT_ID);
  let referenceScore = 0;
  if (reference) {
    const structured = await loadStructuredEntries(reference.id);
    const canonicalTicket = readCanonicalTicket({
      ticketUrl: reference.ticketUrl,
      websiteUrl: reference.websiteUrl,
      priceText: reference.priceText,
      ticketStatus: reference.ticketStatus,
      ticketPhases: reference.ticketPhases,
    });
    const badge = mapCanonicalAvailabilityToTicketBadge(
      canonicalTicket.availability,
      canonicalTicket.ticketStatus,
    );
    referenceScore = referenceQualityScore({
      structuredCount: structured.length,
      hasGallery: buildConsumerGalleryImageUrls({
        flyerUrl: reference.flyerUrl,
        imageUrl: reference.imageUrl,
      }).length > 0,
      hasPrice: Boolean(canonicalTicket.priceText),
      hasBadge: Boolean(badge),
      hasTicketUrl: Boolean(reference.ticketUrl),
      hasVenue: Boolean(reference.venueName),
      collapsed: false,
    });
  }

  for (const event of events) {
    const stages: Array<{ stage: string; ok: boolean; detail?: unknown }> = [];
    let firstFailure: string | undefined;

    const mark = (stage: string, ok: boolean, detail?: unknown) => {
      stages.push({ stage, ok, detail });
      if (!ok && !firstFailure) {
        firstFailure = stage;
      }
    };

    const structured = await loadStructuredEntries(event.id);
    const compatibility = await loadCompatibilityArtists(event.id);
    const lineup = readCanonicalLineup({
      structuredEntries: toResolvedEntries(structured),
      eventTitle: event.title,
    });
    const artistNames =
      lineup.artistNames.length > 0
        ? lineup.artistNames
        : compatibility.filter((name) => !isCollapsedLineupArtistName(name));

    mark('canonical_lineup_reader', lineup.state === 'structured' || artistNames.length > 0, {
      state: lineup.state,
      artistCount: artistNames.length,
    });

    const canonicalTicket = readCanonicalTicket({
      ticketUrl: event.ticketUrl,
      websiteUrl: event.websiteUrl,
      priceText: event.priceText,
      ticketStatus: event.ticketStatus,
      ticketPhases: event.ticketPhases,
    });
    mark('canonical_ticket_reader', Boolean(canonicalTicket.publicCtaUrl || event.websiteUrl), {
      priceText: canonicalTicket.priceText,
      availability: canonicalTicket.availability,
    });

    const gallery = buildConsumerGalleryImageUrls({
      flyerUrl: event.flyerUrl,
      imageUrl: event.imageUrl,
    });
    mark('gallery_projection', gallery.length > 0, { count: gallery.length });

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
      imageUrl: event.imageUrl,
      imageUrls: gallery,
    });
    mark('api_projection', Boolean(canonical.title && canonical.venue), {
      displayPriceText: canonical.displayPriceText,
    });

    const assessment = assessLineupCompleteness(structured.length, compatibility);
    const score = referenceQualityScore({
      structuredCount: structured.length,
      hasGallery: gallery.length > 0,
      hasPrice: Boolean(canonical.displayPriceText),
      hasBadge: Boolean(
        mapCanonicalAvailabilityToTicketBadge(canonicalTicket.availability, canonicalTicket.ticketStatus),
      ),
      hasTicketUrl: Boolean(event.ticketUrl),
      hasVenue: Boolean(event.venueName),
      collapsed: assessment.collapsed,
    });

    traces.push({
      eventId: event.id,
      title: event.title,
      qualityScore: score,
      referenceScore,
      meetsReference: score >= referenceScore,
      firstFailureStage: firstFailure,
      stages,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    referenceEventId: REFERENCE_EVENT_ID,
    referenceScore,
    meetsReferenceCount: traces.filter((row) => row.meetsReference).length,
    traces,
  };
}

async function runAudit(): Promise<void> {
  const events = await loadPublishedEvents();
  await auditFlyers(events);
  await auditLineups(events);
  await auditArtistIdentity(events);
  await auditVenueQuality(events);
  const quality = await auditCanonicalQuality(events);

  const lineupAudit = JSON.parse(
    readFileSync(join(OUT, '_phase475_lineup_completion.json'), 'utf8'),
  ) as { complete: number; incomplete: number };
  const flyerAudit = JSON.parse(
    readFileSync(join(OUT, '_phase475_flyer_completion.json'), 'utf8'),
  ) as { ocrCandidates: number; autoPublishEligible: number };

  beforeSnapshot = {
    generatedAt: new Date().toISOString(),
    publishedEvents: events.length,
    lineupComplete: lineupAudit.complete,
    lineupIncomplete: lineupAudit.incomplete,
    flyerCandidates: flyerAudit.ocrCandidates,
    autoPublishEligible: flyerAudit.autoPublishEligible,
    meetsReference: (quality as { meetsReferenceCount: number }).meetsReferenceCount,
  };
  writeJson('_phase475_before_after.json', { before: beforeSnapshot, quality });
}

async function runBackup(): Promise<void> {
  const events = await loadPublishedEvents();
  const backup = [];
  for (const event of events) {
    backup.push({
      eventId: event.id,
      title: event.title,
      structuredLineup: await loadStructuredEntries(event.id),
      compatibilityArtists: await loadCompatibilityArtists(event.id),
      ticketFingerprint: ticketFingerprint(event),
      forbiddenFingerprint: forbiddenFingerprint(event),
      flyerUrl: event.flyerUrl,
      imageUrl: event.imageUrl,
      eventAttributes: event.eventAttributes,
    });
  }
  writeJson('_phase475_repair_backup.json', { generatedAt: new Date().toISOString(), events: backup });
}

async function runPreflight(): Promise<void> {
  const lineup = existsSync(join(OUT, '_phase475_lineup_completion.json'))
    ? (JSON.parse(readFileSync(join(OUT, '_phase475_lineup_completion.json'), 'utf8')) as {
        events: Array<{ eventId: string; complete: boolean; importEntryCount: number }>;
      })
    : { events: [] };
  const flyers = existsSync(join(OUT, '_phase475_flyer_completion.json'))
    ? (JSON.parse(readFileSync(join(OUT, '_phase475_flyer_completion.json'), 'utf8')) as {
        events: Array<{ eventId: string; evidence: { reviewDecision: string } }>;
      })
    : { events: [] };

  const planned = [
    ...lineup.events
      .filter((row) => !row.complete && row.importEntryCount > 0)
      .map((row) => ({ eventId: row.eventId, domain: 'lineup', action: 'repair_lineup_projection' })),
    ...flyers.events
      .filter((row) => row.evidence.reviewDecision === 'auto_publish')
      .map((row) => ({ eventId: row.eventId, domain: 'flyer', action: 'attach_flyer_evidence' })),
  ];

  writeJson('_phase475_preflight.json', {
    generatedAt: new Date().toISOString(),
    plannedMutations: planned,
    mutationCount: planned.length,
  });
  console.log(`Preflight: ${planned.length} planned mutations`);
}

async function loadRegistry() {
  const { resetDatasourceBundle } = await import('@/data/datasources/supabase/supabase-datasource');
  resetDatasourceBundle();
  const registry = await import('@/data/repositories/registry');
  const entityBootstrap = await import('@/features/entity-resolution/entity-alias-store-bootstrap');
  return {
    importRecordRepository: registry.importRecordRepository,
    importEventPublishService: registry.importEventPublishService,
    adminArtistRepository: registry.adminArtistRepository,
    initializeEntityAliasStore: entityBootstrap.initializeEntityAliasStore,
    flushEntityAliasStore: entityBootstrap.flushEntityAliasStore,
  };
}

async function repairLineups(pass: number): Promise<RepairRun> {
  const run: RepairRun = {
    command: 'repair-lineups',
    pass,
    generatedAt: new Date().toISOString(),
    mutations: 0,
    events: [],
  };

  const {
    importRecordRepository,
    importEventPublishService,
    adminArtistRepository,
    initializeEntityAliasStore,
    flushEntityAliasStore,
  } = await loadRegistry();
  await initializeEntityAliasStore();
  const artists = await adminArtistRepository.getAll();
  const artistsById = new Map(artists.map((artist) => [artist.id, artist] as const));

  const lineupAudit = existsSync(join(OUT, '_phase475_lineup_completion.json'))
    ? (JSON.parse(readFileSync(join(OUT, '_phase475_lineup_completion.json'), 'utf8')) as {
        events: Array<{ eventId: string; complete: boolean }>;
      })
    : { events: [] };

  for (const row of lineupAudit.events.filter((event) => !event.complete)) {
    const { data } = await opsClient().from('events').select('*').eq('id', row.eventId).maybeSingle();
    if (!data) {
      continue;
    }
    const event = mapEventRowToAdminRecord(data as EventRow);
    const beforeTicket = ticketFingerprint(event);
    const beforeForbidden = forbiddenFingerprint(event);

    const records = await loadImportRecordsForEvent(event.id);
    if (records.length === 0) {
      run.events.push({ eventId: event.id, skipped: 'no_import_records' });
      continue;
    }

    const existingIds =
      (await opsClient().from('event_artists').select('artist_id').eq('event_id', event.id)).data?.map(
        (artistRow) => artistRow.artist_id,
      ) ?? [];
    const picked = pickBestImportRecordForLineupRepair(records, existingIds, artistsById);
    if (!picked?.record) {
      run.events.push({ eventId: event.id, skipped: 'no_repair_candidate' });
      continue;
    }

    const prioritized = extractPrioritizedLineupEntries(picked.record);
    if (prioritized.entries.length === 0) {
      run.events.push({ eventId: event.id, skipped: 'no_explicit_lineup_entries' });
      continue;
    }

    const beforeStructured = await loadStructuredEntries(event.id);
    const repair = await importEventPublishService.repairLineupProjection(picked.record, event.id);
    const afterStructured = await loadStructuredEntries(event.id);

    const afterRow = (await opsClient().from('events').select('*').eq('id', event.id).single()).data as EventRow;
    const afterEvent = mapEventRowToAdminRecord(afterRow);
    if (JSON.stringify(beforeTicket) !== JSON.stringify(ticketFingerprint(afterEvent))) {
      throw new Error(`Ticket domain mutation detected: ${event.id}`);
    }
    if (JSON.stringify(beforeForbidden) !== JSON.stringify(forbiddenFingerprint(afterEvent))) {
      throw new Error(`Forbidden domain mutation detected: ${event.id}`);
    }

    const changed =
      repair.wroteLineup ||
      JSON.stringify(beforeStructured) !== JSON.stringify(afterStructured);
    if (changed) {
      run.mutations += 1;
    }
    run.events.push({
      eventId: event.id,
      title: event.title,
      wroteLineup: repair.wroteLineup,
      beforeCount: beforeStructured.length,
      afterCount: afterStructured.length,
      importSource: prioritized.source,
    });
  }

  await flushEntityAliasStore();
  appendRepairRun(run);
  return run;
}

async function repairFlyers(pass: number): Promise<RepairRun> {
  const run: RepairRun = {
    command: 'repair-flyers',
    pass,
    generatedAt: new Date().toISOString(),
    mutations: 0,
    events: [],
  };

  const { importRecordRepository } = await loadRegistry();
  const flyerAudit = existsSync(join(OUT, '_phase475_flyer_completion.json'))
    ? (JSON.parse(readFileSync(join(OUT, '_phase475_flyer_completion.json'), 'utf8')) as {
        events: Array<{
          eventId: string;
          imageUrl: string;
          ocr: { rawText?: string; confidence: number };
          evidence: { reviewDecision: string; overallConfidence: number };
        }>;
      })
    : { events: [] };

  for (const row of flyerAudit.events.filter(
    (event) => event.evidence.reviewDecision === 'auto_publish' && event.ocr.rawText,
  )) {
    const records = await loadImportRecordsForEvent(row.eventId);
    if (records.length === 0) {
      run.events.push({ eventId: row.eventId, skipped: 'no_import_records' });
      continue;
    }
    const record = records[0]!;
    const beforeForbidden = forbiddenFingerprint(
      mapEventRowToAdminRecord(
        (await opsClient().from('events').select('*').eq('id', row.eventId).single()).data as EventRow,
      ),
    );

    const contentHash = hashFlyerImageContent({
      imageUrl: row.imageUrl,
      rawText: row.ocr.rawText,
    });
    const updated = attachFlyerLineupEvidenceToRecord(record, {
      imageUrl: row.imageUrl,
      rawText: row.ocr.rawText!,
      contentHash,
      confidence: row.evidence.overallConfidence,
      autoPublishAllowed: true,
      reviewState: 'accepted',
    });
    await importRecordRepository.update(updated);

    const afterEvent = mapEventRowToAdminRecord(
      (await opsClient().from('events').select('*').eq('id', row.eventId).single()).data as EventRow,
    );
    if (JSON.stringify(beforeForbidden) !== JSON.stringify(forbiddenFingerprint(afterEvent))) {
      throw new Error(`Forbidden domain mutation on flyer repair: ${row.eventId}`);
    }

    run.mutations += 1;
    run.events.push({
      eventId: row.eventId,
      confidence: row.evidence.overallConfidence,
      rawTextLines: row.ocr.rawText!.split('\n').length,
    });
  }

  appendRepairRun(run);
  return run;
}

async function repairArtists(pass: number): Promise<RepairRun> {
  const run: RepairRun = {
    command: 'repair-artists',
    pass,
    generatedAt: new Date().toISOString(),
    mutations: 0,
    events: [],
  };

  const identityAudit = existsSync(join(OUT, '_phase475_artist_identity.json'))
    ? (JSON.parse(readFileSync(join(OUT, '_phase475_artist_identity.json'), 'utf8')) as {
        conflicts: Array<{ kind: string; action: string }>;
      })
    : { conflicts: [] };

  run.events.push({
    reviewed: identityAudit.conflicts.length,
    applied: 0,
    note: 'no_unsafe_auto_merge_without_explicit_evidence',
  });
  appendRepairRun(run);
  return run;
}

function appendRepairRun(run: RepairRun): void {
  const path = join(OUT, '_phase475_repair_runs.json');
  const existing = existsSync(path)
    ? (JSON.parse(readFileSync(path, 'utf8')) as { runs: RepairRun[] }).runs
    : [];
  existing.push(run);
  writeJson('_phase475_repair_runs.json', { runs: existing });
}

async function verifyGallery(): Promise<void> {
  const events = await loadPublishedEvents();
  const validation = events.map((event) => {
    const galleryUrls = buildConsumerGalleryImageUrls({
      flyerUrl: event.flyerUrl,
      imageUrl: event.imageUrl,
    });
    return {
      eventId: event.id,
      title: event.title,
      flyerUrl: event.flyerUrl,
      imageUrl: event.imageUrl,
      galleryImageUrls: galleryUrls,
      galleryActive: galleryUrls.length > 0,
      flyerDistinctFromHero: Boolean(
        event.flyerUrl && event.imageUrl && event.flyerUrl !== event.imageUrl,
      ),
      viewerCapabilities: {
        fullscreen: true,
        swipe: true,
        pinchZoom: true,
        doubleTapZoom: true,
        share: true,
        save: true,
        download: true,
      },
    };
  });

  writeJson('_phase475_gallery_validation.json', {
    generatedAt: new Date().toISOString(),
    projectionOnly: true,
    component: 'FlyerGalleryViewer',
    withGallery: validation.filter((row) => row.galleryActive).length,
    withDistinctFlyer: validation.filter((row) => row.flyerDistinctFromHero).length,
    events: validation,
  });
}

async function verifyConsumer(): Promise<void> {
  const events = await loadPublishedEvents();
  const reference = events.find((event) => event.id === REFERENCE_EVENT_ID);
  const issues: Array<{ eventId: string; issue: string }> = [];
  const reports = [];

  for (const event of events) {
    const structured = await loadStructuredEntries(event.id);
    const compatibility = await loadCompatibilityArtists(event.id);
    const lineup = readCanonicalLineup({
      structuredEntries: toResolvedEntries(structured),
      eventTitle: event.title,
    });
    const artistNames =
      lineup.artistNames.length > 0
        ? lineup.artistNames
        : compatibility.filter((name) => !isCollapsedLineupArtistName(name));

    const canonicalTicket = readCanonicalTicket({
      ticketUrl: event.ticketUrl,
      websiteUrl: event.websiteUrl,
      priceText: event.priceText,
      ticketStatus: event.ticketStatus,
      ticketPhases: event.ticketPhases,
    });

    const galleryUrls = buildConsumerGalleryImageUrls({
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
      imageUrl: event.imageUrl,
      imageUrls: galleryUrls,
    });
    const ticketBadge = mapCanonicalAvailabilityToTicketBadge(
      canonicalTicket.availability,
      canonicalTicket.ticketStatus,
    );

    if (artistNames.length > 0 && canonical.knownArtistNames.length === 0) {
      issues.push({ eventId: event.id, issue: 'lineup_not_projected_to_display' });
    }
    if (canonicalTicket.priceText && !canonical.displayPriceText) {
      issues.push({ eventId: event.id, issue: 'price_not_projected_to_display' });
    }

    reports.push({
      eventId: event.id,
      title: event.title,
      displayArtists: canonical.knownArtistNames,
      displayPriceText: canonical.displayPriceText,
      galleryCount: canonical.galleryImageUrls.length,
      ticketBadge,
      lineupState: lineup.state,
    });
  }

  writeJson('_phase475_consumer_validation.json', {
    generatedAt: new Date().toISOString(),
    referenceEventId: REFERENCE_EVENT_ID,
    referenceTitle: reference?.title,
    totalPublished: events.length,
    issues,
    events: reports,
  });
}

async function runAuditAfter(): Promise<void> {
  const events = await loadPublishedEvents();
  await auditLineups(events);
  await auditFlyers(events);
  await auditArtistIdentity(events);
  await auditVenueQuality(events);
  const quality = await auditCanonicalQuality(events);
  const lineupAudit = JSON.parse(
    readFileSync(join(OUT, '_phase475_lineup_completion.json'), 'utf8'),
  ) as { complete: number; incomplete: number };

  const priorBefore = beforeSnapshot;
  const existingBeforeAfter = existsSync(join(OUT, '_phase475_before_after.json'))
    ? (JSON.parse(readFileSync(join(OUT, '_phase475_before_after.json'), 'utf8')) as {
        before?: Record<string, unknown> | null;
      })
    : null;

  writeJson('_phase475_before_after.json', {
    before: priorBefore ?? existingBeforeAfter?.before ?? null,
    after: {
      generatedAt: new Date().toISOString(),
      lineupComplete: lineupAudit.complete,
      lineupIncomplete: lineupAudit.incomplete,
      meetsReference: (quality as { meetsReferenceCount: number }).meetsReferenceCount,
    },
    quality,
  });
}

async function runReport(): Promise<void> {
  const lineup = existsSync(join(OUT, '_phase475_lineup_completion.json'))
    ? JSON.parse(readFileSync(join(OUT, '_phase475_lineup_completion.json'), 'utf8'))
    : null;
  const flyer = existsSync(join(OUT, '_phase475_flyer_completion.json'))
    ? JSON.parse(readFileSync(join(OUT, '_phase475_flyer_completion.json'), 'utf8'))
    : null;
  const artists = existsSync(join(OUT, '_phase475_artist_identity.json'))
    ? JSON.parse(readFileSync(join(OUT, '_phase475_artist_identity.json'), 'utf8'))
    : null;
  const venue = existsSync(join(OUT, '_phase475_venue_verification.json'))
    ? JSON.parse(readFileSync(join(OUT, '_phase475_venue_verification.json'), 'utf8'))
    : null;
  const gallery = existsSync(join(OUT, '_phase475_gallery_validation.json'))
    ? JSON.parse(readFileSync(join(OUT, '_phase475_gallery_validation.json'), 'utf8'))
    : null;
  const consumer = existsSync(join(OUT, '_phase475_consumer_validation.json'))
    ? JSON.parse(readFileSync(join(OUT, '_phase475_consumer_validation.json'), 'utf8'))
    : null;
  const beforeAfter = existsSync(join(OUT, '_phase475_before_after.json'))
    ? JSON.parse(readFileSync(join(OUT, '_phase475_before_after.json'), 'utf8'))
    : null;
  const runs = existsSync(join(OUT, '_phase475_repair_runs.json'))
    ? JSON.parse(readFileSync(join(OUT, '_phase475_repair_runs.json'), 'utf8'))
    : { runs: [] };

  const lines = [
    '# Phase 4.7.5 — Content Completion Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Reference event',
    '',
    `- **Bootshaus on a Ship Vol. III** (\`${REFERENCE_EVENT_ID}\`)`,
    '',
    '## Workstream A — Flyer evidence',
    '',
    `- OCR candidates: **${flyer?.ocrCandidates ?? 'n/a'}**`,
    `- Text extracted (explicit sources): **${flyer?.textExtracted ?? 'n/a'}**`,
    `- Pending external OCR: **${flyer?.pendingExternal ?? 'n/a'}**`,
    `- Auto-publish eligible: **${flyer?.autoPublishEligible ?? 'n/a'}**`,
    `- Review required: **${flyer?.reviewRequired ?? 'n/a'}**`,
    '',
    '## Workstream B — Structured lineup',
    '',
    `- Complete: **${lineup?.complete ?? 'n/a'}**`,
    `- Incomplete: **${lineup?.incomplete ?? 'n/a'}**`,
    '',
    '## Workstream C — Artist identity',
    '',
    `- Conflicts flagged: **${artists?.conflictCount ?? 'n/a'}**`,
    `- Collapsed lineup blobs: **${artists?.collapsedLineupConflicts ?? 'n/a'}**`,
    '',
    '## Workstream D — Venue verification',
    '',
    `- Representative events audited: **${venue?.representativeCount ?? 'n/a'}**`,
    `- Promoter-inferred venue flags: **${venue?.promoterInferred ?? 'n/a'}**`,
    `- Explicit import mismatch flags: **${venue?.explicitMismatch ?? 'n/a'}**`,
    '',
    '## Workstream E — Gallery verification',
    '',
    `- Events with active gallery: **${gallery?.withGallery ?? 'n/a'}**`,
    `- Distinct flyer ≠ hero: **${gallery?.withDistinctFlyer ?? 'n/a'}**`,
    '',
    '## Workstream F — Consumer validation',
    '',
    `- Projection issues: **${consumer?.issues?.length ?? 'n/a'}**`,
  ];

  if (runs.runs?.length) {
    lines.push('', '## Repair runs', '');
    for (const run of runs.runs as RepairRun[]) {
      lines.push(`- ${run.command} pass ${run.pass}: **${run.mutations}** mutations`);
    }
  }

  lines.push(
    '',
    '## Before / after',
    '',
    '```json',
    JSON.stringify(beforeAfter, null, 2),
    '```',
    '',
    '## Artifacts',
    '',
    '- `docs/real-data/_phase475_lineup_completion.json`',
    '- `docs/real-data/_phase475_flyer_completion.json`',
    '- `docs/real-data/_phase475_artist_identity.json`',
    '- `docs/real-data/_phase475_gallery_validation.json`',
    '- `docs/real-data/_phase475_consumer_validation.json`',
    '- `docs/real-data/_phase475_before_after.json`',
  );

  writeFileSync(REPORT, lines.join('\n'));
}

async function main(): Promise<void> {
  const [command, passArg] = process.argv.slice(2);
  const pass = passArg?.startsWith('--pass=') ? Number.parseInt(passArg.split('=')[1] ?? '1', 10) : 1;

  switch (command) {
    case 'audit':
      await runAudit();
      break;
    case 'preflight':
      await runPreflight();
      break;
    case 'backup':
      await runBackup();
      break;
    case 'repair-lineups': {
      const run = await repairLineups(pass);
      await invalidateConsumerEventCaches();
      console.log(`repair-lineups pass ${pass}: ${run.mutations} mutations`);
      break;
    }
    case 'repair-flyers': {
      const run = await repairFlyers(pass);
      console.log(`repair-flyers pass ${pass}: ${run.mutations} mutations`);
      break;
    }
    case 'repair-artists': {
      const run = await repairArtists(pass);
      console.log(`repair-artists pass ${pass}: ${run.mutations} mutations`);
      break;
    }
    case 'verify-gallery':
      await verifyGallery();
      break;
    case 'verify-consumer':
      await verifyConsumer();
      break;
    case 'audit-after':
      await runAuditAfter();
      break;
    case 'report':
      await runReport();
      break;
    case 'full':
      await runAudit();
      await runBackup();
      await runPreflight();
      await repairLineups(1);
      await repairFlyers(1);
      await repairArtists(1);
      await invalidateConsumerEventCaches();
      await verifyGallery();
      await verifyConsumer();
      await repairLineups(2);
      await repairFlyers(2);
      await runAuditAfter();
      await runReport();
      break;
    default:
      console.error(
        'Usage: audit | preflight | backup | repair-lineups | repair-flyers | repair-artists | verify-gallery | verify-consumer | audit-after | report | full',
      );
      process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
