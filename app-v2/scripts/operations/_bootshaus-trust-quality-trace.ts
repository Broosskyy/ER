/**
 * Bootshaus trust-quality trace — reproduces quality_score breakdown for live records.
 */
import './bootstrap-ops-supabase';

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getSupabaseServiceClient } from '@/services/supabase/client-service-role';
import { getEffectiveCandidate } from '@/features/import/admin/import-utils';
import { sourceQualityResolver } from '@/features/sources/domain/source-quality-resolver';
import { importRecordQualityEvaluator } from '@/features/trust-quality/services/import-record-quality-evaluator';
import { trustPublishDecisionEngine } from '@/features/trust-quality/services/trust-publish-decision-engine';
import { mapSourceRowToRecord } from '@/data/mappers/source-mapper';
import type { ImportRecord } from '@/features/import/models/types';
import type { TrustQualityRule } from '@/features/trust-quality/domain/trust-quality-types';

const BOOTSHAUS = 'source-bootshaus-koeln';
const OUT = join(process.cwd(), 'docs/real-data/_bootshaus_trust_quality_trace.json');

const QUALITY_FIELDS = [
  { name: 'title', weight: 12 },
  { name: 'startDate', weight: 12 },
  { name: 'endDate', weight: 5 },
  { name: 'venue', weight: 12 },
  { name: 'city', weight: 8 },
  { name: 'coordinates', weight: 5 },
  { name: 'description', weight: 10 },
  { name: 'genres', weight: 6 },
  { name: 'lineup', weight: 6 },
  { name: 'image', weight: 8 },
  { name: 'ticket', weight: 8 },
  { name: 'organizer', weight: 4 },
  { name: 'originalLink', weight: 4 },
] as const;

function fieldPresent(name: string, c: ReturnType<typeof getEffectiveCandidate>): boolean {
  switch (name) {
    case 'title': return Boolean(c.title?.trim());
    case 'startDate': return Boolean(c.startDate);
    case 'endDate': return Boolean(c.endDate);
    case 'venue': return Boolean(c.venueName?.trim());
    case 'city': return Boolean(c.cityName?.trim() && c.countryCode);
    case 'coordinates': return c.latitude !== undefined && c.longitude !== undefined;
    case 'description': return Boolean(c.description?.trim());
    case 'genres': return (c.genreNames?.length ?? 0) > 0;
    case 'lineup': return (c.artistNames?.length ?? 0) > 0;
    case 'image': return Boolean(c.imageUrl || (c.imageUrls?.length ?? 0) > 0);
    case 'ticket': return Boolean(c.ticketUrl);
    case 'organizer': return Boolean(c.organizerName?.trim());
    case 'originalLink': return Boolean(c.originalLink || c.eventUrl);
    default: return false;
  }
}

function penaltyPoints(severity: string): number {
  if (severity === 'blocking') return 25;
  if (severity === 'warning') return 10;
  return 4;
}

async function main() {
  const client = getSupabaseServiceClient();

  const { data: sourceRow } = await client.from('sources').select('*').eq('id', BOOTSHAUS).single();
  const source = mapSourceRowToRecord(sourceRow);

  const { data: rules } = await client.from('trust_quality_rules').select('*').eq('enabled', true);
  const ruleList = (rules ?? []) as TrustQualityRule[];

  const { data: recordRow } = await client
    .from('import_records')
    .select('*')
    .eq('source_id', BOOTSHAUS)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();

  const record = {
    id: recordRow.id,
    importJobId: recordRow.import_job_id,
    sourceId: recordRow.source_id,
    externalId: recordRow.external_id,
    sourceUrl: recordRow.source_url,
    rawPayload: recordRow.raw_payload,
    normalizedPayload: recordRow.normalized_payload,
    validationErrors: recordRow.validation_errors,
    validationWarnings: recordRow.validation_warnings,
    matchedCityId: recordRow.matched_city_id,
    matchedVenueId: recordRow.matched_venue_id,
    matchedOrganizerId: recordRow.matched_organizer_id,
    duplicateScore: recordRow.duplicate_score,
    duplicateDecision: recordRow.duplicate_decision,
    status: recordRow.status,
    resultingEventId: recordRow.resulting_event_id,
    createdAt: recordRow.created_at,
    updatedAt: recordRow.updated_at,
  } as ImportRecord;

  const { data: review } = await client
    .from('import_review_queue')
    .select('*')
    .eq('import_record_id', record.id)
    .maybeSingle();

  const candidate = getEffectiveCandidate(record);
  const quality = importRecordQualityEvaluator.evaluate(record, ruleList);
  const publishEval = trustPublishDecisionEngine.evaluate({ source, record, rules: ruleList });

  const completenessBreakdown = QUALITY_FIELDS.map((f) => ({
    field: f.name,
    weight: f.weight,
    present: fieldPresent(f.name, candidate),
    points: fieldPresent(f.name, candidate) ? f.weight : 0,
  }));
  const totalWeight = QUALITY_FIELDS.reduce((s, f) => s + f.weight, 0);
  const completenessRaw = completenessBreakdown.reduce((s, f) => s + f.points, 0);
  const completenessScore = Math.round((completenessRaw / totalWeight) * 100);

  const violationBreakdown = quality.violations.map((v) => ({
    ruleKey: v.ruleKey,
    severity: v.severity,
    decisionImpact: v.decisionImpact,
    message: v.message,
    affectedFields: v.affectedFields,
    penaltyPoints: penaltyPoints(v.severity),
  }));
  const totalPenalty = violationBreakdown.reduce((s, v) => s + v.penaltyPoints, 0);

  const { data: allRecords } = await client
    .from('import_records')
    .select('id, normalized_payload')
    .eq('source_id', BOOTSHAUS);

  const { data: allReviews } = await client
    .from('import_review_queue')
    .select('quality_score, decision, status, reasons')
    .eq('source_id', BOOTSHAUS);

  function analyzeRecord(row: { id: string; normalized_payload: unknown }) {
    const rec = {
      id: row.id,
      importJobId: '',
      sourceId: BOOTSHAUS,
      externalId: '',
      normalizedPayload: row.normalized_payload,
      status: 'needs_review' as const,
      createdAt: '',
      updatedAt: '',
    } as ImportRecord;
    const cand = getEffectiveCandidate(rec);
    const q = importRecordQualityEvaluator.evaluate(rec, ruleList);
    return {
      recordId: row.id,
      cityName: cand.cityName ?? null,
      organizerName: cand.organizerName ?? null,
      venueName: cand.venueName ?? null,
      calculatedScore: q.score,
      violations: q.violations.map((v) => ({
        ruleKey: v.ruleKey,
        severity: v.severity,
        penalty: penaltyPoints(v.severity),
        message: v.message,
      })),
    };
  }

  const scoreDistribution: Record<string, number> = {};
  for (const r of allReviews ?? []) {
    const key = String(r.quality_score);
    scoreDistribution[key] = (scoreDistribution[key] ?? 0) + 1;
  }

  const cohort = (allRecords ?? []).map(analyzeRecord);
  const lowScore = cohort.find((c) => c.calculatedScore <= 40);
  const highScore = cohort.find((c) => c.calculatedScore >= 65);

  const report = {
    capturedAt: new Date().toISOString(),
    externalId: record.externalId,
    importRecordId: record.id,
    reviewId: review?.id ?? null,
    storedReviewQualityScore: review?.quality_score ?? null,
    storedReviewDecision: review?.decision ?? null,
    storedReviewStatus: review?.status ?? null,
    storedReviewReasons: review?.reasons ?? null,
    sourceConfigDefaults: source.sourceConfig?.defaults ?? null,
    pipelinePath: [
      '1. fetch (html_selector from bootshaus.tv)',
      '2. normalize (eventNormalizer + applySourceFieldDefaults from source.fieldDefaults)',
      '3. match (city/venue/organizer catalog)',
      '4. upsert import_records (normalized_payload persisted)',
      '5. publishDecision.evaluate → importRecordQualityEvaluator + trustPublishDecisionEngine',
      '6. enqueueFromEvaluation → import_review_queue',
    ],
    effectiveCandidate: {
      title: candidate.title,
      startDate: candidate.startDate,
      venueName: candidate.venueName,
      cityName: candidate.cityName,
      countryCode: candidate.countryCode,
      organizerName: candidate.organizerName,
      imageUrl: candidate.imageUrl,
      ticketUrl: candidate.ticketUrl,
      eventUrl: candidate.eventUrl,
      description: candidate.description ? '[present]' : null,
      genreNames: candidate.genreNames,
      artistNames: candidate.artistNames,
      latitude: candidate.latitude,
      longitude: candidate.longitude,
    },
    normalizedPayloadSnapshot: record.normalizedPayload,
    matchedIds: {
      city: record.matchedCityId,
      venue: record.matchedVenueId,
      organizer: record.matchedOrganizerId,
    },
    completenessBreakdown,
    completenessScore,
    violationBreakdown,
    totalPenalty,
    calculatedQualityScore: quality.score,
    calculatedTier: quality.tier,
    publishDecision: publishEval.decision,
    publishReasons: publishEval.reasons,
    publishTrustScore: publishEval.trustScore,
    formula: `quality_score = max(0, round(completeness ${completenessScore} - penalty ${totalPenalty})) = ${quality.score}`,
    cohortSummary: {
      reviewScoreDistribution: scoreDistribution,
      recordCalculatedScores: cohort.reduce<Record<string, number>>((acc, c) => {
        const k = String(c.calculatedScore);
        acc[k] = (acc[k] ?? 0) + 1;
        return acc;
      }, {}),
      lowScoreExample: lowScore ?? null,
      highScoreExample: highScore ?? null,
    },
  };

  writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
