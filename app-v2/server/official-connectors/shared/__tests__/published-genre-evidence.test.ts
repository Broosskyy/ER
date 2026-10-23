import { describe, expect, it } from 'vitest';
import { extractExplicitGenresFromPublishedText } from '../published-genre-evidence';

describe('genre labels from published source wording',()=>{
  it('extracts only explicitly named subgenres, preferring more specific styles',()=>{
    expect(extractExplicitGenresFromPublishedText('Hard Techno und Gabber treffen aufeinander'))
      .toEqual(['Hard Techno','Gabber']);
  });
  it('recognizes documented house and hardhouse floors without inventing other genres',()=>{
    expect(extractExplicitGenresFromPublishedText('HOUSE & HARDHOUSE im Backroom'))
      .toEqual(['Hard House','House']);
  });
  it('extracts techno from source sentence, but not DJ/club/rave marketing language',()=>{
    expect(extractExplicitGenresFromPublishedText('Im Club gibt es Techno mit Addctd und Luuk'))
      .toEqual(['Techno']);
    expect(extractExplicitGenresFromPublishedText('DJ-Set im Club, ein Rave mit Überraschungen'))
      .toEqual([]);
  });
  it('does not infer genres when a published page says no techno',()=>{
    expect(extractExplicitGenresFromPublishedText('Heute kein Techno, sondern Pop')).toEqual([]);
  });
});
