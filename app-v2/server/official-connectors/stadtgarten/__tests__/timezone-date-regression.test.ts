import { describe, expect, it } from 'vitest';
import { applyTimeToIsoDate, parseStadtgartenDisplayDate } from '../parse-datetime';

describe('Stadtgarten local dates must never shift on UTC-hosted workers',()=>{
  it.each([
    ['Di, 24.11.2026',20,0,'2026-11-24T20:00:00+01:00'],
    ['Mi, 09.12.2026',20,0,'2026-12-09T20:00:00+01:00'],
    ['Fr, 20.11.2026',23,30,'2026-11-20T23:30:00+01:00'],
    ['Sa, 31.10.2026',21,30,'2026-10-31T21:30:00+01:00'],
    ['Sa, 27.06.2026',23,0,'2026-06-27T23:00:00+02:00'],
    ['Do, 31.12.2026',23,55,'2026-12-31T23:55:00+01:00'],
  ])('retains source calendar day: %s',(label,h,m,expected)=>{
    const midnight=parseStadtgartenDisplayDate(label);
    expect(midnight).not.toBeNull();
    expect(applyTimeToIsoDate(midnight!,h,m)).toBe(expected);
  });
  it('exposes the previous-day UTC failure that prompted this fix',()=>{
    const midnight=parseStadtgartenDisplayDate('Di, 24.11.2026')!;
    expect(new Date(midnight).toISOString()).toBe('2026-11-23T23:00:00.000Z');
    expect(applyTimeToIsoDate(midnight,20,0)).toBe('2026-11-24T20:00:00+01:00');
  });
  it('handles both DST boundaries and rejects ambiguous hours',()=>{
    const march=parseStadtgartenDisplayDate('So, 29.03.2026')!;
    expect(applyTimeToIsoDate(march,1,30)).toBe('2026-03-29T01:30:00+01:00');
    expect(applyTimeToIsoDate(march,2,30)).toBeNull();
    expect(applyTimeToIsoDate(march,3,30)).toBe('2026-03-29T03:30:00+02:00');
    const oct=parseStadtgartenDisplayDate('So, 25.10.2026')!;
    expect(applyTimeToIsoDate(oct,1,30)).toBe('2026-10-25T01:30:00+02:00');
    expect(applyTimeToIsoDate(oct,2,30)).toBeNull();
    expect(applyTimeToIsoDate(oct,3,30)).toBe('2026-10-25T03:30:00+01:00');
  });
  it('rejects invalid dates and clock hours',()=>{
    expect(parseStadtgartenDisplayDate('So, 31.02.2027')).toBeNull();
    expect(applyTimeToIsoDate('2026-02-31T00:00:00+01:00',20,0)).toBeNull();
    expect(applyTimeToIsoDate('2026-11-24T00:00:00+01:00',24,0)).toBeNull();
  });
});
