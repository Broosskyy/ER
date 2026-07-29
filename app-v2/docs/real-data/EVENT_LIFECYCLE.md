# Event Lifecycle

Central status via `EventLifecycleResolver` with `Clock` abstraction (`SystemClock` production, `FixedClock` tests).

## Status Values

`draft`, `needs_review`, `scheduled`, `on_sale`, `sold_out`, `cancelled`, `postponed`, `happening_now`, `ended`, `archived`

`published` is an **editorial** status on `Event.status`, not a lifecycle status.

## Priority Rules

1. Editorial: `draft` → `needs_review`; `archived` / `rejected` → `archived`
2. `cancelledAt` set → `cancelled` (wins over time-based states)
3. `postponedAt` set → `postponed` (wins over time-based states)
4. Time window: `happening_now` when `now` ∈ [start, end]
5. After end: `ended`; after `ARCHIVE_AFTER_ENDED_MS` (90 days) → `archived`
6. Ticket window: `on_sale` when sales window active and `ticketStatus === 'on_sale'`
7. `ticketStatus === 'sold_out'` → `sold_out`
8. Default future published event → `scheduled`

## Timezone

IANA timezone required on input (`timezone_missing` reason code if empty). Default fallback in `toEventLifecycleInput`: `Europe/Berlin`.

Default duration when `endAt` missing: **4 hours** (`DEFAULT_EVENT_DURATION_MS`), not persisted.

## Discovery

`isDiscoverable`: `scheduled`, `on_sale`, `sold_out`, `happening_now` only.

## Consumer Mapping

- `Event` carries lifecycle timestamp fields: `cancelledAt`, `postponedAt`, `doorsOpenAt`, `salesStartAt`, `salesEndAt`, `ticketStatus`
- `toEventLifecycleInput(event)` bridges consumer `Event` → resolver input
- `EventDisplayModel.lifecycleStatus` set in `toEventDisplayModel`
- Saved cards use `lifecycleStatus` for cancelled/postponed (`saved-presentation.ts`)

## Code

- `src/features/events/lifecycle/event-lifecycle-resolver.ts`
- `src/features/events/lifecycle/event-lifecycle-from-event.ts`
- `src/features/events/lifecycle/lifecycle-types.ts`
- `src/core/clock/`

## Tests

- `event-lifecycle-resolver.test.ts`
- `phase-2d-domain-integration.test.ts`
