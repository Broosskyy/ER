# Field Provenance and Merge

## Service

`MergeProvenanceService` — `src/features/aggregation/services/merge-provenance-service.ts`

## Flow

1. Load canonical admin event
2. Upsert `event_source_references`
3. Mark missing references `active = false` (never delete)
4. Load field provenance; protect `manual_override`
5. Run `PriorityBasedMergeStrategy` per contribution
6. Persist provenance with alternatives
7. Detect and upsert conflicts
8. Recalculate event quality and publish readiness
9. Save canonical event; audit; `eventRepository.refresh()`

## Field authority (merge strategy)

| Source type pattern | Fields |
|---------------------|--------|
| `venue` / `club` | `venueAddress`, `latitude`, `longitude` |
| `organizer` | `description`, `artistNames`, `organizerName` |
| `ticket` / `partner` | `ticketUrl` |

Manual overrides always win.

## Persistence

Table `event_field_provenance` — unique on `(canonical_event_id, field_path)`.

## Idempotency

Repeated merge with same contributions yields identical canonical state and stable conflict IDs.
