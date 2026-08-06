import { describe, expect, it } from 'vitest';

import { resolveLineupSectionTitle } from '@/features/event-detail/utils/lineup-completeness';

describe('lineup section titles', () => {
  it('uses compact artist title for a single known artist', () => {
    expect(resolveLineupSectionTitle('partial', 1)).toBe('ARTIST');
  });

  it('keeps known-artists title for multiple partial matches', () => {
    expect(resolveLineupSectionTitle('partial', 2)).toBe('BEKANNTE ARTISTS');
  });
});
