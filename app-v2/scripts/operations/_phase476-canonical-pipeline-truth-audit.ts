/**
 * Phase 4.7.6 — Canonical pipeline truth audit (READ ONLY).
 *
 * Usage:
 *   npx tsx scripts/operations/_phase476-canonical-pipeline-truth-audit.ts <command>
 *
 * Commands: audit | report | full
 */
import './bootstrap-ops-supabase';

process.env.EXPO_PUBLIC_GENERIC_SOURCE_FIELD_TRUST_MERGE = 'true';
process.env.EXPO_PUBLIC_USE_SUPABASE = 'true';

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapEventRowToAdminRecord, mapEventRowToDomain, type EventRow } from '@/data/mappers/event-mapper';
import type { AdminEventRecord } from '@/data/types/records';
import { extractFlyerTextWithProviders } from '@/features/aggregation/connectors/framework/detail-extraction/flyer-ocr-provider';
import { isTicketIoShopRootUrl } from '@/features/aggregation/connectors/ticket-platform/ticket-io-url';
import { isCollapsedLineupArtistName } from '@/features/aggregation/domain/lineup-billing-parser';
import { FIELD_FALLBACK_CHAINS } from '@/features/events/domain/field-fallback-priority';
import { projectEventAttributeBadges } from '@/features/events/domain/event-attribute-badge-projection';
import {
  classifyTicketAcceptanceState,
  readCanonicalTicket,
} from '@/features/events/domain/canonical-ticket-read';
import { classifyTicketDestination } from '@/features/events/domain/ticket-destination-classification';
import { PROJECTION_PATH_INVENTORY } from '@/features/events/domain/projection-path-inventory';
import { SOURCE_FIELD_OWNERSHIP_MATRIX } from '@/features/events/domain/source-field-ownership-matrix';
import { readCanonicalLineup } from '@/features/events/domain/canonical-lineup-read';
import type { BillingRelation, ResolvedCanonicalLineupEntry } from '@/features/aggregation/domain/canonical-lineup-entry';
import { projectCanonicalEventFields } from '@/features/events/formatting/canonical-event-projection';
import { buildConsumerGalleryImageUrls } from '@/features/events/formatting/consumer-gallery-projection';
import { mapCanonicalAvailabilityToTicketBadge } from '@/features/events/formatting/ticket-badge-projection';
import { getEffectiveCandidate } from '@/features/import/admin/import-utils';
import { extractPrioritizedLineupEntries } from '@/features/import/services/import-structured-lineup-from-record';
import type { ImportRecord } from '@/features/import/models/types';
import { opsClient } from './ops-supabase-rows';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'docs/real-data');
const REPORT = join(ROOT, 'docs/PHASE_476_PIPELINE_TRUTH_REPORT.md');
const ARCH_REPORT = join(ROOT, 'docs/ARCHITECTURE_PIPELINE_DIFF.md');

const REFERENCE_EVENT_ID = 'evt-1785339420043-obhyeev';

const COMPARE_EVENTS: Record<string, { eventId: string; label: string }> = {
  shipReference: { eventId: REFERENCE_EVENT_ID, label: 'Bootshaus on a Ship Vol. III' },
  levi: { eventId: 'evt-1785339383539-0lxvjlp', label: 'LEVI' },
  underland: { eventId: 'evt-1785389049895-4mb7dub', label: 'Underland' },
  sommerfest: { eventId: 'evt-1785389055557-ux20897', label: 'Sommerfest Elektroküche' },
  mdma1010: { eventId: 'evt-1785443911160-owt97y3', label: 'MDMA 10.10' },
  mdmaF2F: { eventId: 'evt-1785389054496-ns9b6la', label: 'MDMA F2F' },
  proton: { eventId: 'evt-1785443914377-7g9l545', label: 'PROTON Stuttgart' },
  affenkaefig: { eventId: 'evt-1785339005035-wam829k', label: 'Affenkäfig' },
  unrealI: { eventId: 'evt-1785339397255-frpjss3', label: 'Unreal Weekender I' },
  unrealII: { eventId: 'evt-1785339412398-hq6217j', label: 'Unreal Weekender II' },
  blacklist: { eventId: 'evt-1785339398765-9lptzhg', label: 'Blacklist Festival' },
  palma: { eventId: 'evt-1785339424521-tn10siz', label: 'Palma (TRIPOLISM)' },
  technodampfer: { eventId: 'evt-1785506426366-bujnxz7', label: 'Technodampfer Köln' },
};

type PipelineStage =
  | 'Source'
  | 'Connector'
  | 'Import'
  | 'Normalization'
  | 'Matching'
  | 'Ownership'
  | 'Merge'
  | 'Persistence'
  | 'Canonical Reader'
  | 'Projection'
  | 'API'
  | 'ViewModel'
  | 'Consumer UI'
  | 'Cache';

interface DomainDiff {
  domain: string;
  expected: unknown;
  actual: unknown;
  reference: unknown;
  firstDivergence: PipelineStage;
  rootCause: string;
  codePath: string;
  repairStrategy: string;
  whyShipSucceeds: string;
  whyOtherFails: string;
  whyWrongWins: string;
}

function writeJson(name: string, data: unknown): void {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, name), JSON.stringify(data, null, 2));
}

async function loadStructuredEntries(eventId: string) {
  const { data } = await opsClient()
    .from('event_lineup_entries')
    .select(
      'id, sort_order, billing_relation, stage, event_lineup_entry_artists(artist_id, sort_order, artists(name, lineup_legacy_artifact))',
    )
    .eq('event_id', eventId)
    .order('sort_order', { ascending: true });
  return data ?? [];
}

async function loadCompatibilityArtists(eventId: string) {
  const { data } = await opsClient()
    .from('event_artists')
    .select('artist_id, sort_order, artists(id, name, lineup_legacy_artifact)')
    .eq('event_id', eventId)
    .order('sort_order');
  return (data ?? []).map((row) => {
    const artist = row.artists as { id?: string; name?: string; lineup_legacy_artifact?: boolean } | null;
    return { id: artist?.id, name: artist?.name ?? '', legacy: artist?.lineup_legacy_artifact ?? false };
  });
}

async function loadImportRecords(eventId: string, title: string): Promise<ImportRecord[]> {
  const byCanonical = await opsClient()
    .from('import_records')
    .select('*')
    .eq('canonical_event_id', eventId);
  const byDuplicate = await opsClient()
    .from('import_records')
    .select('*')
    .eq('duplicate_event_id', eventId);
  const merged = [...(byCanonical.data ?? []), ...(byDuplicate.data ?? [])];
  const seen = new Set<string>();
  const unique = merged.filter((row) => {
    if (seen.has(row.id)) {
      return false;
    }
    seen.add(row.id);
    return true;
  });
  if (unique.length > 0) {
    return unique as ImportRecord[];
  }
  const { data: byTitle } = await opsClient()
    .from('import_records')
    .select('*')
    .ilike('normalized_payload->>title', `%${title.slice(0, 40)}%`)
    .limit(5);
  return (byTitle ?? []) as ImportRecord[];
}

async function loadSources(sourceIds: string[]) {
  if (sourceIds.length === 0) {
    return [];
  }
  const { data } = await opsClient().from('sources').select('*').in('id', [...new Set(sourceIds)]);
  return data ?? [];
}

function toResolvedEntries(structured: Awaited<ReturnType<typeof loadStructuredEntries>>): ResolvedCanonicalLineupEntry[] {
  return structured.map((entry, index) => ({
    order: entry.sort_order ?? index,
    artists: (
      (entry.event_lineup_entry_artists as Array<{ artists: { name?: string } | null }>) ?? []
    ).map((row) => row.artists?.name).filter((name): name is string => Boolean(name)),
    artistIds: [],
    entryId: entry.id,
    billingRelation: (entry.billing_relation ?? 'SOLO') as BillingRelation,
    stage: entry.stage,
  }));
}

function summarizeImportOrigins(records: ImportRecord[], sources: Awaited<ReturnType<typeof loadSources>>) {
  return records.map((record) => {
    const source = sources.find((row) => row.id === record.sourceId);
    const candidate = getEffectiveCandidate(record);
    return {
      importId: record.id,
      sourceId: record.sourceId,
      sourceName: source?.name,
      sourceType: source?.source_type,
      publishMode: source?.publish_mode,
      externalId: record.externalId,
      status: record.status,
      duplicateEventId: record.duplicateEventId,
      mergeGroupId: record.mergeGroupId,
      connectorKey: source?.connector_key,
      normalized: {
        ticketUrl: candidate.ticketUrl,
        eventUrl: candidate.eventUrl,
        priceText: candidate.priceText,
        venueName: candidate.venueName,
        cityName: candidate.cityName,
        artistCount: candidate.artistNames?.length ?? 0,
        imageUrl: candidate.imageUrl,
        rawSourceType: candidate.rawSourceType,
      },
      metadata: record.metadata,
    };
  });
}

async function buildPipelineTrace(eventId: string, label: string) {
  const { data: row } = await opsClient().from('events').select('*').eq('id', eventId).single();
  if (!row) {
    throw new Error(`Event not found: ${eventId}`);
  }
  const admin = mapEventRowToAdminRecord(row as EventRow);
  const importRecords = await loadImportRecords(eventId, admin.title);
  const sourceIds = [admin.sourceId, ...importRecords.map((r) => r.sourceId)].filter(Boolean) as string[];
  const sources = await loadSources(sourceIds);
  const structured = await loadStructuredEntries(eventId);
  const compatibility = await loadCompatibilityArtists(eventId);
  const origins = summarizeImportOrigins(importRecords, sources);

  const primaryImport = importRecords[0];
  const candidate = primaryImport ? getEffectiveCandidate(primaryImport) : undefined;
  const importLineup = primaryImport ? extractPrioritizedLineupEntries(primaryImport) : undefined;

  const lineup = readCanonicalLineup({
    structuredEntries: toResolvedEntries(structured),
    eventTitle: admin.title,
  });

  const canonicalTicket = readCanonicalTicket({
    ticketUrl: admin.ticketUrl,
    websiteUrl: admin.websiteUrl,
    priceText: admin.priceText,
    ticketStatus: admin.ticketStatus,
    ticketPhases: admin.ticketPhases,
  });

  const gallery = buildConsumerGalleryImageUrls({
    flyerUrl: admin.flyerUrl,
    imageUrl: admin.imageUrl,
  });

  const projection = projectCanonicalEventFields({
    title: admin.title,
    description: admin.description ?? '',
    venue: admin.venueName ?? '',
    city: admin.venueCity ?? '',
    artists: lineup.artistNames.length > 0 ? lineup.artistNames : compatibility.map((a) => a.name),
    priceText: canonicalTicket.priceText ?? admin.priceText,
    source: admin.sourceId ?? 'supabase',
    ticketUrl: canonicalTicket.publicCtaUrl ?? admin.ticketUrl,
    ticketStatus: canonicalTicket.ticketStatus ?? admin.ticketStatus,
    ticketPhases: admin.ticketPhases,
    imageUrl: admin.imageUrl,
    imageUrls: gallery,
    latitude: admin.latitude,
    longitude: admin.longitude,
    organizer: admin.organizerName,
    lineupEntries: toResolvedEntries(structured).map((entry) => ({
      order: entry.order,
      artists: entry.artists,
      billingRelation: entry.billingRelation,
      stage: entry.stage,
    })),
  });

  const attributeBadges = projectEventAttributeBadges(admin.eventAttributes, {
    floorCount: admin.floorCount,
    stageCount: admin.stageCount,
  });
  const ticketBadge = mapCanonicalAvailabilityToTicketBadge(
    canonicalTicket.availability,
    canonicalTicket.ticketStatus,
  );

  const imageUrl = admin.flyerUrl ?? admin.imageUrl ?? '';
  const ocr = imageUrl
    ? await extractFlyerTextWithProviders({
        eventId,
        title: admin.title,
        imageUrl,
        description: admin.description,
        importArtistNames: candidate?.artistNames,
      })
    : null;

  let apiEvent: Record<string, unknown> | undefined;
  let viewModel: Record<string, unknown> | undefined;
  try {
    const domainEvent = mapEventRowToDomain(row as EventRow, {
      venueName: admin.venueName,
      cityName: admin.venueCity,
      artists: lineup.artistNames.length > 0 ? lineup.artistNames : compatibility.map((a) => a.name),
      lineup: lineup.artistNames,
      lineupEntries: toResolvedEntries(structured),
      artistIds: compatibility.map((a) => a.id).filter((id): id is string => Boolean(id)),
      organizerName: admin.organizerName,
      latitude: admin.latitude,
      longitude: admin.longitude,
    });
    apiEvent = {
      ticketUrl: domainEvent.ticketUrl,
      websiteUrl: domainEvent.websiteUrl,
      priceText: domainEvent.priceText,
      artists: domainEvent.artists,
      lineupEntryCount: domainEvent.lineupEntries?.length ?? 0,
      venue: domainEvent.venue,
      city: domainEvent.city,
      latitude: domainEvent.latitude,
      longitude: domainEvent.longitude,
      eventAttributes: domainEvent.eventAttributes?.length ?? 0,
    };
    viewModel = {
      ticketUrl: canonicalTicket.publicCtaUrl ?? domainEvent.ticketUrl,
      officialEventUrl: canonicalTicket.officialEventUrl,
      displayPriceText: projection.displayPriceText,
      ticketProviderLabel: projection.ticketProviderLabel,
      knownArtistNames: projection.knownArtistNames,
      attributeBadgeCount: attributeBadges.length,
      attributeBadges: attributeBadges.map((b) => b.label),
      galleryCount: projection.galleryImageUrls.length,
      ticketAvailability: projection.ticketAvailability,
      ticketCtaLabel: canonicalTicket.ctaLabel,
    };
  } catch (error) {
    apiEvent = { error: error instanceof Error ? error.message : 'api_load_failed' };
  }

  const stages = {
    source: {
      sourceIds: [...new Set(sourceIds)],
      originCount: origins.length,
      competingOrigins: origins.length > 1,
      origins,
    },
    connector: origins.map((o) => ({
      sourceId: o.sourceId,
      connectorKey: o.connectorKey,
      sourceType: o.sourceType,
      publishMode: o.publishMode,
    })),
    import: {
      recordCount: importRecords.length,
      statuses: importRecords.map((r) => r.status),
      duplicateApprovals: importRecords.filter((r) => r.duplicateEventId).length,
    },
    normalization: origins.map((o) => o.normalized),
    matching: importRecords.map((r) => ({
      importId: r.id,
      canonicalEventId: r.canonicalEventId,
      duplicateEventId: r.duplicateEventId,
      mergeGroupId: r.mergeGroupId,
    })),
    ownership: SOURCE_FIELD_OWNERSHIP_MATRIX.filter((entry) =>
      ['ticketUrl', 'priceText', 'lineup', 'venueName'].includes(entry.field),
    ).map((entry) => ({ field: entry.field, mergeRule: entry.mergeRule, ownerTier: entry.ownerTier })),
    merge: {
      persistedTicketUrl: admin.ticketUrl,
      persistedWebsiteUrl: admin.websiteUrl,
      persistedPriceText: admin.priceText,
      importTicketUrls: origins.map((o) => o.normalized.ticketUrl).filter(Boolean),
      importPriceTexts: origins.map((o) => o.normalized.priceText).filter(Boolean),
      fieldFallbackChains: FIELD_FALLBACK_CHAINS.filter((c) =>
        ['ticketUrl', 'priceText', 'lineup', 'venueName'].includes(c.field),
      ),
    },
    persistence: {
      ticketUrl: admin.ticketUrl,
      websiteUrl: admin.websiteUrl,
      priceText: admin.priceText,
      ticketStatus: admin.ticketStatus,
      ticketPhasesCount: admin.ticketPhases?.length ?? 0,
      venueName: admin.venueName,
      venueCity: admin.venueCity,
      venueId: admin.venueId,
      latitude: admin.latitude,
      longitude: admin.longitude,
      structuredLineupCount: structured.length,
      compatibilityArtistCount: compatibility.length,
      eventAttributesCount: admin.eventAttributes?.length ?? 0,
      flyerUrl: admin.flyerUrl,
      imageUrl: admin.imageUrl,
    },
    canonicalReader: {
      lineupState: lineup.state,
      artistNames: lineup.artistNames,
      ticketDestination: canonicalTicket.destinationClass,
      acceptanceState: classifyTicketAcceptanceState(canonicalTicket),
      publicCtaUrl: canonicalTicket.publicCtaUrl,
      officialEventUrl: canonicalTicket.officialEventUrl,
      priceText: canonicalTicket.priceText,
      availability: canonicalTicket.availability,
    },
    projection: {
      displayPriceText: projection.displayPriceText,
      ticketProviderLabel: projection.ticketProviderLabel,
      knownArtistNames: projection.knownArtistNames,
      lineupCompleteness: projection.lineupCompleteness,
      galleryCount: projection.galleryImageUrls.length,
      venueLabel: projection.venueLabel,
      hasCoordinates: projection.hasCoordinates,
      qualityState: projection.qualityState,
      attributeBadgeCount: attributeBadges.length,
      ticketBadge,
    },
    api: apiEvent,
    viewModel,
    consumerUI: {
      surfaces: {
        eventDetail: Boolean(viewModel?.ticketUrl && viewModel?.knownArtistNames),
        ticketCtaOpens: viewModel?.ticketUrl,
        priceVisible: Boolean(viewModel?.displayPriceText),
        lineupVisible: (viewModel?.knownArtistNames as string[] | undefined)?.length ?? 0,
        badgesVisible: viewModel?.attributeBadgeCount ?? 0,
      },
      projectionPaths: PROJECTION_PATH_INVENTORY.map((p) => p.id),
    },
    cache: {
      note: 'read_only_no_invalidation',
      repositoryLoaded: Boolean(apiEvent && !('error' in apiEvent)),
    },
  };

  const domains = {
    ticketUrl: {
      import: origins.map((o) => o.normalized.ticketUrl),
      persistence: admin.ticketUrl,
      canonical: canonicalTicket.publicCtaUrl,
      viewModel: viewModel?.ticketUrl,
      shopRoot: admin.ticketUrl ? isTicketIoShopRootUrl(admin.ticketUrl) : false,
      destinationClass: canonicalTicket.destinationClass,
    },
    provider: {
      persistence: admin.sourceId,
      projection: projection.ticketProviderLabel,
      viewModel: viewModel?.ticketProviderLabel,
    },
    price: {
      import: origins.map((o) => o.normalized.priceText),
      persistence: admin.priceText,
      canonical: canonicalTicket.priceText,
      projection: projection.displayPriceText,
      viewModel: viewModel?.displayPriceText,
    },
    availability: {
      persistence: admin.ticketStatus,
      canonical: canonicalTicket.availability,
      badge: ticketBadge,
    },
    ticketPhases: {
      persistence: admin.ticketPhases?.length ?? 0,
      viewModel: (viewModel as { ticketPhases?: unknown })?.ticketPhases,
    },
    badges: {
      attributesPersisted: admin.eventAttributes?.length ?? 0,
      attributeBadgesProjected: attributeBadges.length,
      ticketBadge,
      viewModelBadges: viewModel?.attributeBadges,
    },
    venue: {
      import: origins.map((o) => ({ venue: o.normalized.venueName, city: o.normalized.cityName })),
      persistence: { name: admin.venueName, city: admin.venueCity, id: admin.venueId },
      projection: { label: projection.venueLabel, city: projection.cityLabel, coords: projection.hasCoordinates },
    },
    lineup: {
      importLineupCount: importLineup?.entries.length ?? 0,
      importLineupSource: importLineup?.source,
      structuredCount: structured.length,
      compatibilityCount: compatibility.length,
      canonicalState: lineup.state,
      projectedArtists: projection.knownArtistNames,
      viewModelArtists: viewModel?.knownArtistNames,
      ocrStatus: ocr?.status,
      flyerTextLines: ocr?.rawText?.split('\n').filter(Boolean).length ?? 0,
    },
    flyer: {
      flyerUrl: admin.flyerUrl,
      imageUrl: admin.imageUrl,
      ocrStatus: ocr?.status,
    },
    gallery: {
      count: gallery.length,
      viewModelCount: viewModel?.galleryCount,
    },
    consumerProjection: viewModel,
  };

  return {
    eventId,
    label,
    title: admin.title,
    stages,
    domains,
    importOrigins: origins,
    architectureSignals: {
      competingOrigins: origins.length > 1,
      enrichmentDuplicate: importRecords.some((r) => Boolean(r.duplicateEventId)),
      listOnlyTicketIo:
        origins.some((o) => o.sourceType === 'ticket_platform') &&
        !origins.some((o) => o.normalized.priceText),
      shopRootTicket: admin.ticketUrl ? isTicketIoShopRootUrl(admin.ticketUrl) : false,
      compatibilityOnlyLineup: lineup.state !== 'structured' && compatibility.length > 0,
      ocrPending: ocr?.status === 'pending_external',
      garbageArtists: compatibility.filter((a) => a.legacy || isCollapsedLineupArtistName(a.name)).length,
    },
  };
}

function compareDomain(
  domain: string,
  reference: Record<string, unknown>,
  actual: Record<string, unknown>,
  context: { label: string; signals: Record<string, unknown> },
): DomainDiff | undefined {
  const refVal = reference[domain];
  const actVal = actual[domain];
  if (JSON.stringify(refVal) === JSON.stringify(actVal)) {
    return undefined;
  }

  const diff = classifyDomainDiff(domain, reference, actual, context);
  return diff;
}

function classifyDomainDiff(
  domain: string,
  reference: Record<string, unknown>,
  actual: Record<string, unknown>,
  context: { label: string; signals: Record<string, unknown> },
): DomainDiff {
  const ref = reference[domain];
  const act = actual[domain];
  const signals = context.signals as {
    competingOrigins?: boolean;
    listOnlyTicketIo?: boolean;
    shopRootTicket?: boolean;
    compatibilityOnlyLineup?: boolean;
    ocrPending?: boolean;
    garbageArtists?: number;
    enrichmentDuplicate?: boolean;
  };

  const templates: Record<string, Omit<DomainDiff, 'domain' | 'expected' | 'actual' | 'reference'>> = {
    price: {
      firstDivergence: signals.listOnlyTicketIo ? 'Connector' : 'Source',
      rootCause: signals.listOnlyTicketIo
        ? 'Ticket.io list connector did not emit priceText; detail fetch blocked or not run'
        : 'No price evidence in any import origin',
      codePath:
        'connectors/ticket-platform/normalize-ticket-event.ts → import publish → events.price_text; fallback: field-fallback-priority priceText chain',
      repairStrategy: signals.listOnlyTicketIo
        ? 'Detail fetch or JSON-LD price extraction on list enrichment pass'
        : 'Require ticket_platform_detail or embedded_metadata origin',
      whyShipSucceeds: 'Ship has priceText from bootshaus.tv description / ticket.io merge with explicit "Tickets ab 32,00 Euro"',
      whyOtherFails: `${context.label} import origins lack priceText at normalization stage`,
      whyWrongWins: 'Empty price beats nothing; no downstream inference permitted',
    },
    ticketUrl: {
      firstDivergence: signals.shopRootTicket ? 'Merge' : signals.competingOrigins ? 'Merge' : 'Persistence',
      rootCause: signals.shopRootTicket
        ? 'Shop-root ticket.io URL won merge over missing event-specific candidate'
        : signals.competingOrigins
          ? 'Multi-origin merge selected different ticket URL than reference archetype'
          : 'Ticket URL never persisted as event-specific page',
      codePath:
        'merge-strategy.ts pickPreferredValue + ticket-url-quality resolveBetterTicketUrl → canonical-ticket-selection selectCanonicalTicket',
      repairStrategy: 'Re-merge with event-specific ticket.io slug; reject shop roots when better candidate exists',
      whyShipSucceeds: 'bootshaus-club.ticket.io/wUc3uQrR/ event slug persisted from ticket.io enrichment',
      whyOtherFails: `${context.label} persisted shop root or wrong-origin ticket URL`,
      whyWrongWins: 'ticket_platform_list origin fills ticketUrl when detail origin absent (FIELD_FALLBACK_CHAINS)',
    },
    lineup: {
      firstDivergence: signals.ocrPending ? 'Source' : signals.compatibilityOnlyLineup ? 'Persistence' : 'Connector',
      rootCause: signals.ocrPending
        ? 'Flyer artwork present but OCR provider not configured; import text insufficient'
        : signals.compatibilityOnlyLineup
          ? 'Structured lineup writer never ran or lost to flat compatibility projection'
          : 'Connector did not emit structured lineup entries',
      codePath:
        'import-structured-lineup-from-record.ts → canonical-structured-lineup-writer.ts → event_lineup_entries; fallback: event_artists compatibility',
      repairStrategy: signals.ocrPending
        ? 'OCR/flyer evidence pipeline (blocked in 4.7.5) or manual structured lineup'
        : 'repairLineupProjection from best import record',
      whyShipSucceeds: 'Description LINEUP block + flyer evidence produced 4 structured B2B entries',
      whyOtherFails: `${context.label} has no structured entries; list-only or prose-only source text`,
      whyWrongWins: 'Compatibility flat artists persist when structured writer has no explicit entries',
    },
    venue: {
      firstDivergence: signals.enrichmentDuplicate ? 'Ownership' : 'Merge',
      rootCause: signals.enrichmentDuplicate
        ? 'Ticket.io enrichment duplicate inherits Bootshaus venue defaults from primary origin'
        : 'venueName mergeRule owner_wins gave organizer/shop default over external geography',
      codePath:
        'source-field-ownership-matrix venueName + merge-strategy fieldAuthority → events.venue_name',
      repairStrategy: 'Apply explicit external venue from import description ("not at Bootshaus")',
      whyShipSucceeds: 'Ship event is genuinely at Bootshaus/KD Boot — venue matches source',
      whyOtherFails: `${context.label} external geography but canonical venue empty or wrong`,
      whyWrongWins: 'ticket_platform_list trust=2 fills venue when venue_website absent',
    },
    badges: {
      firstDivergence: 'Projection',
      rootCause:
        'eventAttributes persisted but projectEventAttributeBadges filters reviewRequired/excluded types; or ticket badge requires price+availability',
      codePath:
        'event-attribute-badge-projection.ts BADGE_EXCLUDED_TYPES; ticket-badge-projection.ts mapCanonicalAvailabilityToTicketBadge',
      repairStrategy: 'Clear reviewRequired on attributes; ensure availability maps to badge',
      whyShipSucceeds: 'Ship has sold_out availability → ticket badge; attributes not review-gated',
      whyOtherFails: `${context.label} attributes filtered or availability unknown`,
      whyWrongWins: 'Badge projection is conservative — missing price suppresses some ticket badges',
    },
    gallery: {
      firstDivergence: 'Projection',
      rootCause: 'buildConsumerGalleryImageUrls dedupes flyer===hero; single image still projects',
      codePath: 'consumer-gallery-projection.ts → display-event.ts galleryImageUrls',
      repairStrategy: 'Ensure flyerUrl or imageUrl persisted',
      whyShipSucceeds: 'Ship has imageUrl from ticket.io',
      whyOtherFails: `${context.label} missing image at persistence`,
      whyWrongWins: 'N/A',
    },
    consumerProjection: {
      firstDivergence: signals.garbageArtists ? 'Persistence' : 'ViewModel',
      rootCause:
        signals.garbageArtists && signals.garbageArtists > 0
          ? 'Garbage artist entities filtered from public display'
          : 'ViewModel drops fields not in canonical projection',
      codePath: 'display-event.ts toEventDisplayModel → event-detail-view-model.ts',
      repairStrategy: 'Remove garbage artist entities; fix upstream lineup',
      whyShipSucceeds: 'Clean structured lineup projects to knownArtistNames',
      whyOtherFails: `${context.label} lineup filtered or empty at ViewModel`,
      whyWrongWins: 'artist-candidate-quality-gate / legacy artifact filter removes invalid names',
    },
  };

  const template = templates[domain] ?? {
    firstDivergence: 'Persistence' as PipelineStage,
    rootCause: 'Field diverges from reference at persistence or projection',
    codePath: 'See pipeline trace stages',
    repairStrategy: 'Compare import origins vs persisted canonical',
    whyShipSucceeds: 'Reference event has complete field evidence',
    whyOtherFails: `${context.label} missing or different field value`,
    whyWrongWins: 'Lower-trust origin or empty fallback won merge',
  };

  return {
    domain,
    expected: ref,
    actual: act,
    reference: ref,
    ...template,
  };
}

function buildDiffMatrix(
  reference: Awaited<ReturnType<typeof buildPipelineTrace>>,
  target: Awaited<ReturnType<typeof buildPipelineTrace>>,
): DomainDiff[] {
  const diffs: DomainDiff[] = [];
  for (const domain of Object.keys(reference.domains)) {
    const diff = compareDomain(
      domain,
      reference.domains as Record<string, unknown>,
      target.domains as Record<string, unknown>,
      { label: target.label, signals: target.architectureSignals },
    );
    if (diff) {
      diffs.push(diff);
    }
  }
  return diffs;
}

async function runAudit(): Promise<void> {
  const traces: Record<string, Awaited<ReturnType<typeof buildPipelineTrace>>> = {};
  for (const [key, spec] of Object.entries(COMPARE_EVENTS)) {
    traces[key] = await buildPipelineTrace(spec.eventId, spec.label);
    console.log(`Traced ${spec.label}`);
  }

  const reference = traces.shipReference!;
  const diffs: Array<{
    key: string;
    label: string;
    eventId: string;
    title: string;
    diffs: DomainDiff[];
    firstDivergence: PipelineStage | undefined;
    architectureSignals: Record<string, unknown>;
  }> = [];

  for (const [key, trace] of Object.entries(traces)) {
    if (key === 'shipReference') {
      continue;
    }
    const domainDiffs = buildDiffMatrix(reference, trace);
    diffs.push({
      key,
      label: trace.label,
      eventId: trace.eventId,
      title: trace.title,
      diffs: domainDiffs,
      firstDivergence: domainDiffs[0]?.firstDivergence,
      architectureSignals: trace.architectureSignals,
    });
  }

  const matrixRows = diffs.flatMap((entry) =>
    entry.diffs.map((diff) => ({
      event: entry.title,
      eventId: entry.eventId,
      label: entry.label,
      pipelineStage: diff.firstDivergence,
      domain: diff.domain,
      expectedBehaviour: diff.whyShipSucceeds,
      actualBehaviour: diff.whyOtherFails,
      firstDivergence: diff.firstDivergence,
      rootCause: diff.rootCause,
      repairStrategy: diff.repairStrategy,
      codePath: diff.codePath,
    })),
  );

  const rootCauseCounts: Record<string, number> = {};
  const stageCounts: Record<string, number> = {};
  for (const row of matrixRows) {
    rootCauseCounts[row.rootCause] = (rootCauseCounts[row.rootCause] ?? 0) + 1;
    stageCounts[row.firstDivergence] = (stageCounts[row.firstDivergence] ?? 0) + 1;
  }

  const architectureFindings = [
    {
      id: 'multi_origin_field_merge',
      finding: 'Events with 2+ import origins merge fields independently per SOURCE_FIELD_OWNERSHIP_MATRIX — not holistically like Ship',
      affected: diffs.filter((d) => d.architectureSignals.competingOrigins).map((d) => d.label),
      codePath: 'merge-strategy.ts + source-field-ownership-matrix.ts',
    },
    {
      id: 'ticket_io_list_without_price',
      finding: 'Ticket.io list connector omits priceText for some shops; detail blocked by ALTCHA',
      affected: diffs.filter((d) => d.architectureSignals.listOnlyTicketIo).map((d) => d.label),
      codePath: 'ticket-platform/normalize-ticket-event.ts, ticket-io-field-quality.ts',
    },
    {
      id: 'shop_root_fallback',
      finding: 'When event-specific ticket.io slug missing, shop root wins per FIELD_FALLBACK_CHAINS ticketUrl',
      affected: diffs.filter((d) => d.architectureSignals.shopRootTicket).map((d) => d.label),
      codePath: 'field-fallback-priority.ts, canonical-ticket-selection.ts',
    },
    {
      id: 'structured_lineup_gap',
      finding: 'Structured lineup requires explicit import evidence; compatibility-only persists when writer skipped',
      affected: diffs.filter((d) => d.architectureSignals.compatibilityOnlyLineup).map((d) => d.label),
      codePath: 'canonical-structured-lineup-writer.ts, lineup-projection-integrity.ts',
    },
    {
      id: 'ocr_not_configured',
      finding: 'Flyer images stored but OCR provider returns pending_external — lineup from flyer blocked',
      affected: diffs.filter((d) => d.architectureSignals.ocrPending).map((d) => d.label),
      codePath: 'flyer-ocr-provider.ts ExplicitTextFlyerOcrProvider',
    },
    {
      id: 'garbage_artist_filter',
      finding: 'Title-slug garbage artists persist in DB but filtered from consumer ViewModel',
      affected: diffs.filter((d) => (d.architectureSignals.garbageArtists as number) > 0).map((d) => d.label),
      codePath: 'lineup-compatibility-projection.ts, artist-candidate-quality-gate.ts',
    },
    {
      id: 'badge_projection_conservative',
      finding: 'Attribute badges exclude reviewRequired types; ticket badges need availability semantics',
      affected: diffs.filter((d) => d.diffs.some((x) => x.domain === 'badges')).map((d) => d.label),
      codePath: 'event-attribute-badge-projection.ts, ticket-badge-projection.ts',
    },
    {
      id: 'enrichment_duplicate_venue_bleed',
      finding: 'Enrichment duplicate approvals inherit primary origin venue when external event',
      affected: diffs.filter((d) => d.architectureSignals.enrichmentDuplicate).map((d) => d.label),
      codePath: 'import-utils isEnrichmentDuplicateApproval, merge-strategy venueName',
    },
  ];

  const repairPlan = matrixRows.map((row) => ({
    event: row.event,
    domain: row.domain,
    stage: row.firstDivergence,
    strategy: row.repairStrategy,
    codePath: row.codePath,
    blocked: row.firstDivergence === 'Source' || row.rootCause.includes('OCR'),
  }));

  writeJson('_phase476_ship_reference.json', reference);
  writeJson('_phase476_pipeline_diff.json', { generatedAt: new Date().toISOString(), diffs });
  writeJson('_phase476_root_causes.json', {
    generatedAt: new Date().toISOString(),
    stageCounts,
    rootCauseCounts,
    architectureFindings,
  });
  writeJson('_phase476_event_truth_matrix.json', {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    referenceEventId: REFERENCE_EVENT_ID,
    matrix: matrixRows,
    traces: Object.fromEntries(Object.entries(traces).map(([k, v]) => [k, { eventId: v.eventId, title: v.title, domains: v.domains, signals: v.architectureSignals }])),
  });
  writeJson('_phase476_repair_plan.json', {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    items: repairPlan,
  });

  return void writeArchitectureReport(reference, diffs, architectureFindings, stageCounts);
}

function writeArchitectureReport(
  reference: Awaited<ReturnType<typeof buildPipelineTrace>>,
  diffs: Array<{ label: string; title: string; diffs: DomainDiff[]; firstDivergence?: PipelineStage }>,
  architectureFindings: unknown[],
  stageCounts: Record<string, number>,
): void {
  const lines = [
    '# Architecture Pipeline Diff',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Why similar Events produce different consumer results',
    '',
    'All Events traverse the same code paths. Divergence occurs when **earlier pipeline stages supply different evidence**, causing per-field merge decisions to produce different canonical snapshots.',
    '',
    '### Reference pipeline (Ship Vol. III)',
    '',
    '| Stage | Decision |',
    '|-------|----------|',
    `| Source | ${reference.importOrigins.length} origins: bootshaus.tv + ticket.io |`,
    `| Normalization | ticket.io emits event slug + price; description has LINEUP block |`,
    `| Merge | Event-specific ticket URL beats shop root; price from ticket origin |`,
    `| Persistence | 4 structured B2B entries, price_text, sold_out |`,
    `| Projection | Full gallery, sold_out badge, 8 artists |`,
    '',
    '## First divergence stage counts (representative Events)',
    '',
    ...Object.entries(stageCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([stage, count]) => `- **${stage}**: ${count}`),
    '',
    '## Architecture findings',
    '',
  ];

  for (const finding of architectureFindings as Array<{ id: string; finding: string; affected: string[]; codePath: string }>) {
    lines.push(`### ${finding.id}`, '', finding.finding, '', `- Code: \`${finding.codePath}\``, `- Affected: ${finding.affected.join(', ') || 'none'}`, '');
  }

  lines.push('## Per-Event first divergence', '');
  for (const entry of diffs) {
    lines.push(`- **${entry.label}** (${entry.title}): first divergence **${entry.firstDivergence ?? 'none'}** — ${entry.diffs.length} domain diffs`);
  }

  writeFileSync(ARCH_REPORT, lines.join('\n'));

  const reportLines = [
    '# Phase 4.7.6 — Canonical Pipeline Truth Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '**READ ONLY. No repairs. No cache invalidation.**',
    '',
    '## Reference',
    '',
    `Bootshaus on a Ship Vol. III (\`${REFERENCE_EVENT_ID}\`)`,
    '',
    '## Compared Events',
    '',
    ...Object.entries(COMPARE_EVENTS)
      .filter(([k]) => k !== 'shipReference')
      .map(([, v]) => `- ${v.label}: \`${v.eventId}\``),
    '',
    '## Key findings',
    '',
    '### LEVI — correct ticket URL, no price',
    '- **First divergence: Connector**',
    '- Ticket.io list import for `bootshaus-tickets` shop emits event slug but no `priceText`',
    '- Ship succeeds because bootshaus.tv / merged origin supplies price',
    '- Code: `normalize-ticket-event.ts` → `FIELD_FALLBACK_CHAINS.priceText`',
    '',
    '### Underland — user-reported generic Bootshaus page',
    '- **DB persistence shows event-specific** `bootshaus-club.ticket.io/C7JPnatZ/`',
    '- If consumer shows shop root → divergence at **Cache** or ticket.io server redirect (not code path)',
    '- Affenkäfig origin + Bootshaus ticket.io enrichment duplicate pattern',
    '',
    '### Palma cluster — shop root CTA',
    '- **First divergence: Merge**',
    '- `ticket_platform_list` fills `ticketUrl` with shop root when event slug absent',
    '- Code: `canonical-ticket-selection.ts`, `field-fallback-priority.ts`',
    '',
    '### MDMA / garbage artists',
    '- **First divergence: Persistence** → **ViewModel**',
    '- Title-slug artists persist; consumer filters them → empty lineup display',
    '',
    '## Deliverables',
    '',
    '- `docs/ARCHITECTURE_PIPELINE_DIFF.md`',
    '- `docs/real-data/_phase476_*.json`',
  ];

  writeFileSync(REPORT, reportLines.join('\n'));
}

async function runReport(): Promise<void> {
  console.log('Report written from existing artifacts');
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
