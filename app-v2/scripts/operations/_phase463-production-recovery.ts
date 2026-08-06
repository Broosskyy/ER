/**
 * Phase 4.6.3 — Controlled production recovery, multi-origin reimport & live validation.
 *
 * Usage:
 *   npx tsx scripts/operations/_phase463-production-recovery.ts [phase]
 *
 * Phases:
 *   preflight | inventory | metrics-before | ticket-audit | multi-origin | regression |
 *   metrics-after | report | validate-only | full
 *
 * Import passes delegate to _phase462-production-activation.ts (pass1, pass2, trace).
 */
import './bootstrap-ops-supabase';

process.env.EXPO_PUBLIC_GENERIC_SOURCE_FIELD_TRUST_MERGE = 'true';
process.env.EXPO_PUBLIC_USE_SUPABASE = 'true';

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapEventRowToAdminRecord } from '@/data/mappers/event-mapper';
import type { EventRow } from '@/data/mappers/event-mapper';
import {
  classifyTicketUrl,
  isEventSpecificTicketUrl,
  isGenericTicketUrl,
  pickBestTicketUrl,
} from '@/features/events/domain/ticket-url-quality';
import { meaningfulEventText } from '@/features/events/domain/event-field-value';
import { opsClient } from './ops-supabase-rows';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_JSON = join(ROOT, 'docs/real-data/_phase463_production_recovery.json');
const OUT_MD = join(ROOT, 'docs/PHASE_463_PRODUCTION_RECOVERY_REPORT.md');
const PREFLIGHT_462 = join(ROOT, 'docs/real-data/_phase462_production_preflight.json');
const ACTIVATION_462 = join(ROOT, 'docs/real-data/_phase462_production_activation.json');

const REIMPORT_SOURCE_ORDER = [
  'source-bootshaus-koeln',
  'source-affenkaefig',
  'source-ticket-kings-org-m-d-m-a-musik-die-mich-antreibt',
  'source-ticket-io-lehmannclub',
  'source-ticket-io-technodampfer',
  'source-ticket-io-protontheclub',
  'source-ticket-io-area51events',
  'source-ticket-io-hmg-concerts',
  'source-bootshaus-ticket-io',
  'source-affenkaefig-ticket-kings',
  'source-ticket-kings-org-elektrokuche',
  'source-ticket-kings-org-underland',
];

const MULTI_ORIGIN_PAIRS: Array<{ label: string; sourceIds: string[] }> = [
  { label: 'Bootshaus', sourceIds: ['source-bootshaus-koeln', 'source-bootshaus-ticket-io'] },
  { label: 'Affenkäfig', sourceIds: ['source-affenkaefig', 'source-affenkaefig-ticket-kings'] },
];

const REGRESSION_EVENTS = [
  { needle: /sommerfest/i, label: 'Bootshaus Sommerfest' },
  { needle: /play!\s*open\s*air/i, label: 'PLAY! Open Air' },
  { needle: /\blevi\b/i, label: 'LEVI' },
  { needle: /ely\s*oaks/i, label: 'ELY OAKS' },
  { needle: /technodampfer/i, label: 'Technodampfer' },
  { needle: /shock\s*one|shockone/i, label: 'SHOCKONE' },
  { needle: /musik die mich antreibt/i, label: 'Musik die mich antreibt' },
  { needle: /affenk/i, label: 'Affenkäfig' },
  { needle: /proton/i, label: 'Proton' },
  { needle: /lehmann/i, label: 'Lehmann' },
  { needle: /area\s*51/i, label: 'Area51' },
];

const PHASE462_COLUMNS = [
  'venue_address',
  'ticket_phases',
  'genre_labels',
  'ticket_status',
] as const;

type RecoveryReport = Record<string, unknown>;

function loadReport(): RecoveryReport {
  if (existsSync(OUT_JSON)) {
    return JSON.parse(readFileSync(OUT_JSON, 'utf8')) as RecoveryReport;
  }
  return {
    startedAt: new Date().toISOString(),
    phase: process.argv[2] ?? 'full',
    errors: [] as string[],
  };
}

const report: RecoveryReport = loadReport();

function save(): void {
  writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));
}

function fail(message: string): never {
  (report.errors as string[]).push(message);
  save();
  throw new Error(message);
}

function supabaseHost(): string {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

async function probeColumn(table: string, column: string): Promise<boolean> {
  const { error } = await opsClient().from(table).select(column).limit(1);
  return !error;
}

async function collectMetrics(label: string): Promise<Record<string, number>> {
  const c = opsClient();
  const [published, archived, origins, importRecords, eventArtists, withLineup, withDescription, withTicketPhases, withPriceText, withCoords, withVenueAddress, withGenreLabels] =
    await Promise.all([
      c.from('events').select('id', { count: 'exact', head: true }).eq('status', 'published'),
      c.from('events').select('id', { count: 'exact', head: true }).eq('status', 'archived'),
      c.from('event_origins').select('id', { count: 'exact', head: true }),
      c.from('import_records').select('id', { count: 'exact', head: true }),
      c.from('event_artists').select('id', { count: 'exact', head: true }),
      c.from('events').select('id', { count: 'exact', head: true }).eq('status', 'published').not('lineup', 'is', null),
      c.from('events').select('id', { count: 'exact', head: true }).eq('status', 'published').not('description', 'is', null),
      c.from('events').select('id', { count: 'exact', head: true }).eq('status', 'published').not('ticket_phases', 'is', null),
      c.from('events').select('id', { count: 'exact', head: true }).eq('status', 'published').not('price_text', 'is', null),
      c.from('events').select('id', { count: 'exact', head: true }).eq('status', 'published').not('latitude', 'is', null),
      c.from('events').select('id', { count: 'exact', head: true }).eq('status', 'published').not('venue_address', 'is', null),
      c.from('events').select('id', { count: 'exact', head: true }).eq('status', 'published').not('genre_labels', 'is', null),
    ]);

  const snapshot = {
    publishedEvents: published.count ?? 0,
    archivedEvents: archived.count ?? 0,
    activeOrigins: origins.count ?? 0,
    importRecords: importRecords.count ?? 0,
    eventArtistRows: eventArtists.count ?? 0,
    eventsWithLineup: withLineup.count ?? 0,
    eventsWithMeaningfulDescription: withDescription.count ?? 0,
    eventsWithTicketPhases: withTicketPhases.count ?? 0,
    eventsWithPriceText: withPriceText.count ?? 0,
    eventsWithCoordinates: withCoords.count ?? 0,
    eventsWithVenueAddress: withVenueAddress.count ?? 0,
    eventsWithGenreLabels: withGenreLabels.count ?? 0,
  };

  const metrics = (report.metrics as Record<string, unknown>) ?? {};
  metrics[label] = snapshot;
  report.metrics = metrics;
  save();
  return snapshot;
}

async function runPreflight(): Promise<void> {
  if (!existsSync(PREFLIGHT_462)) {
    execSync('npx tsx scripts/operations/_phase462-production-preflight.ts', {
      cwd: ROOT,
      stdio: 'inherit',
      env: process.env,
    });
  }

  const checks: Record<string, unknown> = {
    targetHost: supabaseHost(),
    serviceRoleConfigured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    fieldTrustMerge: process.env.EXPO_PUBLIC_GENERIC_SOURCE_FIELD_TRUST_MERGE === 'true',
    publishMapperAvailable: true,
    preflightArtifactExists: existsSync(PREFLIGHT_462),
  };

  if (process.env.EXPO_PUBLIC_GENERIC_SOURCE_FIELD_TRUST_MERGE !== 'true') {
    fail('EXPO_PUBLIC_GENERIC_SOURCE_FIELD_TRUST_MERGE is not true.');
  }

  const columnProbes: Record<string, boolean> = {};
  for (const col of PHASE462_COLUMNS) {
    columnProbes[col] = await probeColumn('events', col);
  }
  checks.columnProbes = columnProbes;
  if (Object.values(columnProbes).some((ok) => !ok)) {
    fail('Required migration columns missing on events table.');
  }

  const c = opsClient();
  const { data: activeJobs } = await c
    .from('import_jobs')
    .select('id,source_id,status')
    .in('status', ['pending', 'running'])
    .in('source_id', REIMPORT_SOURCE_ORDER);
  const { data: queueRows } = await c
    .from('import_job_queue')
    .select('id,source_id,status')
    .in('status', ['pending', 'processing', 'leased'])
    .in('source_id', REIMPORT_SOURCE_ORDER);

  checks.activeImportJobs = activeJobs ?? [];
  checks.activeQueueEntries = queueRows ?? [];
  if ((activeJobs ?? []).length > 0 || (queueRows ?? []).length > 0) {
    fail('Active import jobs or queue entries exist — aborting.');
  }

  const preflight = JSON.parse(readFileSync(PREFLIGHT_462, 'utf8')) as Record<string, unknown>;
  checks.preflightSummary = {
    generatedAt: preflight.generatedAt,
    totals: preflight.totals,
    publishMapperProbe: preflight.publishMapperProbe,
  };

  const { data: sources } = await c
    .from('sources')
    .select('id,adapter_key,source_config')
    .in('id', REIMPORT_SOURCE_ORDER);
  checks.connectorFingerprints = (sources ?? []).map((s) => ({
    id: s.id,
    adapterKey: s.adapter_key,
    maxDetailPages:
      (s.source_config as { ticketPlatform?: { limits?: { maxDetailPages?: number } } })?.ticketPlatform
        ?.limits?.maxDetailPages ??
      (s.source_config as { website?: { limits?: { maxDetailPages?: number } } })?.website?.limits
        ?.maxDetailPages,
  }));

  report.preflight = checks;
  save();
  console.log(JSON.stringify(checks, null, 2));
}

async function runInventory(): Promise<void> {
  const c = opsClient();
  const { data: sources, error } = await c
    .from('sources')
    .select('id,display_name,source_type,enabled,adapter_key,base_url,website,source_config,publish_mode')
    .order('display_name');

  if (error) {
    fail(error.message);
  }

  const inventory = [];
  for (const source of sources ?? []) {
    const config = (source.source_config ?? {}) as Record<string, unknown>;
    const website = config.website as { limits?: { maxDetailPages?: number } } | undefined;
    const ticketPlatform = config.ticketPlatform as { limits?: { maxDetailPages?: number } } | undefined;
    const maxDetailPages = ticketPlatform?.limits?.maxDetailPages ?? website?.limits?.maxDetailPages ?? 0;

    const { count } = await c
      .from('import_records')
      .select('id', { count: 'exact', head: true })
      .eq('source_id', source.id);

    const { count: publishedCount } = await c
      .from('import_records')
      .select('id', { count: 'exact', head: true })
      .eq('source_id', source.id)
      .not('resulting_event_id', 'is', null);

    const haystack = `${source.id} ${source.display_name ?? ''}`.toLowerCase();
    const inScope =
      REIMPORT_SOURCE_ORDER.includes(source.id) ||
      (source.enabled &&
        (haystack.includes('ticket') ||
          haystack.includes('bootshaus') ||
          haystack.includes('affenk') ||
          haystack.includes('musik')));

    if (!inScope) continue;

    inventory.push({
      id: source.id,
      displayName: source.display_name,
      enabled: source.enabled,
      sourceType: source.source_type,
      adapterKey: source.adapter_key,
      urls: {
        baseUrl: source.base_url,
        website: source.website,
      },
      detailSupport: maxDetailPages > 0,
      maxDetailPages,
      publishMode: source.publish_mode,
      importRecordCount: count ?? 0,
      linkedCanonicalEvents: publishedCount ?? 0,
      inReimportBatch: REIMPORT_SOURCE_ORDER.includes(source.id),
    });
  }

  report.sourceInventory = inventory;
  save();
  console.log(JSON.stringify(inventory, null, 2));
}

function readTicketUrlFromPayload(payload: Record<string, unknown> | null | undefined): string | undefined {
  if (!payload) return undefined;
  const direct = payload.ticketUrl ?? payload.ticket_url;
  return typeof direct === 'string' ? meaningfulEventText(direct) : undefined;
}

async function runTicketAudit(): Promise<void> {
  const c = opsClient();
  const { data: events } = await c
    .from('events')
    .select('id,title,ticket_url,website_url,source_id,status')
    .eq('status', 'published');

  const regressions: Array<Record<string, unknown>> = [];
  let bootshausTvCount = 0;
  let eventSpecificCount = 0;
  let genericCount = 0;
  let missingCount = 0;

  const sourceIds = new Set(REIMPORT_SOURCE_ORDER);
  const { data: refs } = await c
    .from('event_source_references')
    .select('canonical_event_id,source_id,original_url')
    .in('source_id', [...sourceIds]);

  const refsByEvent = new Map<string, Array<{ sourceId: string; url?: string }>>();
  for (const ref of refs ?? []) {
    const list = refsByEvent.get(ref.canonical_event_id) ?? [];
    list.push({ sourceId: ref.source_id, url: ref.original_url ?? undefined });
    refsByEvent.set(ref.canonical_event_id, list);
  }

  const { data: importRecords } = await c
    .from('import_records')
    .select('source_id,resulting_event_id,normalized_payload')
    .in('source_id', [...sourceIds])
    .not('resulting_event_id', 'is', null);

  const payloadUrlsByEvent = new Map<string, Map<string, string>>();
  for (const row of importRecords ?? []) {
    if (!row.resulting_event_id) continue;
    const url = readTicketUrlFromPayload(row.normalized_payload as Record<string, unknown>);
    if (!url) continue;
    const map = payloadUrlsByEvent.get(row.resulting_event_id) ?? new Map();
    map.set(row.source_id, url);
    payloadUrlsByEvent.set(row.resulting_event_id, map);
  }

  for (const event of events ?? []) {
    const ticketUrl = meaningfulEventText(event.ticket_url);
    const classification = classifyTicketUrl(ticketUrl);
    const originUrls = payloadUrlsByEvent.get(event.id) ?? new Map();
    const candidateUrls = [
      ticketUrl,
      ...[...originUrls.values()],
      ...(refsByEvent.get(event.id) ?? []).map((r) => r.url),
    ].filter((u): u is string => Boolean(u));
    const best = pickBestTicketUrl(candidateUrls);

    if (!ticketUrl) {
      missingCount += 1;
    } else if (isEventSpecificTicketUrl(ticketUrl)) {
      eventSpecificCount += 1;
    } else if (isGenericTicketUrl(ticketUrl)) {
      genericCount += 1;
    }

    const isBootshausTv =
      ticketUrl != null &&
      (/bootshaus\.tv/i.test(ticketUrl) || /bootshaus\.tv/i.test(event.website_url ?? '')) &&
      !/\.ticket\.io\//i.test(ticketUrl);

    if (isBootshausTv) {
      bootshausTvCount += 1;
    }

    const hasBetterTicketIo =
      [...originUrls.values()].some((u) => /\.ticket\.io\//i.test(u) && isEventSpecificTicketUrl(u)) ||
      [...originUrls.values()].some((u) => /ticketkings\.de\/event\//i.test(u));

    if (isBootshausTv || (hasBetterTicketIo && !isEventSpecificTicketUrl(ticketUrl ?? ''))) {
      regressions.push({
        eventId: event.id,
        title: event.title,
        canonicalTicketUrl: ticketUrl,
        classification: classification.class,
        score: classification.score,
        originTicketUrls: Object.fromEntries(originUrls),
        recommendedUrl: best,
        issue: isBootshausTv ? 'bootshaus_tv_instead_of_ticket_shop' : 'generic_over_event_specific',
      });
    }
  }

  report.ticketDestinationAudit = {
    generatedAt: new Date().toISOString(),
    totals: {
      published: events?.length ?? 0,
      eventSpecificTicketUrls: eventSpecificCount,
      genericTicketUrls: genericCount,
      missingTicketUrls: missingCount,
      bootshausTvRegressions: bootshausTvCount,
      actionableRegressions: regressions.length,
    },
    regressions: regressions.slice(0, 100),
  };
  save();
  console.log(JSON.stringify(report.ticketDestinationAudit, null, 2));
}

async function runMultiOriginValidation(): Promise<void> {
  const c = opsClient();
  const results = [];

  for (const pair of MULTI_ORIGIN_PAIRS) {
    const { data: refs } = await c
      .from('event_source_references')
      .select('canonical_event_id,source_id')
      .in('source_id', pair.sourceIds);

    const byCanonical = new Map<string, Set<string>>();
    for (const ref of refs ?? []) {
      const set = byCanonical.get(ref.canonical_event_id) ?? new Set();
      set.add(ref.source_id);
      byCanonical.set(ref.canonical_event_id, set);
    }

    const merged = [...byCanonical.entries()].filter(([, sources]) => {
      return pair.sourceIds.every((id) => sources.has(id));
    });

    const splitDuplicates: Array<{ title: string; sourceIds: string[] }> = [];
    const { data: records } = await c
      .from('import_records')
      .select('resulting_event_id,source_id,normalized_payload')
      .in('source_id', pair.sourceIds)
      .not('resulting_event_id', 'is', null);

    const titleToEvents = new Map<string, Set<string>>();
    for (const row of records ?? []) {
      const payload = row.normalized_payload as Record<string, unknown> | undefined;
      const title = String(payload?.title ?? '').trim().toLowerCase();
      if (!title || !row.resulting_event_id) continue;
      const set = titleToEvents.get(title) ?? new Set();
      set.add(row.resulting_event_id);
      titleToEvents.set(title, set);
    }

    for (const [title, eventIds] of titleToEvents) {
      if (eventIds.size > 1) {
        splitDuplicates.push({ title, sourceIds: pair.sourceIds });
      }
    }

    results.push({
      label: pair.label,
      sourceIds: pair.sourceIds,
      canonicalEventsWithBothOrigins: merged.length,
      sampleMergedIds: merged.slice(0, 5).map(([id]) => id),
      potentialSplitDuplicates: splitDuplicates.slice(0, 10),
    });
  }

  report.multiOriginValidation = {
    generatedAt: new Date().toISOString(),
    pairs: results,
  };
  save();
  console.log(JSON.stringify(report.multiOriginValidation, null, 2));
}

async function runRegressionValidation(): Promise<void> {
  const c = opsClient();
  const { data: events } = await c
    .from('events')
    .select('*')
    .eq('status', 'published');

  const traces = [];
  for (const spec of REGRESSION_EVENTS) {
    const match = (events ?? []).find((e) => spec.needle.test(String(e.title ?? '')));
    if (!match) {
      traces.push({ label: spec.label, status: 'not_found' });
      continue;
    }

    const admin = mapEventRowToAdminRecord(match as EventRow);
    const ticketClass = classifyTicketUrl(admin.ticketUrl);

    const orgAsArtist = (admin.artists ?? []).some(
      (a) => /organization|bootshaus|affenkäfig|affenkaefig/i.test(a.name) && a.role !== 'organizer',
    );

    traces.push({
      label: spec.label,
      status: 'found',
      eventId: admin.id,
      title: admin.title,
      source: admin.source,
      fields: {
        descriptionLen: admin.description?.length ?? 0,
        lineupCount: admin.lineup?.length ?? admin.artists?.length ?? 0,
        genreLabels: admin.genreLabels ?? [],
        ticketUrl: admin.ticketUrl,
        ticketClass: ticketClass.class,
        priceText: admin.priceText,
        venueName: admin.venueName,
        organizerName: admin.organizerName,
        address: admin.venueAddress,
        coordinates: admin.latitude != null && admin.longitude != null,
        ticketPhases: admin.ticketPhases?.length ?? 0,
        ageRestriction: admin.ageRestriction,
      },
      checks: {
        organizationNotArtist: !orgAsArtist,
        hasLineup: (admin.lineup?.length ?? admin.artists?.length ?? 0) > 0,
        hasGenres: (admin.genreLabels?.length ?? 0) > 0,
        hasDescription: (admin.description?.length ?? 0) > 40,
        eventSpecificTicket: isEventSpecificTicketUrl(admin.ticketUrl),
        hasAddress: Boolean(meaningfulEventText(admin.venueAddress)),
        venueOrganizerSeparated:
          Boolean(meaningfulEventText(admin.venueName)) &&
          Boolean(meaningfulEventText(admin.organizerName)) &&
          admin.venueName !== admin.organizerName,
      },
    });
  }

  report.regressionValidation = {
    generatedAt: new Date().toISOString(),
    traces,
    checklist: {
      organizationNotArtist: traces.every((t) => t.status === 'not_found' || (t as { checks?: { organizationNotArtist?: boolean } }).checks?.organizationNotArtist !== false),
      directTicketUrls: traces.filter((t) => (t as { checks?: { eventSpecificTicket?: boolean } }).checks?.eventSpecificTicket === false).map((t) => (t as { label?: string }).label),
      missingEvents: traces.filter((t) => t.status === 'not_found').map((t) => t.label),
    },
  };
  save();
  console.log(JSON.stringify(report.regressionValidation, null, 2));
}

function runImportPasses(): void {
  const phases = ['pre-check', 'pass1', 'pass2', 'trace'];
  for (const phase of phases) {
    console.log(`\n=== Phase 4.6.2 activation: ${phase} ===\n`);
    execSync(`npx tsx scripts/operations/_phase462-production-activation.ts ${phase}`, {
      cwd: ROOT,
      stdio: 'inherit',
      env: process.env,
    });
  }

  if (existsSync(ACTIVATION_462)) {
    report.importActivation = JSON.parse(readFileSync(ACTIVATION_462, 'utf8'));
  }
  save();
}

function buildMarkdown(): void {
  const metrics = report.metrics as Record<string, Record<string, number>> | undefined;
  const before = metrics?.before;
  const after = metrics?.after ?? metrics?.pass2;
  const preflight = report.preflight as Record<string, unknown> | undefined;
  const ticket = report.ticketDestinationAudit as Record<string, Record<string, number>> | undefined;
  const regression = report.regressionValidation as Record<string, unknown> | undefined;
  const multi = report.multiOriginValidation as { pairs?: unknown[] } | undefined;
  const inventory = report.sourceInventory as unknown[] | undefined;

  const pass2 = (report.importActivation as { pass2?: { results?: Array<{ metrics?: { createdCount?: number } }> } })?.pass2;
  const pass2Created = (pass2?.results ?? []).reduce((sum, r) => sum + (r.metrics?.createdCount ?? 0), 0);

  const md = [
    '# Phase 4.6.3 Production Recovery Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## 1. Preflight',
    `- Target host: ${preflight?.targetHost ?? 'n/a'}`,
    `- Field trust merge: ${preflight?.fieldTrustMerge ?? 'n/a'}`,
    `- Queue empty: ${((preflight?.activeImportJobs as unknown[])?.length ?? 0) === 0}`,
    `- Migration columns: ${JSON.stringify(preflight?.columnProbes ?? {})}`,
    '',
    '## 2. Sources processed',
    '',
    '| Source | Enabled | Detail | Import records |',
    '| --- | --- | --- | --- |',
    ...(inventory ?? []).map((s) => {
      const row = s as {
        displayName?: string;
        enabled?: boolean;
        detailSupport?: boolean;
        importRecordCount?: number;
      };
      return `| ${row.displayName ?? '?'} | ${row.enabled} | ${row.detailSupport ? 'yes' : 'no'} | ${row.importRecordCount ?? 0} |`;
    }),
    '',
    '## 3. Two-pass import',
    `- Pass 2 total createdCount: **${pass2Created}** (expected 0 for idempotency)`,
    `- Activation artifact: docs/real-data/_phase462_production_activation.json`,
    '',
    '## 4. Multi-origin merge',
    ...(multi?.pairs ?? []).map((p) => `- ${JSON.stringify(p)}`),
    '',
    '## 5. Ticket destination validation',
    `- Event-specific URLs: ${ticket?.totals?.eventSpecificTicketUrls ?? 'n/a'}`,
    `- Bootshaus.tv regressions: ${ticket?.totals?.bootshausTvRegressions ?? 'n/a'}`,
    `- Actionable regressions: ${ticket?.totals?.actionableRegressions ?? 'n/a'}`,
    '',
    '## 6. Regression events',
    ...(Array.isArray(regression?.traces)
      ? (regression.traces as Array<{ label?: string; status?: string; checks?: Record<string, boolean> }>).map(
          (t) =>
            `- **${t.label}**: ${t.status}${t.checks ? ` — lineup=${t.checks.hasLineup}, ticket=${t.checks.eventSpecificTicket}, desc=${t.checks.hasDescription}` : ''}`,
        )
      : ['- n/a']),
    '',
    '## 7. Metrics before → after',
    `| Metric | Before | After |`,
    `| Published | ${before?.publishedEvents ?? '-'} | ${after?.publishedEvents ?? '-'} |`,
    `| Origins | ${before?.activeOrigins ?? '-'} | ${after?.activeOrigins ?? '-'} |`,
    `| Lineups | ${before?.eventsWithLineup ?? '-'} | ${after?.eventsWithLineup ?? '-'} |`,
    `| Descriptions | ${before?.eventsWithMeaningfulDescription ?? '-'} | ${after?.eventsWithMeaningfulDescription ?? '-'} |`,
    `| Genres | ${before?.eventsWithGenreLabels ?? '-'} | ${after?.eventsWithGenreLabels ?? '-'} |`,
    `| Coordinates | ${before?.eventsWithCoordinates ?? '-'} | ${after?.eventsWithCoordinates ?? '-'} |`,
    `| Addresses | ${before?.eventsWithVenueAddress ?? '-'} | ${after?.eventsWithVenueAddress ?? '-'} |`,
    `| Ticket phases | ${before?.eventsWithTicketPhases ?? '-'} | ${after?.eventsWithTicketPhases ?? '-'} |`,
    '',
    '## 8. Browser validation',
    'Manual: Home, Search, Map, Saved, Profiles, Event Detail, ticket buttons.',
    '',
    '## 9. Remaining blockers',
    `- Ticket URL regressions: ${ticket?.totals?.actionableRegressions ?? 0}`,
    `- Missing regression events: ${(regression?.checklist as { missingEvents?: string[] })?.missingEvents?.join(', ') || 'none'}`,
  ].join('\n');

  const blockers = (ticket?.totals?.actionableRegressions ?? 0) > 0 || pass2Created > 0;
  const recommendation = blockers
    ? '## 10. Recommendation\n\n**Additional completion slice required** before Part 4.'
    : '## 10. Recommendation\n\n**Ready for Phase 4.6.3 Part 4** manual acceptance.';

  writeFileSync(OUT_MD, `${md}\n${recommendation}\n`);
}

async function main(): Promise<void> {
  const phase = process.argv[2] ?? 'full';
  report.phase = phase;
  save();

  if (phase === 'preflight' || phase === 'full' || phase === 'validate-only') {
    await runPreflight();
  }
  if (phase === 'inventory' || phase === 'full' || phase === 'validate-only') {
    await runInventory();
  }
  if (phase === 'metrics-before' || phase === 'full') {
    await collectMetrics('before');
  }
  if (phase === 'import' || phase === 'full') {
    runImportPasses();
  }
  if (phase === 'ticket-audit' || phase === 'full' || phase === 'validate-only') {
    await runTicketAudit();
  }
  if (phase === 'multi-origin' || phase === 'full' || phase === 'validate-only') {
    await runMultiOriginValidation();
  }
  if (phase === 'regression' || phase === 'full' || phase === 'validate-only') {
    await runRegressionValidation();
  }
  if (phase === 'metrics-after' || phase === 'full' || phase === 'validate-only') {
    await collectMetrics('after');
  }
  if (phase === 'coverage') {
    execSync('npx tsx scripts/operations/_phase463-import-coverage-audit.ts', {
      cwd: ROOT,
      stdio: 'inherit',
      env: process.env,
    });
  }
  if (phase === 'report' || phase === 'full' || phase === 'validate-only') {
    buildMarkdown();
  }

  report.completedAt = new Date().toISOString();
  save();
  console.log(`Recovery report: ${OUT_JSON}`);
  console.log(`Recovery markdown: ${OUT_MD}`);
}

main().catch((error) => {
  console.error(error);
  save();
  process.exit(1);
});
