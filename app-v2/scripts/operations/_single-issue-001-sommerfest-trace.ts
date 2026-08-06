/**
 * Single-Issue Fix #001 — Sommerfest Elektroküche production trace (read-only + repair phases).
 */
import './bootstrap-ops-supabase';

process.env.EXPO_PUBLIC_USE_SUPABASE = 'true';

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { mapEventRowToAdminRecord } from '@/data/mappers/event-mapper';
import type { EventRow } from '@/data/mappers/event-mapper';
import { extractPrioritizedArtistNames } from '@/features/import/services/import-lineup-from-record';
import { getEffectiveCandidate } from '@/features/import/admin/import-utils';
import type { ImportRecord } from '@/features/import/models/types';
import { opsClient } from './ops-supabase-rows';

const EVENT_ID = 'evt-1785389055557-ux20897';
const OUT = join(process.cwd(), 'docs/real-data/_single_issue_001_sommerfest_trace.json');

async function main(): Promise<void> {
  const phase = process.argv[2] ?? 'trace';
  const c = opsClient();

  const { data: eventRow } = await c.from('events').select('*').eq('id', EVENT_ID).maybeSingle();
  const { data: refs } = await c
    .from('event_source_references')
    .select('*')
    .eq('canonical_event_id', EVENT_ID);
  const { data: artistRows } = await c
    .from('event_artists')
    .select('*, artists(id,name,slug,verification_status)')
    .eq('event_id', EVENT_ID)
    .order('sort_order', { ascending: true });
  const { data: importRows } = await c
    .from('import_records')
    .select('*')
    .eq('resulting_event_id', EVENT_ID)
    .order('updated_at', { ascending: false });

  const importTraces = (importRows ?? []).map((row) => {
    const fakeRecord = {
      id: row.id,
      sourceId: row.source_id,
      normalizedPayload: row.normalized_payload,
      rawPayload: row.raw_payload,
      status: row.status,
      externalId: row.external_id,
    } as ImportRecord;
    const prioritized = extractPrioritizedArtistNames(fakeRecord);
    const candidate = getEffectiveCandidate(fakeRecord);
    const payload = row.normalized_payload as Record<string, unknown> | null;
    const metadata = payload?.sourceMetadata as Record<string, unknown> | undefined;
    return {
      importRecordId: row.id,
      sourceId: row.source_id,
      externalId: row.external_id,
      status: row.status,
      updatedAt: row.updated_at,
      artistNames: payload?.artistNames ?? candidate.artistNames,
      lineupEntries: metadata?.lineupEntries ?? payload?.lineupEntries,
      lineupEntryCount: Array.isArray(metadata?.lineupEntries)
        ? (metadata.lineupEntries as unknown[]).length
        : Array.isArray(payload?.lineupEntries)
          ? (payload.lineupEntries as unknown[]).length
          : 0,
      prioritizedNames: prioritized.names,
      prioritizedSource: prioritized.source,
      detailSnapshot: metadata?.detailSnapshot ?? null,
      parserVersion: metadata?.detailParserVersion ?? metadata?.parserVersion,
    };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    phase,
    canonicalEventId: EVENT_ID,
    event: eventRow
      ? {
          ...mapEventRowToAdminRecord(eventRow as EventRow),
          status: eventRow.status,
          slug: eventRow.id,
        }
      : null,
    origins: refs ?? [],
    eventArtists: artistRows ?? [],
    importTraces,
  };

  writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));

  if (phase === 'repair') {
    const ticketKingsSourceIds = [
      'source-affenkaefig-ticket-kings',
      'source-ticket-kings-org-elektrokuche',
      'source-ticket-kings-org-m-d-m-a-musik-die-mich-antreibt',
    ];
    for (const sourceId of ticketKingsSourceIds) {
      const { data: sourceRow } = await c.from('sources').select('source_config').eq('id', sourceId).maybeSingle();
      if (!sourceRow?.source_config) continue;
      const config = sourceRow.source_config as Record<string, unknown>;
      const ticketPlatform = (config.ticketPlatform ?? {}) as Record<string, unknown>;
      const limits = (ticketPlatform.limits ?? {}) as Record<string, unknown>;
      if (Number(limits.maxDetailPages ?? 0) <= 0) {
        limits.maxDetailPages = 15;
        ticketPlatform.limits = limits;
        config.ticketPlatform = ticketPlatform;
        await c.from('sources').update({ source_config: config, updated_at: new Date().toISOString() }).eq('id', sourceId);
        console.log(`[repair] patched maxDetailPages for ${sourceId}`);
      }
    }

    const { resetDatasourceBundle } = await import('@/data/datasources/supabase/supabase-datasource');
    resetDatasourceBundle();
    const registry = await import('@/data/repositories/registry');
    const entityBootstrap = await import('@/features/entity-resolution/entity-alias-store-bootstrap');
    await entityBootstrap.initializeEntityAliasStore();

    const sources = ['source-affenkaefig', 'source-affenkaefig-ticket-kings'];
    for (const sourceId of sources) {
      const { data: sourceRow } = await c.from('sources').select('*').eq('id', sourceId).maybeSingle();
      if (!sourceRow) continue;
      const { mapSourceRowToRecord } = await import('@/data/mappers/source-mapper');
      const source = mapSourceRowToRecord(sourceRow as never);
      console.log(`[repair] enqueue ${sourceId}...`);
      const job = await registry.importAggregationService.enqueueJob(source, 'manual', 'single-issue-001');
      const completed = await registry.importAggregationService.executeExistingJob(job, source, {
        recordImportReputation: true,
      });
      const records = await registry.importRecordRepository.listByJobId(completed.id);
      for (const record of records) {
        if (record.resultingEventId !== EVENT_ID && record.externalId && !String(record.externalId).includes('sommerfest')) {
          continue;
        }
        if (!record.resultingEventId && !String(record.normalizedPayload?.title ?? '').includes('Sommerfest')) {
          continue;
        }
        await registry.importEventPublishService.publishRecord(record, source, [], {
          actorId: 'single-issue-001',
        });
        await registry.importEventPublishService.repairLineupProjectionIfNeeded(
          record,
          record.resultingEventId ?? EVENT_ID,
        );
      }
      console.log(`[repair] done ${sourceId}`, completed.metrics);
    }

    await entityBootstrap.flushEntityAliasStore();
    await registry.importEventPublishService.refreshConsumerFeed();
    console.log('[repair] complete — re-run trace');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
