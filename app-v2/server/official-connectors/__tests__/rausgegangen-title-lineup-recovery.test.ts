import { describe, expect, it } from 'vitest';

import { extractVerifiedTitleLineupCandidates } from '../shared/title-lineup-evidence';

describe('Rausgegangen title lineup recovery', () => {
  it('extracts explicit w/ multi-act billing without venue or more noise', () => {
    const ascension = extractVerifiedTitleLineupCandidates({
      eventTitle:
        'Ascension w/ Limoncello, Hotboi2300, Oskamaxx, Patrick Schumm & more at Helios37',
    });
    expect(ascension.candidates.map((act) => act.displayName)).toEqual([
      'Limoncello',
      'Hotboi2300',
      'Oskamaxx',
      'Patrick Schumm',
    ]);

    const birthday = extractVerifiedTitleLineupCandidates({
      eventTitle: '12 Jahre Richtig DICK Techno! w/ Zeuz, Tommy Libera',
    });
    expect(birthday.candidates.map((act) => act.displayName)).toEqual([
      'Zeuz',
      'Tommy Libera',
    ]);

    const weiberfastnacht = extractVerifiedTitleLineupCandidates({
      eventTitle: 'Weiberfastnacht im Bootshaus /w Trash Island, Mickie Krause & more',
    });
    expect(weiberfastnacht.candidates.map((act) => act.displayName)).toEqual([
      'Trash Island',
      'Mickie Krause',
    ]);
  });

  it('accepts only clearly formatted German show billing after mit', () => {
    const extracted = extractVerifiedTitleLineupCandidates({
      eventTitle:
        'Feiern wie früher - nur früher! Der Daytime Rave mit ANNA REUSCH & THOMAS SCHUMACHER',
    });
    expect(extracted.candidates.map((act) => act.displayName)).toEqual([
      'ANNA REUSCH',
      'THOMAS SCHUMACHER',
    ]);

    const prose = extractVerifiedTitleLineupCandidates({
      eventTitle: 'Eine Nacht mit guter Musik und Freunden',
    });
    expect(prose.candidates).toHaveLength(0);
  });
});
