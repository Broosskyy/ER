import { describe, expect, it } from 'vitest';

import {
  createLocalDatasourceBundle,
  getLocalStore,
} from '@/data/datasources/local/local-datasource';
import { derivePrimaryArtistId } from '@/features/events/domain/event-lineup-primary';
import { validateEventLineupInputs } from '@/features/events/domain/event-lineup-validation';

describe('EventLineupRepository (local)', () => {
  it('replaces lineup and syncs deprecated primary artist', async () => {
    const bundle = createLocalDatasourceBundle();
    const artists = await bundle.artists.getAll();
    expect(artists.length).toBeGreaterThanOrEqual(2);

    const events = await bundle.events.getPublishedEvents();
    const eventId = events[0]?.id;
    expect(eventId).toBeTruthy();

    const firstArtist = artists[0]!;
    const secondArtist = artists[1]!;
    const lineup = await bundle.eventLineups.replaceEventLineup(eventId!, [
      { artistId: firstArtist.id, billingRole: 'support' },
      { artistId: secondArtist.id, billingRole: 'headliner' },
    ]);

    expect(lineup.map((entry) => entry.artist.id)).toEqual([firstArtist.id, secondArtist.id]);
    expect(lineup[1]?.billingRole).toBe('headliner');

    const adminEvent = getLocalStore().adminEvents.find((event) => event.id === eventId);
    expect(adminEvent?.artistId).toBe(
      derivePrimaryArtistId([
        { artistId: firstArtist.id, billingRole: 'support' },
        { artistId: secondArtist.id, billingRole: 'headliner' },
      ]),
    );
  });

  it('rejects duplicate artists before persistence', () => {
    const artists = getLocalStore().artists;
    const artistId = artists[0]?.id;
    expect(artistId).toBeTruthy();

    expect(() =>
      validateEventLineupInputs(
        [
          { artistId: artistId!, billingRole: 'headliner' },
          { artistId: artistId!, billingRole: 'support' },
        ],
        new Map(artists.map((artist) => [artist.id, artist])),
      ),
    ).toThrow('once');
  });
});
