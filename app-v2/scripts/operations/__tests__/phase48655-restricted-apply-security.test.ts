import { describe, expect, it } from 'vitest';

import {
  computeImmutableManifestBody,
  computeStableManifestHash,
  createApplyWriteCounters,
  productionMutationsInThisRun,
  recordAttemptedWrite,
  recordRollbackWrite,
  recordSuccessfulWrite,
  verifyApprovedManifestHash,
} from '../phase48655-restricted-apply-security';

describe('phase48655 restricted apply security', () => {
  it('manifest hash ignores generatedAt metadata drift', () => {
    const basePlan = {
      generatedAt: '2026-08-08T12:00:00.000Z',
      phase: '4.8.6.5.5',
      parentManifestHash: 'parent',
      sourceManifestHash: 'source',
      applyToken: 'exact:phase48655-restricted-correction',
      consumerPreviewNow: '2026-08-08T12:00:00.000Z',
      events: [
        {
          key: 'levi',
          eventId: 'evt-1',
          restrictedPatch: { endDate: '2026-08-08T03:00:00.000Z' },
          lineupArtistNames: [],
          rowFingerprintAtPlanTime: 'fp1',
        },
      ],
    };

    const hashA = computeStableManifestHash(basePlan);
    const hashB = computeStableManifestHash({
      ...basePlan,
      generatedAt: '2026-08-08T13:00:00.000Z',
      restrictedManifestHash: hashA,
    });

    expect(hashA).toBe(hashB);
    expect(computeImmutableManifestBody(basePlan)).not.toHaveProperty('generatedAt');
  });

  it('hard manifest verification fails on content drift', () => {
    const plan = {
      phase: '4.8.6.5.5',
      parentManifestHash: 'parent',
      sourceManifestHash: 'source',
      applyToken: 'exact:phase48655-restricted-correction',
      consumerPreviewNow: '2026-08-08T12:00:00.000Z',
      events: [
        {
          key: 'levi',
          eventId: 'evt-1',
          restrictedPatch: { endDate: '2026-08-08T03:00:00.000Z' },
          lineupArtistNames: [],
          rowFingerprintAtPlanTime: 'fp1',
        },
      ],
    };
    const approvedHash = computeStableManifestHash(plan);

    const drifted = {
      ...plan,
      events: [
        {
          key: 'levi',
          eventId: 'evt-1',
          restrictedPatch: { endDate: '2026-08-09T03:00:00.000Z' },
          lineupArtistNames: [],
          rowFingerprintAtPlanTime: 'fp1',
        },
      ],
    };

    expect(verifyApprovedManifestHash(drifted, approvedHash).ok).toBe(false);
  });

  it('counts attempted, successful, rollback and retry writes', () => {
    const counters = createApplyWriteCounters();

    recordAttemptedWrite(counters, false);
    recordSuccessfulWrite(counters, 2, 1);
    recordAttemptedWrite(counters, true);
    recordRollbackWrite(counters, 2);

    expect(counters.attemptedWrites).toBe(2);
    expect(counters.retryWrites).toBe(1);
    expect(counters.successfulWrites).toBe(1);
    expect(counters.finalCommittedFieldMutations).toBe(2);
    expect(counters.finalLineupOperations).toBe(1);
    expect(counters.rollbackWrites).toBe(1);
    expect(productionMutationsInThisRun(counters)).toBe(5);
  });
});
