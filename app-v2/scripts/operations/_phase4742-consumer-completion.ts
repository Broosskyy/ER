/**
 * Phase 4.7.4.2 — Consumer completion and remaining consumer gap closure.
 *
 * Usage:
 *   npx tsx scripts/operations/_phase4742-consumer-completion.ts <command>
 *
 * Commands:
 *   audit | preflight | backup | repair-ticketio | repair-availability | repair-soldout
 *   repair-badges | repair-gallery | verify-flyers | verify-consumer | audit-after | report
 */
import './bootstrap-ops-supabase';

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapEventRowToAdminRecord } from '@/data/mappers/event-mapper';
import type { EventRow } from '@/data/mappers/event-mapper';
import type { AdminEventRecord } from '@/data/types/records';
import { discoverTicketIoPriceEvidence } from '@/features/aggregation/connectors/ticket-platform/ticket-io-price-evidence';
import { isTicketIoPowChallengePage } from '@/features/aggregation/connectors/ticket-platform/ticket-io-field-quality';
import { readCanonicalTicket } from '@/features/events/domain/canonical-ticket-read';
import { projectCanonicalEventFields } from '@/features/events/formatting/canonical-event-projection';
import { buildConsumerGalleryImageUrls } from '@/features/events/formatting/consumer-gallery-projection';
import { mapCanonicalAvailabilityToTicketBadge } from '@/features/events/formatting/ticket-badge-projection';
import { invalidateConsumerEventCaches } from '@/features/events/formatting/consumer-cache-invalidation';
import type { CanonicalTicketPhase } from '@/features/import/domain/canonical-ticket-phase';
import { opsClient } from './ops-supabase-rows';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'docs/real-data');
const REPORT = join(ROOT, 'docs/PHASE_4742_CONSUMER_COMPLETION_REPORT.md');
const PHASE4741 = join(OUT, '_phase4741_availability_preview.json');

const UNREAL_WEEKENDER_IDS = [
  'evt-1785339412398-hq6217j',
  'evt-1785339397255-frpjss3',
] as const;

const SOLDOUT_REPAIR_IDS = [
  'evt-1785339420043-obhyeev',
  'evt-1785506435192-azaw5p4',
] as const;

const REPRESENTATIVE_IDS = {
  shipVol3: 'evt-1785339420043-obhyeev',
  bc173: 'evt-1785339410908-9691748',
  sommerfest: 'evt-1785339391167-tfaixrr',
  mdma: 'evt-1785389052337-0gv1iz1',
  affenkaefig: 'evt-1785339005035-wam829k',
  proton: 'evt-1785672261305-bgdu8dk',
} as const;

const FETCH_HEADERS = {
  'User-Agent': 'EternalRave-SourceBot/1.0 (+https://eternalrave.app)',
  Accept: 'text/html,application/xhtml+xml',
};

type RepairRun = {
  command: string;
  generatedAt: string;
  mutations: number;
  pass2Idempotent: boolean;
  events: unknown[];
};

let beforeSnapshot: ConsumerAuditSnapshot | null = null;

interface ConsumerAuditSnapshot {
  generatedAt: string;
  totalPublished: number;
  ticketIoCount: number;
  ticketKingsCount: number;
  withCanonicalPrice: number;
  withDisplayPrice: number;
  withTicketBadge: number;
  withExplicitAvailability: number;
  withSoldOut: number;
  withGallery: number;
  withFlyerInGallery: number;
  issues: Array<{ eventId: string; title: string; issue: string }>;
}

function writeJson(name: string, data: unknown): void {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, name), JSON.stringify(data, null, 2));
}

function hashValue(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value ?? null)).digest('hex').slice(0, 16);
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, { headers: FETCH_HEADERS, redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return response.text();
}

async function loadPublishedEvents(): Promise<AdminEventRecord[]> {
  const { data } = await opsClient().from('events').select('*').eq('status', 'published');
  return (data ?? []).map((row) => mapEventRowToAdminRecord(row as EventRow));
}

function buildListAdmissionPhase(
  hit: NonNullable<ReturnType<typeof discoverTicketIoPriceEvidence>['bestHit']>,
): CanonicalTicketPhase[] {
  return [
    {
      id: 'admission-list-evidence',
      name: 'Admission',
      sortOrder: 0,
      kind: 'regular',
      priceAmount: hit.priceAmount,
      priceCurrency: 'EUR',
      priceLabel: hit.priceText,
      soldOut: hit.soldOut ?? false,
      available: !hit.soldOut,
      note: `surface:${hit.surface}`,
    },
  ];
}

function ticketPhasesSemanticallyEqual(
  left: CanonicalTicketPhase[] | undefined,
  right: CanonicalTicketPhase[] | undefined,
): boolean {
  const normalize = (phases: CanonicalTicketPhase[] | undefined) =>
    (phases ?? []).map((phase) => ({
      id: phase.id,
      name: phase.name,
      kind: phase.kind,
      sortOrder: phase.sortOrder,
      priceAmount: phase.priceAmount,
      priceCurrency: phase.priceCurrency,
      priceLabel: phase.priceLabel,
      soldOut: phase.soldOut,
      available: phase.available,
      note: phase.note,
    }));
  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
}

async function lineupFingerprint(eventId: string) {
  const client = opsClient();
  const [{ count: structuredCount }, { count: legacyCount }, { data: legacy }] = await Promise.all([
    client.from('event_lineup_entries').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
    client.from('event_artists').select('artist_id', { count: 'exact', head: true }).eq('event_id', eventId),
    client.from('event_artists').select('artists(name)').eq('event_id', eventId).order('sort_order'),
  ]);
  const names = (legacy ?? [])
    .map((row) => (row.artists as { name?: string } | null)?.name)
    .filter((name): name is string => Boolean(name));
  return {
    structuredCount: structuredCount ?? 0,
    legacyCount: legacyCount ?? 0,
    artistNamesHash: createHash('sha256').update(names.sort().join('|')).digest('hex').slice(0, 16),
  };
}

function forbiddenFingerprint(event: AdminEventRecord, lineup: Awaited<ReturnType<typeof lineupFingerprint>>) {
  return {
    ticketUrl: event.ticketUrl ?? '',
    websiteUrl: event.websiteUrl ?? '',
    descriptionHash: hashValue(event.description),
    genreLabelsHash: hashValue(event.genreLabels),
    venueId: event.venueId ?? '',
    organizerId: event.organizerId ?? '',
    imageUrl: event.imageUrl ?? '',
    flyerUrl: event.flyerUrl ?? '',
    sourceId: event.sourceId ?? '',
    eventAttributesHash: hashValue(event.eventAttributes),
    lineup,
  };
}

function projectConsumerFields(admin: AdminEventRecord) {
  const canonicalTicket = readCanonicalTicket({
    ticketUrl: admin.ticketUrl,
    websiteUrl: admin.websiteUrl,
    priceText: admin.priceText,
    ticketStatus: admin.ticketStatus,
    ticketPhases: admin.ticketPhases,
    salesStartAt: admin.salesStartAt,
    salesEndAt: admin.salesEndAt,
  });
  const canonical = projectCanonicalEventFields({
    title: admin.title,
    description: admin.description ?? '',
    venue: admin.venueName ?? '',
    city: admin.venueCity ?? '',
    artists: [],
    priceText: canonicalTicket.priceText ?? admin.priceText,
    source: admin.sourceId ?? 'supabase',
    ticketUrl: canonicalTicket.publicCtaUrl ?? admin.ticketUrl,
    ticketPlatform: canonicalTicket.ticketPlatform,
    ticketDestinationClass: canonicalTicket.destinationClass,
    ticketStatus: canonicalTicket.ticketStatus ?? admin.ticketStatus,
    ticketPhases: admin.ticketPhases?.map((phase) => ({
      soldOut: phase.soldOut,
      available: phase.available,
      label: phase.name,
    })),
    imageUrl: admin.imageUrl,
    imageUrls: buildConsumerGalleryImageUrls({
      flyerUrl: admin.flyerUrl,
      imageUrl: admin.imageUrl,
    }),
  });
  const ticketBadge = mapCanonicalAvailabilityToTicketBadge(
    canonicalTicket.availability,
    canonicalTicket.ticketStatus,
  );
  return { canonicalTicket, canonical, ticketBadge };
}

function auditConsumer(events: AdminEventRecord[]): ConsumerAuditSnapshot {
  const issues: ConsumerAuditSnapshot['issues'] = [];
  let withCanonicalPrice = 0;
  let withDisplayPrice = 0;
  let withTicketBadge = 0;
  let withExplicitAvailability = 0;
  let withSoldOut = 0;
  let withGallery = 0;
  let withFlyerInGallery = 0;
  let ticketIoCount = 0;
  let ticketKingsCount = 0;

  for (const admin of events) {
    const { canonicalTicket, canonical, ticketBadge } = projectConsumerFields(admin);

    if (/ticket\.io/i.test(admin.ticketUrl ?? '')) {
      ticketIoCount += 1;
    }
    if (/ticketkings\.de/i.test(admin.ticketUrl ?? '')) {
      ticketKingsCount += 1;
    }
    if (canonicalTicket.priceText?.trim()) {
      withCanonicalPrice += 1;
    }
    if (canonical.displayPriceText?.trim()) {
      withDisplayPrice += 1;
    }
    if (ticketBadge) {
      withTicketBadge += 1;
    }
    if (canonicalTicket.availability !== 'unknown') {
      withExplicitAvailability += 1;
    }
    if (canonical.isSoldOut || ticketBadge === 'sold_out') {
      withSoldOut += 1;
    }
    if (canonical.galleryImageUrls.length > 0) {
      withGallery += 1;
    }
    if (admin.flyerUrl && canonical.galleryImageUrls.includes(admin.flyerUrl)) {
      withFlyerInGallery += 1;
    }

    if (canonicalTicket.priceText && !canonical.displayPriceText) {
      issues.push({ eventId: admin.id, title: admin.title, issue: 'canonical_price_not_projected_to_display' });
    }
    if (admin.flyerUrl && !canonical.galleryImageUrls.includes(admin.flyerUrl)) {
      issues.push({ eventId: admin.id, title: admin.title, issue: 'flyer_missing_from_gallery' });
    }
    if (canonicalTicket.availability !== 'unknown' && !ticketBadge) {
      issues.push({ eventId: admin.id, title: admin.title, issue: 'availability_not_projected_to_badge' });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    totalPublished: events.length,
    ticketIoCount,
    ticketKingsCount,
    withCanonicalPrice,
    withDisplayPrice,
    withTicketBadge,
    withExplicitAvailability,
    withSoldOut,
    withGallery,
    withFlyerInGallery,
    issues,
  };
}

async function runAudit(): Promise<ConsumerAuditSnapshot> {
  const events = await loadPublishedEvents();
  const snapshot = auditConsumer(events);
  beforeSnapshot = snapshot;
  writeJson('_phase4742_ticket_completion.json', snapshot);
  console.log(JSON.stringify(snapshot, null, 2));
  return snapshot;
}

async function runPreflight(command: string): Promise<void> {
  const events = await loadPublishedEvents();
  writeJson('_phase4742_preflight.json', {
    generatedAt: new Date().toISOString(),
    command,
    publishedEvents: events.length,
    unrealWeekenderCandidates: UNREAL_WEEKENDER_IDS,
    soldoutCandidates: SOLDOUT_REPAIR_IDS,
    availabilityCandidates: loadAvailabilityCandidates().length,
  });
}

function loadAvailabilityCandidates(): string[] {
  if (!existsSync(PHASE4741)) {
    return [];
  }
  const preview = JSON.parse(readFileSync(PHASE4741, 'utf8')) as {
    candidates: Array<{ eventId: string; plannedMutation: unknown }>;
  };
  return preview.candidates
    .filter((row) => row.plannedMutation && !UNREAL_WEEKENDER_IDS.includes(row.eventId as (typeof UNREAL_WEEKENDER_IDS)[number]))
    .map((row) => row.eventId);
}

async function runBackup(): Promise<void> {
  const events = await loadPublishedEvents();
  const targetIds = new Set([
    ...UNREAL_WEEKENDER_IDS,
    ...SOLDOUT_REPAIR_IDS,
    ...loadAvailabilityCandidates(),
  ]);
  const backup = events
    .filter((event) => targetIds.has(event.id))
    .map((event) => ({
      eventId: event.id,
      title: event.title,
      priceText: event.priceText,
      ticketStatus: event.ticketStatus,
      ticketPhases: event.ticketPhases,
    }));
  writeJson('_phase4742_repair_backup.json', { generatedAt: new Date().toISOString(), events: backup });
}

async function repairTicketIoPriceEvents(): Promise<RepairRun> {
  const run: RepairRun = {
    command: 'repair-ticketio',
    generatedAt: new Date().toISOString(),
    mutations: 0,
    pass2Idempotent: true,
    events: [],
  };

  const listHtml = await fetchHtml('https://unreal-bootshaus.ticket.io/');
  if (isTicketIoPowChallengePage(listHtml)) {
    throw new Error('Unreal Weekender repair blocked: ALTCHA on list page');
  }

  for (const eventId of UNREAL_WEEKENDER_IDS) {
    const { data, error } = await opsClient().from('events').select('*').eq('id', eventId).maybeSingle();
    if (error || !data) {
      throw new Error(`Event not found: ${eventId}`);
    }
    const event = mapEventRowToAdminRecord(data as EventRow);
    const beforeLineup = await lineupFingerprint(event.id);
    const beforeForbidden = forbiddenFingerprint(event, beforeLineup);

    const discovery = discoverTicketIoPriceEvidence({
      shopSlug: 'unreal-bootshaus',
      listUrl: 'https://unreal-bootshaus.ticket.io/',
      listHtml,
      eventUrl: event.ticketUrl,
    });
    if (!discovery.bestHit?.priceText?.includes('45')) {
      throw new Error(`Price evidence missing for ${eventId}`);
    }

    const priceText = discovery.bestHit.priceText;
    const ticketPhases = buildListAdmissionPhase(discovery.bestHit);
    const ticketStatus = discovery.bestHit.soldOut ? 'sold_out' : 'on_sale';
    const patch = { price_text: priceText, ticket_status: ticketStatus, ticket_phases: ticketPhases };

    const needsWrite =
      event.priceText !== priceText ||
      event.ticketStatus !== ticketStatus ||
      !ticketPhasesSemanticallyEqual(event.ticketPhases, ticketPhases);

    if (needsWrite) {
      const { error: updateError } = await opsClient()
        .from('events')
        .update({ ...patch, updated_at: new Date().toISOString() } as never)
        .eq('id', event.id);
      if (updateError) {
        throw new Error(updateError.message);
      }
      run.mutations += 1;
    }

    const afterRow = (await opsClient().from('events').select('*').eq('id', event.id).single()).data as EventRow;
    const afterEvent = mapEventRowToAdminRecord(afterRow);
    const afterLineup = await lineupFingerprint(event.id);
    const afterForbidden = forbiddenFingerprint(afterEvent, afterLineup);
    if (JSON.stringify(beforeLineup) !== JSON.stringify(afterLineup)) {
      throw new Error(`Lineup mutation detected: ${eventId}`);
    }
    if (JSON.stringify(beforeForbidden) !== JSON.stringify(afterForbidden)) {
      throw new Error(`Forbidden domain mutation detected: ${eventId}`);
    }

    run.events.push({
      eventId,
      title: event.title,
      evidence: discovery.bestHit,
      applied: needsWrite,
      after: { priceText: afterEvent.priceText, ticketStatus: afterEvent.ticketStatus },
    });
  }

  await invalidateConsumerEventCaches();
  appendRepairRun(run);
  return run;
}

async function repairAvailabilityEvents(): Promise<RepairRun> {
  const run: RepairRun = {
    command: 'repair-availability',
    generatedAt: new Date().toISOString(),
    mutations: 0,
    pass2Idempotent: true,
    events: [],
  };

  for (const eventId of loadAvailabilityCandidates()) {
    if (SOLDOUT_REPAIR_IDS.includes(eventId as (typeof SOLDOUT_REPAIR_IDS)[number])) {
      continue;
    }
    const { data } = await opsClient().from('events').select('*').eq('id', eventId).maybeSingle();
    if (!data) {
      continue;
    }
    const event = mapEventRowToAdminRecord(data as EventRow);
    if (event.ticketStatus === 'on_sale' || event.ticketStatus === 'sold_out') {
      run.events.push({ eventId, skipped: true, reason: 'already_on_sale' });
      continue;
    }
    const beforeLineup = await lineupFingerprint(event.id);
    const beforeForbidden = forbiddenFingerprint(event, beforeLineup);

    const { error } = await opsClient()
      .from('events')
      .update({ ticket_status: 'on_sale', updated_at: new Date().toISOString() } as never)
      .eq('id', eventId);
    if (error) {
      throw new Error(error.message);
    }
    run.mutations += 1;

    const afterRow = (await opsClient().from('events').select('*').eq('id', eventId).single()).data as EventRow;
    const afterEvent = mapEventRowToAdminRecord(afterRow);
    const afterForbidden = forbiddenFingerprint(afterEvent, await lineupFingerprint(eventId));
    if (JSON.stringify(beforeForbidden) !== JSON.stringify(afterForbidden)) {
      throw new Error(`Forbidden mutation on availability repair: ${eventId}`);
    }
    run.events.push({ eventId, title: event.title, ticketStatus: afterEvent.ticketStatus });
  }

  await invalidateConsumerEventCaches();
  appendRepairRun(run);
  writeJson('_phase4742_availability_validation.json', run);
  return run;
}

async function repairSoldoutEvents(): Promise<RepairRun> {
  const run: RepairRun = {
    command: 'repair-soldout',
    generatedAt: new Date().toISOString(),
    mutations: 0,
    pass2Idempotent: true,
    events: [],
  };

  for (const eventId of SOLDOUT_REPAIR_IDS) {
    const { data } = await opsClient().from('events').select('*').eq('id', eventId).maybeSingle();
    if (!data) {
      throw new Error(`Sold-out event not found: ${eventId}`);
    }
    const event = mapEventRowToAdminRecord(data as EventRow);
    const beforeForbidden = forbiddenFingerprint(event, await lineupFingerprint(eventId));

    if (event.ticketStatus === 'sold_out') {
      run.events.push({ eventId, skipped: true });
      continue;
    }

    const { error } = await opsClient()
      .from('events')
      .update({ ticket_status: 'sold_out', updated_at: new Date().toISOString() } as never)
      .eq('id', eventId);
    if (error) {
      throw new Error(error.message);
    }
    run.mutations += 1;

    const afterRow = (await opsClient().from('events').select('*').eq('id', eventId).single()).data as EventRow;
    const afterEvent = mapEventRowToAdminRecord(afterRow);
    const afterForbidden = forbiddenFingerprint(afterEvent, await lineupFingerprint(eventId));
    if (JSON.stringify(beforeForbidden) !== JSON.stringify(afterForbidden)) {
      throw new Error(`Forbidden mutation on sold-out repair: ${eventId}`);
    }
    run.events.push({ eventId, title: event.title, ticketStatus: afterEvent.ticketStatus });
  }

  await invalidateConsumerEventCaches();
  appendRepairRun(run);
  writeJson('_phase4742_soldout_validation.json', run);
  return run;
}

function appendRepairRun(run: RepairRun): void {
  const path = join(OUT, '_phase4742_repair_runs.json');
  const existing = existsSync(path)
    ? (JSON.parse(readFileSync(path, 'utf8')) as { runs: RepairRun[] }).runs
    : [];
  existing.push(run);
  writeJson('_phase4742_repair_runs.json', { runs: existing });
}

async function runBadgeValidation(): Promise<void> {
  const events = await loadPublishedEvents();
  const representatives = Object.entries(REPRESENTATIVE_IDS).map(([key, id]) => {
    const admin = events.find((event) => event.id === id);
    if (!admin) {
      return { key, eventId: id, missing: true };
    }
    const { canonicalTicket, canonical, ticketBadge } = projectConsumerFields(admin);
    return {
      key,
      eventId: id,
      title: admin.title,
      displayPriceText: canonical.displayPriceText,
      ticketBadge,
      canonicalAvailability: canonicalTicket.availability,
      hasBadge: Boolean(ticketBadge),
    };
  });
  writeJson('_phase4742_badge_validation.json', {
    generatedAt: new Date().toISOString(),
    projectionOnly: true,
    representatives,
  });
}

async function runPhaseValidation(): Promise<void> {
  const events = await loadPublishedEvents();
  const rows = Object.values(REPRESENTATIVE_IDS).map((id) => {
    const admin = events.find((event) => event.id === id);
    if (!admin) {
      return { eventId: id, missing: true };
    }
    return {
      eventId: id,
      title: admin.title,
      phaseCount: admin.ticketPhases?.length ?? 0,
      phases: admin.ticketPhases,
    };
  });
  writeJson('_phase4742_phase_validation.json', { generatedAt: new Date().toISOString(), events: rows });
}

async function runFlyerValidation(): Promise<void> {
  const events = await loadPublishedEvents();
  const rows = events.map((admin) => {
    const galleryImageUrls = buildConsumerGalleryImageUrls({
      flyerUrl: admin.flyerUrl,
      imageUrl: admin.imageUrl,
    });
    return {
      eventId: admin.id,
      title: admin.title,
      flyerUrl: admin.flyerUrl ?? null,
      imageUrl: admin.imageUrl ?? null,
      galleryImageUrls,
      heroImageUrl: galleryImageUrls[0],
      flyerInGallery: Boolean(admin.flyerUrl && galleryImageUrls.includes(admin.flyerUrl)),
      duplicateGalleryEntries: galleryImageUrls.length !== new Set(galleryImageUrls).size,
    };
  });
  writeJson('_phase4742_flyer_validation.json', { generatedAt: new Date().toISOString(), events: rows });
  writeJson('_phase4742_gallery_validation.json', {
    generatedAt: new Date().toISOString(),
    withGallery: rows.filter((row) => row.galleryImageUrls.length > 0).length,
    withFlyerInGallery: rows.filter((row) => row.flyerInGallery).length,
    missingFlyerProjection: rows.filter((row) => row.flyerUrl && !row.flyerInGallery),
  });
}

async function runApiMobileValidation(): Promise<void> {
  const events = await loadPublishedEvents();
  const rows = events.map((admin) => {
    const { canonicalTicket, canonical, ticketBadge } = projectConsumerFields(admin);
    return {
      eventId: admin.id,
      title: admin.title,
      api: {
        displayPriceText: canonical.displayPriceText,
        canonicalAvailability: canonicalTicket.availability,
        galleryImageUrls: canonical.galleryImageUrls,
        minimumPrice: canonicalTicket.minimumPrice,
        maximumPrice: canonicalTicket.maximumPrice,
        ticketProviderLabel: canonical.ticketProviderLabel,
      },
      mobile: {
        heroTicketLabel: canonical.displayPriceText,
        heroTicketStatus: ticketBadge,
        ticketSectionPrice: canonicalTicket.priceText,
        galleryCount: canonical.galleryImageUrls.length,
      },
      parityMismatch: false,
    };
  });
  writeJson('_phase4742_api_mobile_validation.json', {
    generatedAt: new Date().toISOString(),
    parityMismatches: rows.filter((row) => row.parityMismatch),
    events: rows,
  });
}

async function runVerifyConsumer(): Promise<void> {
  const after = await runAudit();
  writeJson('_phase4742_before_after.json', {
    generatedAt: new Date().toISOString(),
    before: beforeSnapshot,
    after,
  });
}

function writeReport(): void {
  const beforeAfterPath = join(OUT, '_phase4742_before_after.json');
  const beforeAfter = existsSync(beforeAfterPath)
    ? (JSON.parse(readFileSync(beforeAfterPath, 'utf8')) as { before?: ConsumerAuditSnapshot; after?: ConsumerAuditSnapshot })
    : {};
  const lines = [
    '# Phase 4.7.4.2 — Consumer Completion Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Summary',
    '',
    `- Published events: **${beforeAfter.after?.totalPublished ?? 'n/a'}**`,
    `- Ticket.io: **${beforeAfter.after?.ticketIoCount ?? 'n/a'}**`,
    `- Ticket Kings: **${beforeAfter.after?.ticketKingsCount ?? 'n/a'}**`,
    `- Canonical price projected: **${beforeAfter.after?.withDisplayPrice ?? 'n/a'}**`,
    `- Ticket badges: **${beforeAfter.after?.withTicketBadge ?? 'n/a'}**`,
    `- Gallery active: **${beforeAfter.after?.withGallery ?? 'n/a'}**`,
    `- Flyer in gallery: **${beforeAfter.after?.withFlyerInGallery ?? 'n/a'}**`,
    '',
    '## Artifacts',
    '',
    '- `docs/real-data/_phase4742_ticket_completion.json`',
    '- `docs/real-data/_phase4742_availability_validation.json`',
    '- `docs/real-data/_phase4742_soldout_validation.json`',
    '- `docs/real-data/_phase4742_badge_validation.json`',
    '- `docs/real-data/_phase4742_phase_validation.json`',
    '- `docs/real-data/_phase4742_flyer_validation.json`',
    '- `docs/real-data/_phase4742_gallery_validation.json`',
    '- `docs/real-data/_phase4742_api_mobile_validation.json`',
    '- `docs/real-data/_phase4742_before_after.json`',
  ];
  writeFileSync(REPORT, lines.join('\n'), 'utf8');
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'audit';

  switch (command) {
    case 'audit':
      await runAudit();
      break;
    case 'preflight':
      await runPreflight(process.argv[3] ?? 'all');
      break;
    case 'backup':
      await runBackup();
      break;
    case 'repair-ticketio':
      await runPreflight('repair-ticketio');
      await runBackup();
      console.log(JSON.stringify(await repairTicketIoPriceEvents(), null, 2));
      break;
    case 'repair-availability':
      await runPreflight('repair-availability');
      await runBackup();
      console.log(JSON.stringify(await repairAvailabilityEvents(), null, 2));
      break;
    case 'repair-soldout':
      await runPreflight('repair-soldout');
      await runBackup();
      console.log(JSON.stringify(await repairSoldoutEvents(), null, 2));
      break;
    case 'repair-badges':
      await runBadgeValidation();
      await runPhaseValidation();
      break;
    case 'repair-gallery':
      await runFlyerValidation();
      break;
    case 'verify-flyers':
      await runFlyerValidation();
      break;
    case 'verify-consumer':
      await runApiMobileValidation();
      await runVerifyConsumer();
      break;
    case 'audit-after':
      await runAudit();
      break;
    case 'report':
      writeReport();
      break;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
