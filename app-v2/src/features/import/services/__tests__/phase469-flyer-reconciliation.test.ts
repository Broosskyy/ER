import { describe, expect, it } from 'vitest';

import { parseFlyerTextToCanonicalEntries } from '@/features/aggregation/domain/flyer-lineup-to-canonical';
import { hashFlyerImageContent } from '@/features/aggregation/connectors/framework/detail-extraction/flyer-lineup-enrichment';
import { buildFlyerLineupEvidence } from '@/features/import/services/flyer-lineup-evidence';
import {
  attachFlyerLineupEvidenceToRecord,
  isPublishableFlyerEvidence,
  readFlyerLineupEvidence,
} from '@/features/import/services/flyer-evidence-metadata';
import type { ImportRecord } from '@/features/import/models/types';

const BOOTSHAUS_FLYER = [
  'BRANDON B2B SAM COLLINS',
  'OLIVER MAGENTA B2B LOST IDENTITY',
  'DAVE REPLAY B2B EMIN',
  'ALUKES B2B MAKLA',
].join('\n');

describe('flyer lineup to canonical entries', () => {
  it('reconstructs four Bootshaus B2B pairs', () => {
    const entries = parseFlyerTextToCanonicalEntries(BOOTSHAUS_FLYER);
    expect(entries).toHaveLength(4);
    expect(entries.every((entry) => entry.billingRelation === 'B2B')).toBe(true);
    expect(entries.flatMap((entry) => entry.artists)).toEqual([
      'BRANDON',
      'SAM COLLINS',
      'OLIVER MAGENTA',
      'LOST IDENTITY',
      'DAVE REPLAY',
      'EMIN',
      'ALUKES',
      'MAKLA',
    ]);
  });

  it('parses MDMA F2F billing row', () => {
    const entries = parseFlyerTextToCanonicalEntries('KARAMUSTAN F2F GREEKZ');
    expect(entries).toHaveLength(1);
    expect(entries[0]?.billingRelation).toBe('F2F');
    expect(entries[0]?.artists).toEqual(['KARAMUSTAN', 'GREEKZ']);
  });

  it('skips sponsor and venue noise lines', () => {
    const entries = parseFlyerTextToCanonicalEntries(
      'BOOTSHAUS\nCOLOGNE\nSPONSOR ENERGY\nBRANDON B2B SAM COLLINS',
      { venueName: 'Bootshaus', cityName: 'Cologne' },
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]?.artists).toEqual(['BRANDON', 'SAM COLLINS']);
  });
});

describe('flyer evidence metadata', () => {
  const baseRecord: ImportRecord = {
    id: 'imp-1',
    importJobId: 'job-1',
    sourceId: 'src-1',
    externalId: 'ext-1',
    rawPayload: {},
    normalizedPayload: { sourceMetadata: {} },
    status: 'published',
    createdAt: '',
    updatedAt: '',
  };

  it('attaches and reads flyer evidence on import record', () => {
    const hash = hashFlyerImageContent({ imageUrl: 'https://example.com/flyer.jpg', rawText: BOOTSHAUS_FLYER });
    const updated = attachFlyerLineupEvidenceToRecord(baseRecord, {
      imageUrl: 'https://example.com/flyer.jpg',
      rawText: BOOTSHAUS_FLYER,
      contentHash: hash,
      confidence: 0.92,
      autoPublishAllowed: false,
      reviewState: 'accepted',
    });
    const evidence = readFlyerLineupEvidence(updated);
    expect(evidence?.rawText).toBe(BOOTSHAUS_FLYER);
    expect(isPublishableFlyerEvidence(evidence)).toBe(true);
  });

  it('is idempotent for unchanged image hash', () => {
    const hash = hashFlyerImageContent({ imageUrl: 'https://example.com/flyer.jpg', rawText: BOOTSHAUS_FLYER });
    const first = buildFlyerLineupEvidence({
      eventId: 'evt-1',
      imageUrl: 'https://example.com/flyer.jpg',
      rawText: BOOTSHAUS_FLYER,
    });
    const second = buildFlyerLineupEvidence({
      eventId: 'evt-1',
      imageUrl: 'https://example.com/flyer.jpg',
      rawText: BOOTSHAUS_FLYER,
      previousHash: hash,
    });
    expect(first.extraction.contentHash).toBe(second.extraction.contentHash);
    expect(first.entries).toHaveLength(second.entries.length);
    expect(first.entries.map((entry) => entry.billingRelation)).toEqual(
      second.entries.map((entry) => entry.billingRelation),
    );
  });
});
