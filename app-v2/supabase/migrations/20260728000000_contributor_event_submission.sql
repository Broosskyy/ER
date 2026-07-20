-- Eternal Rave — Contributor event submission (ER-004)
-- Flyer column, owner read for draft/review, draft→review submit, contributor image uploads.

alter table public.events
  add column if not exists flyer_url text;

drop policy if exists "auth_read_own_draft_events" on public.events;

create policy "auth_read_own_contributor_events" on public.events
  for select
  using (
    auth.uid() is not null
    and created_by = auth.uid()
    and status in ('draft', 'review')
  );

drop policy if exists "auth_update_own_draft_events" on public.events;

create policy "auth_update_own_draft_events" on public.events
  for update
  using (
    auth.uid() is not null
    and created_by = auth.uid()
    and status = 'draft'
  )
  with check (
    created_by = auth.uid()
    and status = 'draft'
  );

create policy "auth_submit_own_draft_events" on public.events
  for update
  using (
    auth.uid() is not null
    and created_by = auth.uid()
    and status = 'draft'
  )
  with check (
    created_by = auth.uid()
    and status = 'review'
  );

create policy "contributor_upload_own_event_images" on storage.objects
  for insert
  with check (
    bucket_id = 'events'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );
