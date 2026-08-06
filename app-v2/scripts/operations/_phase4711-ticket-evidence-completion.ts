/**
 * Phase 4.7.1.1 — Ticket Evidence Completion and Mobile Truth Validation
 *
 * Usage:
 *   npx tsx scripts/operations/_phase4711-ticket-evidence-completion.ts baseline
 *   npx tsx scripts/operations/_phase4711-ticket-evidence-completion.ts discover
 *   npx tsx scripts/operations/_phase4711-ticket-evidence-completion.ts preflight
 *   npx tsx scripts/operations/_phase4711-ticket-evidence-completion.ts backup
 *   npx tsx scripts/operations/_phase4711-ticket-evidence-completion.ts repair
 *   npx tsx scripts/operations/_phase4711-ticket-evidence-completion.ts audit-after
 *   npx tsx scripts/operations/_phase4711-ticket-evidence-completion.ts report
 *   npx tsx scripts/operations/_phase4711-ticket-evidence-completion.ts full
 */
import './bootstrap-ops-supabase';

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapEventRowToAdminRecord } from '@/data/mappers/event-mapper';
import type { EventRow } from '@/data/mappers/event-mapper';
import type { AdminEventRecord } from '@/data/types/records';
import { parseTicketKingsEventDetailHtml } from '@/features/aggregation/connectors/ticket-platform/adapters/ticket-kings-adapter';
import { formatGermanTicketPrice } from '@/features/aggregation/connectors/ticket-platform/format-ticket-price';
import {
  extractOutboundTicketLinksFromHtml,
  isTicketDestinationUrl,
} from '@/features/aggregation/domain/outbound-ticket-html-discovery';
import { pickBestOutboundTicketLink } from '@/features/aggregation/domain/cross-source-ticket-discovery';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import {
  classifyTicketAcceptanceState,
  readCanonicalTicket,
} from '@/features/events/domain/canonical-ticket-read';
import { writeCanonicalTicketFields } from '@/features/events/domain/canonical-ticket-writer';
import type { TicketUrlCandidate } from '@/features/events/domain/canonical-ticket-selection';
import { formatTicketAvailabilityLabelDe } from '@/features/events/domain/canonical-ticket-availability-label';
import { isGenericTicketUrl } from '@/features/events/domain/ticket-url-quality';
import { invalidateConsumerEventCaches } from '@/features/events/formatting/consumer-cache-invalidation';
import { opsClient } from './ops-supabase-rows';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const REAL_DATA = join(ROOT, 'docs/real-data');
const OUT_MOBILE_BASELINE = join(REAL_DATA, '_phase4711_mobile_baseline.json');
const OUT_SHOP_ROOT_EVIDENCE = join(REAL_DATA, '_phase4711_shop_root_evidence.json');
const OUT_FIELD_TRACES = join(REAL_DATA, '_phase4711_ticket_field_traces.json');
const OUT_UI_TRACES = join(REAL_DATA, '_phase4711_ticket_ui_traces.json');
const OUT_BEFORE_AFTER = join(REAL_DATA, '_phase4711_before_after.json');
const OUT_BACKUP = join(REAL_DATA, '_phase4711_repair_backup.json');
const OUT_RUNS = join(REAL_DATA, '_phase4711_repair_runs.json');
const OUT_ACCEPTANCE = join(REAL_DATA, '_phase4711_acceptance_matrix.json');
const OUT_REPORT = join(ROOT, 'docs/PHASE_4711_TICKET_EVIDENCE_COMPLETION_REPORT.md');
const PRIOR_SHOP_ROOT = join(REAL_DATA, '_phase471_shop_root_audit.json');

const REPRESENTATIVE_TITLE_PATTERNS = [
  /sommerfest.*elektroküche/i,
  /^mdma/i,
  /presents levi/i,
  /bc173.*let's get loco|pres\. bc173/i,
  /blacklist festival/i,
  /ship vol\. iii/i,
] as const;

const FETCH_HEADERS = {
  'User-Agent': 'EternalRave-SourceBot/1.0 (+https://eternalrave.app)',
  Accept: 'text/html,application/xhtml+xml',
};

type LineupFingerprint = {
  structuredCount: number;
  legacyCount: number;
  artistNamesHash: string;
};

type ShopRootUpgradeClass =
  | 'upgraded_to_direct_purchase'
  | 'upgraded_to_ticket_event_page'
  | 'official_event_page_only'
  | 'confirmed_shop_root_only'
  | 'external_detail_blocked'
  | 'review_required';

type MissingFieldClass =
  | 'source_provides_pipeline_lost'
  | 'source_provides_ui_lost'
  | 'detail_page_externally_blocked'
  | 'source_genuinely_missing'
  | 'field_in_inaccessible_source'
  | 'review_required';

type DiscoveredEvidence = {
  eventId: string;
  title: string;
  officialEventUrl?: string;
  fetchedAt: string;
  httpStatus: number;
  discoveredUrls: string[];
  bestEventSpecificUrl?: string;
  bestClass?: string;
  inStaticHtml: boolean;
  inJsonLd: boolean;
  inDataAttribute: boolean;
  previouslyInImports: boolean;
  onlyShopRootStored: boolean;
  evidenceNotes: string[];
};

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2));
}

function hashNames(names: string[]): string {
  return createHash('sha256').update(names.sort().join('|')).digest('hex').slice(0, 16);
}

async function fetchHtml(url: string): Promise<{ status: number; html: string }> {
  const response = await fetch(url, { headers: FETCH_HEADERS, redirect: 'follow' });
  const html = await response.text();
  return { status: response.status, html };
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

function isRepresentativeEvent(title: string): boolean {
  return REPRESENTATIVE_TITLE_PATTERNS.some((pattern) => pattern.test(title));
}

function buildCanonicalRead(event: AdminEventRecord, extraCandidates: TicketUrlCandidate[] = []) {
  return readCanonicalTicket({
    ticketUrl: event.ticketUrl,
    websiteUrl: event.websiteUrl,
    priceText: event.priceText,
    ticketStatus: event.ticketStatus,
    ticketPhases: event.ticketPhases,
    salesStartAt: event.salesStartAt,
    salesEndAt: event.salesEndAt,
    extraUrlCandidates: extraCandidates,
  });
}

function buildUiTrace(event: AdminEventRecord) {
  const canonical = buildCanonicalRead(event);
  return {
    eventId: event.id,
    title: event.title,
    ctaLabel: canonical.ctaLabel,
    ctaDestination: canonical.publicCtaUrl,
    expectedDestinationClass: canonical.destinationClass,
    visiblePriceHeader: canonical.priceText,
    visiblePriceTicketSection: canonical.priceText,
    visibleAvailabilityTicketSection:
      canonical.availability !== 'unknown'
        ? formatTicketAvailabilityLabelDe(canonical.availability)
        : undefined,
    visiblePhases: (event.ticketPhases ?? []).length,
    canonicalTicket: canonical,
  };
}

async function discoverOfficialPageEvidence(event: AdminEventRecord, importCandidates: string[]): Promise<DiscoveredEvidence> {
  const officialUrl = event.websiteUrl;
  const notes: string[] = [];
  if (!officialUrl) {
    return {
      eventId: event.id,
      title: event.title,
      officialEventUrl: officialUrl,
      fetchedAt: new Date().toISOString(),
      httpStatus: 0,
      discoveredUrls: [],
      inStaticHtml: false,
      inJsonLd: false,
      inDataAttribute: false,
      previouslyInImports: false,
      onlyShopRootStored: isGenericTicketUrl(event.ticketUrl),
      evidenceNotes: ['no_official_event_url'],
    };
  }

  let status = 0;
  let html = '';
  try {
    const fetched = await fetchHtml(officialUrl);
    status = fetched.status;
    html = fetched.html;
  } catch (error) {
    notes.push(`fetch_failed:${error instanceof Error ? error.message : String(error)}`);
  }

  const rawUrls = html ? extractOutboundTicketLinksFromHtml(html) : [];
  const best = pickBestOutboundTicketLink(rawUrls);
  const eventSpecific = rawUrls.filter(
    (entry) => entry.class === 'ticket_io_event' || entry.class === 'ticket_kings_event',
  );

  const inStaticHtml = Boolean(html && /<a[^>]+href=["'][^"']*ticket\.io\/[A-Za-z0-9]+/i.test(html));
  const inJsonLd = Boolean(html && /application\/ld\+json[\s\S]*ticket\.io/i.test(html));
  const inDataAttribute = Boolean(html && /data-(?:href|url|ticket-url|link)\s*=\s*["'][^"']*ticket/i.test(html));

  const discoveredUrls = [...new Set(rawUrls.map((entry) => entry.url))];
  const previouslyInImports = eventSpecific.some((entry) =>
    importCandidates.some((candidate) => candidate.includes(entry.url.replace(/\/$/, ''))),
  );

  if (eventSpecific.length === 0) {
    notes.push('no_event_specific_ticket_url_in_official_page');
  }
  if (isGenericTicketUrl(event.ticketUrl) && eventSpecific.length > 0) {
    notes.push('shop_root_stored_despite_event_specific_evidence');
  }

  return {
    eventId: event.id,
    title: event.title,
    officialEventUrl: officialUrl,
    fetchedAt: new Date().toISOString(),
    httpStatus: status,
    discoveredUrls,
    bestEventSpecificUrl: best?.class === 'ticket_io_event' || best?.class === 'ticket_kings_event' ? best.url : undefined,
    bestClass: best?.class,
    inStaticHtml,
    inJsonLd,
    inDataAttribute,
    previouslyInImports,
    onlyShopRootStored: isGenericTicketUrl(event.ticketUrl),
    evidenceNotes: notes,
  };
}

async function fetchTicketKingsCandidate(ticketUrl: string): Promise<CanonicalImportEvent | undefined> {
  if (!/ticketkings\.de\/event\//i.test(ticketUrl)) {
    return undefined;
  }
  try {
    const { html } = await fetchHtml(ticketUrl);
    const parsed = parseTicketKingsEventDetailHtml(html, {
      platform: 'ticket_king',
      shopSlug: 'ticketkings',
      listUrl: 'https://ticketkings.de/all-events/',
      timezone: 'Europe/Berlin',
    });
    if (!parsed) {
      return undefined;
    }
    const priceText =
      parsed.priceAmount !== undefined
        ? formatGermanTicketPrice(parsed.priceAmount, parsed.priceCurrency ?? 'EUR')
        : undefined;
    return {
      externalId: parsed.externalId,
      title: parsed.title,
      startDate: parsed.startDate,
      timezone: parsed.timezone,
      ticketUrl: parsed.ticketUrl,
      eventUrl: parsed.eventUrl,
      priceAmount: parsed.priceAmount,
      priceText,
      sourceMetadata: { platform: 'ticket_king', evidenceSource: 'phase4711_live_fetch' },
    };
  } catch {
    return undefined;
  }
}

function classifyShopRootUpgrade(
  beforeAcceptance: string,
  afterAcceptance: string,
  afterDestination: string,
): ShopRootUpgradeClass {
  if (beforeAcceptance !== 'shop_root_fallback_only') {
    return 'review_required';
  }
  if (afterAcceptance === 'shop_root_fallback_only') {
    return 'confirmed_shop_root_only';
  }
  if (afterDestination === 'redirect_or_tracking' || afterAcceptance === 'direct_purchase_correct') {
    return 'upgraded_to_direct_purchase';
  }
  if (afterAcceptance === 'ticket_event_page_correct') {
    return 'upgraded_to_ticket_event_page';
  }
  if (afterAcceptance === 'official_event_page_only') {
    return 'official_event_page_only';
  }
  if (afterAcceptance === 'external_detail_blocked') {
    return 'external_detail_blocked';
  }
  return 'review_required';
}

async function runBaseline(): Promise<void> {
  const events = await loadPublishedEvents();
  const shopRootIds = new Set(
    existsSync(PRIOR_SHOP_ROOT)
      ? (JSON.parse(readFileSync(PRIOR_SHOP_ROOT, 'utf8')) as Array<{ eventId: string }>).map((row) => row.eventId)
      : events.filter((event) => isGenericTicketUrl(event.ticketUrl)).map((event) => event.id),
  );

  const selected = events.filter((event) => isRepresentativeEvent(event.title) || shopRootIds.has(event.id));
  const baseline = [];
  for (const event of selected) {
    const candidates = await collectTicketCandidates(event.id);
    baseline.push({
      ...buildUiTrace(event),
      importCandidateCount: candidates.length,
      shopRootFallback: shopRootIds.has(event.id),
    });
  }
  writeJson(OUT_MOBILE_BASELINE, { generatedAt: new Date().toISOString(), events: baseline });
  console.log(`Baseline written for ${baseline.length} events`);
}

async function runDiscover(): Promise<DiscoveredEvidence[]> {
  const events = await loadPublishedEvents();
  const shopRootEvents = events.filter(
    (event) => isGenericTicketUrl(event.ticketUrl) || classifyTicketAcceptanceState(buildCanonicalRead(event)) === 'shop_root_fallback_only',
  );
  const evidence: DiscoveredEvidence[] = [];
  for (const event of shopRootEvents) {
    const candidates = (await collectTicketCandidates(event.id)).map((entry) => entry.url);
    evidence.push(await discoverOfficialPageEvidence(event, candidates));
  }
  writeJson(OUT_SHOP_ROOT_EVIDENCE, { generatedAt: new Date().toISOString(), events: evidence });
  console.log(`Discovery complete for ${evidence.length} shop-root events`);
  return evidence;
}

async function runBackup(): Promise<void> {
  const events = await loadPublishedEvents();
  const backupEvents = [];
  for (const event of events) {
    backupEvents.push({
      id: event.id,
      title: event.title,
      ticketUrl: event.ticketUrl,
      websiteUrl: event.websiteUrl,
      priceText: event.priceText,
      ticketStatus: event.ticketStatus,
      ticketPhases: event.ticketPhases,
      lineupFingerprint: await lineupFingerprint(event.id),
    });
  }
  writeJson(OUT_BACKUP, { generatedAt: new Date().toISOString(), events: backupEvents });
  console.log(`Backup written: ${backupEvents.length} events`);
}

async function runRepair(pass: number, dryRun: boolean, evidenceRows: DiscoveredEvidence[]): Promise<number> {
  const events = await loadPublishedEvents();
  const evidenceById = new Map(evidenceRows.map((row) => [row.eventId, row]));
  let mutations = 0;
  const details: Array<Record<string, unknown>> = [];

  for (const event of events) {
    const beforeLineup = await lineupFingerprint(event.id);
    const candidates = await collectTicketCandidates(event.id);
    const evidence = evidenceById.get(event.id);

    const discoveryCandidates: TicketUrlCandidate[] = [];
    if (evidence?.bestEventSpecificUrl && isTicketDestinationUrl(evidence.bestEventSpecificUrl)) {
      discoveryCandidates.push({
        url: evidence.bestEventSpecificUrl,
        field: 'website.html.discovery',
        confidence: 0.98,
      });
    }
    for (const url of evidence?.discoveredUrls ?? []) {
      if (url === evidence?.bestEventSpecificUrl || !isTicketDestinationUrl(url)) {
        continue;
      }
      discoveryCandidates.push({
        url,
        field: 'website.html.discovery',
        confidence: 0.85,
      });
    }

    let candidate: CanonicalImportEvent | undefined;
    const ticketUrl = event.ticketUrl ?? '';
    if (
      (!event.priceText?.trim() || event.ticketPhases?.length === 0) &&
      /ticketkings\.de\/event\//i.test(ticketUrl)
    ) {
      candidate = await fetchTicketKingsCandidate(ticketUrl);
    }

    const write = writeCanonicalTicketFields({
      existing: event,
      extraCandidates: [...candidates, ...discoveryCandidates],
      candidate,
      fillOnly: false,
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
      beforePriceText: event.priceText,
      afterPriceText: write.patch.priceText ?? event.priceText,
      destinationClass: write.snapshot.destinationClass,
      acceptanceState: write.snapshot.acceptanceState,
      discoveredUrl: evidence?.bestEventSpecificUrl,
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

async function runAuditAfter(beforeBackup: { events: Array<Record<string, unknown>> }): Promise<void> {
  const events = await loadPublishedEvents();
  const beforeById = new Map(beforeBackup.events.map((row) => [String(row.id), row]));
  const shopRootBefore = existsSync(PRIOR_SHOP_ROOT)
    ? (JSON.parse(readFileSync(PRIOR_SHOP_ROOT, 'utf8')) as Array<{ eventId: string; acceptanceState: string }>)
    : [];

  const fieldTraces = [];
  const uiTraces = [];
  const beforeAfter = [];
  const acceptanceRows = [];

  let pricesGained = 0;
  let availabilityGained = 0;

  for (const event of events) {
    const before = beforeById.get(event.id) as {
      ticketUrl?: string;
      priceText?: string;
      lineupFingerprint?: LineupFingerprint;
    } | undefined;
    const canonical = buildCanonicalRead(event);
    const ui = buildUiTrace(event);
    const beforeCanonical = before
      ? readCanonicalTicket({
          ticketUrl: before.ticketUrl,
          websiteUrl: event.websiteUrl,
          priceText: before.priceText,
          ticketStatus: event.ticketStatus,
          ticketPhases: event.ticketPhases,
        })
      : undefined;

    if (!before?.priceText?.trim() && event.priceText?.trim()) {
      pricesGained += 1;
    }
    if (
      (beforeCanonical?.availability === 'unknown' || !beforeCanonical) &&
      canonical.availability !== 'unknown'
    ) {
      availabilityGained += 1;
    }

    const priorShop = shopRootBefore.find((row) => row.eventId === event.id);
    if (priorShop?.acceptanceState === 'shop_root_fallback_only') {
      acceptanceRows.push({
        eventId: event.id,
        title: event.title,
        classification: classifyShopRootUpgrade(
          'shop_root_fallback_only',
          classifyTicketAcceptanceState(canonical),
          canonical.destinationClass,
        ),
        beforeTicketUrl: before?.ticketUrl,
        afterTicketUrl: event.ticketUrl,
        officialEventUrl: event.websiteUrl,
        publicCtaUrl: canonical.publicCtaUrl,
      });
    }

    fieldTraces.push({
      eventId: event.id,
      title: event.title,
      officialEventUrl: canonical.officialEventUrl,
      purchaseUrl: canonical.purchaseUrl,
      destinationClass: canonical.destinationClass,
      minimumPrice: canonical.minimumPrice,
      maximumPrice: canonical.maximumPrice,
      priceText: event.priceText,
      currency: canonical.currency,
      availability: canonical.availability,
      ticketStatus: event.ticketStatus,
      ticketPhases: event.ticketPhases,
      acceptanceState: classifyTicketAcceptanceState(canonical),
    });

    uiTraces.push(ui);
    beforeAfter.push({
      eventId: event.id,
      title: event.title,
      beforeTicketUrl: before?.ticketUrl,
      afterTicketUrl: event.ticketUrl,
      beforePriceText: before?.priceText,
      afterPriceText: event.priceText,
      lineupUnchanged:
        before?.lineupFingerprint &&
        JSON.stringify(before.lineupFingerprint) === JSON.stringify(await lineupFingerprint(event.id)),
    });
  }

  writeJson(OUT_FIELD_TRACES, { generatedAt: new Date().toISOString(), events: fieldTraces });
  writeJson(OUT_UI_TRACES, { generatedAt: new Date().toISOString(), events: uiTraces });
  writeJson(OUT_BEFORE_AFTER, { generatedAt: new Date().toISOString(), events: beforeAfter });
  writeJson(OUT_ACCEPTANCE, {
    generatedAt: new Date().toISOString(),
    shopRootUpgrades: acceptanceRows,
    pricesGained,
    availabilityGained,
    lineupFingerprintsVerified: beforeAfter.every((row) => row.lineupUnchanged !== false),
  });
  console.log('Audit-after complete', { pricesGained, availabilityGained, shopRootAudited: acceptanceRows.length });
}

function writeReport(summary: Record<string, unknown>): void {
  const md = `# Phase 4.7.1.1 — Ticket Evidence Completion Report

**Generated:** ${new Date().toISOString()}

## Summary

${Object.entries(summary)
  .map(([key, value]) => `- **${key}**: ${JSON.stringify(value)}`)
  .join('\n')}

## Deliverables

- \`_phase4711_mobile_baseline.json\`
- \`_phase4711_shop_root_evidence.json\`
- \`_phase4711_ticket_field_traces.json\`
- \`_phase4711_ticket_ui_traces.json\`
- \`_phase4711_before_after.json\`
- \`_phase4711_repair_backup.json\`
- \`_phase4711_repair_runs.json\`
- \`_phase4711_acceptance_matrix.json\`
`;
  writeFileSync(OUT_REPORT, md);
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'preflight';

  if (command === 'baseline') {
    await runBaseline();
    return;
  }
  if (command === 'discover') {
    await runDiscover();
    return;
  }
  if (command === 'preflight') {
    await runBaseline();
    await runDiscover();
    return;
  }
  if (command === 'backup') {
    await runBackup();
    return;
  }
  if (command === 'repair') {
    const evidence = existsSync(OUT_SHOP_ROOT_EVIDENCE)
      ? (JSON.parse(readFileSync(OUT_SHOP_ROOT_EVIDENCE, 'utf8')) as { events: DiscoveredEvidence[] }).events
      : await runDiscover();
    const mutations = await runRepair(1, false, evidence);
    invalidateConsumerEventCaches();
    console.log(`Repair complete: ${mutations} mutations`);
    return;
  }
  if (command === 'audit-after' || command === 'report') {
    const backup = existsSync(OUT_BACKUP)
      ? (JSON.parse(readFileSync(OUT_BACKUP, 'utf8')) as { events: Array<Record<string, unknown>> })
      : { events: [] };
    await runAuditAfter({ events: backup.events });
    if (command === 'report') {
      const acceptance = existsSync(OUT_ACCEPTANCE)
        ? (JSON.parse(readFileSync(OUT_ACCEPTANCE, 'utf8')) as Record<string, unknown>)
        : {};
      writeReport(acceptance);
    }
    return;
  }
  if (command === 'full') {
    await runBaseline();
    const evidence = await runDiscover();
    await runBackup();
    const pass1 = await runRepair(1, false, evidence);
    const pass2 = await runRepair(2, false, evidence);
    if (pass2 !== 0) {
      throw new Error(`Idempotency failed: pass 2 produced ${pass2} mutations`);
    }
    invalidateConsumerEventCaches();
    const backup = JSON.parse(readFileSync(OUT_BACKUP, 'utf8')) as { events: Array<Record<string, unknown>> };
    await runAuditAfter(backup);
    const acceptance = JSON.parse(readFileSync(OUT_ACCEPTANCE, 'utf8')) as Record<string, unknown>;
    writeReport(acceptance);
    console.log('Full run complete', acceptance);
    return;
  }
  throw new Error(`Unknown command: ${command}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
