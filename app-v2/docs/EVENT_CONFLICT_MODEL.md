# Event Conflict Model

## Type

`EventConflict` — `src/features/aggregation/merge/event-conflict.ts`

## Fields

- `field`, `values[]` (per source), `severity` (`info` | `warning` | `critical`)
- `resolved`, `resolution`, `resolvedAt`

## Detection

`detectConflictingValues()` during merge when ≥2 distinct source values exist for a tracked field.

## Resolution service

`ConflictResolutionService` supports:

| Decision | Behavior |
|----------|----------|
| `source_value` | Apply chosen source value |
| `keep_canonical` | Retain current canonical value |
| `manual_value` | Set manual provenance override |
| `defer` | Leave unresolved |

## Blocking

Unresolved `critical` conflicts block publish readiness (`critical_schedule_conflict`).

## Admin

Route: `/admin/events/review/[id]/conflicts` — `ConflictReviewContent`

## Persistence

Table `event_conflicts` — migration `20260741000000_multi_source_event_provenance.sql`
