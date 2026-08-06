import { describe, expect, it } from 'vitest';

import { normalizePublicEventDescription } from '@/features/events/formatting/public-description-normalizer';

describe('normalizePublicEventDescription', () => {
  it('strips unsafe markup and decodes entities', () => {
    const normalized = normalizePublicEventDescription(
      '<p>Tonight at Bootshaus &amp; friends</p><script>alert(1)</script><ul><li>WESTBAM</li></ul>',
    );

    expect(normalized).toContain('Tonight at Bootshaus & friends');
    expect(normalized).toContain('• WESTBAM');
    expect(normalized).not.toContain('<script');
    expect(normalized).not.toContain('alert');
  });

  it('removes placeholders', () => {
    expect(normalizePublicEventDescription('N/A')).toBeUndefined();
    expect(normalizePublicEventDescription('   ')).toBeUndefined();
  });
});
