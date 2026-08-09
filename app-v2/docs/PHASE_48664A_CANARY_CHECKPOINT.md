# Phase 4.8.6.6.4a — Canary Checkpoint

## Outcome

First controlled generic-truth canary apply succeeded for `evt-1785339418526-dn9f7g0` (Bootshaus on a Ship Vol. IV).

Checkpoint run (`4866.6.4a`): **no production writes**, `rolloutActivated: false`.

## Write reconstruction (4866.6.4 apply)

| Metric | Value |
|--------|-------|
| attemptedApplicationEvents | 1 |
| successfulApplicationEvents | 1 |
| databaseWriteRequests | 17 |
| affectedRows | 17 |
| eventFieldMutations (events row) | 3 (`priceText`, `ticketStatus`, `ticketPhases`) |
| provenanceWriteRequests | 14 |
| sourceReferenceWriteRequests | 1 |
| rollbackWriteRequests | 0 |
| **totalProductionWriteOperations** | **17** |

`attemptedWrites` (1) counts the publish attempt only — not an additional DB operation.

### Per-operation breakdown

1. `events` — UPDATE ×1 — apply enrichment + generic truth ticket patch
2. `import_records` — UPDATE ×1 — mark record imported
3. `event_source_references` — UPSERT ×1 — refresh ticket.io `last_seen_at` / metadata
4. `event_field_provenance` — UPSERT ×14 — publish provenance for all tracked fields with values

Prior report `totalProductionWriteOperations = 5` was incorrect (summed semantic groups, omitted import record + bulk provenance upserts).

## Freshness semantics

- Source evidence `verifiedAt`: `2026-08-09T19:21:16.347Z`
- Provenance readback `freshness_at` after apply: `2026-08-09T19:22:13.576Z` (~57s later)

**Root cause:** `EventFieldProvenanceWriter.writeFromPublish` set `freshnessAt` from publish `publishedAt` (apply time), not evidence `verifiedAt`.

**Fix:** pass `readCandidateEvidenceVerifiedAt(candidate)` as `evidenceVerifiedAt`; keep `publishedAt` on `lastChangedAt` / `selected_at` as apply audit metadata.

**Freshness merge** (`evaluateTicketEvidenceFreshness`) compares snapshot `verifiedAt`, not provenance `freshness_at` directly — but wrong provenance freshness misleads provenance-based tooling.

**Provenance correction:** read-only plan in `docs/real-data/_phase48664a_provenance_freshness_correction_plan.json` (not applied in this phase).

## Consumer verification

- Header price: `ab 32,00 €`
- Ticket card count: 1
- CTA: Ticket.io / „Tickets ansehen“
- `websiteUrl` unchanged (official Bootshaus page)
- `ticketUrl` unchanged
