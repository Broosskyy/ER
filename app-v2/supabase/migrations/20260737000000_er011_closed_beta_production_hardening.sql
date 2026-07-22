-- Eternal Rave — ER-011 Closed Beta Production Hardening
-- Align reference-table and import RLS with application role permissions.
--
-- Application rules (admin-roles.ts / admin-permissions.ts):
-- - viewer: read-only across admin surfaces
-- - editor: CMS writes (events, venues, artists, organizers, genres, cities, collections)
-- - reviewer: import record review actions
-- - source_manager: source configuration and import job starts
-- - admin/owner: full moderation and publish rights

-- Genres
drop policy if exists "admin_manage_genres" on public.genres;

create policy "admin_read_genres" on public.genres
  for select using (public.is_admin());

create policy "admin_insert_genres" on public.genres
  for insert
  with check (public.has_admin_role(array['editor', 'admin', 'owner']));

create policy "admin_update_genres" on public.genres
  for update
  using (public.has_admin_role(array['editor', 'admin', 'owner']))
  with check (public.has_admin_role(array['editor', 'admin', 'owner']));

create policy "admin_delete_genres" on public.genres
  for delete
  using (public.has_admin_role(array['editor', 'admin', 'owner']));

-- Cities
drop policy if exists "admin_manage_cities" on public.cities;

create policy "admin_read_cities" on public.cities
  for select using (public.is_admin());

create policy "admin_insert_cities" on public.cities
  for insert
  with check (public.has_admin_role(array['editor', 'admin', 'owner']));

create policy "admin_update_cities" on public.cities
  for update
  using (public.has_admin_role(array['editor', 'admin', 'owner']))
  with check (public.has_admin_role(array['editor', 'admin', 'owner']));

create policy "admin_delete_cities" on public.cities
  for delete
  using (public.has_admin_role(array['editor', 'admin', 'owner']));

-- Collections
drop policy if exists "admin_manage_collections" on public.collections;

create policy "admin_read_collections" on public.collections
  for select using (public.is_admin());

create policy "admin_insert_collections" on public.collections
  for insert
  with check (public.has_admin_role(array['editor', 'admin', 'owner']));

create policy "admin_update_collections" on public.collections
  for update
  using (public.has_admin_role(array['editor', 'admin', 'owner']))
  with check (public.has_admin_role(array['editor', 'admin', 'owner']));

create policy "admin_delete_collections" on public.collections
  for delete
  using (public.has_admin_role(array['editor', 'admin', 'owner']));

-- Sources
drop policy if exists "admin_manage_sources" on public.sources;

create policy "admin_insert_sources" on public.sources
  for insert
  with check (public.has_admin_role(array['source_manager', 'admin', 'owner']));

create policy "admin_update_sources" on public.sources
  for update
  using (public.has_admin_role(array['source_manager', 'admin', 'owner']))
  with check (public.has_admin_role(array['source_manager', 'admin', 'owner']));

create policy "admin_delete_sources" on public.sources
  for delete
  using (public.has_admin_role(array['source_manager', 'admin', 'owner']));

-- Import jobs
drop policy if exists "admin_manage_import_jobs" on public.import_jobs;

create policy "admin_read_import_jobs" on public.import_jobs
  for select using (public.is_admin());

create policy "admin_insert_import_jobs" on public.import_jobs
  for insert
  with check (public.has_admin_role(array['source_manager', 'admin', 'owner']));

create policy "admin_update_import_jobs" on public.import_jobs
  for update
  using (public.has_admin_role(array['source_manager', 'admin', 'owner']))
  with check (public.has_admin_role(array['source_manager', 'admin', 'owner']));

create policy "admin_delete_import_jobs" on public.import_jobs
  for delete
  using (public.has_admin_role(array['admin', 'owner']));

-- Import records
drop policy if exists "admin_manage_import_records" on public.import_records;

create policy "admin_read_import_records" on public.import_records
  for select using (public.is_admin());

create policy "admin_insert_import_records" on public.import_records
  for insert
  with check (public.has_admin_role(array['source_manager', 'admin', 'owner']));

create policy "admin_update_import_records" on public.import_records
  for update
  using (public.has_admin_role(array['editor', 'reviewer', 'admin', 'owner']))
  with check (public.has_admin_role(array['editor', 'reviewer', 'admin', 'owner']));

create policy "admin_delete_import_records" on public.import_records
  for delete
  using (public.has_admin_role(array['admin', 'owner']));

-- Import logs
drop policy if exists "admin_manage_import_logs" on public.import_logs;

create policy "admin_read_import_logs" on public.import_logs
  for select using (public.is_admin());

create policy "admin_insert_import_logs" on public.import_logs
  for insert
  with check (
    public.has_admin_role(array['editor', 'reviewer', 'source_manager', 'admin', 'owner'])
  );

create policy "admin_update_import_logs" on public.import_logs
  for update
  using (public.has_admin_role(array['admin', 'owner']))
  with check (public.has_admin_role(array['admin', 'owner']));

create policy "admin_delete_import_logs" on public.import_logs
  for delete
  using (public.has_admin_role(array['admin', 'owner']));

-- Event image uploads: restrict writes to CMS editors and above (not viewer).
drop policy if exists "admin_upload_event_images" on storage.objects;

create policy "admin_upload_event_images" on storage.objects
  for insert
  with check (
    bucket_id = 'events'
    and public.has_admin_role(array['editor', 'admin', 'owner'])
  );
