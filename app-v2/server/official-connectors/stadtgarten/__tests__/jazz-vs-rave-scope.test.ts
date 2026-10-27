import { describe, expect, it } from 'vitest';
import { assessStadtgartenScope } from '../parse-scope';

describe('Stadtgarten source genre focus', () => {
  it('rejects the seated SML jazz/electronic crossover concert without a dance genre', () => {
    expect(assessStadtgartenScope(['Konzert'], ['Jazz', 'Elektronische Musik', 'Jazz-Fusion']))
      .toBe('outside_scope');
  });
  it('accepts crossover concerts only if Techno/House/Trance is explicitly published', () => {
    expect(assessStadtgartenScope(['Konzert'], ['Jazz','Techno','Global Sound']))
      .toBe('include');
  });
  it('keeps actual electronic club nights, but not broad-label concerts', () => {
    expect(assessStadtgartenScope(['Late Night'], ['House', 'Disco']))
      .toBe('include');
    expect(assessStadtgartenScope(['Konzert'], ['Elektronische Musik']))
      .toBe('outside_scope');
    expect(assessStadtgartenScope(['Konzert'], ['Techno']))
      .toBe('include');
  });
  it('excludes Latin / Cumbia parties unless explicit electronic dance genre is billed', () => {
    expect(assessStadtgartenScope(['Late Night'], ['Cumbia', 'DJ', 'Dancehall']))
      .toBe('outside_scope');
    expect(assessStadtgartenScope(['Late Night'], ['Salsa', 'DJ Sets']))
      .toBe('outside_scope');
    expect(assessStadtgartenScope(['Late Night'], ['Cumbia', 'House']))
      .toBe('include');
    expect(assessStadtgartenScope(['Late Night'], ['Latin Techno', 'Techno']))
      .toBe('include');
  });
  it('does not import unrelated pop or standard jazz concerts', () => {
    expect(assessStadtgartenScope(['Konzert'], ['Jazz']))
      .toBe('outside_scope');
    expect(assessStadtgartenScope(['Konzert'], ['Pop']))
      .toBe('outside_scope');
  });
});

describe('regressions from published irrelevant Stadtgarten events',()=>{
  it('rejects electronica art-pop, ambient concert, string quartet and reggae-only club night',()=>{
    expect(assessStadtgartenScope(['Konzert'], ['Electronica','Chanson','Art Pop']))
      .toBe('outside_scope'); // Dillon
    expect(assessStadtgartenScope(['Konzert'], ['Electronica','Ambient','Zeitgenössische Kammermusik']))
      .toBe('outside_scope'); // PULSE
    expect(assessStadtgartenScope(['Konzert'], ['Electronic','Ambient','Environmental Music']))
      .toBe('outside_scope'); // Visible Cloaks
    expect(assessStadtgartenScope(['Late Night'], ['Reggae','Dancehall','Hip Hop','Afrobeat']))
      .toBe('outside_scope'); // KingStone Sound
  });
  it('preserves known electronic dance-floor lineups and 11.11 club formats',()=>{
    expect(assessStadtgartenScope(['Late Night'], ['House','Tech-House'])).toBe('include');
    expect(assessStadtgartenScope(['Late Night'], ['R&B','Elektro','Global Club Music'])).toBe('include');
    expect(assessStadtgartenScope(['Late Night'], ['Electronica','Disco','Pop'])).toBe('include');
    expect(assessStadtgartenScope(['Konzert'], ['Breakbeat','Hard Trance'])).toBe('include');
  });
});
