import { describe, expect, it } from 'vitest';

import { classifyDomainFromRelevance, classifyImportQualification } from '../domain-classification';
import { fuseEventGenreEvidence } from '../event-genre-fusion';
import type { DiscoverySignalBundle, GenreFusionContext } from '../types';
import type { GenreEvidenceExhaustionResult } from '../../genre-evidence';
import type { StagingEventSnapshot } from '../../../../ingestion/sync/canonical-consolidation';

function emptyExhaustion(event: StagingEventSnapshot): GenreEvidenceExhaustionResult {
  return {
    eventId: event.eventId,
    title: event.title,
    currentGenres: event.genres,
    recommendedGenres: [],
    evidence: [],
    checkedLayers: [],
    lineupDerivedGenres: [],
    explicitGenreCount: 0,
    highConfidenceCount: 0,
    lineupDerivedCount: 0,
  };
}

function baseEvent(overrides: Partial<StagingEventSnapshot> = {}): StagingEventSnapshot {
  return {
    eventId: 'evt-1',
    title: 'Hard Techno Night',
    status: 'published',
    genres: [],
    sources: [],
    venueName: 'Bootshaus',
    organizerName: null,
    city: 'Cologne',
    ...overrides,
  } as StagingEventSnapshot;
}

function discoveryBundle(overrides: Partial<DiscoverySignalBundle> = {}): DiscoverySignalBundle {
  return {
    eventId: 'evt-1',
    relevance: {
      relevance: 'HIGH_RELEVANCE',
      reasons: ['strong_positive:hard_techno'],
      strongPositiveHits: ['hard_techno'],
      weakPositiveHits: [],
      negativeHits: [],
    },
    genreCandidates: [{ label: 'Hard Techno', confidence: 'strong_inferred' }],
    importQualification: 'STRONG_EVENT_SPECIFIC',
    domainClassification: 'ELECTRONIC_HIGH',
    discoveryGenreLabels: ['Hard Techno'],
    strongDiscoverySignals: ['hard_techno'],
    weakDiscoverySignals: [],
    sourceUrls: [],
    connectorIds: ['ticket.io'],
    ...overrides,
  };
}

describe('domain classification', () => {
  it('separates domain from genre', () => {
    const domain = classifyDomainFromRelevance({
      relevance: 'HIGH_RELEVANCE',
      reasons: [],
      strongPositiveHits: ['techno'],
      weakPositiveHits: [],
      negativeHits: [],
    });
    expect(domain).toBe('ELECTRONIC_HIGH');
  });

  it('flags weak import qualification', () => {
    const qualification = classifyImportQualification({
      relevance: {
        relevance: 'LIKELY_RELEVANT',
        reasons: [],
        strongPositiveHits: [],
        weakPositiveHits: [],
        negativeHits: [],
      },
      hasTicketBinding: true,
      hasOfficialBinding: false,
      genreCandidateCount: 0,
    });
    expect(qualification).toBe('WEAK_IMPORT_QUALIFICATION');
  });
});

describe('event genre fusion', () => {
  it('reuses discovery strong signals for genre classification', () => {
    const event = baseEvent();
    const fusionContext: GenreFusionContext = {
      discoveryByEventId: new Map([['evt-1', discoveryBundle()]]),
      bootshausGenresByEventId: new Map(),
      seriesGenresByEventId: new Map(),
    };
    const result = fuseEventGenreEvidence({
      event,
      exhaustion: emptyExhaustion(event),
      fusionContext,
    });
    expect(result.recommendedGenres).toContain('Hard Techno');
    expect(result.domainClassification).toBe('ELECTRONIC_HIGH');
  });

  it('allows series inheritance from classified sibling events', () => {
    const event = baseEvent({ title: 'MI KitKat 30.12' });
    const fusionContext: GenreFusionContext = {
      discoveryByEventId: new Map([
        [
          'evt-1',
          discoveryBundle({
            eventId: 'evt-1',
            importQualification: 'MODERATE_EVENT_SPECIFIC',
            discoveryGenreLabels: [],
            strongDiscoverySignals: [],
            domainClassification: 'ELECTRONIC_MEDIUM',
            relevance: {
              relevance: 'LIKELY_RELEVANT',
              reasons: [],
              strongPositiveHits: [],
              weakPositiveHits: ['club'],
              negativeHits: [],
            },
          }),
        ],
      ]),
      bootshausGenresByEventId: new Map(),
      seriesGenresByEventId: new Map([['evt-1', ['Tech House', 'Techno']]]),
    };
    const result = fuseEventGenreEvidence({
      event,
      exhaustion: emptyExhaustion(event),
      fusionContext,
    });
    expect(result.recommendedGenres).toContain('Tech House');
  });

  it('rejects venue-only weak qualification without event evidence', () => {
    const event = baseEvent({ title: 'Mystery Club Night' });
    const fusionContext: GenreFusionContext = {
      discoveryByEventId: new Map([
        [
          'evt-1',
          discoveryBundle({
            eventId: 'evt-1',
            importQualification: 'WEAK_IMPORT_QUALIFICATION',
            discoveryGenreLabels: [],
            strongDiscoverySignals: [],
            domainClassification: 'ELECTRONIC_MEDIUM',
            relevance: {
              relevance: 'LIKELY_RELEVANT',
              reasons: [],
              strongPositiveHits: [],
              weakPositiveHits: ['club'],
              negativeHits: [],
            },
          }),
        ],
      ]),
      bootshausGenresByEventId: new Map(),
      seriesGenresByEventId: new Map(),
    };
    const result = fuseEventGenreEvidence({
      event,
      exhaustion: emptyExhaustion(event),
      fusionContext,
    });
    expect(result.recommendedGenres).toHaveLength(0);
    expect(result.importEligibilityReview).toBe(true);
  });

  it('allows broad Electronic only with defensible discovery signals', () => {
    const event = baseEvent({ title: 'Electronic Showcase' });
    const fusionContext: GenreFusionContext = {
      discoveryByEventId: new Map([
        [
          'evt-1',
          discoveryBundle({
            discoveryGenreLabels: [],
            strongDiscoverySignals: ['electro'],
            genreCandidates: [],
          }),
        ],
      ]),
      bootshausGenresByEventId: new Map(),
      seriesGenresByEventId: new Map(),
    };
    const result = fuseEventGenreEvidence({
      event,
      exhaustion: emptyExhaustion(event),
      fusionContext,
    });
    expect(result.recommendedGenres.length).toBeGreaterThan(0);
  });
});
