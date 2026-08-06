/**
 * Audit longest artists.id / artist_id values (B-tree index overflow diagnosis).
 */
import './bootstrap-ops-supabase';

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { isCollapsedLineupArtistName } from '@/features/aggregation/domain/lineup-billing-parser';
import { isLegacyLineupArtifact } from '@/features/artists/domain/legacy-lineup-artist';
import { isLineupBlobArtistName } from '@/features/events/domain/lineup-artist-quality';
import { opsClient } from './ops-supabase-rows';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '../../docs/real-data/_phase468_long_artist_ids_audit.json');

interface ArtistRow {
  id: string;
  name: string;
  lineup_legacy_artifact?: boolean;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

function classifyOrigin(id: string, name: string): string {
  if (id.startsWith('artist-title-')) {
    return 'import_title_lineup_resolver (artist-title-{slug}-{suffix})';
  }
  if (id.startsWith('staging-seed-')) {
    return 'staging_seed';
  }
  if (id.startsWith('artist-')) {
    return 'legacy_artist_prefix';
  }
  if (/[<>&]/.test(name) || /einlass|admission|ticket/i.test(name)) {
    return 'html_or_footer_lineup_blob_as_name';
  }
  if (isCollapsedLineupArtistName(name)) {
    return 'collapsed_b2b_f2f_lineup_artifact';
  }
  return 'unknown';
}

interface EventArtistRow {
  id: string;
  artist_id: string;
  event_id: string;
}

interface EventTitleRow {
  id: string;
  title: string;
  artist_id?: string | null;
}

async function main(): Promise<void> {
  const c = opsClient();
  const { data: artists, error } = await c
    .from('artists')
    .select('id,name,lineup_legacy_artifact,status,created_at,updated_at');
  if (error) {
    throw error;
  }

  const rows = (artists ?? []) as ArtistRow[];
  const enriched = rows.map((artist) => ({
    id: artist.id,
    idLength: artist.id.length,
    nameLength: artist.name?.length ?? 0,
    namePreview: artist.name?.slice(0, 120) ?? '',
    legacyArtifact: artist.lineup_legacy_artifact === true || isLegacyLineupArtifact(artist),
    collapsedName: isCollapsedLineupArtistName(artist.name),
    status: artist.status,
    origin: classifyOrigin(artist.id, artist.name),
    createdAt: artist.created_at,
    updatedAt: artist.updated_at,
  }));

  enriched.sort((left, right) => right.idLength - left.idLength);
  const top20 = enriched.slice(0, 20);

  const { data: eventArtists } = await c.from('event_artists').select('id,artist_id,event_id');
  const { data: events } = await c.from('events').select('id,title,artist_id');
  const eventRows = (events ?? []) as EventTitleRow[];
  const eventsById = new Map(eventRows.map((event) => [event.id, event.title]));

  const compositeRows = ((eventArtists ?? []) as EventArtistRow[]).map((row) => {
    const legacyEntryId = `ele-backfill-${row.id}`;
    const legacyCompositeBytes =
      Buffer.byteLength(legacyEntryId, 'utf8') + Buffer.byteLength(row.artist_id, 'utf8');
    return {
      eventArtistId: row.id,
      eventArtistIdLength: row.id.length,
      artistId: row.artist_id,
      artistIdLength: row.artist_id.length,
      eventId: row.event_id,
      eventTitle: eventsById.get(row.event_id) ?? row.event_id,
      legacyBackfillEntryId: legacyEntryId,
      legacyBackfillEntryIdLength: legacyEntryId.length,
      legacyCompositeIndexBytes: legacyCompositeBytes,
      exceedsBtreeLimit: legacyCompositeBytes > 2704,
    };
  });
  compositeRows.sort((left, right) => right.legacyCompositeIndexBytes - left.legacyCompositeIndexBytes);

  const eventArtistIds = new Set(((eventArtists ?? []) as EventArtistRow[]).map((row) => row.artist_id));
  const inLineup = top20.map((row) => ({
    ...row,
    linkedInEventArtists: eventArtistIds.has(row.id),
  }));

  const primaryArtistRefs = eventRows
    .filter((event): event is EventTitleRow & { artist_id: string } => Boolean(event.artist_id))
    .map((event) => ({
      artistId: event.artist_id,
      idLength: event.artist_id.length,
      eventId: event.id,
      title: event.title,
    }))
    .sort((left, right) => right.idLength - left.idLength)
    .slice(0, 10);

  const report = {
    generatedAt: new Date().toISOString(),
    postgresBtreeIndexLimitBytes: 2704,
    totalArtists: rows.length,
    compositeIndexAnalysis: {
      description:
        'unique(entry_id, artist_id) on event_lineup_entry_artists fails when ele-backfill-||ea.id embeds artist_id and artist_id is repeated in the composite key',
      legacyBackfillEntryIdPrefix: 'ele-backfill-',
      worstCompositeKeyBytes: enriched[0]
        ? Buffer.byteLength(`ele-backfill-ea-${'x'.repeat(30)}-${enriched[0].id}-0`, 'utf8') +
          Buffer.byteLength(enriched[0].id, 'utf8')
        : 0,
    },
    counts: {
      idOver2704: enriched.filter((row) => row.idLength > 2704).length,
      idOver1000: enriched.filter((row) => row.idLength > 1000).length,
      idOver500: enriched.filter((row) => row.idLength > 500).length,
      idOver200: enriched.filter((row) => row.idLength > 200).length,
      legacyArtifact: enriched.filter((row) => row.legacyArtifact).length,
      collapsedName: enriched.filter((row) => row.collapsedName).length,
      lineupBlobName: enriched.filter((row) => isLineupBlobArtistName(row.namePreview)).length,
      legacyCompositeOverflowRows: compositeRows.filter((row) => row.exceedsBtreeLimit).length,
    },
    top20LongestArtistIds: inLineup.map((row) => ({
      ...row,
      isLineupBlob: isLineupBlobArtistName(row.namePreview),
    })),
    top10LegacyCompositeOverflow: compositeRows.filter((row) => row.exceedsBtreeLimit).slice(0, 10),
    top10LegacyCompositeKeys: compositeRows.slice(0, 10),
    top10EventPrimaryArtistIds: primaryArtistRefs,
    diagnosis:
      compositeRows.some((row) => row.exceedsBtreeLimit)
        ? `B-tree overflow on unique(entry_id, artist_id): ${compositeRows.filter((row) => row.exceedsBtreeLimit).length} rows exceed 2704 bytes when entry_id = ele-backfill-||event_artists.id (embeds artist_id twice)`
        : (enriched[0]?.idLength ?? 0) > 200
          ? `Long artist ids (max ${enriched[0]?.idLength ?? 0}) from import_title_lineup_resolver slugifying HTML/description blobs as artist names`
          : 'No composite btree overflow detected',
  };

  writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(`Wrote ${OUT}`);
  console.log(`Max id length: ${enriched[0]?.idLength ?? 0}`);
  console.log(`Over 2704: ${report.counts.idOver2704}`);
  for (const row of top20.slice(0, 5)) {
    console.log(`- [${row.idLength}] ${row.id.slice(0, 100)}...`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
