# Phase 4.7.3 — Canonical Event Attributes

Updated: 2026-08-03 (controlled attribute backfill complete)

## Schema deployment status

| Item | Status |
|---|---|
| Phase 4.7.3 migration (`20260803140000`) | **applied** |
| Phase 4.7.3.1 follow-up (`20260803150000`) | **applied** |
| Schema validation mode | `manual_sql_verified` |
| Controlled attribute backfill | **completed** |

## Schema audit note

The initial phase473 migration deployed columns, indexes, and `venue_environment` validation. It omitted three guarantees (migration-file omission, not execution failure):

- `event_attributes` default `'{}'::jsonb`
- `events_floor_count_check`
- `events_stage_count_check`

Phase4731 closed these gaps. Manual SQL verification confirmed all constraints and indexes.

## Attribute backfill results

| Metric | Before | After |
|---|---:|---:|
| Events with canonical attributes | 0 | **19** |
| Events with visible attribute badges | 0 | **19** |
| Floor-count coverage | 0 | **5** |
| Stage-count coverage | 0 | **0** |
| Open Air coverage | 0 | **4** |
| Indoor/Outdoor coverage | 0 | **1** |
| Boat coverage | 0 | **2** |
| Minimum-age coverage | 0 | **0** |
| Doors-time coverage | 0 | **0** |
| Review-required events | 0 | **1** |
| Published events (total) | 108 | **108** |

### Repair run

| Pass | Mutations |
|---|---:|
| Pass 1 | **19** |
| Pass 2 (semantic idempotency) | **0** |

Global frozen-domain fingerprints unchanged (artists, venues, organizers, sources, lineups, origins).

## Representative acceptance

| Event | Result |
|---|---|
| **Sommerfest Elektroküche** | `floor_count` + Multi Floor badge; indoor + indoor_outdoor preserved; tickets/lineup unchanged |
| **Bootshaus on a Ship Vol. III** | `boat` badge from explicit title evidence only; no unrelated attributes |
| **Open-Air events** | `open_air` / `outdoor` from explicit source evidence |
| **KitKatClub conflict** | `outdoor` persisted with `reviewRequired: true`; **no outdoor badge**; Live badge only |

## Ops scripts

```bash
# Read-only audit / preview
npx tsx scripts/operations/_phase473-event-attributes.ts full

# Schema validation (service-role + manual_sql_verified mode)
PHASE473_VALIDATION_MODE=manual_sql_verified npx tsx scripts/operations/_phase4731-schema-validation.ts

# Controlled backfill (completed)
PHASE473_VALIDATION_MODE=manual_sql_verified npx tsx scripts/operations/_phase473-attribute-backfill.ts full
```

## Artifacts

- `docs/real-data/_phase473_attribute_repair_backup.json`
- `docs/real-data/_phase473_attribute_repair_runs.json`
- `docs/real-data/_phase473_attribute_before_after.json`
- `docs/real-data/_phase473_badge_projection.json`
- `docs/real-data/_phase473_post_repair_audit.json`
- `docs/real-data/_phase473_schema_validation.json`
- `docs/real-data/_phase4731_schema_validation.json`
- `docs/ARCHITECTURE_EVENT_ATTRIBUTES.md`

## Constraints honored

- Evidence-backed attributes only — no invented values
- Conflicting explicit evidence review-gated (KitKatClub outdoor)
- No ticket, lineup, venue, organizer, source, description, genre, or image mutations
- No Featured / Trending / Sponsored badges
