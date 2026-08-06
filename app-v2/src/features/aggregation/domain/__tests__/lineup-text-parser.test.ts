import { describe, expect, it } from 'vitest';

import { extractLineupNamesFromDescriptionText } from '@/features/aggregation/domain/lineup-text-parser';

describe('lineup text parser', () => {
  it('extracts description lineup with B2B/F2F billing units split into artists', () => {
    const description = `Line Up:
DYSTOPIA F2F VALKYRIE
IAN CRANK F2F EASYPYSI
FLASH B2B FORWARD
LOCATION: Essigfabrik`;
    const names = extractLineupNamesFromDescriptionText(description);
    expect(names).toEqual(['DYSTOPIA', 'VALKYRIE', 'IAN CRANK', 'EASYPYSI', 'FLASH', 'FORWARD']);
  });

  it('extracts Artists and Running Order section headers', () => {
    const artists = extractLineupNamesFromDescriptionText('Running Order: ANNA, KI/KI');
    expect(artists).toEqual(['ANNA', 'KI/KI']);
  });

  it('rejects Presented by and Location noise', () => {
    const names = extractLineupNamesFromDescriptionText(
      'Line Up: ANNA Presented by: Bootshaus Location: Köln',
    );
    expect(names?.some((n) => /presented|location/i.test(n))).toBe(false);
  });

  it('parses pipe-separated A–Z artist lists without prose tokens', () => {
    const description = `HERE ARE ALL ARTISTS (A-Z):
A.M.C | AKIRAH | ECRAZE B2B BIZO`;
    const names = extractLineupNamesFromDescriptionText(description);
    expect(names).toEqual(['A.M.C', 'AKIRAH', 'ECRAZE', 'BIZO']);
  });

  it('rejects ON:MODE and save-the-date prose tokens in lineup blocks', () => {
    const names = extractLineupNamesFromDescriptionText(
      'Line Up: ON:MODE....MORE TBA SAVE THE DATE: OCTOBER 09-10, 2026',
    );
    expect(names).toBeUndefined();
  });
});
