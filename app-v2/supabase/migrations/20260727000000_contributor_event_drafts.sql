-- Eternal Rave — Contributor event drafts (ER-004)
-- Ownership column + RLS so authenticated users can create/read/update their own drafts.
-- Required because admin-only write policies (20260725000000) block consumer draft creation.

alter table public.events
  add column if not exists created_by uuid references auth.users(id) on delete set null;

create index if not exists events_created_by_idx on public.events(created_by);

create policy "auth_insert_own_draft_events" on public.events
  for insert
  with check (
    auth.uid() is not null
    and created_by = auth.uid()
    and status = 'draft'
  );

create policy "auth_read_own_draft_events" on public.events
  for select
  using (
    auth.uid() is not null
    and created_by = auth.uid()
    and status = 'draft'
  );

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
