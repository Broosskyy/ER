import { describe, expect, it } from 'vitest';

import {
  evidenceSupportsProposal,
  loadApprovedBatchPreview,
  productionValueUnchangedSinceReview,
  verifyApprovedCandidateSet,
} from '@/features/import/shadow/phase4822-controlled-batch';
import { join } from 'node:path';

const ROOT = join(__dirname, '../../../../../');

describe('phase4822-controlled-batch', () => {
  it('loads and verifies the approved 3-proposal / 2-event batch', () => {
    const preview = loadApprovedBatchPreview(ROOT);
    const verification = verifyApprovedCandidateSet(preview);
    expect(verification.ok).toBe(true);
    expect(preview.proposals).toHaveLength(3);
    expect(preview.affectedEvents).toBe(2);
  });

  it('detects production drift after review', () => {
    expect(
      productionValueUnchangedSinceReview(
        'UNDERLAND ESSIGFABRIK – Der Start einer neuen Ära!',
        'UNDERLAND ESSIGFABRIK – Der Start einer neuen Ära!',
        'description',
      ),
    ).toBe(true);
    expect(
      productionValueUnchangedSinceReview(
        'Already corrected description',
        'UNDERLAND ESSIGFABRIK – Der Start einer neuen Ära!',
        'description',
      ),
    ).toBe(false);
  });

  it('accepts live flyer evidence for approved URLs', () => {
    const proposed =
      'https://s3.eu-central-1.amazonaws.com/cdn.pixend.de/CQYDNRZ9Q8QSS8D/events/19-04-04-14-8dbecd78eaba1d7771ad.jpeg';
    expect(
      evidenceSupportsProposal(
        'flyer',
        { flyer: proposed },
        proposed,
        proposed,
      ),
    ).toBe(true);
  });
});
