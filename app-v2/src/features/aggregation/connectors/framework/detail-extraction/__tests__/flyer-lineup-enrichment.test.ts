import { describe, expect, it } from 'vitest';

import { enrichFlyerLineup } from '@/features/aggregation/connectors/framework/detail-extraction/flyer-lineup-enrichment';

describe('flyer lineup enrichment', () => {
  it('skips unchanged image content hash', () => {
    const first = enrichFlyerLineup({
      imageUrl: 'https://example.com/flyer.jpg',
      rawText: 'ARTIST ONE',
    });
    const second = enrichFlyerLineup({
      imageUrl: 'https://example.com/flyer.jpg',
      rawText: 'ARTIST ONE',
      previousHash: first.contentHash,
    });
    expect(second.status).toBe('skipped_unchanged');
  });

  it('stays pending when no OCR text is available', () => {
    const result = enrichFlyerLineup({
      imageUrl: 'https://example.com/poster.png',
    });
    expect(result.status).toBe('pending');
    expect(result.autoPublishCandidates).toHaveLength(0);
  });
});
