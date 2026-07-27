# Publish Readiness

## Resolver

`PublishReadinessResolver` — `src/features/events/quality/publish-readiness-resolver.ts`

## Status values

| Status | Meaning |
|--------|---------|
| `ready` | Safe to publish |
| `needs_review` | Warnings or manual review required |
| `blocked` | Hard blockers present |

## Block reason codes

- `missing_title`, `invalid_date`, `missing_city`, `missing_venue`
- `blocked_source`, `no_active_source`
- `critical_schedule_conflict`
- `unresolved_duplicate`, `manual_review_required`

## Integration

- Merge and conflict services recalculate readiness after writes
- Conflict review UI shows blocking state for `critical` severity
- Consumer surfaces only show `published` events via existing `EventRepository` filters

## Separation

Publish readiness is distinct from import status, source lifecycle status, and submission moderation status.
