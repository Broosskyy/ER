import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const homeScreenSource = readFileSync(join(process.cwd(), 'app/(tabs)/index.tsx'), 'utf8');

describe('Sprint 23 home screen discovery integration', () => {
  it('uses HomeFeedContent instead of direct collection repository access', () => {
    expect(homeScreenSource).toContain('HomeFeedContent');
    expect(homeScreenSource).not.toContain('getCollectionPreviewEvents');
    expect(homeScreenSource).not.toContain('toEventDisplayModel');
    expect(homeScreenSource).not.toContain('eventRepository');
  });

  it('keeps location selector on home', () => {
    expect(homeScreenSource).toContain('<LocationSelector />');
  });
});
