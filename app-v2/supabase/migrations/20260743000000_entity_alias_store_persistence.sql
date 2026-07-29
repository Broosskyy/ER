-- Eternal Rave — Sprint 8 Phase 2B: Entity alias store persistence hardening.
-- Additive only. Extends existing entity_identity_aliases / entity_resolution_decisions tables.

alter table public.entity_identity_aliases
  add column if not exists original_alias text,
  add column if not exists locale text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

alter table public.entity_resolution_decisions
  add column if not exists source_id text references public.sources(id) on delete set null,
  add column if not exists source_external_id text,
  add column if not exists candidate_entity_id text,
  add column if not exists confidence numeric,
  add column if not exists normalized_input text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

alter table public.entity_resolution_decisions
  drop constraint if exists entity_resolution_decisions_decision_check;

alter table public.entity_resolution_decisions
  add constraint entity_resolution_decisions_decision_check
    check (decision in (
      'keep_separate',
      'manual_override',
      'match',
      'manual_match',
      'no_match',
      'alias_added'
    ));

create index if not exists entity_identity_aliases_lookup_idx
  on public.entity_identity_aliases(entity_type, alias_type, alias_value);

create index if not exists entity_identity_aliases_source_external_idx
  on public.entity_identity_aliases(entity_type, alias_value)
  where alias_type = 'external_id';

create index if not exists entity_resolution_decisions_source_idx
  on public.entity_resolution_decisions(source_id);

create index if not exists entity_resolution_decisions_decision_idx
  on public.entity_resolution_decisions(decision);

create index if not exists entity_resolution_decisions_updated_idx
  on public.entity_resolution_decisions(updated_at desc);

alter table public.entity_identity_aliases enable row level security;
alter table public.entity_resolution_decisions enable row level security;

drop policy if exists admin_read_entity_identity_aliases on public.entity_identity_aliases;
drop policy if exists admin_write_entity_identity_aliases on public.entity_identity_aliases;
drop policy if exists admin_read_entity_resolution_decisions on public.entity_resolution_decisions;
drop policy if exists admin_write_entity_resolution_decisions on public.entity_resolution_decisions;

create policy admin_read_entity_identity_aliases on public.entity_identity_aliases
  for select using (public.is_admin());

create policy admin_write_entity_identity_aliases on public.entity_identity_aliases
  for all using (public.is_admin()) with check (public.is_admin());

create policy admin_read_entity_resolution_decisions on public.entity_resolution_decisions
  for select using (public.is_admin());

create policy admin_write_entity_resolution_decisions on public.entity_resolution_decisions
  for all using (public.is_admin()) with check (public.is_admin());
