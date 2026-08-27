import { describe, expect, it } from 'vitest';

import {
  isEarlyBirdOcrSplitFragment,
  isOcrFlyerNoiseLine,
  sanitizeFinalLineupCandidates,
} from '../../shared/lineup-normalization';

describe('early bird OCR noise guards', () => {
  it('rejects early bird marketing fragments', () => {
    expect(isEarlyBirdOcrSplitFragment('EARLY BIRD')).toBe(true);
    expect(isEarlyBirdOcrSplitFragment('ARLY')).toBe(true);
    expect(isEarlyBirdOcrSplitFragment('BIRD')).toBe(true);
  });

  it('removes arly+bird split pair from finalized lineup', () => {
    const result = sanitizeFinalLineupCandidates(
      [
        {
          displayName: 'UNDERLAND',
          rawText: 'UNDERLAND',
          billingOrder: 0,
          evidenceRole: 'headliner',
          evidenceOrigin: 'official_media',
        },
        {
          displayName: 'ARLY',
          rawText: 'ARLY',
          billingOrder: 1,
          evidenceRole: 'artist',
          evidenceOrigin: 'official_media',
        },
        {
          displayName: 'BIRD',
          rawText: 'BIRD',
          billingOrder: 2,
          evidenceRole: 'artist',
          evidenceOrigin: 'official_media',
        },
      ],
      { eventTitle: 'Underland Essigfabrik' },
    );
    expect(result.lineupCandidates.map((act) => act.displayName)).toEqual(['UNDERLAND']);
    expect(result.rejectedCandidates.some((entry) =>
      ['early_bird_ocr_split', 'ticket_marketing_fragment'].includes(entry.reason),
    )).toBe(true);
  });

  it('rejects common flyer OCR noise fragments', () => {
    expect(isOcrFlyerNoiseLine('X A')).toBe(true);
    expect(isOcrFlyerNoiseLine('SOON.')).toBe(true);
    expect(isOcrFlyerNoiseLine('10.0KT.2026')).toBe(true);
    expect(isOcrFlyerNoiseLine('Sichert euch euer')).toBe(true);
    const result = sanitizeFinalLineupCandidates(
      [
        {
          displayName: 'X A',
          rawText: 'X A',
          billingOrder: 0,
          evidenceRole: 'artist',
          evidenceOrigin: 'official_media',
        },
        {
          displayName: 'SOON.',
          rawText: 'SOON.',
          billingOrder: 1,
          evidenceRole: 'artist',
          evidenceOrigin: 'official_media',
        },
      ],
      { eventTitle: 'Halloween Weekender' },
    );
    expect(result.lineupCandidates).toEqual([]);
  });
});
