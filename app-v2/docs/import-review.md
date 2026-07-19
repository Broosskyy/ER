# Import Review Workflow

Sprint 12D adds the administrative review workflow for imported events.

## Review Queue

The review queue lists import records with status `needs_review` or `duplicate` by default. Records are loaded via `ImportAdminRepository.listRecords()` with server-side pagination — raw payloads are excluded from list responses.

### Filters

- Source, city, date range, status
- Duplicate score and match confidence thresholds
- Records with warnings
- Missing venue/city/genre/artist matches

### Sorting

Newest first (default), event date, duplicate score, match confidence, warning count.

## Detail View

The review detail screen shows:

1. **Original data** — collapsible raw payload, source URL, external ID
2. **Normalized data** — title, dates, venue, city, artists, genres, URLs
3. **Matching** — matched entity IDs and warnings
4. **Duplicate detection** — score and suggested event
5. **Validation** — errors and warnings

## Editing Before Approval

Reviewers with `records:edit` permission can correct normalized fields. Changes are stored in `reviewer_edits` on the import record and do not modify `raw_payload`.

Editable fields: title, description, dates, timezone, venue, address, city, coordinates, artists, genres, ticket/event/image URLs, organizer, minimum age.

## Approve

1. Record is re-loaded and `updated_at` is checked (concurrency guard)
2. Validation is re-run on effective candidate (normalized + reviewer edits)
3. Duplicate decision must be resolved if score exceeds threshold
4. Event is created via `AdminEventRepository.save()` with status `draft`
5. Record status becomes `imported`, `resulting_event_id` is set
6. Audit log entry is created

Events are **not** automatically published.

## Reject

Requires a predefined reason and optional note. Status becomes `rejected`. Rejected records cannot be approved without a deliberate status reset (future sprint).

### Reject Reasons

- `not_relevant`, `incomplete_data`, `invalid_data`, `outdated_event`
- `wrong_region`, `spam`, `source_error`, `other`

## Duplicate Workflow

When duplicate score exceeds threshold:

- **Confirm duplicate** — sets status `duplicate`, stores `duplicate_event_id`, no new event
- **Dismiss** — clears duplicate concern, continues as `needs_review`
- **Override** — changes suggested duplicate event ID

## Status Transitions

```
needs_review → imported (approve)
needs_review → rejected (reject)
needs_review → duplicate (confirm duplicate)
invalid → imported (approve, if valid after edits)
invalid → rejected
duplicate → (terminal, no new event)
rejected → (terminal without explicit reset)
imported → (terminal)
```

## Concurrency Protection

All write actions compare `updated_at` before persisting. On conflict, the client receives `IMPORT_CONCURRENCY_CONFLICT` and should reload the record.

Server-side: `ImportAdminDatasource.updateIfUnchanged()` uses optimistic locking.

## Permissions

| Action | Required Permission |
|--------|-------------------|
| View queue | `records:read` |
| Edit fields | `records:edit` |
| Approve | `records:approve` |
| Reject | `records:reject` |
| Duplicate actions | `records:duplicate` |
