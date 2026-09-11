import { describe, expect, it } from 'vitest';

import { parseDescriptionExplicitGenres } from '../parse-description-genres';

describe('parseDescriptionExplicitGenres', () => {
  it('extracts Hard Techno from event editorial description', () => {
    const description =
      'The High Priestess of Hard Techno is coming to Bootshaus. On December 11th, one of the most defining artists of the new generation of hard techno takes over Bootshaus: Sara Landry.';
    expect(parseDescriptionExplicitGenres(description)).toContain('Hard Techno');
  });
});
