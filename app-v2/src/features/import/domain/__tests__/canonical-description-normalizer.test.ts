import { describe, expect, it } from 'vitest';

import { normalizeCanonicalEventDescription } from '@/features/import/domain/canonical-description-normalizer';

describe('canonical-description-normalizer', () => {
  it('decodes entities and repairs escaped newlines', () => {
    const result = normalizeCanonicalEventDescription(
      'Line one\\nLine two&amp;more',
    );
    expect(result).toContain('Line one');
    expect(result).toContain('Line two&more');
  });

  it('strips duplicated metadata labels', () => {
    const result = normalizeCanonicalEventDescription(
      'Place: Bootshaus\nDate: 01.08.2026\nStart: 22:00\nReal description body.',
    );
    expect(result).toBe('Real description body.');
  });

  it('preserves meaningful multi-paragraph text', () => {
    const input = 'First paragraph.\n\nSecond paragraph with details.';
    expect(normalizeCanonicalEventDescription(input)).toBe(input);
  });
});
