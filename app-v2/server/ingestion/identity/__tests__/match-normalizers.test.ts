import { describe, expect, it } from 'vitest';

import { titleSimilarity } from '../match-normalizers';

describe('titleSimilarity', () => {
  it('treats title expansions with and more as equivalent', () => {
    expect(
      titleSimilarity('NIBIRII pres. ELY OAKS!', 'NIBIRII pres. ELY OAKS and more!'),
    ).toBe(1);
  });
});
