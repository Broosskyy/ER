/**
 * Bootshaus trust re-evaluation repair — closes stale reviews and publishes via pipeline.
 * Usage: npx tsx scripts/operations/_bootshaus-trust-reevaluation-repair.ts
 */
import './bootstrap-ops-supabase';

import { assertLegacyRepairScriptAllowed } from '@/features/operations/repair/legacy-repair-script-guard';

assertLegacyRepairScriptAllowed('scripts/operations/_bootshaus-trust-reevaluation-repair.ts');

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import {
  adminSourceRepository,
  importPublishOrchestratorService,
  importRecordRepository,
} from '@/data/repositories/registry';
import { initializeEntityAliasStore } from '@/features/entity-resolution/entity-alias-store-bootstrap';
import { getSupabaseServiceClient } from '@/services/supabase/client-service-role';
import { importRecordQualityEvaluator } from '@/features/trust-quality/services/import-record-quality-evaluator';
import { trustPublishDecisionEngine } from '@/features/trust-quality/services/trust-publish-decision-engine';
import type { TrustQualityRule } from '@/features/trust-quality/domain/trust-quality-types';

const BOOTSHAUS_SOURCE = 'source-bootshaus-koeln';
const OUT_JSON = join(process.cwd(), 'docs/real-data/_bootshaus_trust_reevaluation_repair.json');

function anonClient() {
  return createClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '',
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function loadRules(): Promise<TrustQualityRule[]> {
  const client = getSupabaseServiceClient();
  const { data, error } = await client.from('trust_quality_rules').select('*').eq('enabled', true);
  if (error) {
    throw new Error(`Failed to load trust rules: ${error.message}`);
  }
  return (data ?? []).map((row) => ({
    id: String(row.id),
    ruleKey: String(row.rule_key),
    category: row.category,
    severity: row.severity,
    decisionImpact: row.decision_impact,
    enabled: Boolean(row.enabled),
    weight: Number(row.weight ?? 1),
    config: (row.config as Record<string, unknown> | undefined) ?? {},
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  })) as TrustQualityRule[];
}

async function captureState(label: string) {
  const client = getSupabaseServiceClient();
  const { data: records } = await client
    .from('import_records')
    .select('id, external_id, status, resulting_event_id, normalized_payload, updated_at')
    .eq('source_id', BOOTSHAUS_SOURCE);

  const { data: reviews } = await client
    .from('import_review_queue')
    .select('id, import_record_id, status, decision, quality_score, trust_score, reasons, metadata')
    .eq('source_id', BOOTSHAUS_SOURCE);

  const activeReviews = (reviews ?? []).filter((r) => r.status === 'pending' || r.status === 'on_hold');

  const { count: publishedCount } = await client
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('source_id', BOOTSHAUS_SOURCE)
    .eq('status', 'published');

  const { count: sourceRefCount } = await client
    .from('event_source_references')
    .select('id', { count: 'exact', head: true })
    .eq('source_id', BOOTSHAUS_SOURCE);

  return {
    label,
    capturedAt: new Date().toISOString(),
    importRecords: records?.length ?? 0,
    activeReviews: activeReviews.length,
    reviewScoreDistribution: activeReviews.reduce<Record<string, number>>((acc, review) => {
      const key = String(review.quality_score ?? 'null');
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
    publishedEvents: publishedCount ?? 0,
    sourceReferences: sourceRefCount ?? 0,
    records,
    reviews,
    activeReviewRows: activeReviews,
  };
}

async function main() {
  await initializeEntityAliasStore();
  const rules = await loadRules();
  const sourceBeforeRepair = await adminSourceRepository.getById(BOOTSHAUS_SOURCE);
  if (!sourceBeforeRepair) {
    throw new Error('Bootshaus source not found');
  }
  if ((sourceBeforeRepair.computedTrustScore ?? sourceBeforeRepair.trustScore) < 70) {
    await adminSourceRepository.save({
      ...sourceBeforeRepair,
      computedTrustScore: sourceBeforeRepair.trustScore,
      trustScoreUpdatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  const before = await captureState('before');
  const domainRecords = await importRecordRepository.listLatestBySourceId(BOOTSHAUS_SOURCE);

  const perRecordTraces: Array<Record<string, unknown>> = [];
  for (const record of domainRecords) {
    const source = await adminSourceRepository.getById(BOOTSHAUS_SOURCE);
    if (!source) {
      throw new Error('Bootshaus source not found');
    }
    const quality = importRecordQualityEvaluator.evaluate(record, rules);
    const evaluation = trustPublishDecisionEngine.evaluate({ source, record, rules });
    perRecordTraces.push({
      importRecordId: record.id,
      externalId: record.externalId,
      status: record.status,
      resultingEventId: record.resultingEventId ?? null,
      qualityScore: quality.score,
      completeness: quality.completeness,
      violations: quality.violations.length,
      decision: evaluation.decision,
      trustScore: evaluation.trustScore,
      reasons: evaluation.reasons,
    });
  }

  const reevaluationJobId = `trust-reevaluation-${Date.now()}`;
  const result = await importPublishOrchestratorService.reevaluateRecords(
    domainRecords,
    async () => {
      const source = await adminSourceRepository.getById(BOOTSHAUS_SOURCE);
      if (!source) {
        throw new Error('Bootshaus source not found');
      }
      return source;
    },
    domainRecords,
    { actorId: 'system:trust-reevaluation' },
  );

  const after = await captureState('after');
  const notPublished = perRecordTraces
    .map((trace) => {
      const recordAfter = (after.records ?? []).find((row) => row.id === trace.importRecordId);
      return {
        ...trace,
        published: Boolean(recordAfter?.resulting_event_id),
        finalStatus: recordAfter?.status ?? null,
        resultingEventId: recordAfter?.resulting_event_id ?? null,
      };
    })
    .filter((entry) => !entry.published);

  const discovery: Record<string, unknown> = {};
  const anon = anonClient();
  const { count: anonPublished } = await anon
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('source_id', BOOTSHAUS_SOURCE)
    .eq('status', 'published');
  discovery.anonPublishedCount = anonPublished ?? 0;

  const { data: bootshausSearch } = await anon
    .from('events')
    .select('id, title, venue_name, venue_id, search_document')
    .eq('status', 'published')
    .ilike('search_document', '%bootshaus%')
    .limit(10);
  discovery.bootshausSearchHits = bootshausSearch?.length ?? 0;
  discovery.bootshausSearchSample = bootshausSearch ?? [];

  const sampleTitle = (bootshausSearch?.[0]?.title as string | undefined) ?? null;
  if (sampleTitle) {
    const { data: titleSearch } = await anon
      .from('events')
      .select('id, title')
      .eq('status', 'published')
      .ilike('title', `%${sampleTitle.slice(0, 12)}%`)
      .limit(5);
    discovery.titleSearchHits = titleSearch?.length ?? 0;
  }

  const { data: venueEvents } = await anon
    .from('events')
    .select('id, title, venue_id')
    .eq('status', 'published')
    .eq('venue_id', 'venue-bootshaus-koeln')
    .limit(5);
  discovery.venueFilterHits = venueEvents?.length ?? 0;

  const artifact = {
    capturedAt: new Date().toISOString(),
    sourceId: BOOTSHAUS_SOURCE,
    reevaluationJobId,
    before: {
      importRecords: before.importRecords,
      activeReviews: before.activeReviews,
      reviewScoreDistribution: before.reviewScoreDistribution,
      publishedEvents: before.publishedEvents,
      sourceReferences: before.sourceReferences,
    },
    perRecordTraces,
    reevaluationResult: result,
    after: {
      importRecords: after.importRecords,
      activeReviews: after.activeReviews,
      reviewScoreDistribution: after.reviewScoreDistribution,
      publishedEvents: after.publishedEvents,
      sourceReferences: after.sourceReferences,
    },
    notPublished,
    discovery,
    closedReviews: (after.reviews ?? []).filter((review) => review.status === 'expired').length,
  };

  writeFileSync(OUT_JSON, JSON.stringify(artifact, null, 2));
  console.log(JSON.stringify(artifact, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
