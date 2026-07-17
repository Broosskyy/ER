-- Sprint 2 — Auth roles foundation (moderator + helpers)
-- Run after 001_initial_schema.sql

-- Extend user_role enum with moderator (Band 4.6)
do $$ begin
  alter type user_role add value if not exists 'moderator' before 'admin';
exception
  when duplicate_object then null;
end $$;

-- Moderator helper for future RLS policies
create or replace function public.is_moderator()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('moderator', 'admin')
  );
$$ language sql stable security definer;

-- Verified organizer: role organizer/admin with verified organizers row
create or replace function public.is_verified_organizer()
returns boolean as $$
  select exists (
    select 1
    from public.profiles p
    left join public.organizers o on o.profile_id = p.id
    where p.id = auth.uid()
      and (
        p.role = 'admin'
        or (p.role = 'organizer' and coalesce(o.verification_status, 'unverified') = 'verified')
      )
  );
$$ language sql stable security definer;

-- Profiles: users can update own display_name / avatar (not role)
drop policy if exists "Users update own profile metadata" on public.profiles;
create policy "Users update own profile metadata"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Organizers: owner can read own row
drop policy if exists "Organizers read own row" on public.organizers;
create policy "Organizers read own row"
  on public.organizers for select to authenticated
  using (profile_id = auth.uid() or public.is_admin());

comment on function public.is_moderator() is 'Band 4.6 — moderator or admin';
comment on function public.is_verified_organizer() is 'Band 4.6 — verified organizer or admin';
