import { describe, expect, it } from 'vitest';
import { extractExplicitGenresFromPublishedText } from '../../../official-connectors/shared/published-genre-evidence';
import { extractZakkPublishedTechnoBilling } from '../../../official-connectors/zakk/explicit-techno-lineup';
import { normalizeOfficialGenreLabels } from '../../../official-connectors/shared/normalize-genre';

describe('source metadata import contract', () => {
  it('assigns only explicitly published music genres and supported canonical keys', () => {
    expect(normalizeOfficialGenreLabels(
      extractExplicitGenresFromPublishedText('Backroom Session: HOUSE & HARDHOUSE')
    ).normalized.map(g => g.genreKey)).toEqual(['hard-house','house']);
    expect(extractExplicitGenresFromPublishedText('Eine Party im Club mit DJs und Tanz')).toEqual([]);
  });
  it('keeps artist lists absent until names are actually printed by the source',()=>{
    expect(extractZakkPublishedTechnoBilling('Das Line-up wird bald bekannt gegeben')).toEqual([]);
    expect(extractZakkPublishedTechnoBilling('Im Club gibt es Techno mit Addctd & Luuk de Keizer: Dunkel, treibend.')
      .map(a=>a.displayName)).toEqual(['Addctd','Luuk de Keizer']);
  });
});
