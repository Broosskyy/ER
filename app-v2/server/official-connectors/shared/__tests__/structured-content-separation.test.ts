import { describe, expect, it } from 'vitest';

import {
  detectStructuredDescriptionLeakage,
  separateStructuredEventContent,
} from '../structured-content-separation';

describe('structured content separation', () => {
  it('pure lineup fixture strips description residual and extracts artists/genres', () => {
    const result = separateStructuredEventContent(`LINEUP:
#techno
DJ A
DJ B`);
    expect(result.lineupCandidates).toEqual(['DJ A', 'DJ B']);
    expect(result.genreCandidates.map((genre) => genre.toLowerCase())).toContain('techno');
    expect(result.descriptionResidual).toBeUndefined();
    expect(result.classification).toBe('PURE_STRUCTURED');
  });

  it('mixed fixture preserves editorial prose and separates lineup/genres', () => {
    const result = separateStructuredEventContent(`Wir feiern eine besondere Nacht.

LINEUP:
DJ A
DJ B

#hardtechno`);
    expect(result.editorialText).toBe('Wir feiern eine besondere Nacht.');
    expect(result.lineupCandidates).toEqual(['DJ A', 'DJ B']);
    expect(result.genreCandidates.map((genre) => genre.toLowerCase())).toContain('hard techno');
    expect(result.classification).toBe('MIXED');
  });

  it('preserves editorial hashtags in prose', () => {
    const result = separateStructuredEventContent('Wir feiern #10JahreGemeinsam mit euch.');
    expect(result.editorialText).toBe('Wir feiern #10JahreGemeinsam mit euch.');
    expect(result.lineupCandidates).toHaveLength(0);
    expect(result.genreCandidates).toHaveLength(0);
  });

  it('rejects TBA placeholders from lineup candidates', () => {
    const result = separateStructuredEventContent(`LINEUP:
DJ A
TBA
DJ B`);
    expect(result.lineupCandidates).toEqual(['DJ A', 'DJ B']);
    expect(result.rejectedFragments.some((entry) => /tba/i.test(entry.text))).toBe(true);
  });

  it('preserves B2B billing units', () => {
    const result = separateStructuredEventContent('LINEUP:\nDJ A B2B DJ B');
    expect(result.lineupCandidates).toEqual(['DJ A B2B DJ B']);
  });

  it('separates ticket blocks while preserving editorial copy', () => {
    const result = separateStructuredEventContent(`Unsere nächste Clubnacht.

Tickets:
Early Bird 12 €
Phase 1 15 €`);
    expect(result.editorialText).toBe('Unsere nächste Clubnacht.');
    expect(result.ticketCandidates.length).toBeGreaterThan(0);
  });

  it('handles condensed ticket.io lineup with bullet separators', () => {
    const result = separateStructuredEventContent(
      'LINEUP: #bounce #hardbounce #trance● AMON● NORDCORREIA.MP3 B2B DOCTOR MÜCKE● LSG● CAROLINKA● NSLZ #techno #hardtechno● STELLA MARIA● MAURO● RAFFA● VYKA● RUSSEL B2B FLUMMI',
    );
    expect(result.lineupCandidates).toContain('AMON');
    expect(result.lineupCandidates).toContain('NORDCORREIA.MP3 B2B DOCTOR MÜCKE');
    expect(result.lineupCandidates).toContain('RUSSEL B2B FLUMMI');
    expect(result.genreCandidates.map((genre) => genre.toLowerCase())).toEqual(
      expect.arrayContaining(['trance', 'techno']),
    );
    expect(result.descriptionResidual).toBeUndefined();
    expect(detectStructuredDescriptionLeakage(
      'LINEUP: #bounce #hardbounce #trance● AMON● NORDCORREIA.MP3 B2B DOCTOR MÜCKE',
    ).recoverable).toBe(true);
  });

  it('does not aggressively strip ambiguous prose with artist names', () => {
    const result = separateStructuredEventContent(
      'DJ Alpha präsentiert sein neues Projekt gemeinsam mit seinem Kollegen.',
    );
    expect(result.editorialText).toContain('DJ Alpha');
    expect(result.lineupCandidates).toHaveLength(0);
  });

  it('extracts rausgegangen run-together star-bullet lineup prose', () => {
    const description =
      'TICKETS ONLINE NOW – EhrenKlub #14 at SchrottyFREITAG // 25.09.26 // SchrottyTOTAL MAYHEM FROM START TO FINISH GUARANTEEDLineup Main (A – Z)* DIKKE BAAP * RIOT SHIFT * S*Y*N*K * TITI * USH * 333CXT * CAMILLA V * GREEKZ B2B KARAMUSTAN * LAURA VOM JUPITER  SECOND FLOOR HOSTED BY ???* 4GIVEN * BASSSTØRM * LASZR * V Λ N Y * VYKATo assure the party a safer space';
    const result = separateStructuredEventContent(description);
    expect(result.lineupCandidates).toEqual(
      expect.arrayContaining([
        'DIKKE BAAP',
        'RIOT SHIFT',
        'GREEKZ B2B KARAMUSTAN',
        'LAURA VOM JUPITER',
        'VYKA',
      ]),
    );
    expect(result.lineupCandidates.some((artist) => /to assure/i.test(artist))).toBe(false);
    expect(detectStructuredDescriptionLeakage(result.descriptionResidual).recoverable).toBe(false);
  });

  it('connector-agnostic rausgegangen-like mixed content', () => {
    const result = separateStructuredEventContent(`Freitag im Club — wir feiern zusammen.

Line-Up:
Mira
Klangkuenstler

#techno #house`);
    expect(result.editorialText).toContain('Freitag im Club');
    expect(result.lineupCandidates).toEqual(expect.arrayContaining(['Mira', 'Klangkuenstler']));
  });
});
