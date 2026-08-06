import { describe, expect, it } from 'vitest';

import { resolveLineupRootCause } from '@/features/aggregation/domain/lineup-root-cause';

describe('lineup root cause resolver', () => {
  it('resolves title-inferred single artist with detail not fetched to stage 3', () => {
    const result = resolveLineupRootCause({
      eventId: 'evt-test',
      title: 'TECHNO DAMPFER Duisburg w/ Pappenheimer',
      validCanonicalCount: 1,
      invalidCanonicalNames: [],
      canonicalArtistNames: ['Pappenheimer'],
      importTraces: [
        {
          sourceId: 'source-ticket-io-technodampfer',
          prioritizedNames: ['Pappenheimer'],
          prioritizedSource: 'title_inference',
          detailUrl: 'https://technodampfer.ticket.io/QC7jvv0A/',
          detailPagesFetched: 0,
        },
      ],
    });

    expect(result.rootCauseClass).toBe('detail_not_fetched');
    expect(result.firstFailureStage).toBe(3);
    expect(result.completenessState).toBe('title_inferred_only');
    expect(result.rootCauseClass).not.toBe('parser_or_merge_unknown');
  });

  it('marks exact structured two-artist match as complete', () => {
    const result = resolveLineupRootCause({
      eventId: 'evt-stereoact',
      title: 'Stereoact & Lena Marie Engel',
      validCanonicalCount: 2,
      invalidCanonicalNames: [],
      canonicalArtistNames: ['Stereoact', 'Lena Marie Engel'],
      importTraces: [
        {
          sourceId: 'source-ticket-io-hmg',
          prioritizedNames: ['Stereoact', 'Lena Marie Engel'],
          prioritizedSource: 'structured',
          detailUrl: 'https://hmg-concerts.ticket.io/hU0Qr9Gh/',
          detailPagesFetched: 0,
        },
      ],
    });

    expect(result.classification).toBe('complete');
    expect(result.firstFailureStage).toBeNull();
    expect(result.completenessState).toBe('complete');
  });

  it('flags invalid title fragment extraction', () => {
    const result = resolveLineupRootCause({
      eventId: 'evt-bootshaus',
      title: 'DEBORAH DE LUCA pres by Bootshaus',
      validCanonicalCount: 1,
      invalidCanonicalNames: [],
      canonicalArtistNames: ['by Bootshaus'],
      importTraces: [
        {
          sourceId: 'source-bootshaus-ticket-io',
          prioritizedNames: ['by Bootshaus'],
          prioritizedSource: 'title_inference',
          detailUrl: 'https://bootshaus-club.ticket.io/uSXeJhHU/',
          detailPagesFetched: 0,
        },
      ],
    });

    expect(result.firstFailureStage).toBe(8);
    expect(result.classification).toBe('invalid');
  });
});
