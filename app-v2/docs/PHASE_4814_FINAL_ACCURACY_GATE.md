# Phase 4.8.1.4 — Final Accuracy Gate

**Status:** Executed — **production shadow NOT executed** (plan only)  
**Production mutations:** `0`  
**Command:** `npx tsx scripts/operations/_phase4814-final-accuracy-gate.ts full`

## Summary

Phase 4.8.1.4 resolved all **5** remaining `BOTH_INCORRECT` fields from Phase 4.8.1.3 through live public ground-truth audits, generic Ticket.io price semantics, official-page body description extraction, stale-evidence policy, Ticket Kings public discovery, and fixture-backed double-run stability.

| Metric | Phase 4.8.1.3 | Phase 4.8.1.4 |
|--------|---------------|---------------|
| BOTH_INCORRECT (claimed) | 5 | **0 unresolved** |
| Ticket.io price discrepancies | 4 | **0 importer errors** (all production-stale) |
| Description extractor gap | 1 | **resolved** (body extraction) |
| Fixture replay drift | unproven | **0** |
| Production shadow executed | no | **no** |

## Five incorrect fields — before / after

| Event | Field | Before | After | Resolution |
|-------|-------|--------|-------|------------|
| Ship Vol. III (`obhyeev`) | ticket-io price | `Ausverkauft` vs `Tickets ab 32,00 Euro` | Live list: sold-out (`OutOfStock`) | **Production stale** — unified correct |
| LOONYLAND (`cazpz3d`) | ticket-io price | `25,90 €` vs `23,90 Euro` | Live list: `25,90 Euro` | **Production stale** |
| TECHNO DAMPFER Mainz (`m5ugmjh`) | ticket-io price | `49,90 €` vs `69,90 €` | Live list: `49,90 Euro` | **Production stale** (tier change) |
| HCG Stuttgart (`yhn81xp`) | ticket-io price | `22,00 €` vs `19,00 €` | Live list: `22,00 Euro` | **Production stale** |
| Bootshaus Sommerfest (`tfaixrr`) | official-website description | `Doors: 22:00` vs wrong Underland production text | Body: `Electro/EDM vs. Deep/TechHouse…` | **Extractor fixed** — production row has contaminated description from another event |

Detail: [`docs/real-data/_phase4814_remaining_incorrect_fields.json`](real-data/_phase4814_remaining_incorrect_fields.json)

## Ticket.io price semantics

Generic model in `ticket-io-price-semantics.ts` separates:

- `current_purchaseable` — live list-row price
- `sold_out_status` — `Ausverkauft` (never `ab 0,00 €`)
- `historical_phase` — provenance-only when sold out had prior amount
- `placeholder_zero` — rejected (`ab 0,00 €`)

Detail: [`docs/real-data/_phase4814_ticketio_price_semantics.json`](real-data/_phase4814_ticketio_price_semantics.json)

## Underland / Affenkäfig description

- **Underland** (`4mb7dub`): public ECM page has **empty body** — correctly emits no description (legacy may remain authoritative during shadow).
- **7 Affenkäfig pages** audited: no footer/sidebar contamination; no fabricated descriptions.
- **Bootshaus pages**: `.event-description-content` body preferred over short `og:description`.

Detail: [`docs/real-data/_phase4814_underland_description.json`](real-data/_phase4814_underland_description.json)

## Stale evidence

| Case | Stale candidate | Winner | Policy |
|------|-----------------|--------|--------|
| Underland JSON-LD offer | TK Underland URL | Ticket.io `C7JPnatZ` | Cannot win CTA |
| Sommerfest TK slug | `08-08-2026` slug | `20-06-2026` canonical | Cannot win CTA |

Detail: [`docs/real-data/_phase4814_stale_evidence.json`](real-data/_phase4814_stale_evidence.json)

## Ticket Kings discovery

- **5** public events on `ticketkings.de/all-events/`
- **4** DB-linked overlap, **1** new staging discovery (Underland TK URL)
- Sommerfest slug/date mismatch documented (`20-06` slug, `08-08` title)

Detail: [`docs/real-data/_phase4814_ticketkings_discovery.json`](real-data/_phase4814_ticketkings_discovery.json)

## Live double-run stability

- Fixture replay (30 pilots × 2): **identical hash**, 0 nondeterminism
- Live price audits: differences explained by current public list evidence vs stale production

Detail: [`docs/real-data/_phase4814_live_double_run.json`](real-data/_phase4814_live_double_run.json)

## LEGACY_BETTER migration scope (69 fields)

| Scope | Count |
|-------|-------|
| Required before shadow | 0 |
| Allowed legacy during shadow | 2 |
| Required before controlled batch | 45 |
| Future enhancement | 3 |

Detail: [`docs/real-data/_phase4814_legacy_better_scope.json`](real-data/_phase4814_legacy_better_scope.json)

## Readiness

| Importer | Verdict |
|----------|---------|
| **official-website** | **READY_FOR_PRODUCTION_SHADOW** |
| ticket-io | READY_FOR_MORE_STAGING |
| ticket-kings | READY_FOR_MORE_STAGING |
| nacht-manager | READY_FOR_MORE_STAGING |

Detail: [`docs/real-data/_phase4814_readiness_by_importer.json`](real-data/_phase4814_readiness_by_importer.json)

## Code changes

| Module | Change |
|--------|--------|
| `ticket-io-price-semantics.ts` | Generic price/sold-out/placeholder model |
| `official-page-description.ts` | Body-first description extraction |
| `stale-evidence-policy.ts` | Stale candidate tier + merge penalties |
| `ticket-io-pilot.ts` | Sold-out + historical phase evidence |
| `official-website-pilot.ts` | Body description + stale JSON-LD offers |
| `merge-simulation.ts` | Stale candidate cannot win ticket URL |
| `semantic-field-comparison.ts` | Ticket.io production-stale reclassification |
| `ticket-kings-public-discovery.ts` | Public list discovery |
| `shadow-safety.ts` | Bounded shadow plan + no-write validation |

## Proof of zero production mutations

All artifacts: `productionMutationsInThisRun: 0`. No canonical writes, no scheduling changes, no shadow execution.
