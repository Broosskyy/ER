/**
 * Phase 4.6.3 completion slice — targeted re-import + validation report.
 *
 * Usage:
 *   npx tsx scripts/operations/_phase463-completion-slice.ts [phase]
 *
 * Phases: audit-before | pass1 | pass2 | repair-lineup | repair-ticket | audit-after | missing-events | report | full
 */
import './bootstrap-ops-supabase';

process.env.EXPO_PUBLIC_GENERIC_SOURCE_FIELD_TRUST_MERGE = 'true';
process.env.EXPO_PUBLIC_USE_SUPABASE = 'true';

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapEventRowToAdminRecord } from '@/data/mappers/event-mapper';
import type { EventRow } from '@/data/mappers/event-mapper';
import { mapSourceRowToRecord, type SourceRow } from '@/data/mappers/source-mapper';
import { invalidateConsumerEventCaches } from '@/features/events/formatting/consumer-cache-invalidation';
import {
  classifyTicketUrl,
  eventNeedsTicketDestinationRepair,
  isEventSpecificTicketUrl,
  pickBestTicketUrl,
} from '@/features/events/domain/ticket-url-quality';
import { extractPrioritizedArtistNames } from '@/features/import/services/import-lineup-from-record';
import { getEffectiveCandidate } from '@/features/import/admin/import-utils';
import type { SourceRecord } from '@/data/types/records';
import type { ImportJob } from '@/features/import/models/types';
import { opsClient } from './ops-supabase-rows';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_JSON = join(ROOT, 'docs/real-data/_phase463_completion_slice.json');
const OUT_MD = join(ROOT, 'docs/PHASE_463_COMPLETION_SLICE_REPORT.md');

const AFFECTED_SOURCES = [
  'source-bootshaus-koeln',
  'source-bootshaus-ticket-io',
  'source-affenkaefig',
  'source-affenkaefig-ticket-kings',
  'source-ticket-io-lehmannclub',
  'source-ticket-io-technodampfer',
  'source-ticket-io-protontheclub',
  'source-ticket-io-hmg-concerts',
];

const MISSING_SAMPLES = [
  { label: 'PLAY! Open Air', needle: /play!\s*open\s*air/i },
  { label: 'Technodampfer', needle: /technodampfer/i },
  { label: 'SHOCKONE', needle: /shock\s*one|shockone/i },
];

type Report = Record<string, unknown>;
const report: Report = existsSync(OUT_JSON)
  ? (JSON.parse(readFileSync(OUT_JSON, 'utf8')) as Report)
  : { startedAt: new Date().toISOString(), errors: [] as string[] };

function save(): void {
  writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));
}

async function loadRegistry() {
  const { resetDatasourceBundle } = await import('@/data/datasources/supabase/supabase-datasource');
  resetDatasourceBundle();
  const registry = await import('@/data/repositories/registry');
  const entityBootstrap = await import('@/features/entity-resolution/entity-alias-store-bootstrap');
  return {
    adminSourceRepository: registry.adminSourceRepository,
    eventRepository: registry.eventRepository,
    importAggregationService: registry.importAggregationService,
    importEventPublishService: registry.importEventPublishService,
    importRecordRepository: registry.importRecordRepository,
    initializeEntityAliasStore: entityBootstrap.initializeEntityAliasStore,
    flushEntityAliasStore: entityBootstrap.flushEntityAliasStore,
  };
}

async function loadSource(sourceId: string): Promise<SourceRecord | null> {
  const { data } = await opsClient().from('sources').select('*').eq('id', sourceId).maybeSingle();
  return data ? mapSourceRowToRecord(data as SourceRow) : null;
}

async function republishJob(source: SourceRecord, jobId: string): Promise<number> {
  const { importRecordRepository, importEventPublishService } = await loadRegistry();
  const records = await importRecordRepository.listByJobId(jobId);
  let count = 0;
  for (const record of records) {
    if (!record.resultingEventId) continue;
    await importEventPublishService.publishRecord(record, source, [], {
      actorId: 'phase463-completion-slice',
    });
    count += 1;
  }
  return count;
}

async function auditLineupLosses(label: string): Promise<void> {
  const c = opsClient();
  const { data: records } = await c
    .from('import_records')
    .select('id,source_id,resulting_event_id,normalized_payload')
    .in('source_id', AFFECTED_SOURCES)
    .not('resulting_event_id', 'is', null);

  const table = [];
  for (const row of records ?? []) {
    const payload = row.normalized_payload as Record<string, unknown> | null;
    if (!payload) continue;
    const fakeRecord = {
      id: row.id,
      sourceId: row.source_id,
      normalizedPayload: payload,
      status: 'imported',
    } as import('@/features/import/models/types').ImportRecord;
    const prioritized = extractPrioritizedArtistNames(fakeRecord);
    if (prioritized.names.length === 0) continue;

    const { count: artistRows } = await c
      .from('event_artists')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', row.resulting_event_id);

    const { data: eventRow } = await c
      .from('events')
      .select('title')
      .eq('id', row.resulting_event_id)
      .maybeSingle();

    table.push({
      eventId: row.resulting_event_id,
      title: eventRow?.title,
      sourceId: row.source_id,
      importLineupCount: prioritized.names.length,
      canonicalArtistRows: artistRows ?? 0,
      unresolvedNames:
        (artistRows ?? 0) < prioritized.names.length ? prioritized.names.slice(artistRows ?? 0) : [],
      reason: (artistRows ?? 0) === 0 ? 'publish_projection' : 'resolved',
    });
  }

  const losses = table.filter((row) => row.canonicalArtistRows === 0 && row.importLineupCount > 0);
  report[`lineupAudit_${label}`] = {
    generatedAt: new Date().toISOString(),
    totalWithImportLineup: table.length,
    unresolvedLosses: losses.length,
    losses,
    allRows: table,
  };
  save();
  console.log(JSON.stringify(report[`lineupAudit_${label}`], null, 2));
}

async function runPass(passLabel: 'pass1' | 'pass2'): Promise<void> {
  const {
    importAggregationService,
    initializeEntityAliasStore,
    flushEntityAliasStore,
  } = await loadRegistry();
  await initializeEntityAliasStore();
  const results: Array<Record<string, unknown>> = [];

  for (const sourceId of AFFECTED_SOURCES) {
    const source = await loadSource(sourceId);
    if (!source?.enabled) {
      results.push({ sourceId, status: 'skipped' });
      continue;
    }
    console.log(`[${passLabel}] ${sourceId}...`);
    const job = await importAggregationService.enqueueJob(source, 'manual', `phase463:${passLabel}`);
    const completed = await importAggregationService.executeExistingJob(job, source, {
      recordImportReputation: true,
    });
    const republished =
      source.publishMode === 'manual_review' || source.reviewRequired
        ? await republishJob(source, completed.id)
        : 0;
    results.push({
      sourceId,
      jobId: completed.id,
      status: completed.status,
      metrics: completed.metrics,
      republishedRecords: republished,
    });
  }

  await flushEntityAliasStore();
  const { eventRepository } = await loadRegistry();
  await invalidateConsumerEventCaches(eventRepository);
  report[passLabel] = { completedAt: new Date().toISOString(), results };
  save();
}

async function auditMissingEvents(): Promise<void> {
  const c = opsClient();
  const findings = [];

  for (const sample of MISSING_SAMPLES) {
    const { data: allRows } = await c.from('events').select('*');
    const matches = (allRows ?? []).filter((e) => sample.needle.test(String(e.title ?? '')));

    const { data: importRows } = await c
      .from('import_records')
      .select('id,source_id,resulting_event_id,status,normalized_payload,updated_at')
      .order('updated_at', { ascending: false });

    const relatedImports = (importRows ?? []).filter((row) => {
      const payload = row.normalized_payload as Record<string, unknown> | undefined;
      return sample.needle.test(String(payload?.title ?? ''));
    });

    findings.push({
      label: sample.label,
      publishedMatches: matches.filter((e) => e.status === 'published').map((e) => ({
        id: e.id,
        title: e.title,
        status: e.status,
        startDate: e.start_date,
      })),
      archivedMatches: matches.filter((e) => e.status === 'archived').map((e) => ({
        id: e.id,
        title: e.title,
        status: e.status,
        startDate: e.start_date,
      })),
      importEvidence: relatedImports.slice(0, 5).map((row) => ({
        sourceId: row.source_id,
        resultingEventId: row.resulting_event_id,
        status: row.status,
        title: (row.normalized_payload as Record<string, unknown>)?.title,
      })),
      recommendedAction:
        matches.some((e) => e.status === 'published')
          ? 'use_published_match'
          : matches.some((e) => e.status === 'archived')
            ? 'document_archived_lifecycle'
            : relatedImports.length > 0
              ? 'investigate_publish_gap'
              : 'source_no_longer_lists_event',
    });
  }

  report.missingEventFindings = findings;
  save();
  console.log(JSON.stringify(findings, null, 2));
}

async function auditBootshausTickets(): Promise<void> {
  const c = opsClient();
  const { data: refs } = await c
    .from('event_source_references')
    .select('canonical_event_id,source_id')
    .in('source_id', ['source-bootshaus-koeln', 'source-bootshaus-ticket-io']);

  const byEvent = new Map<string, string[]>();
  for (const ref of refs ?? []) {
    const list = byEvent.get(ref.canonical_event_id) ?? [];
    list.push(ref.source_id);
    byEvent.set(ref.canonical_event_id, list);
  }

  const merged = [...byEvent.entries()].filter(([, sources]) =>
    sources.includes('source-bootshaus-koeln') && sources.includes('source-bootshaus-ticket-io'),
  );

  const audit = [];
  for (const [eventId] of merged.slice(0, 20)) {
    const { data: eventRow } = await c.from('events').select('*').eq('id', eventId).maybeSingle();
    if (!eventRow) continue;
    const event = mapEventRowToAdminRecord(eventRow as EventRow);
    const { data: imports } = await c
      .from('import_records')
      .select('source_id,normalized_payload')
      .eq('resulting_event_id', eventId);

    const originUrls: Record<string, string | undefined> = {};
    for (const row of imports ?? []) {
      const p = row.normalized_payload as Record<string, unknown>;
      originUrls[row.source_id] = String(p?.ticketUrl ?? p?.ticket_url ?? '');
    }

    audit.push({
      eventId,
      title: event.title,
      canonicalTicketUrl: event.ticketUrl,
      classification: classifyTicketUrl(event.ticketUrl).class,
      websiteUrl: event.websiteUrl,
      originTicketUrls: originUrls,
      bestAvailable: pickBestTicketUrl([
        event.ticketUrl,
        ...Object.values(originUrls),
      ].filter(Boolean) as string[]),
    });
  }

  report.bootshausTicketAudit = audit;
  save();
}

function buildReport(): void {
  const before = report.lineupAudit_before as { unresolvedLosses?: number } | undefined;
  const after = report.lineupAudit_after as { unresolvedLosses?: number } | undefined;
  const pass2Block = report.pass2 as Record<string, unknown> | undefined;
  const pass2Results = (pass2Block?.results as Array<{ metrics?: { createdCount?: number } }> | undefined) ?? [];
  const pass2Created = pass2Results.reduce((s, r) => s + (r.metrics?.createdCount ?? 0), 0);

  const recommendation =
    (after?.unresolvedLosses ?? 1) === 0 && pass2Created === 0
      ? 'READY_FOR_PART_4'
      : 'ADDITIONAL_SINGLE_ISSUE_FIX_REQUIRED';

  report.recommendation = recommendation;

  const md = [
    '# Phase 4.6.3 Completion Slice Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    `## Recommendation: **${recommendation}**`,
    '',
    '## Root cause (lineup)',
    'Structured `artistNames` were dropped in `resolveArtistIdsForNames` because auto-create was limited to ≤2 unmatched names.',
    '',
    '## Lineup losses before → after',
    `- Before: ${before?.unresolvedLosses ?? 'n/a'}`,
    `- After: ${after?.unresolvedLosses ?? 'n/a'}`,
    '',
    '## Pass 2 idempotency',
    `- createdCount sum: ${pass2Created}`,
    '',
    '## Ticket URL policy',
    '- `bootshaus.tv` classified as `event_info_page` (score 12), below shop root (20)',
    '- `eventUrl`/`originalLink` removed from ticket URL candidate pool',
    '',
    '## Missing events',
    JSON.stringify(report.missingEventFindings ?? [], null, 2),
    '',
    'Full JSON: docs/real-data/_phase463_completion_slice.json',
  ].join('\n');

  writeFileSync(OUT_MD, md);
  save();
}

async function repairTicketDestinations(): Promise<void> {
  const c = opsClient();
  const { importRecordRepository, importEventPublishService } = await loadRegistry();
  const { data: events } = await c.from('events').select('id,title,ticket_url,status').eq('status', 'published');

  const results: Array<Record<string, unknown>> = [];
  for (const eventRow of events ?? []) {
    const { data: importRows } = await c
      .from('import_records')
      .select('id,source_id')
      .eq('resulting_event_id', eventRow.id)
      .order('updated_at', { ascending: false });

    for (const importRow of importRows ?? []) {
      const record = await importRecordRepository.getById(importRow.id);
      const source = await loadSource(importRow.source_id);
      if (!record || !source) continue;

      const candidate = getEffectiveCandidate(record);
      const metadata = candidate.sourceMetadata as Record<string, unknown> | undefined;
      const candidates = [
        candidate.ticketUrl,
        typeof metadata?.ticketUrl === 'string' ? metadata.ticketUrl : undefined,
      ];
      if (!eventNeedsTicketDestinationRepair(eventRow.ticket_url, candidates)) {
        continue;
      }

      const publishResult = await importEventPublishService.publishRecord(record, source, [], {
        actorId: 'phase463-ticket-repair',
      });
      results.push({
        eventId: eventRow.id,
        title: eventRow.title,
        before: eventRow.ticket_url,
        after: publishResult.event.ticketUrl,
        classification: classifyTicketUrl(publishResult.event.ticketUrl).class,
      });
      break;
    }
  }

  const { eventRepository } = await loadRegistry();
  await invalidateConsumerEventCaches(eventRepository);
  report.ticketDestinationRepair = { completedAt: new Date().toISOString(), results };
  save();
  console.log(JSON.stringify(report.ticketDestinationRepair, null, 2));
}

async function repairLineupLosses(): Promise<void> {
  const { importRecordRepository, importEventPublishService } = await loadRegistry();
  const c = opsClient();
  const losses =
    ((report.lineupAudit_after ?? report.lineupAudit_before) as { losses?: Array<{ eventId: string }> })
      ?.losses ?? [];

  const results: Array<Record<string, unknown>> = [];
  for (const loss of losses) {
    const { data: rows } = await c
      .from('import_records')
      .select('id,source_id,resulting_event_id,normalized_payload,status,external_id,import_job_id,created_at,updated_at')
      .eq('resulting_event_id', loss.eventId)
      .order('updated_at', { ascending: false })
      .limit(1);

    const row = rows?.[0];
    if (!row) continue;
    const record = await importRecordRepository.getById(row.id);
    if (!record?.resultingEventId) continue;

    const repair = await importEventPublishService.repairLineupProjectionIfNeeded(
      record,
      record.resultingEventId,
    );
    results.push({
      eventId: loss.eventId,
      wroteLineup: repair.wroteLineup,
      artistIds: repair.artistIds,
      createdArtistIds: repair.createdArtistIds,
    });
  }

  const { eventRepository } = await loadRegistry();
  await invalidateConsumerEventCaches(eventRepository);
  report.lineupRepair = { completedAt: new Date().toISOString(), results };
  save();
  console.log(JSON.stringify(report.lineupRepair, null, 2));
}

async function main(): Promise<void> {
  const phase = process.argv[2] ?? 'full';

  if (phase === 'audit-before' || phase === 'full') await auditLineupLosses('before');
  if (phase === 'pass1' || phase === 'full') await runPass('pass1');
  if (phase === 'pass2' || phase === 'full') await runPass('pass2');
  if (phase === 'repair-lineup' || phase === 'full') await repairLineupLosses();
  if (phase === 'repair-ticket' || phase === 'full') await repairTicketDestinations();
  if (phase === 'audit-after' || phase === 'full') {
    await auditLineupLosses('after');
    await auditBootshausTickets();
    await auditMissingEvents();
  }
  if (phase === 'missing-events') await auditMissingEvents();
  if (phase === 'report' || phase === 'full') buildReport();

  report.completedAt = new Date().toISOString();
  save();
  console.log(`Report: ${OUT_MD}`);
}

main().catch((e) => {
  console.error(e);
  save();
  process.exit(1);
});
