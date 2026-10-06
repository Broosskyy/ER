import { describe, expect, it } from 'vitest';

import { classifyRelevanceEvidence } from '../relevance-evidence';

describe('relevance evidence cross-domain regression', () => {
  it('keeps explicit electronic genres strongly relevant', () => {
    expect(classifyRelevanceEvidence({ title: 'Warehouse Techno Night' }).relevance).toBe('HIGH_RELEVANCE');
    expect(classifyRelevanceEvidence({ title: 'Hardstyle & Gabber Night' }).relevance).toBe('HIGH_RELEVANCE');
    expect(classifyRelevanceEvidence({ title: 'Drum & Bass Bundesliga' }).relevance).toBe('HIGH_RELEVANCE');
  });

  it('does not treat bare hardcore as sufficient electronic evidence', () => {
    const result = classifyRelevanceEvidence({ title: 'Hardcore Night' });
    expect(result.relevance).toBe('AMBIGUOUS');
    expect(result.strongPositiveHits).not.toContain('hardcore');
    expect(result.weakPositiveHits).toContain('hardcore');
  });

  it('rejects punk and post-hardcore context instead of importing it as hard dance', () => {
    expect(
      classifyRelevanceEvidence({ title: 'Punk und Hardcore Festival' }).relevance,
    ).toBe('IRRELEVANT');

    expect(
      classifyRelevanceEvidence({
        title: 'Deep Blue Tour',
        description: 'Post-Hardcore and metalcore live show',
      }).relevance,
    ).toBe('IRRELEVANT');
  });

  it('keeps electronic hardcore when an unambiguous electronic signal corroborates it', () => {
    const result = classifyRelevanceEvidence({
      title: 'Hardcore Rave',
      description: 'Gabber DJs all night',
    });
    expect(result.relevance).toBe('HIGH_RELEVANCE');
    expect(result.strongPositiveHits).toContain('gabber');
  });

  it('recognizes German opera wording as definitive non-electronic evidence', () => {
    const result = classifyRelevanceEvidence({ title: 'Opern-Slam – Winter Wunderland' });
    expect(result.relevance).toBe('IRRELEVANT');
    expect(result.negativeHits).toContain('opera');
  });

  it('does not auto-import K-Pop or generic club nights', () => {
    expect(classifyRelevanceEvidence({ title: 'K-Pop Club Night' }).relevance).toBe('IRRELEVANT');
    expect(classifyRelevanceEvidence({ title: 'Extended Clubnight' }).relevance).toBe('AMBIGUOUS');
  });

  it('rejects hip-hop/rap events even when marketing language says rave', () => {
    const result = classifyRelevanceEvidence({
      title: 'Planet Kumpel Rave',
      description: 'Hip-Hop and Rap live tour',
    });
    expect(result.relevance).toBe('IRRELEVANT');
    expect(result.negativeHits).toContain('hip_hop_rap');
  });
});
