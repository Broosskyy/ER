# Migration Report — Multi-Source Provenance

**Migration:** `supabase/migrations/20260741000000_multi_source_event_provenance.sql`  
**Date:** 2026-07-27

## Summary

Additive migration introducing multi-source provenance tables. No rewrites of `events`, `saved` references, or import records.

## Tables created

| Table | Purpose |
|-------|---------|
| `event_source_references` | Source ↔ canonical event links |
| `event_field_provenance` | Per-field selection and alternatives |
| `duplicate_decisions` | Admin/system duplicate decisions |
| `event_conflicts` | Unresolved field conflicts |

## Safety checks

- `country_code` on sources preserved via prior migrations (defensive `if not exists` patterns in foundation migration)
- Existing source IDs unchanged (FK `on delete restrict` for sources)
- Existing events preserved (FK to `events.id`, no UPDATE of event IDs)
- Import records preserved (`raw_record_id` nullable FK)
- Saved event IDs not rewritten (alias resolution at read time)
- Idempotent: all `create table if not exists` / `create index if not exists`

## Tests

`src/data/__tests__/multi-source-event-provenance-migration.test.ts`

## Recovery

If migration fails mid-deploy: tables are independent; re-run migration script. No destructive DDL. Rollback = drop new tables only (loses provenance data, not canonical events).
