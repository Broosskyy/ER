/**
 * Phase 4.7.1 — Canonical Ticket Domain (preflight, repair, audit).
 *
 * Usage:
 *   npx tsx scripts/operations/_phase471-canonical-ticket-domain.ts preflight
 *   npx tsx scripts/operations/_phase471-canonical-ticket-domain.ts backup
 *   npx tsx scripts/operations/_phase471-canonical-ticket-domain.ts repair
 *   npx tsx scripts/operations/_phase471-canonical-ticket-domain.ts audit-after
 *   npx tsx scripts/operations/_phase471-canonical-ticket-domain.ts full
 */
import './bootstrap-ops-supabase';

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapEventRowToAdminRecord } from '@/data/mappers/event-mapper';
import type { EventRow } from '@/data/mappers/event-mapper';
import type { AdminEventRecord } from '@/data/types/records';
import { classifyTicketDestination } from '@/features/events/domain/ticket-destination-classification';
import {
  classifyTicketAcceptanceState,
  readCanonicalTicket,
} from '@/features/events/domain/canonical-ticket-read';
import { writeCanonicalTicketFields } from '@/features/events/domain/canonical-ticket-writer';
import type { TicketUrlCandidate } from '@/features/events/domain/canonical-ticket-selection';
import { isGenericTicketUrl } from '@/features/events/domain/ticket-url-quality';
import { invalidateConsumerEventCaches } from '@/features/events/formatting/consumer-cache-invalidation';
import { opsClient } from './ops-supabase-rows';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const REAL_DATA = join(ROOT, 'docs/real-data');
const OUT_PREFLIGHT = join(REAL_DATA, '_phase471_ticket_preflight.json');
const OUT_FIELD_MATRIX = join(REAL_DATA, '_phase471_ticket_field_matrix.json');
const OUT_CLASSIFICATION = join(REAL_DATA, '_phase471_ticket_url_classification.json');
const OUT_SHOP_ROOT = join(REAL_DATA, '_phase471_shop_root_audit.json');
const OUT_BACKUP = join(REAL_DATA, '_phase471_ticket_repair_backup.json');
const OUT_BEFORE_AFTER = join(REAL_DATA, '_phase471_ticket_before_after.json');
const OUT_RUNS = join(REAL_DATA, '_phase471_ticket_repair_runs.json');
const OUT_ACCEPTANCE = join(REAL_DATA, '_phase471_ticket_acceptance_matrix.json');
const OUT_REPORT = join(ROOT, 'docs/PHASE_471_CANONICAL_TICKET_DOMAIN_REPORT.md');

const REPRESENTATIVE_TITLES = [
  'LEVI',
  'Bootshaus on a Ship Vol. III',
  'Bootshaus on a Ship Vol. IV',
  'Sommerfest',
  'MDMA',
  'Blacklist',
  'BC173',
  'Vision Ekstase',
  'PURE TECHNO',
] as const;

type LineupFingerprint = {
  structuredCount: number;
  legacyCount: number;
  artistNamesHash: string;
};

type TicketEventRow = {
  eventId: string;
  title: string;
  startDate: string;
  venueName?: string;
  organizerName?: string;
  ticketUrl?: string;
  websiteUrl?: string;
  priceText?: string;
  ticketStatus?: string;
  ticketPhases?: unknown;
  origins: Array<Record<string, unknown>>;
  importCandidates: string[];
  canonicalRead: ReturnType<typeof readCanonicalTicket>;
  acceptanceState: string;
  detailBlocked: boolean;
  shopRoot: boolean;
};

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2));
}

function hashNames(names: string[]): string {
  return createHash('sha256').update(names.sort().join('|')).digest('hex').slice(0, 16);
}

async function lineupFingerprint(eventId: string): Promise<LineupFingerprint> {
  const c = opsClient();
  const [{ count: structuredCount }, { count: legacyCount }, { data: legacy }] = await Promise.all([
    c.from('event_lineup_entries').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
    c.from('event_artists').select('artist_id', { count: 'exact', head: true }).eq('event_id', eventId),
    c
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

async function collectTicketCandidates(eventId: string): Promise<TicketUrlCandidate[]> {
  const c = opsClient();
  const candidates: TicketUrlCandidate[] = [];
  const { data: imports } = await c
    .from('import_records')
    .select('normalized_payload, source_url, source_id')
    .eq('resulting_event_id', eventId);
  const { data: refs } = await c
    .from('event_source_references')
    .select('source_url, original_url, metadata')
    .eq('canonical_event_id', eventId);

  for (const row of imports ?? []) {
    const payload = (row.normalized_payload ?? {}) as Record<string, unknown>;
    const metadata = payload.sourceMetadata as Record<string, unknown> | undefined;
    if (typeof payload.ticketUrl === 'string') {
      candidates.push({ url: payload.ticketUrl, sourceId: row.source_id, field: 'import.ticketUrl' });
    }
    if (typeof payload.eventUrl === 'string') {
      candidates.push({ url: payload.eventUrl, sourceId: row.source_id, field: 'import.eventUrl' });
    }
    if (typeof metadata?.ticketUrl === 'string') {
      candidates.push({ url: metadata.ticketUrl, sourceId: row.source_id, field: 'import.metadata.ticketUrl' });
    }
    if (row.source_url) {
      candidates.push({ url: row.source_url, sourceId: row.source_id, field: 'import.source_url' });
    }
  }
  for (const ref of refs ?? []) {
    if (ref.source_url) candidates.push({ url: String(ref.source_url), field: 'origin.source_url' });
    if (ref.original_url) candidates.push({ url: String(ref.original_url), field: 'origin.original_url' });
    const meta = ref.metadata as Record<string, unknown> | undefined;
    if (typeof meta?.ticketUrl === 'string') {
      candidates.push({ url: meta.ticketUrl, field: 'origin.metadata.ticketUrl' });
    }
  }
  return candidates;
}

async function loadPublishedEvents(): Promise<AdminEventRecord[]> {
  const c = opsClient();
  const { data, error } = await c.from('events').select('*').eq('status', 'published');
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapEventRowToAdminRecord(row as EventRow));
}

async function buildEventTicketRow(event: AdminEventRecord): Promise<TicketEventRow> {
  const c = opsClient();
  const candidates = await collectTicketCandidates(event.id);
  const { data: refs } = await c
    .from('event_source_references')
    .select('*')
    .eq('canonical_event_id', event.id);

  const detailBlocked = candidates.some((candidate) => {
    // detail blocked inferred from import metadata in preflight only
    return false;
  });

  const canonicalRead = readCanonicalTicket({
    ticketUrl: event.ticketUrl,
    websiteUrl: event.websiteUrl,
    priceText: event.priceText,
    ticketStatus: event.ticketStatus,
    ticketPhases: event.ticketPhases,
    salesStartAt: event.salesStartAt,
    salesEndAt: event.salesEndAt,
    extraUrlCandidates: candidates,
    detailBlocked,
  });

  return {
    eventId: event.id,
    title: event.title,
    startDate: event.startDate,
    venueName: event.venueName,
    organizerName: event.organizerName,
    ticketUrl: event.ticketUrl,
    websiteUrl: event.websiteUrl,
    priceText: event.priceText,
    ticketStatus: event.ticketStatus,
    ticketPhases: event.ticketPhases,
    origins: refs ?? [],
    importCandidates: candidates.map((c) => c.url),
    canonicalRead,
    acceptanceState: classifyTicketAcceptanceState(canonicalRead),
    detailBlocked: canonicalRead.detailBlocked,
    shopRoot: isGenericTicketUrl(event.ticketUrl),
  };
}

function summarizeAcceptance(rows: TicketEventRow[]) {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.acceptanceState] = (counts[row.acceptanceState] ?? 0) + 1;
  }
  return {
    totalPublished: rows.length,
    acceptanceCounts: counts,
    directPurchase: rows.filter((r) => r.acceptanceState === 'direct_purchase_correct').length,
    ticketEventPage: rows.filter((r) => r.acceptanceState === 'ticket_event_page_correct').length,
    officialEventPageOnly: rows.filter((r) => r.acceptanceState === 'official_event_page_only').length,
    shopRootFallbacks: rows.filter((r) => r.acceptanceState === 'shop_root_fallback_only').length,
    listingFallbacks: rows.filter((r) => r.acceptanceState === 'listing_fallback_only').length,
    detailBlocked: rows.filter((r) => r.acceptanceState === 'external_detail_blocked').length,
    noTicketData: rows.filter((r) => r.acceptanceState === 'source_has_no_ticket_data').length,
    reviewRequired: rows.filter((r) => r.acceptanceState === 'review_required').length,
    incorrect: rows.filter((r) => r.acceptanceState === 'incorrect').length,
    pricesPresent: rows.filter((r) => Boolean(r.priceText?.trim())).length,
    availabilityPresent: rows.filter((r) => r.canonicalRead.availability !== 'unknown').length,
    phasesPresent: rows.filter((r) => Array.isArray(r.ticketPhases) && r.ticketPhases.length > 0).length,
    shopRootUrls: rows.filter((r) => r.shopRoot).length,
    homepagesAsTicket: rows.filter(
      (r) => r.canonicalRead.destinationClass === 'organizer_or_venue_homepage' && Boolean(r.ticketUrl),
    ).length,
  };
}

async function runPreflight(): Promise<TicketEventRow[]> {
  const events = await loadPublishedEvents();
  const rows: TicketEventRow[] = [];
  for (const event of events) {
    rows.push(await buildEventTicketRow(event));
  }

  const generatedAt = new Date().toISOString();
  const summary = summarizeAcceptance(rows);

  writeJson(OUT_PREFLIGHT, { generatedAt, summary, events: rows });
  writeJson(OUT_FIELD_MATRIX, {
    generatedAt,
    events: rows.map((row) => ({
      eventId: row.eventId,
      title: row.title,
      officialEventUrl: row.canonicalRead.officialEventUrl,
      purchaseUrl: row.canonicalRead.purchaseUrl,
      publicCtaUrl: row.canonicalRead.publicCtaUrl,
      destinationClass: row.canonicalRead.destinationClass,
      priceText: row.priceText,
      availability: row.canonicalRead.availability,
      ticketPhases: row.ticketPhases,
      acceptanceState: row.acceptanceState,
    })),
  });
  writeJson(
    OUT_CLASSIFICATION,
    rows.flatMap((row) =>
      [row.ticketUrl, row.websiteUrl, ...row.importCandidates]
        .filter(Boolean)
        .map((url) => ({
          eventId: row.eventId,
          title: row.title,
          url,
          ...classifyTicketDestination(url),
        })),
    ),
  );
  writeJson(
    OUT_SHOP_ROOT,
    rows
      .filter((row) => row.shopRoot || row.acceptanceState === 'shop_root_fallback_only')
      .map((row) => ({
        eventId: row.eventId,
        title: row.title,
        currentTicketUrl: row.ticketUrl,
        destinationClass: row.canonicalRead.destinationClass,
        eventSpecificInImports: row.importCandidates.some(
          (url) => classifyTicketDestination(url).destinationClass === 'ticket_platform_event',
        ),
        acceptanceState: row.acceptanceState,
        importCandidateCount: row.importCandidates.length,
      })),
  );
  writeJson(OUT_ACCEPTANCE, { generatedAt, ...summary });

  console.log('Preflight complete:', JSON.stringify(summary, null, 2));
  return rows;
}

async function runBackup(): Promise<void> {
  const events = await loadPublishedEvents();
  const c = opsClient();
  const { data: provenance } = await c.from('field_provenance').select('*');
  writeJson(OUT_BACKUP, {
    generatedAt: new Date().toISOString(),
    events: events.map((event) => ({
      id: event.id,
      title: event.title,
      ticketUrl: event.ticketUrl,
      websiteUrl: event.websiteUrl,
      priceText: event.priceText,
      ticketStatus: event.ticketStatus,
      ticketPhases: event.ticketPhases,
      lineupFingerprint: null,
    })),
    fieldProvenanceCount: provenance?.length ?? 0,
  });
  for (const event of events) {
    const fp = await lineupFingerprint(event.id);
    const backup = JSON.parse(readFileSync(OUT_BACKUP, 'utf8')) as {
      events: Array<{ id: string; lineupFingerprint: LineupFingerprint | null }>;
    };
    const entry = backup.events.find((row) => row.id === event.id);
    if (entry) entry.lineupFingerprint = fp;
  }
  writeJson(OUT_BACKUP, JSON.parse(readFileSync(OUT_BACKUP, 'utf8')));
  console.log(`Backup written: ${events.length} events`);
}

async function runRepair(pass: number, dryRun: boolean): Promise<number> {
  const events = await loadPublishedEvents();
  let mutations = 0;
  const details: Array<Record<string, unknown>> = [];

  for (const event of events) {
    const beforeLineup = await lineupFingerprint(event.id);
    const candidates = await collectTicketCandidates(event.id);
    const write = writeCanonicalTicketFields({
      existing: event,
      extraCandidates: candidates,
    });

    if (!write.changed) {
      continue;
    }

    if (!dryRun) {
      const patch = write.patch;
      const { error } = await opsClient()
        .from('events')
        .update({
          ticket_url: patch.ticketUrl ?? event.ticketUrl ?? null,
          website_url: patch.websiteUrl ?? event.websiteUrl ?? null,
          price_text: patch.priceText ?? event.priceText ?? null,
          ticket_status: patch.ticketStatus ?? event.ticketStatus ?? null,
          ticket_phases: patch.ticketPhases ?? event.ticketPhases ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', event.id);
      if (error) throw new Error(error.message);
    }

    const afterLineup = dryRun ? beforeLineup : await lineupFingerprint(event.id);
    if (
      beforeLineup.structuredCount !== afterLineup.structuredCount ||
      beforeLineup.legacyCount !== afterLineup.legacyCount ||
      beforeLineup.artistNamesHash !== afterLineup.artistNamesHash
    ) {
      throw new Error(`Lineup mutation detected for ${event.id}`);
    }

    mutations += write.fieldChanges.length;
    details.push({
      eventId: event.id,
      title: event.title,
      fieldChanges: write.fieldChanges,
      beforeTicketUrl: event.ticketUrl,
      afterTicketUrl: write.patch.ticketUrl ?? event.ticketUrl,
      destinationClass: write.snapshot.destinationClass,
      acceptanceState: write.snapshot.acceptanceState,
    });
  }

  const runs = existsSync(OUT_RUNS)
    ? (JSON.parse(readFileSync(OUT_RUNS, 'utf8')) as { runs: [] }).runs
    : [];
  runs.push({ at: new Date().toISOString(), pass, dryRun, mutations, details });
  writeJson(OUT_RUNS, { runs });

  console.log(`Repair pass ${pass}: ${mutations} field mutations (${dryRun ? 'dry-run' : 'live'})`);
  return mutations;
}

async function runAuditAfter(): Promise<void> {
  const rows = await runPreflight();
  const before = existsSync(OUT_BACKUP)
    ? (JSON.parse(readFileSync(OUT_BACKUP, 'utf8')) as { events: Array<{ id: string; ticketUrl?: string }> })
        .events
    : [];
  const beforeById = new Map(before.map((row) => [row.id, row]));
  writeJson(
    OUT_BEFORE_AFTER,
    rows.map((row) => ({
      eventId: row.eventId,
      title: row.title,
      beforeTicketUrl: beforeById.get(row.eventId)?.ticketUrl,
      afterTicketUrl: row.ticketUrl,
      destinationClass: row.canonicalRead.destinationClass,
      acceptanceState: row.acceptanceState,
      officialEventUrl: row.canonicalRead.officialEventUrl,
      publicCtaUrl: row.canonicalRead.publicCtaUrl,
      ctaLabel: row.canonicalRead.ctaLabel,
    })),
  );
}

function writeReport(before: ReturnType<typeof summarizeAcceptance>, after: ReturnType<typeof summarizeAcceptance>, repairMutations: number) {
  const md = `# Phase 4.7.1 — Canonical Ticket Domain Report

**Generated:** ${new Date().toISOString()}

## Acceptance counts

| State | Before | After |
|-------|--------|-------|
| Total published | ${before.totalPublished} | ${after.totalPublished} |
| direct_purchase_correct | ${before.directPurchase} | ${after.directPurchase} |
| ticket_event_page_correct | ${before.ticketEventPage} | ${after.ticketEventPage} |
| official_event_page_only | ${before.officialEventPageOnly} | ${after.officialEventPageOnly} |
| shop_root_fallback_only | ${before.shopRootFallbacks} | ${after.shopRootFallbacks} |
| listing_fallback_only | ${before.listingFallbacks} | ${after.listingFallbacks} |
| external_detail_blocked | ${before.detailBlocked} | ${after.detailBlocked} |
| source_has_no_ticket_data | ${before.noTicketData} | ${after.noTicketData} |
| review_required | ${before.reviewRequired} | ${after.reviewRequired} |
| incorrect | ${before.incorrect} | ${after.incorrect} |

## Metrics

- Corrected ticket destinations (repair mutations): **${repairMutations}**
- Remaining shop-root fallbacks: **${after.shopRootFallbacks}**
- Events with prices: **${after.pricesPresent}**
- Events with availability: **${after.availabilityPresent}**
- Externally blocked: **${after.detailBlocked}**
- Lineup unchanged: **verified via fingerprint per event**

## Representative events

See \`_phase471_ticket_before_after.json\` for LEVI, Bootshaus Ship, Sommerfest, MDMA, Blacklist, BC173, Vision Ekstase, PURE TECHNO.
`;
  writeFileSync(OUT_REPORT, md);
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'preflight';
  if (command === 'preflight' || command === 'inventory' || command === 'classify') {
    await runPreflight();
    return;
  }
  if (command === 'backup') {
    await runBackup();
    return;
  }
  if (command === 'repair') {
    const mutations = await runRepair(1, false);
    invalidateConsumerEventCaches();
    console.log(`Repair complete: ${mutations} mutations`);
    return;
  }
  if (command === 'audit-after' || command === 'report') {
    await runAuditAfter();
    return;
  }
  if (command === 'full') {
    const beforeRows = await runPreflight();
    const beforeSummary = summarizeAcceptance(beforeRows);
    await runBackup();
    const pass1 = await runRepair(1, false);
    const pass2 = await runRepair(2, false);
    if (pass2 !== 0) {
      throw new Error(`Idempotency failed: pass 2 produced ${pass2} mutations`);
    }
    invalidateConsumerEventCaches();
    const afterRows = await runPreflight();
    const afterSummary = summarizeAcceptance(afterRows);
    await runAuditAfter();
    writeReport(beforeSummary, afterSummary, pass1);
    console.log('Full run complete', { pass1, pass2, before: beforeSummary, after: afterSummary });
    return;
  }
  throw new Error(`Unknown command: ${command}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
