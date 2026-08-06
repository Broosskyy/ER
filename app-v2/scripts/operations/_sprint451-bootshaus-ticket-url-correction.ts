/**
 * Phase 4.5.1 — Bootshaus ticket URL audit and targeted correction.
 *
 * Usage:
 *   npx tsx scripts/operations/_sprint451-bootshaus-ticket-url-correction.ts
 *   npx tsx scripts/operations/_sprint451-bootshaus-ticket-url-correction.ts --apply
 */
import './bootstrap-ops-supabase';

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  adminSourceRepository,
  importAggregationService,
  importEventPublishService,
} from '@/data/repositories/registry';
import {
  classifyTicketUrl,
  isEventSpecificTicketUrl,
  isGenericTicketUrl,
  pickBestTicketUrl,
  resolveBetterTicketUrl,
} from '@/features/events/domain/ticket-url-quality';
import { meaningfulEventText } from '@/features/events/domain/event-field-value';
import { initializeEntityAliasStore, flushEntityAliasStore } from '@/features/entity-resolution/entity-alias-store-bootstrap';
import type {
  EventSourceReferenceRow,
  EventTicketAuditSnippet,
  ImportRecordReviewSnippet,
} from './ops-supabase-rows';
import { opsClient, updateEventRow } from './ops-supabase-rows';

const BOOTSHAUS_WEBSITE_SOURCE_ID = 'source-bootshaus-koeln';
const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../docs/real-data/_sprint451_bootshaus_ticket_url_audit.json',
);
const ACTOR = 'sprint451-bootshaus-ticket-url-correction';
const applyChanges = process.argv.includes('--apply');

const SAMPLE_TITLES = [
  /play!\s*open\s*air/i,
  /sommerfest\s*-\s*part\s*4/i,
  /loonyland\s+at\s+nature\s+one/i,
  /mallorca/i,
];

function readTicketUrlFromPayload(payload: Record<string, unknown> | null | undefined): string | undefined {
  if (!payload) return undefined;
  const direct = payload.ticketUrl ?? payload.ticket_url;
  return typeof direct === 'string' ? meaningfulEventText(direct) : undefined;
}

async function main(): Promise<void> {
  const client = opsClient();
  const report: Record<string, unknown> = {
    startedAt: new Date().toISOString(),
    phase: '4.5.1',
    applyChanges,
  };

  await initializeEntityAliasStore();

  const beforeCanonical = await client
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'published');
  const beforeOrigins = await client.from('event_origins').select('id', { count: 'exact', head: true });

  const { data: refs } = await client
    .from('event_source_references')
    .select('canonical_event_id,source_id,external_event_id,original_url')
    .in('source_id', [BOOTSHAUS_WEBSITE_SOURCE_ID, 'source-bootshaus-ticket-io']);

  const refRows = (refs ?? []) as EventSourceReferenceRow[];
  const { data: bootshausImportRows } = await client
    .from('import_records')
    .select('resulting_event_id')
    .in('source_id', [BOOTSHAUS_WEBSITE_SOURCE_ID, 'source-bootshaus-ticket-io'])
    .not('resulting_event_id', 'is', null);

  const importResultRows = (bootshausImportRows ?? []) as Pick<ImportRecordReviewSnippet, 'resulting_event_id'>[];
  const eventIds = [
    ...new Set([
      ...refRows.map((row) => String(row.canonical_event_id)),
      ...importResultRows
        .map((row) => row.resulting_event_id)
        .filter((value): value is string => Boolean(value)),
    ]),
  ];
  const { data: events } = await client
    .from('events')
    .select('id,title,description,ticket_url,price_text,venue_name,updated_at')
    .in('id', eventIds.length > 0 ? eventIds : ['__none__']);

  const { data: importRecords } = await client
    .from('import_records')
    .select('id,source_id,external_id,resulting_event_id,normalized_payload,raw_payload,updated_at')
    .in('source_id', [BOOTSHAUS_WEBSITE_SOURCE_ID, 'source-bootshaus-ticket-io'])
    .in('resulting_event_id', eventIds.length > 0 ? eventIds : ['__none__']);

  const recordRows = (importRecords ?? []) as ImportRecordReviewSnippet[];
  const recordsByEvent = new Map<string, ImportRecordReviewSnippet[]>();
  for (const record of recordRows) {
    if (!record.resulting_event_id) continue;
    const list = recordsByEvent.get(record.resulting_event_id) ?? [];
    list.push(record);
    recordsByEvent.set(record.resulting_event_id, list);
  }

  const eventRows = (events ?? []) as EventTicketAuditSnippet[];
  const auditRows = eventRows.map((event) => {
    const records = recordsByEvent.get(event.id) ?? [];
    const originUrls = records.map((record) => ({
      sourceId: record.source_id,
      externalId: record.external_id,
      ticketUrl: readTicketUrlFromPayload(record.normalized_payload as Record<string, unknown>),
      importedTicketClass: classifyTicketUrl(
        readTicketUrlFromPayload(record.normalized_payload as Record<string, unknown>),
      ),
    }));
    const bestOriginUrl = pickBestTicketUrl(originUrls.map((entry) => entry.ticketUrl));
    const canonicalUrl = meaningfulEventText(event.ticket_url as string | undefined);
    const canonicalClass = classifyTicketUrl(canonicalUrl);
    const resolution = resolveBetterTicketUrl(canonicalUrl, bestOriginUrl);
    const needsCorrection =
      Boolean(bestOriginUrl) &&
      isEventSpecificTicketUrl(bestOriginUrl) &&
      isGenericTicketUrl(canonicalUrl) &&
      resolution.decision === 'accepted_incoming';

    return {
      eventId: event.id,
      title: event.title,
      canonicalTicketUrl: canonicalUrl,
      canonicalTicketClass: canonicalClass.class,
      bestOriginTicketUrl: bestOriginUrl,
      bestOriginTicketClass: classifyTicketUrl(bestOriginUrl).class,
      origins: originUrls,
      needsCorrection,
      proposedTicketUrl: needsCorrection ? resolution.selected : canonicalUrl,
      trustDecision: resolution,
    };
  });

  const corrections = auditRows.filter((row) => row.needsCorrection);
  report.audit = {
    eventsAudited: auditRows.length,
    withEventSpecificOriginUrl: auditRows.filter((row) => isEventSpecificTicketUrl(row.bestOriginTicketUrl)).length,
    canonicalAlreadyCorrect: auditRows.filter((row) => isEventSpecificTicketUrl(row.canonicalTicketUrl)).length,
    canonicalGeneric: auditRows.filter((row) => isGenericTicketUrl(row.canonicalTicketUrl)).length,
    noEventSpecificAvailable: auditRows.filter((row) => !isEventSpecificTicketUrl(row.bestOriginTicketUrl)).length,
    conflictingUrls: auditRows.filter(
      (row) =>
        row.bestOriginTicketUrl &&
        row.canonicalTicketUrl &&
        row.bestOriginTicketUrl !== row.canonicalTicketUrl &&
        isEventSpecificTicketUrl(row.bestOriginTicketUrl) &&
        isEventSpecificTicketUrl(row.canonicalTicketUrl),
    ).length,
    correctionsNeeded: corrections.length,
  };
  report.samples = auditRows.filter((row) => SAMPLE_TITLES.some((pattern) => pattern.test(row.title ?? '')));
  report.correctionsPreview = corrections.map((row) => ({
    eventId: row.eventId,
    title: row.title,
    oldUrl: row.canonicalTicketUrl,
    newUrl: row.proposedTicketUrl,
  }));

  report.rootCause = {
    mechanism: 'importUpdateService.buildUpdatedAdminEvent used `candidate.ticketUrl ?? existing.ticketUrl`',
    trigger: 'Phase 4.5 website reimport supplied generic bootshaus.ticket.io shop URL from detail enrichment',
    path: 'legacy publish path (genericSourceFieldTrustMerge=false) overwrote Ticket.io deep links',
    fix: 'resolveBetterTicketUrl in import-update-service, field-trust-merge-service, merge-strategy',
  };

  if (applyChanges && corrections.length > 0) {
    const applied: Array<{ eventId: string; oldUrl?: string; newUrl?: string }> = [];
    for (const row of corrections) {
      await updateEventRow(row.eventId, { ticket_url: row.proposedTicketUrl });
      applied.push({ eventId: row.eventId, oldUrl: row.canonicalTicketUrl, newUrl: row.proposedTicketUrl });
    }
    report.appliedCorrections = applied;
    await importEventPublishService.refreshConsumerFeed();
  }

  if (applyChanges) {
    const source = await adminSourceRepository.getById(BOOTSHAUS_WEBSITE_SOURCE_ID);
    if (!source) {
      throw new Error('Bootshaus source missing for idempotency import.');
    }
    const job = await importAggregationService.enqueueJob(source, 'manual', `${ACTOR}:idempotency`);
    const completed = await importAggregationService.executeExistingJob(job, source, {
      recordImportReputation: true,
    });
    await importEventPublishService.refreshConsumerFeed();
    report.idempotencyImport = {
      jobId: completed.id,
      status: completed.status,
      metrics: completed.metrics,
    };
  }

  const afterCanonical = await client
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'published');
  const afterOrigins = await client.from('event_origins').select('id', { count: 'exact', head: true });

  report.counts = {
    canonicalPublishedBefore: beforeCanonical.count ?? 0,
    canonicalPublishedAfter: afterCanonical.count ?? 0,
    originsBefore: beforeOrigins.count ?? 0,
    originsAfter: afterOrigins.count ?? 0,
  };

  report.completedAt = new Date().toISOString();
  writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));

  await flushEntityAliasStore();
}

main().catch(async (error) => {
  console.error(error);
  try {
    await flushEntityAliasStore();
  } catch {
    // ignore
  }
  process.exit(1);
});
