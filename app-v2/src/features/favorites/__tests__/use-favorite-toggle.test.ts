import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const toggleSource = readFileSync(
  join(process.cwd(), 'src/features/favorites/useFavoriteToggle.ts'),
  'utf8',
);

describe('useFavoriteToggle', () => {
  it('persists favorites locally for guest and signed-in users', () => {
    expect(toggleSource).toContain('favorites.toggleFavorite(eventId, source)');
    expect(toggleSource).toContain('resolveFavoriteSource');
    expect(toggleSource).not.toContain('buildLoginHref');
  });
});
