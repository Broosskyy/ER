-- Eternal Rave — ER-006 Platform Hardening
-- Align event write RLS with application publish/moderation permissions.
--
-- Why this migration is required:
-- 1. `admin_manage_events` granted ALL operations to any `is_admin()` role, including
--    viewer/editor/reviewer. The app restricts publish/reject to admin/owner only.
-- 2. Contributor events in `review` could be archived or status-changed outside the
--    moderation workflow by any admin role at the database layer.
-- 3. UI and service checks are not authoritative; RLS must enforce the same rules.
--
-- Approach (additive, non-breaking):
-- - Replace broad `admin_manage_events` with role-scoped insert/update/delete policies.
-- - Add a BEFORE UPDATE trigger for publish/reject and contributor-review transitions.
-- - Contributor self-service paths (draft edit, submit, withdraw) bypass the trigger.

drop policy if exists "admin_manage_events" on public.events;

create policy "admin_insert_events" on public.events
  for insert
  with check (public.has_admin_role(array['editor', 'admin', 'owner']));

create policy "admin_update_events" on public.events
  for update
  using (public.has_admin_role(array['editor', 'admin', 'owner']))
  with check (public.has_admin_role(array['editor', 'admin', 'owner']));

create policy "admin_delete_events" on public.events
  for delete
  using (public.has_admin_role(array['editor', 'admin', 'owner']));

create or replace function public.enforce_admin_event_status_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Contributor self-service (draft edit, submit, withdraw) uses separate RLS policies.
  if auth.uid() is not null and auth.uid() = old.created_by then
    return new;
  end if;

  if not public.is_admin() then
    return new;
  end if;

  if new.status is distinct from old.status
     and new.status in ('published', 'rejected') then
    if not public.has_admin_role(array['admin', 'owner']) then
      raise exception 'event_publish_requires_admin_role'
        using errcode = '42501';
    end if;
  end if;

  if old.created_by is not null and old.status = 'review' then
    if not public.has_admin_role(array['admin', 'owner']) then
      raise exception 'contributor_review_requires_admin_role'
        using errcode = '42501';
    end if;

    if new.status is distinct from old.status
       and new.status not in ('published', 'rejected') then
      raise exception 'contributor_review_invalid_transition'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_admin_event_status_rules on public.events;

create trigger enforce_admin_event_status_rules
  before update on public.events
  for each row
  execute function public.enforce_admin_event_status_rules();
