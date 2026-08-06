# Phase 4.8.6.2 — Ticket.io Enrichment Linkage Completion

Generated: 2026-08-06T01:38:00.000Z

## Goal

Close the generic linkage/persistence gap between valid Event-specific Ticket.io list evidence and canonical ticket fields — without modifying the Official Website importer, without broad Ticket.io scheduling, and without production writes in this phase.

## Scope

| Dimension | Allowed |
|-----------|---------|
| Audit | All published Events with Event-specific Ticket.io ticket URLs |
| Code | Enrichment linkage resolution + import publish identity path |
| Preview | Controlled batch preview only |
| Forbidden | Website importer changes, broad scheduling, new sources, production apply |

## Global Audit Summary

| Metric | Value |
|--------|-------|
| Event-specific Ticket.io Events audited | **71** |
| Linkage/persistence gaps | **14** |
| Batch A (auto-safe) | **0** |
| Review-only preview candidates | **8** |
| `productionMutationsInThisRun` | **0** |

### Root-cause distribution

| Root cause | Count |
|------------|-------|
| `NONE` | 47 |
| `CANONICAL_VALUE_STALE` | 14 |
| `REVIEW_REQUIRED` | 4 |
| `LIST_ROW_MATCH_FAILED` | 3 |
| `PUBLIC_EVIDENCE_MISSING` | 3 |

`CANONICAL_VALUE_STALE` events already carry a raw list price string (e.g. `Tickets ab 23,00 Euro`) but not the normalized connector form (`ab 23,00 €`). They are enrichment candidates but blocked from Batch A when slug collisions or formatting-only ambiguity applies.

## Generic Linkage Fix (implemented)

**Problem:** After Phase 4.8.6 set a correct Ticket.io URL on a website-owned Event, Ticket.io enrichment could not associate imports because identity resolution fell back to fingerprint matching instead of URL linkage.

**Fix:**

1. `EventCanonicalIdentityService.resolveByTicketIoEventUrl()` — resolves canonical Event ID from normalized Ticket.io event URL against the published catalog.
2. `ImportEventPublishService.resolveExistingEventId()` — for enrichment sources, resolves by Ticket.io URL before fingerprint fallback.
3. `ticket-io-enrichment-linkage/` module — audit, classification, preview, consumer simulation.
4. `buildTicketIoEnrichmentCandidate()` — uses list-row context + price discovery directly (not full shop scope filter).

Website ownership is preserved: `sourceId` remains the website source; Ticket.io is enrichment-only.

## R3HAB Acceptance Trace

| Field | Value |
|-------|-------|
| Event ID | `evt-1785339421539-k3swcrl` |
| Slug | `C7JPnatZ` |
| Ticket URL | `https://bootshaus-club.ticket.io/C7JPnatZ/` |
| Public raw price | `Tickets ab 23,90 Euro` |
| Connector normalized | `ab 23,90 €` |
| Amount / currency | `23.90` / EUR |
| Availability | InStock |
| Sold out | false |
| Canonical `priceText` | *(empty)* |
| Ticket.io source refs | 0 |
| Ticket.io import records | 0 |

**Earliest root cause (audit):** `REVIEW_REQUIRED` — slug `C7JPnatZ` is shared with `evt-1785389049895-4mb7dub` (Underland). Live list row title is **R3HAB pres. by BOOTSHAUS**; Underland holds stale/wrong URL assignment.

**Proposed controlled write (after collision resolution):**

- `price_text: ab 23,90 €`
- `ticket_status`: unchanged (`external_link`) unless explicit on-sale evidence maps to existing writer
- Website-owned fields: frozen

## Batch Preview

### Batch A — Proven persistence/linkage gaps

**0 candidates.** No Event passed all Batch A gates simultaneously (exact URL, exact list-row identity, connector extraction, missing/stale canonical value, no slug collision).

### Review only (8)

Includes R3HAB and Underland (`C7JPnatZ` collision), plus Events with stale raw price strings, ambiguous slug sharing, or identity uncertainty. See `docs/real-data/_phase4862_batch_preview.json`.

## Forbidden-domain protection

Simulated R3HAB enrichment (`_phase4862_simulated_consumer_result.json`):

- `displayPriceText` → `ab 23,90 €`
- `ticketUrl` unchanged
- `title`, `description`, `imageUrl`, `websiteUrl`, `venueName`, `genres`, `organizerName`, `sourceId` frozen
- `websiteFieldsFrozen: true`

## Ops commands

```bash
npm run audit-phase4862
# or individual commands:
tsx scripts/operations/_phase4862-ticketio-enrichment-linkage.ts audit-linkage
tsx scripts/operations/_phase4862-ticketio-enrichment-linkage.ts trace-r3hab
tsx scripts/operations/_phase4862-ticketio-enrichment-linkage.ts preview-batch
tsx scripts/operations/_phase4862-ticketio-enrichment-linkage.ts full
```

`full` is production-read-only.

## Tests

`src/features/import/ticket-io-enrichment-linkage/__tests__/phase4862-enrichment-linkage.test.ts` — 7 tests covering URL eligibility, slug collision rejection, linkage classification, enrichment preview, downgrade prevention, identity resolution.

## Next approval required

1. **Resolve `C7JPnatZ` slug collision** — confirm R3HAB owns the slug; correct or unlink Underland's ticket URL.
2. **Approve controlled Ticket.io enrichment batch apply** — R3HAB first, then remaining `CANONICAL_VALUE_STALE` normalization candidates after collision review.
3. Do **not** run broad Ticket.io scheduling until batch apply is validated.

## Artifacts

| File | Purpose |
|------|---------|
| `_phase4862_linkage_audit.json` | Per-Event audit rows |
| `_phase4862_root_cause_matrix.json` | Root-cause classification |
| `_phase4862_r3hab_trace.json` | R3HAB acceptance trace |
| `_phase4862_source_reference_analysis.json` | Source-reference ownership |
| `_phase4862_batch_preview.json` | Controlled batch preview |
| `_phase4862_simulated_consumer_result.json` | Consumer projection |
| `_phase4862_readiness.json` | Readiness verdict |
