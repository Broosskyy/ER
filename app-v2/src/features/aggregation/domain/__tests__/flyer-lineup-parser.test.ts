import { describe, expect, it } from 'vitest';

import {
  parseFlyerLineupCandidates,
  selectPublishableFlyerCandidates,
  selectReviewRequiredFlyerCandidates,
} from '@/features/aggregation/domain/flyer-lineup-parser';

describe('flyer lineup parser', () => {
  it('extracts single artist from flyer text', () => {
    const candidates = parseFlyerLineupCandidates({
      rawText: 'LINEUP\nNIKOLINA\nTECHNO DAMPFER',
      eventTitle: '100% SCHRANZ',
      knownCanonicalNames: ['NIKOLINA'],
    });
    const publishable = selectPublishableFlyerCandidates(candidates);
    expect(publishable.map((c) => c.displayName)).toContain('NIKOLINA');
  });

  it('keeps B2B billing row as a single high-confidence candidate', () => {
    const candidates = parseFlyerLineupCandidates({
      rawText: 'ARTISTS\nMOONBOOTICA B2B ANNA REUSCH',
    });
    expect(candidates.map((c) => c.displayName)).toContain('MOONBOOTICA B2B ANNA REUSCH');
    expect(candidates.find((c) => c.displayName.includes('B2B'))?.isB2b).toBe(true);
    expect(candidates.find((c) => c.displayName.includes('B2B'))?.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it('rejects venue and sponsor noise', () => {
    const candidates = parseFlyerLineupCandidates({
      rawText: 'BOOTSHAUS\nCOLOGNE\nDOORS 23:00\nSPONSOR ENERGY DRINK',
      venueName: 'Bootshaus',
      cityName: 'Cologne',
    });
    const accepted = candidates.filter((c) => !c.rejected);
    expect(accepted).toHaveLength(0);
  });

  it('routes ambiguous OCR to review not auto-publish', () => {
    const candidates = parseFlyerLineupCandidates({
      rawText: 'MYSTERY DJ\nUNKNOWN ACT',
    });
    const publishable = selectPublishableFlyerCandidates(candidates);
    const review = selectReviewRequiredFlyerCandidates(candidates);
    expect(publishable).toHaveLength(0);
    expect(candidates.length).toBeGreaterThan(0);
    expect(review.length + candidates.filter((c) => c.rejected).length).toBeGreaterThan(0);
  });

  it('auto-publishes exact canonical match', () => {
    const candidates = parseFlyerLineupCandidates({
      rawText: 'SHOCKONE',
      knownCanonicalNames: ['SHOCKONE'],
    });
    expect(selectPublishableFlyerCandidates(candidates)).toHaveLength(1);
  });
});
