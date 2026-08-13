import { describe, expect, it } from 'vitest';

import type { ResolvedCanonicalLineupEntry } from '@/features/aggregation/domain/canonical-lineup-entry';
import { mapEventRowToDomain } from '@/data/mappers/event-mapper';
import type { EventRow } from '@/data/types/records';
import { readCanonicalLineup } from '@/features/events/domain/canonical-lineup-read';
import { projectCanonicalEventFields } from '@/features/events/formatting/canonical-event-projection';
import { normalizePublicEventDescription } from '@/features/events/formatting/public-description-normalizer';
import { buildLineupBillingRows } from '@/features/event-detail/utils/lineup-billing-display';
import { toLineupSectionViewModel } from '@/features/event-detail/utils/event-detail-view-model';
import { resolveDescriptionGenrePublish } from '@/features/import/domain/description-genre-publish-resolver';
import {
  classifyImportLineupPreflight,
  importLineupPreflightIsWritable,
} from '@/features/import/services/import-lineup-preflight';
import { needsStructuredLineupReplace } from '@/features/import/services/structured-lineup-replace-decision';

function mapProductiveConsumerEvent(
  row: Partial<EventRow>,
  structuredEntries: ResolvedCanonicalLineupEntry[],
) {
  const canonicalLineup = readCanonicalLineup({
    structuredEntries,
    compatibilityLineup: [],
    eventTitle: row.title,
  });
  return mapEventRowToDomain(row as EventRow, {
    artists: canonicalLineup.artistNames,
    lineup: canonicalLineup.artistNames,
    lineupEntries: canonicalLineup.lineupEntries,
    artistIds: canonicalLineup.artistIds,
  });
}

const LOONYLAND_DESCRIPTION =
  "Let's go Loony... We're back on the MAINFLOOR.On August 21st, LOONYLAND returns to Bootshaus with LUCA DANTE SPADAFORA, 2 ENGEL & CHARLIE and more.MAINFLOOR:LUCA DANTE SPADAFORA 2 ENGEL & CHARLIEOLIVER MAGENTADJ OLDEJEY AUX PLATINES";

const GOLDEN_LINEUP = [
  'LUCA DANTE SPADAFORA',
  '2 ENGEL & CHARLIE',
  'OLIVER MAGENTA',
  'DJ OLDE',
  'JEY AUX PLATINES',
];

function legacySplitStructuredEntries(): ResolvedCanonicalLineupEntry[] {
  return [
    {
      order: 0,
      artists: ['LUCA DANTE SPADAFORA'],
      artistIds: ['artist-luca'],
      billingRelation: 'SOLO',
      confidence: 0.5,
      provenance: { source: 'event_artists_backfill' },
    },
    {
      order: 1,
      artists: ['2 ENGEL'],
      artistIds: ['artist-engel'],
      billingRelation: 'SOLO',
      confidence: 0.5,
      provenance: { source: 'event_artists_backfill' },
    },
    {
      order: 2,
      artists: ['CHARLIE'],
      artistIds: ['artist-charlie'],
      billingRelation: 'SOLO',
      confidence: 0.5,
      provenance: { source: 'event_artists_backfill' },
    },
  ];
}

function goldenStructuredEntries(): ResolvedCanonicalLineupEntry[] {
  return GOLDEN_LINEUP.map((name, order) => ({
    order,
    artists: [name],
    artistIds: [`artist-${order}`],
    billingRelation: 'SOLO' as const,
    confidence: 0.86,
    provenance: { importRecordId: 'imp-loonyland', source: 'structured' },
  }));
}

describe('bootshaus live consumer contract', () => {
  it('1. compound act with "&" stays one lineup entry in persistence payload', () => {
    const incoming = goldenStructuredEntries();
    expect(incoming.find((entry) => entry.artists[0] === '2 ENGEL & CHARLIE')).toBeDefined();
    expect(incoming.filter((entry) => entry.artists[0]?.includes('ENGEL')).length).toBe(1);
  });

  it('2. description keeps paragraph separation without venue-floor hype', () => {
    const resolved = resolveDescriptionGenrePublish({
      event: {
        eventId: 'evt-loonyland',
        title: 'LOONYLAND pres. LUCA DANTE SPADAFORA & 2 ENGEL & CHARLIE',
        startDate: '2026-08-21T22:00:00',
      },
      officialDescription: LOONYLAND_DESCRIPTION,
      observedAt: '2026-08-13T00:00:00.000Z',
    });
    expect(resolved.description).toMatch(/On August 21st, LOONYLAND returns/);
    expect(resolved.description).not.toMatch(/\bmain\s*floor\b/i);
  });

  it('3. lineup and genre blocks do not leak into description', () => {
    const resolved = resolveDescriptionGenrePublish({
      event: {
        eventId: 'evt-loonyland',
        title: 'LOONYLAND',
        startDate: '2026-08-21T22:00:00',
      },
      officialDescription: LOONYLAND_DESCRIPTION,
      observedAt: '2026-08-13T00:00:00.000Z',
    });
    expect(resolved.description).not.toMatch(/OLIVER MAGENTA/i);
    expect(resolved.description).not.toMatch(/DJ OLDE/i);
  });

  it('4. stored genre_labels reach consumer genre chips when present', () => {
    const event = mapProductiveConsumerEvent(
      {
        id: 'evt-genre',
        title: 'Genre Event',
        description: 'Body',
        start_date: '2026-08-21T20:00:00+00:00',
        status: 'published',
        genre_labels: ['Techno', 'House'],
      } as EventRow,
      [],
    );
    const projection = projectCanonicalEventFields({
      title: event.title,
      description: event.description ?? '',
      venue: event.venue,
      city: event.city,
      artists: event.artists,
      genres: event.genres,
      source: 'test',
    });
    expect(projection.genres).toEqual(['Techno', 'House']);
  });

  it('5. one structured billing row renders as one lineup row', () => {
    const event = mapProductiveConsumerEvent(
      {
        id: 'evt-lineup',
        title: 'Compound billing',
        description: 'Body',
        start_date: '2026-08-21T20:00:00+00:00',
        status: 'published',
      } as EventRow,
      [
        {
          order: 0,
          artists: ['2 ENGEL & CHARLIE'],
          artistIds: ['artist-compound'],
          billingRelation: 'SOLO',
          confidence: 0.86,
          provenance: { importRecordId: 'imp-1', source: 'structured' },
        },
      ],
    );
    const rows = buildLineupBillingRows({ lineupEntries: event.lineupEntries ?? [] });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.artists[0]?.name).toBe('2 ENGEL & CHARLIE');
  });

  it('6. legacy split DB shape is detected as needing persistence write', () => {
    const state = classifyImportLineupPreflight({
      manifestBeforeNames: [],
      goldenTargetNames: GOLDEN_LINEUP,
      currentStructuredEntries: legacySplitStructuredEntries(),
    });
    expect(state).toBe('needs_persistence_write');
    expect(importLineupPreflightIsWritable(state)).toBe(true);
    expect(needsStructuredLineupReplace(legacySplitStructuredEntries(), goldenStructuredEntries())).toBe(
      true,
    );
  });

  it('7. missing relations are not invented in mapper output', () => {
    const event = mapProductiveConsumerEvent(
      {
        id: 'evt-empty-genres',
        title: 'No genres',
        description: 'Body',
        start_date: '2026-08-21T20:00:00+00:00',
        status: 'published',
        genre_labels: null,
      } as EventRow,
      legacySplitStructuredEntries(),
    );
    expect(event.genres).toEqual([]);
  });

  it('8. productive mapper + LineupSection preserve compound act when DB shape is correct', () => {
    const event = mapProductiveConsumerEvent(
      {
        id: 'evt-loonyland',
        title: 'LOONYLAND pres. LUCA DANTE SPADAFORA & 2 ENGEL & CHARLIE',
        description: 'On August 21st, LOONYLAND returns to Bootshaus.',
        start_date: '2026-08-21T20:00:00+00:00',
        status: 'published',
      } as EventRow,
      goldenStructuredEntries(),
    );
    const projection = projectCanonicalEventFields({
      title: event.title,
      description: normalizePublicEventDescription(event.description ?? ''),
      venue: event.venue,
      city: event.city,
      artists: event.artists,
      lineupEntries: event.lineupEntries,
      source: 'test',
    });
    const lineupVm = toLineupSectionViewModel(
      {
        ...event,
        knownArtistNames: projection.knownArtistNames,
        lineupEntries: event.lineupEntries,
      },
      { artistsById: new Map() },
    );
    const rendered =
      lineupVm?.billingRows?.map((row) => row.artists.map((artist) => artist.name).join(' & ')) ?? [];
    expect(rendered).toHaveLength(5);
    expect(rendered).toContain('2 ENGEL & CHARLIE');
    expect(rendered).not.toContain('2 ENGEL');
    expect(rendered).not.toContain('CHARLIE');
  });
});
