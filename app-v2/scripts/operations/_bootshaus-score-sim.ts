import { importRecordQualityEvaluator } from '@/features/trust-quality/services/import-record-quality-evaluator';
import { trustPublishDecisionEngine } from '@/features/trust-quality/services/trust-publish-decision-engine';
import { createBootshausProductionSourceRecord } from '@/features/sources/production/production-source-records';
import type { ImportRecord } from '@/features/import/models/types';
import type { TrustQualityRule } from '@/features/trust-quality/domain/trust-quality-types';

const rules: TrustQualityRule[] = [
  { id: 'rule-missing-city', ruleKey: 'missing_city', category: 'field_required', severity: 'warning', decisionImpact: 'review_required', enabled: true, weight: 0.8, config: { field: 'cityName' }, createdAt: '', updatedAt: '' },
  { id: 'rule-missing-organizer', ruleKey: 'missing_organizer', category: 'field_required', severity: 'info', decisionImpact: 'hold', enabled: true, weight: 0.4, config: { field: 'organizerName' }, createdAt: '', updatedAt: '' },
  { id: 'rule-missing-image', ruleKey: 'missing_image', category: 'field_required', severity: 'info', decisionImpact: 'hold', enabled: true, weight: 0.5, config: { field: 'imageUrl' }, createdAt: '', updatedAt: '' },
];

const base = {
  id: 'sim',
  importJobId: 'j',
  sourceId: 'source-bootshaus-koeln',
  externalId: 'https://bootshaus.tv/events/x',
  status: 'needs_review' as const,
  createdAt: '',
  updatedAt: '',
};

const oldRecord: ImportRecord = {
  ...base,
  normalizedPayload: {
    title: 'LOONYLAND AT NATURE ONE',
    startDate: '2026-07-30T18:00:00.000Z',
    venueName: 'CHROME COLOGNE',
    imageUrl: 'https://cdn.example/x.jpg',
    eventUrl: 'https://bootshaus.tv/events/x',
    countryCode: 'DE',
    rawSourceType: 'unknown',
  },
};

const newRecord: ImportRecord = {
  ...base,
  normalizedPayload: {
    title: 'LOONYLAND AT NATURE ONE',
    startDate: '2026-07-30T18:00:00.000Z',
    venueName: 'Bootshaus',
    cityName: 'Köln',
    organizerName: 'Bootshaus',
    imageUrl: 'https://cdn.example/x.jpg',
    eventUrl: 'https://bootshaus.tv/events/x',
    ticketUrl: 'https://bootshaus.tv/events/x',
    countryCode: 'DE',
    rawSourceType: 'unknown',
  },
};

const source = createBootshausProductionSourceRecord();
for (const [label, rec] of [
  ['OLD_PRE_DEFAULTS', oldRecord],
  ['NEW_WITH_DEFAULTS', newRecord],
] as const) {
  const q = importRecordQualityEvaluator.evaluate(rec, rules);
  const pub = trustPublishDecisionEngine.evaluate({ source, record: rec, rules });
  console.log(
    label,
    JSON.stringify(
      {
        qualityScore: q.score,
        completenessScore: q.completeness,
        violations: q.violations.map((v) => ({
          ruleKey: v.ruleKey,
          severity: v.severity,
          decisionImpact: v.decisionImpact,
          penalty: v.severity === 'blocking' ? 25 : v.severity === 'warning' ? 10 : 4,
          message: v.message,
        })),
        publishDecision: pub.decision,
        publishReasons: pub.reasons,
      },
      null,
      2,
    ),
  );
}
