-- Eternal Rave — ER-005 My Events & pre-publish hardening
-- Social link columns, venue suggestion fields, expanded owner RLS, review→draft withdraw.

alter table public.events
  add column if not exists website_url text,
  add column if not exists instagram_url text,
  add column if not exists facebook_url text,
  add column if not exists venue_name text,
  add column if not exists venue_city text;

drop policy if exists "auth_read_own_contributor_events" on public.events;

create policy "auth_read_own_events" on public.events
  for select
  using (
    auth.uid() is not null
    and created_by = auth.uid()
  );

create policy "auth_withdraw_own_review_events" on public.events
  for update
  using (
    auth.uid() is not null
    and created_by = auth.uid()
    and status = 'review'
  )
  with check (
    created_by = auth.uid()
    and status = 'draft'
  );
