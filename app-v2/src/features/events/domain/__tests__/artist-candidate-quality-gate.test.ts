import { describe, expect, it } from 'vitest';

import {
  evaluateArtistCandidate,
  filterArtistCandidatesThroughGate,
} from '@/features/events/domain/artist-candidate-quality-gate';

describe('artist candidate quality gate', () => {
  it('rejects HTML entity prose fragments', () => {
    const result = evaluateArtistCandidate({
      name: 'definiert sich der KitKatClub als avantgardistischer Nachtclub und greift die Traditionen auf',
      sourceField: 'description',
    });
    expect(result.decision).toBe('invalid');
    expect(result.signals).toContain('prose_sentence');
  });

  it('rejects amenities and artwork credits', () => {
    expect(evaluateArtistCandidate({ name: 'Massageservice' }).decision).toBe('invalid');
    expect(evaluateArtistCandidate({ name: 'Artwork by Victor Calma' }).decision).toBe('invalid');
    expect(evaluateArtistCandidate({ name: 'Verkleide Dich nicht' }).decision).toBe('invalid');
  });

  it('accepts legitimate multi-word artists', () => {
    const result = evaluateArtistCandidate({ name: 'Kevin de Vries' });
    expect(result.decision).toBe('valid');
  });

  it('accepts known canonical alias even when unusual length', () => {
    const result = evaluateArtistCandidate({
      name: 'The Advent',
      knownCanonicalNames: ['The Advent'],
    });
    expect(result.decision).toBe('valid');
    expect(result.signals).toContain('known_alias_match');
  });

  it('filters KitKatClub regression fixture tokens', () => {
    const filtered = filterArtistCandidatesThroughGate([
      'Crazy Rabbit Hole&ldquo',
      'Massageservice',
      'DYSTOPIA',
      'Artwork by Victor Calma ** Surreal &ldquo',
    ]);
    expect(filtered).toEqual(['DYSTOPIA']);
  });
});
