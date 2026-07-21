-- Eternal Rave — ER-007 Artist Domain Foundation
-- Extend artists table with canonical domain fields, lifecycle/verification status,
-- and role-scoped RLS aligned with ER-006 event hardening.

alter table public.artists
  add column if not exists slug text,
  add column if not exists bio text,
  add column if not exists image_url text,
  add column if not exists genre_ids text[] not null default '{}',
  add column if not exists country text,
  add column if not exists city text,
  add column if not exists facebook text,
  add column if not exists soundcloud text,
  add column if not exists status text not null default 'published'
    check (status in ('draft', 'published', 'archived')),
  add column if not exists verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'verified'));

-- Backfill slug from name for existing rows.
update public.artists
set slug = lower(
  regexp_replace(
    regexp_replace(trim(name), '[^a-zA-Z0-9]+', '-', 'g'),
    '(^-+|-+$)',
    '',
    'g'
  )
)
where slug is null or trim(slug) = '';

-- Resolve slug collisions by appending a short id suffix.
update public.artists as target
set slug = target.slug || '-' || right(target.id, 8)
from (
  select id
  from (
    select id, row_number() over (partition by slug order by created_at, id) as row_num
    from public.artists
  ) ranked
  where row_num > 1
) duplicates
where target.id = duplicates.id;

alter table public.artists
  alter column slug set not null;

create unique index if not exists artists_slug_idx on public.artists (slug);
create index if not exists artists_status_idx on public.artists (status);
create index if not exists artists_verification_status_idx on public.artists (verification_status);

-- Replace broad read/write policies with scoped access.
drop policy if exists "anon_read_artists" on public.artists;
drop policy if exists "admin_manage_artists" on public.artists;

create policy "anon_read_published_artists" on public.artists
  for select using (status = 'published');

create policy "admin_read_artists" on public.artists
  for select using (public.is_admin());

create policy "admin_insert_artists" on public.artists
  for insert
  with check (
    public.has_admin_role(array['editor', 'admin', 'owner'])
    and (
      status = 'draft'
      or public.has_admin_role(array['admin', 'owner'])
    )
  );

create policy "admin_update_artists" on public.artists
  for update
  using (public.has_admin_role(array['editor', 'admin', 'owner']))
  with check (public.has_admin_role(array['editor', 'admin', 'owner']));

create policy "admin_delete_artists" on public.artists
  for delete
  using (public.has_admin_role(array['editor', 'admin', 'owner']));

create or replace function public.enforce_admin_artist_sensitive_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    return new;
  end if;

  if new.verification_status is distinct from old.verification_status then
    if not public.has_admin_role(array['admin', 'owner']) then
      raise exception 'artist_verification_requires_admin_role'
        using errcode = '42501';
    end if;
  end if;

  if new.status is distinct from old.status then
    if new.status in ('published', 'archived')
       or old.status = 'archived' then
      if not public.has_admin_role(array['admin', 'owner']) then
        raise exception 'artist_lifecycle_requires_admin_role'
          using errcode = '42501';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_admin_artist_sensitive_rules on public.artists;

create trigger enforce_admin_artist_sensitive_rules
  before update on public.artists
  for each row
  execute function public.enforce_admin_artist_sensitive_rules();
