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
  it('keeps electronic club nights and jazz-free electronic performances', () => {
    expect(assessStadtgartenScope(['Late Night'], ['House', 'Disco']))
      .toBe('include');
    expect(assessStadtgartenScope(['Konzert'], ['Elektronische Musik']))
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
