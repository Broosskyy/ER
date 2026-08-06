-- Eternal Rave — Phase 4.6 generic entity follows
-- Authenticated follow/unfollow for organizer/venue/artist with RLS and uniqueness.

create table if not exists public.entity_follows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entity_type text not null check (entity_type in ('organizer', 'venue', 'artist')),
  entity_id text not null,
  followed_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists entity_follows_user_entity_uidx
  on public.entity_follows (user_id, entity_type, entity_id);

create index if not exists entity_follows_entity_idx
  on public.entity_follows (entity_type, entity_id);

alter table public.entity_follows enable row level security;

drop policy if exists "entity_follows_select_authenticated" on public.entity_follows;
drop policy if exists "entity_follows_select_public_counts" on public.entity_follows;
create policy "entity_follows_select_public_counts"
  on public.entity_follows
  for select
  to anon, authenticated
  using (true);

drop policy if exists "entity_follows_insert_own" on public.entity_follows;
create policy "entity_follows_insert_own"
  on public.entity_follows
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "entity_follows_delete_own" on public.entity_follows;
create policy "entity_follows_delete_own"
  on public.entity_follows
  for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, delete on public.entity_follows to authenticated;
grant select on public.entity_follows to anon;
