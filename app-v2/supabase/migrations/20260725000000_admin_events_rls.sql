-- Eternal Rave — Sprint 12.6C Admin Web Access
-- Tighten reference/event write policies to admin roles only.

drop policy if exists "auth_manage_events" on public.events;
drop policy if exists "auth_manage_genres" on public.genres;
drop policy if exists "auth_manage_cities" on public.cities;
drop policy if exists "auth_manage_venues" on public.venues;
drop policy if exists "auth_manage_artists" on public.artists;
drop policy if exists "auth_manage_collections" on public.collections;

create policy "admin_read_events" on public.events
  for select using (public.is_admin());

create policy "admin_manage_events" on public.events
  for all using (public.is_admin());

create policy "admin_manage_genres" on public.genres
  for all using (public.is_admin());

create policy "admin_manage_cities" on public.cities
  for all using (public.is_admin());

create policy "admin_manage_venues" on public.venues
  for all using (public.is_admin());

create policy "admin_manage_artists" on public.artists
  for all using (public.is_admin());

create policy "admin_manage_collections" on public.collections
  for all using (public.is_admin());

drop policy if exists "auth_upload_event_images" on storage.objects;

create policy "admin_upload_event_images" on storage.objects
  for insert with check (bucket_id = 'events' and public.is_admin());
