-- Eternal Rave — ER-012.1 Source Foundation Consolidation Patch
-- Align trust_score default with application neutral default (50).

alter table public.sources
  alter column trust_score set default 50;
