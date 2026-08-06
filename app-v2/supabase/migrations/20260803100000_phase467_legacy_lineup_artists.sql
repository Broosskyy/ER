-- Phase 4.6.7 closure — preserve collapsed historical artist rows without public exposure.

alter table public.artists
  add column if not exists lineup_legacy_artifact boolean not null default false;

create index if not exists artists_lineup_legacy_artifact_idx
  on public.artists (lineup_legacy_artifact)
  where lineup_legacy_artifact = true;

drop policy if exists "anon_read_published_artists" on public.artists;

create policy "anon_read_published_artists" on public.artists
  for select
  to anon, authenticated
  using (
    status = 'published'
    and lineup_legacy_artifact = false
  );
