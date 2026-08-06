import type { LineupItemViewModel } from '@/components/discovery/view-models';
import type { LineupBillingRowViewModel } from '@/components/event-detail/view-models';
import {
  billingRelationLabel,
  type BillingRelation,
} from '@/features/aggregation/domain/canonical-lineup-entry';
import type { EventLineupEntryProjection } from '@/features/events/domain/event-lineup-entry-projection';
import { evaluateArtistCandidate } from '@/features/events/domain/artist-candidate-quality-gate';
import type { ArtistRecord } from '@/data/types/records';
import {
  toLineupItemFromArtist,
  toLineupItemFromName,
} from '@/features/profiles/utils/profile-view-models';
import { normalizeMatchText } from '@/features/import/matching/matching-utils';

function resolveArtistIdForName(
  name: string,
  artistIds: string[] | undefined,
  knownArtistNames: string[] | undefined,
): string | undefined {
  if (!artistIds?.length || !knownArtistNames?.length) {
    return undefined;
  }
  const key = normalizeMatchText(name);
  const index = knownArtistNames.findIndex((candidate) => normalizeMatchText(candidate) === key);
  return index >= 0 ? artistIds[index] : undefined;
}

function toLineupItem(
  name: string,
  artistsById: Map<string, ArtistRecord> | undefined,
  artistIds: string[] | undefined,
  knownArtistNames: string[] | undefined,
  headliner: boolean,
): LineupItemViewModel {
  const artistId = resolveArtistIdForName(name, artistIds, knownArtistNames);
  if (artistId && artistsById?.has(artistId)) {
    return toLineupItemFromArtist(artistsById.get(artistId)!, headliner);
  }
  if (artistId) {
    return {
      ...toLineupItemFromName(name, headliner),
      id: artistId,
      profileNavigable: true,
    };
  }
  return toLineupItemFromName(name, headliner);
}

function billingAccessibilityLabel(
  relation: BillingRelation,
  artists: LineupItemViewModel[],
): string {
  if (relation === 'SOLO' || artists.length <= 1) {
    return artists[0]?.name ?? '';
  }
  const separator = ` ${billingRelationLabel(relation)} `;
  return artists.map((artist) => artist.name).join(separator);
}

export function buildLineupBillingRows(input: {
  lineupEntries: EventLineupEntryProjection[];
  artistsById?: Map<string, ArtistRecord>;
  artistIds?: string[];
  knownArtistNames?: string[];
}): LineupBillingRowViewModel[] {
  const sorted = [...input.lineupEntries].sort((left, right) => left.order - right.order);

  return sorted
    .map((entry, index) => {
    const showHeadliner = entry.billingRelation === 'SOLO' && sorted.length <= 2 && index === 0;
    const artists = entry.artists
      .filter(
        (name) =>
          evaluateArtistCandidate({ name, sourceField: 'lineup' }).decision !== 'invalid',
      )
      .map((name) =>
        toLineupItem(
          name,
          input.artistsById,
          input.artistIds,
          input.knownArtistNames,
          showHeadliner,
        ),
      )
      .filter((artist) => artist.name.trim().length > 0);

    return {
      id: `lineup-entry-${entry.order}`,
      billingRelation: entry.billingRelation,
      artists,
      accessibilityLabel: billingAccessibilityLabel(entry.billingRelation, artists),
    };
  })
    .filter((row) => row.artists.length > 0);
}
