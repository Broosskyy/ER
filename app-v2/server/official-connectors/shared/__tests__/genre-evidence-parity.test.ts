import { describe, expect, it } from 'vitest';

import { expandGenreKeysForSearch } from '../genre-taxonomy';
import { normalizeOfficialGenreLabel } from '../normalize-genre';
import { parseDescriptionExplicitGenres } from '../parse-description-genres';
import { separateStructuredEventContent } from '../structured-content-separation';
import {
  classifyUnknownGenreTerm,
  registerUnknownGenreCandidate,
  exportUnknownGenreCandidates,
} from '../unknown-genre-candidate';

describe('genre evidence parity', () => {
  it('normalizes hard bounce variants', () => {
    for (const label of ['hardbounce', 'hard bounce', 'hard-bounce', '#hardbounce']) {
      const normalized = normalizeOfficialGenreLabel(label.replace(/^#/, ''));
      expect(normalized.status).toBe('normalized');
      expect(normalized.displayName).toBe('Hard Bounce');
    }
  });

  it('parses odonien-style lineup genre block', () => {
    const text = `LINEUP:
#bounce #hardbounce #trance
DJ A
DJ B
#techno #hardtechno
DJ C
DJ D`;
    const separated = separateStructuredEventContent(text);
    const genres = [...new Set([...separated.genreCandidates, ...parseDescriptionExplicitGenres(text)])];
    expect(genres.map((genre) => genre.toLowerCase())).toEqual(
      expect.arrayContaining(['bounce', 'hard bounce', 'trance', 'techno', 'hard techno']),
    );
    expect(separated.descriptionResidual).toBeUndefined();
  });

  it('records unknown genre candidates instead of silently dropping', () => {
    const registry = new Map();
    registerUnknownGenreCandidate(registry, {
      rawTerm: '#futuregenre',
      eventId: 'evt-1',
      sourceType: 'description',
      authority: 'EXPLICIT_EVENT',
    });
    const candidates = exportUnknownGenreCandidates(registry);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.classification).toBe('NEEDS_REVIEW');
  });

  it('rejects non-genre editorial hashtags', () => {
    expect(classifyUnknownGenreTerm('#10JahreGemeinsam')).toBe('NON_GENRE');
  });

  it('preserves multi-genre explicit evidence set', () => {
    const genres = parseDescriptionExplicitGenres('Techno, Hard Techno, Trance, Bounce, Hard Bounce');
    expect(genres).toEqual(
      expect.arrayContaining(['Techno', 'Hard Techno', 'Trance', 'Bounce', 'Hard Bounce']),
    );
  });

  it('expands parent techno search to child genres without forcing parent storage', () => {
    const technoSearch = expandGenreKeysForSearch('techno');
    expect(technoSearch.has('techno')).toBe(true);
    expect(technoSearch.has('hardtechno')).toBe(true);
    const hardBounceSearch = expandGenreKeysForSearch('hard-bounce');
    expect(hardBounceSearch.has('hard-bounce')).toBe(true);
    expect(hardBounceSearch.has('techno')).toBe(false);
  });
});
