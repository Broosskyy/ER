# Bootshaus Ticket Readback and Provenance Rollback

## Problem

The restricted Bootshaus Ticket.io seven-event apply failed readback on Loonyland
(`evt-1785339382025-cazpz3d`) even though the event write and provenance insert used the
approved manifest values. Two generic writer-safety gaps were identified:

1. **Ticket readback** compared the full admin ticket snapshot with `JSON.stringify`,
   which treats JSONB property reordering as a mismatch.
2. **Provenance rollback** only upserted rows that existed before the apply. Fields that were
   absent before the attempt (for example `ticketPhases` on Loonyland) were inserted during
   the failed apply and were not deleted on rollback.

## Readback comparison

`compareCanonicalTicketSnapshotSemantically()` in
`src/features/events/domain/ticket-field-readback-comparison.ts` compares:

- `ticketUrl`
- `priceText`
- `ticketStatus`
- admission `ticketPhases`

Material differences still fail on price, currency, concrete ticket URL, phase count,
phase identity, sales status, and shop-root URLs.

Presentation-only differences are normalized:

- missing optional fields versus `undefined`
- semantically empty `ticketPhases` (`null`, `undefined`, `[]`)
- trailing-slash URL normalization
- JSONB property order inside phase objects
- equivalent numeric price amounts

## Provenance rollback

`captureProvenanceFieldRollbackPlans()` and `resolveProvenanceRollbackActions()` in
`src/features/import/domain/provenance-rollback-snapshot.ts` model per-field rollback as:

- `beforeState: existing` → `restore_exact_snapshot`
- `beforeState: absent` → `delete_exact_insert` only when the live row fingerprint matches
  the attempt insert fingerprint
- otherwise → `abort_due_to_drift`

No event-specific cleanup logic is embedded in these helpers.

## Loonyland orphan provenance

The failed apply left one orphan row:

- `provenance-evt-1785339382025-cazpz3d-ticketPhases`
- `selection_reason = bootshaus_golden_ticketio_seven_apply`
- `freshness_at = 2026-08-12T18:37:21.812Z`

A one-row cleanup plan is generated read-only in
`.tmp/loonyland-ticketphases-provenance-cleanup-plan.json`.

## Verification

Focused tests:

- `src/features/events/domain/__tests__/ticket-field-readback-comparison.test.ts`
- `src/features/import/domain/__tests__/provenance-rollback-snapshot.test.ts`

No production writes are performed by these helpers or tests.
