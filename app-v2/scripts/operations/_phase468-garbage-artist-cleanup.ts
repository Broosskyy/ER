/**
 * Detach lineup blob / HTML footer artists from events and mark as legacy artifacts.
 */
import './bootstrap-ops-supabase';

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { isCollapsedLineupArtistName } from '@/features/aggregation/domain/lineup-billing-parser';
import { isLegacyLineupArtifact } from '@/features/artists/domain/legacy-lineup-artist';
import {
  isLineupBlobArtistName,
  isLineupPlaceholderArtist,
  MAX_LINEUP_ARTIST_NAME_LENGTH,
} from '@/features/events/domain/lineup-artist-quality';
import { invalidateConsumerEventCaches } from '@/features/events/formatting/consumer-cache-invalidation';
import type { ArtistRecord } from '@/data/types/records';
import { opsClient } from './ops-supabase-rows';

const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../docs/real-data/_phase468_garbage_artist_cleanup.json',
);

function isGarbageArtist(artist: Pick<ArtistRecord, 'id' | 'name' | 'lineupLegacyArtifact'>): boolean {
  if (isLegacyLineupArtifact(artist)) {
    return true;
  }
  if (isLineupBlobArtistName(artist.name)) {
    return true;
  }
  if (isCollapsedLineupArtistName(artist.name)) {
    return true;
  }
  if ((artist.name?.length ?? 0) > MAX_LINEUP_ARTIST_NAME_LENGTH) {
    return true;
  }
  if ((artist.id?.length ?? 0) > 200) {
    return true;
  }
  return isLineupPlaceholderArtist(artist.name);
}

async function main(): Promise<void> {
  const c = opsClient();
  const { adminArtistRepository, eventRepository, initializeEntityAliasStore, flushEntityAliasStore } =
    await import('@/data/repositories/registry').then(async (registry) => {
      const entityBootstrap = await import('@/features/entity-resolution/entity-alias-store-bootstrap');
      return {
        adminArtistRepository: registry.adminArtistRepository,
        eventRepository: registry.eventRepository,
        initializeEntityAliasStore: entityBootstrap.initializeEntityAliasStore,
        flushEntityAliasStore: entityBootstrap.flushEntityAliasStore,
      };
    });

  await initializeEntityAliasStore();
  const artists = await adminArtistRepository.getAll();
  const detached: Array<{ artistId: string; name: string; eventIds: string[] }> = [];
  const markedLegacy: Array<{ artistId: string; name: string }> = [];

  for (const artist of artists) {
    if (!isGarbageArtist(artist)) {
      continue;
    }

    const { data: links } = await c
      .from('event_artists')
      .select('event_id')
      .eq('artist_id', artist.id);
    const eventIds = (links ?? []).map((row) => row.event_id);
    if (eventIds.length > 0) {
      await c.from('event_artists').delete().eq('artist_id', artist.id);
      detached.push({ artistId: artist.id, name: artist.name, eventIds });
    }

    if (!artist.lineupLegacyArtifact) {
      await adminArtistRepository.save({
        ...artist,
        lineupLegacyArtifact: true,
        updatedAt: new Date().toISOString(),
      });
      markedLegacy.push({ artistId: artist.id, name: artist.name });
    }
  }

  await flushEntityAliasStore();
  await invalidateConsumerEventCaches(eventRepository);

  const report = {
    generatedAt: new Date().toISOString(),
    detachedCount: detached.length,
    markedLegacyCount: markedLegacy.length,
    detached,
    markedLegacy,
  };
  writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(`Garbage artist cleanup: detached=${detached.length}, marked=${markedLegacy.length}`);
  console.log(`Report: ${OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
