import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { spacing, spacingRoles } from '@/design/spacing';

const featuredLayoutSource = readFileSync(
  join(process.cwd(), 'src/features/home/components/featured-card-layout.ts'),
  'utf8',
);
const clubLayoutSource = readFileSync(
  join(process.cwd(), 'src/features/home/data/home-club-fixtures.ts'),
  'utf8',
);

const HOME_FEATURED_CARD_WIDTH_RATIO = 0.78;

describe('home featured hero layout source', () => {
  it('calculates width from viewport padding and hero ratio for premium peek', () => {
    expect(featuredLayoutSource).toContain('getHomeFeaturedCardWidth');
    expect(featuredLayoutSource).toContain('HOME_FEATURED_PAIR_GAP');
    expect(featuredLayoutSource).toContain('HOME_FEATURED_SLOT_COUNT');
    expect(featuredLayoutSource).toContain('HOME_FEATURED_CARD_WIDTH_RATIO');
    expect(featuredLayoutSource).toContain('spacingRoles.screenHorizontal * 2');
  });
});

describe('home featured hero width formula', () => {
  it('uses ~78% of available width on a 390px mobile viewport', () => {
    const available = 390 - spacingRoles.screenHorizontal * 2;
    const cardWidth = Math.floor(available * HOME_FEATURED_CARD_WIDTH_RATIO);

    expect(cardWidth).toBeGreaterThan(240);
    expect(cardWidth).toBeLessThan(available);
  });

  it('leaves a peek of the next slot on a 360px viewport', () => {
    const available = 360 - spacingRoles.screenHorizontal * 2;
    const cardWidth = Math.floor(available * HOME_FEATURED_CARD_WIDTH_RATIO);

    expect(cardWidth).toBeLessThan(available);
    expect(available - cardWidth).toBeGreaterThan(40);
  });
});

describe('home Top Clubs rail density', () => {
  it('decouples club width from the featured hero and targets 2.3–2.7 cards', () => {
    expect(clubLayoutSource).toContain('availableWidth * 0.4');
    expect(clubLayoutSource).not.toContain('return pairCardWidth');

    const availableWidth = 390 - spacingRoles.screenHorizontal * 2;
    const clubWidth = Math.floor(availableWidth * 0.4);
    const visibleCards = (390 - spacingRoles.screenHorizontal + spacing.md) / (clubWidth + spacing.md);

    expect(clubWidth).toBe(143);
    expect(visibleCards).toBeGreaterThanOrEqual(2.3);
    expect(visibleCards).toBeLessThanOrEqual(2.7);
  });
});
