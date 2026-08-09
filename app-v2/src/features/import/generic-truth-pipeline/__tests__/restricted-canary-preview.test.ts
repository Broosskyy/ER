import { describe, expect, it } from 'vitest';

import {
  buildRestrictedCanaryRollout,
  buildStableCanaryManifestHash,
  RESTRICTED_CANARY_SOURCE_ID,
  selectDeterministicCanaryEventIds,
} from '@/features/import/generic-truth-pipeline/restricted-canary-preview';

describe('restricted canary determinism', () => {
  it('selects the same cohort for identical inputs', () => {
    const rollout = buildRestrictedCanaryRollout();
    const eventIds = Array.from({ length: 40 }, (_, index) => `evt-deterministic-${index}`);
    const first = selectDeterministicCanaryEventIds(
      RESTRICTED_CANARY_SOURCE_ID,
      eventIds,
      10,
      3,
      rollout,
    );
    const second = selectDeterministicCanaryEventIds(
      RESTRICTED_CANARY_SOURCE_ID,
      eventIds,
      10,
      3,
      rollout,
    );
    expect(first).toEqual(second);
    expect(first.length).toBeLessThanOrEqual(3);
  });

  it('builds a stable manifest hash without timestamps', () => {
    const hashA = buildStableCanaryManifestHash({
      sourceId: RESTRICTED_CANARY_SOURCE_ID,
      canaryPercent: 10,
      maxEvents: 3,
      allowedFieldGroups: ['tickets', 'cta_checkout'],
      candidates: [
        {
          eventId: 'evt-a',
          beforeFingerprint: 'fp-a',
          expectedPatches: { priceText: '15,00 €' },
          rollbackPayload: { priceText: '12,00 €' },
        },
      ],
    });
    const hashB = buildStableCanaryManifestHash({
      sourceId: RESTRICTED_CANARY_SOURCE_ID,
      canaryPercent: 10,
      maxEvents: 3,
      allowedFieldGroups: ['tickets', 'cta_checkout'],
      candidates: [
        {
          eventId: 'evt-a',
          beforeFingerprint: 'fp-a',
          expectedPatches: { priceText: '15,00 €' },
          rollbackPayload: { priceText: '12,00 €' },
        },
      ],
    });
    expect(hashA).toBe(hashB);
  });
});
