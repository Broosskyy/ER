-- Eternal Rave — Contributor event image re-upload (ER-005.5)
-- Allow contributors to replace cover/flyer images via storage upsert.

create policy "contributor_update_own_event_images" on storage.objects
  for update
  using (
    bucket_id = 'events'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'events'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );
