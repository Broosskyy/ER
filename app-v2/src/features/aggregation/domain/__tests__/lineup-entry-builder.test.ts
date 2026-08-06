import { describe, expect, it } from 'vitest';

import { parseLineupLineToCanonicalEntries } from '@/features/aggregation/domain/lineup-entry-builder';
import { mergeCanonicalLineupEntries } from '@/features/aggregation/domain/lineup-entry-merge';

describe('lineup entry builder', () => {
  it('parses F2F billing into grouped artists', () => {
    const entries = parseLineupLineToCanonicalEntries('DYSTOPIA F2F VALKYRIE');
    expect(entries).toHaveLength(1);
    expect(entries[0]?.billingRelation).toBe('F2F');
    expect(entries[0]?.artists).toEqual(['DYSTOPIA', 'VALKYRIE']);
  });

  it('parses B2B billing into grouped artists', () => {
    const entries = parseLineupLineToCanonicalEntries('FLASH B2B FORWARD');
    expect(entries).toHaveLength(1);
    expect(entries[0]?.billingRelation).toBe('B2B');
    expect(entries[0]?.artists).toEqual(['FLASH', 'FORWARD']);
  });

  it('parses hosted by prefix', () => {
    const entries = parseLineupLineToCanonicalEntries('Hosted by XYZ');
    expect(entries[0]?.billingRelation).toBe('HOSTED_BY');
    expect(entries[0]?.artists).toEqual(['XYZ']);
  });

  it('parses special guest without artist name', () => {
    const entries = parseLineupLineToCanonicalEntries('Special Guest');
    expect(entries[0]?.billingRelation).toBe('SPECIAL_GUEST');
    expect(entries[0]?.artists).toEqual([]);
  });
});

describe('lineup entry merge', () => {
  it('never downgrades B2B to SOLO when merging', () => {
    const merged = mergeCanonicalLineupEntries(
      [{ order: 0, artists: ['FLASH', 'FORWARD'], billingRelation: 'B2B' }],
      [{ order: 0, artists: ['FLASH'], billingRelation: 'SOLO' }],
      { existingConfidence: 0.9, incomingConfidence: 0.5 },
    );
    expect(merged[0]?.billingRelation).toBe('B2B');
    expect(merged[0]?.artists).toEqual(['FLASH', 'FORWARD']);
  });
});
