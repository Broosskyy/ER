import { describe, expect, it } from 'vitest';

import type { StagingEventSnapshot } from '../../../../ingestion/sync/canonical-consolidation';
import { classifyDomainFromRelevance } from '../../discovery-genre-fusion/domain-classification';
import { fuseEventGenreEvidence } from '../../discovery-genre-fusion/event-genre-fusion';
import type { DiscoverySignalBundle, GenreFusionContext } from '../../discovery-genre-fusion/types';
import { exhaustGenreEvidence } from '../../genre-evidence';
import { matchEventSeriesIdentity } from '../../event-series-intelligence/series-identity';
import { summarizeBatchQuality } from '../batch-quality-gate';
import { evaluateEventQuality, publishedElectronicGenreCoverage } from '../evaluate-event-quality';

function baseEvent(overrides: Partial<StagingEventSnapshot> = {}): StagingEventSnapshot {
  return {
    eventId: 'evt-1',
    title: 'Sample Event',
    startsAt: '2026-12-01T22:00:00+00:00',
    endsAt: null,
    status: 'published',
    venueName: 'Club',
    venueCity: 'Cologne',
    organizerName: 'Promoter',
    description: 'Techno night',
    imageUrl: 'https://example.com/flyer.jpg',
    genres: [],
    lineup: ['Artist A'],
    sources: [{ sourceRole: 'official', sourceUrl: 'https://example.com/event', connectorId: 'test' }],
    ...overrides,
  };
}

function discoveryBundle(eventId: string, overrides: Partial<DiscoverySignalBundle> = {}): DiscoverySignalBundle {
  return {
    eventId,
    relevance: {
      relevance: 'HIGH_RELEVANCE',
      score: 90,
      reasons: ['strong_positive:techno'],
      strongPositiveHits: ['techno'],
      weakPositiveHits: [],
      negativeHits: [],
      genreCandidates: [],
    },
    genreCandidates: [],
    importQualification: 'STRONG_EVENT_SPECIFIC',
    domainClassification: 'ELECTRONIC_HIGH',
    discoveryGenreLabels: ['Techno'],
    strongDiscoverySignals: ['techno'],
    weakDiscoverySignals: [],
    sourceUrls: ['https://example.com/event'],
    connectorIds: ['test'],
    ...overrides,
  };
}

describe('new event quality contract', () => {
  it('A perfect electronic event is READY with genre', () => {
    const event = baseEvent({ genres: ['Techno'] });
    const evaluation = evaluateEventQuality({
      event,
      discovery: discoveryBundle(event.eventId),
      genreCoverage: {
        eventId: event.eventId,
        title: event.title,
        currentGenres: ['Techno'],
        classification: 'GENRE_VERIFIED',
        reason: 'verified',
        checkedLayers: [],
        confidenceBand: 'EXPLICIT',
      },
    });
    expect(evaluation.qualityState).toBe('READY');
    expect(evaluation.genre.genres).toContain('Techno');
  });

  it('D event-series evidence can classify unresolved inventory', () => {
    const identity = matchEventSeriesIdentity(
      baseEvent({
        title: 'MDMA – Musik Die Mich Antreibt 10.10.26',
        sources: [
          {
            sourceRole: 'official',
            sourceUrl: 'https://affenkaefig.info/event/mdma-musik-die-mich-antreibt-10-10-26/',
            connectorId: 'affenkaefig-official',
          },
        ],
      }),
    );
    expect(identity?.seriesId).toBe('series:affenkaefig-mdma');
  });

  it('F unsafe ticket URL routes to review', () => {
    const evaluation = evaluateEventQuality({
      event: baseEvent(),
      completeness: {
        eventId: 'evt-1',
        title: 'Sample',
        startsAt: '2026-12-01T22:00:00+00:00',
        endsAt: null,
        venue: 'Club',
        city: 'Cologne',
        organizer: 'Promoter',
        fields: {
          title: { state: 'VERIFIED_COMPLETE', value: 'Sample' },
          startsAt: { state: 'VERIFIED_COMPLETE', value: '2026-12-01T22:00:00+00:00' },
          endsAt: { state: 'UNRESOLVED_NO_EVIDENCE' },
          venue: { state: 'VERIFIED_COMPLETE', value: 'Club' },
          city: { state: 'VERIFIED_COMPLETE', value: 'Cologne' },
          organizer: { state: 'VERIFIED_COMPLETE', value: 'Promoter' },
          description: { state: 'VERIFIED_COMPLETE', value: 'Techno' },
          lineup: { state: 'VERIFIED_COMPLETE', value: 'Artist A' },
          genres: { state: 'UNRESOLVED_NO_EVIDENCE' },
          media: { state: 'VERIFIED_COMPLETE', value: 'flyer' },
          ticketUrl: { state: 'INVALID', value: 'https://shop.example/privacy' },
          ticketPrice: { state: 'UNRESOLVED_NO_EVIDENCE' },
          ticketStatus: { state: 'UNRESOLVED_NO_EVIDENCE' },
          sourceBindings: { state: 'VERIFIED_COMPLETE', value: '1' },
        },
        readiness: 'REVIEW_REQUIRED',
        sourceBindings: [],
      },
    });
    expect(evaluation.reviewReasons).toContain('unsafe_or_invalid_ticket_target');
  });

  it('hypothetical new connector can run generic fusion without ticket.io coupling', () => {
    const event = baseEvent({
      eventId: 'hypothetical-1',
      title: 'Future Source Night',
      sources: [{ sourceRole: 'official', sourceUrl: 'https://future-source.example/event/1', connectorId: 'future-source' }],
    });
    const discovery = discoveryBundle(event.eventId, {
      connectorIds: ['future-source'],
      domainClassification: classifyDomainFromRelevance(discoveryBundle(event.eventId).relevance),
    });
    const fusionContext: GenreFusionContext = {
      discoveryByEventId: new Map([[event.eventId, discovery]]),
      bootshausGenresByEventId: new Map(),
      seriesGenresByEventId: new Map(),
    };
    const exhaustion = exhaustGenreEvidence(event, [], { fusionContext });
    const fused = fuseEventGenreEvidence({ event, exhaustion, fusionContext });
    expect(fused.recommendedGenres.length).toBeGreaterThan(0);
  });

  it('genre scale batch coverage metric is computed', () => {
    const evaluations = [
      evaluateEventQuality({
        event: baseEvent({ genres: ['Techno'] }),
        genreCoverage: {
          eventId: 'evt-1',
          title: 'A',
          currentGenres: ['Techno'],
          classification: 'GENRE_VERIFIED',
          reason: '',
          checkedLayers: [],
          confidenceBand: 'HIGH',
        },
      }),
      evaluateEventQuality({
        event: baseEvent({ eventId: 'evt-2', genres: [] }),
        discovery: discoveryBundle('evt-2', { domainClassification: 'ELECTRONIC_HIGH' }),
        genreCoverage: {
          eventId: 'evt-2',
          title: 'B',
          currentGenres: [],
          classification: 'GENRE_UNRESOLVED_NO_EVIDENCE',
          reason: '',
          checkedLayers: [],
          confidenceBand: 'UNRESOLVED',
        },
      }),
    ];
    const batch = summarizeBatchQuality(evaluations);
    expect(batch.publishedEligible).toBe(2);
    expect(batch.genreClassified).toBe(1);
    expect(publishedElectronicGenreCoverage(evaluations)).toBe(0.5);
  });
});
