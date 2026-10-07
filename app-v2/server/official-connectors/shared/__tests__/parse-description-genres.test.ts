import { describe, expect, it } from 'vitest';

import { parseDescriptionExplicitGenres } from '../parse-description-genres';

describe('parseDescriptionExplicitGenres', () => {
  it('extracts Hard Techno from event editorial description', () => {
    const description =
      'The High Priestess of Hard Techno is coming to Bootshaus. On December 11th, one of the most defining artists of the new generation of hard techno takes over Bootshaus: Sara Landry.';
    expect(parseDescriptionExplicitGenres(description)).toContain('Hard Techno');
  });
  it('does not infer House from publisher names', () => {
    expect(
      parseDescriptionExplicitGenres('Ihre Bücher erscheinen bei Penguin Random House.'),
    ).not.toContain('House');
  });

  it('does not infer Electro from electro-acoustic wording', () => {
    expect(
      parseDescriptionExplicitGenres('An innovative electro-acoustic sound performance.'),
    ).not.toContain('Electro');
  });

  it('still extracts explicit House and Electro music genres', () => {
    expect(parseDescriptionExplicitGenres('House music and Electro all night long.')).toEqual(
      expect.arrayContaining(['House', 'Electro']),
    );
  });
});
