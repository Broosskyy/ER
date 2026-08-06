import { describe, expect, it } from 'vitest';

import { extractLineupNamesFromDescriptionText } from '@/features/aggregation/domain/lineup-text-parser';
import { extractArtistsFromEventTitle } from '@/features/aggregation/connectors/ticket-platform/ticket-io-title-artists';
import { evaluateArtistCandidate, filterArtistCandidatesThroughGate } from '@/features/events/domain/artist-candidate-quality-gate';
import { sanitizeLineupArtistNames } from '@/features/events/domain/lineup-artist-quality';

describe('phase 4691 P0 lineup integrity', () => {
  it('does not emit artists from description without lineup section', () => {
    const description =
      'definiert sich der KitKatClub als avantgardistischer Nachtclub. Massageservice und Raucher-Lounge verfügbar.';
    expect(extractLineupNamesFromDescriptionText(description)).toBeUndefined();
  });

  it('emits artists only from explicit lineup section', () => {
    const description = 'Line Up: DYSTOPIA F2F VALKYRIE\nLocation: Essigfabrik';
    expect(extractLineupNamesFromDescriptionText(description)).toEqual(['DYSTOPIA', 'VALKYRIE']);
  });

  it('prevents title inference brand promotion', () => {
    expect(extractArtistsFromEventTitle('Into The Madness Pre-Party Weekender')).toBeUndefined();
    expect(extractArtistsFromEventTitle('BC173 Airport Session pres. by Bootshaus')).toBeUndefined();
    expect(extractArtistsFromEventTitle('DEBORAH DE LUCA pres by Bootshaus')).toBeUndefined();
  });

  it('isolates batch lineup arrays between events', () => {
    const eventA = sanitizeLineupArtistNames(['DYSTOPIA', 'VALKYRIE', 'IAN CRANK']) ?? [];
    const eventB = sanitizeLineupArtistNames([]) ?? [];
    eventA.push('LEAKED ARTIST');
    expect(eventB).toEqual([]);
    expect(filterArtistCandidatesThroughGate(eventB)).toEqual([]);
  });

  it('rejects prose but keeps valid billing rows', () => {
    expect(evaluateArtistCandidate({ name: 'NIKLAS DEEFABIAN FARELLOLIVER MAGENTA' }).decision).toBe(
      'invalid',
    );
    const names = sanitizeLineupArtistNames([
      'SAM COLLINS',
      'NIKLAS DEEFABIAN FARELLOLIVER MAGENTA',
      'Einlass ab 18 Jahren / Age for admission 18 years',
    ]);
    expect(names).toEqual(['SAM COLLINS']);
  });
});
