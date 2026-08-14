import { describe, expect, it } from 'vitest';

import {
  isEndAfterStart,
  parseBootshausDisplayDateTime,
} from '../bootshaus/berlin-datetime';

describe('bootshaus berlin datetime', () => {
  it('parses summer time with +02:00 offset', () => {
    expect(parseBootshausDisplayDateTime('21.08.2026 22:00')).toBe('2026-08-21T22:00:00+02:00');
  });

  it('parses winter time with +01:00 offset', () => {
    expect(parseBootshausDisplayDateTime('23.10.2026 23:00')).toBe('2026-10-23T23:00:00+02:00');
  });

  it('supports end times after midnight', () => {
    const startsAt = parseBootshausDisplayDateTime('21.08.2026 22:00');
    const endsAt = parseBootshausDisplayDateTime('22.08.2026 05:00');
    expect(startsAt).toBeTruthy();
    expect(endsAt).toBeTruthy();
    expect(isEndAfterStart(startsAt!, endsAt!)).toBe(true);
  });
});
