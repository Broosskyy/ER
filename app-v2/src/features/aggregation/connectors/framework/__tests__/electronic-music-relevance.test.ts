import { describe, expect, it } from 'vitest';

import { classifyElectronicMusicRelevance } from '@/features/aggregation/connectors/framework/electronic-music-relevance';

describe('shared electronic-music relevance', () => {
  it('classifies website and platform-shaped events through one service', () => {
    expect(
      classifyElectronicMusicRelevance({
        title: 'AMØK Open Air',
        description: 'Techno and house all night',
        venueName: 'AMØK Club',
      }).relevance,
    ).toBe('relevant');

    expect(
      classifyElectronicMusicRelevance({
        title: 'Comedy night',
        venueName: 'Club venue',
      }).relevance,
    ).toBe('irrelevant');

    expect(
      classifyElectronicMusicRelevance({
        title: 'Late night session',
      }).relevance,
    ).toBe('uncertain');
  });

  it('keeps curated sources explicit without accepting excluded content', () => {
    expect(
      classifyElectronicMusicRelevance(
        { title: 'Undocumented club gathering' },
        { requireElectronicSignal: false },
      ).relevance,
    ).toBe('relevant');
    expect(
      classifyElectronicMusicRelevance(
        { title: 'Classical opera evening' },
        { requireElectronicSignal: false },
      ).relevance,
    ).toBe('irrelevant');
  });
});
