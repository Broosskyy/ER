# Phase 4.8.1.3 — Unified Import Gap Elimination

**Status:** Executed — **production shadow NOT approved**  
**Production mutations:** `0`  
**Command:** `npx tsx scripts/operations/_phase4813-gap-analysis.ts full`

## Summary

Phase 4.8.1.3 re-analyzed all **714 field comparisons** from the Phase 4.8.1.2 live staging sample (120 events × multiple importers) using semantic normalization and importer field-ownership rules. No live re-fetch was required; analysis is read-only against `_phase4812_field_comparison.json`.

| Metric | Phase 4.8.1.2 | Phase 4.8.1.3 | Delta |
|--------|---------------|---------------|-------|
| BOTH_INCORRECT | 42 | **5** | −37 |
| LEGACY_BETTER | 249 | **69** | −180 reclassified |
| INTENTIONALLY_UNSUPPORTED | — | **182** | new category |
| BOTH_CORRECT | 204 | **234** | +30 |
| STALE_EVIDENCE | — | **4** | new category |
| REVIEW_REQUIRED | — | **1** | sold-out vs zero-price |
| Regressions | — | **0** | — |

**217** comparisons resolved without changing comparison rules factually — only by applying allowed semantic normalization (price labels, HTML entities, emoji, URL trailing slashes) and field-ownership denials.

## Root-cause clusters

| Cluster | Occurrences | Affected fields | Earliest stage | Responsible module | Correction |
|---------|-------------|-----------------|----------------|-------------------|------------|
| `field_ownership_mismatch` | 180 | title, venue, description, price | comparison | `semantic-field-comparison.ts` | Do not count LEGACY_BETTER when importer does not own field |
| `price_label_normalization` | 65 | price | normalization | `parsePriceSemantics` | Shared price normalizer (resolved false BOTH_INCORRECT) |
| `description_html_entity_whitespace` | 26 | description | normalization | `text-normalizer.ts` | Named HTML entity decode + tag strip (resolved) |
| `url_trailing_slash` | 74 | ticketUrl | normalization | URL normalizer | Trailing-slash equivalence (resolved) |
| `missing_extractor` | 69 | venue, ticketUrl, description, title, price | importer | `live-staging-pilots` | Future extractor support (LEGACY_BETTER group A) |
| `stale_json_ld_offer_slug` | 4 | ticketUrl | evidence_extraction | `official-website-pilot.ts` | Mark JSON-LD offer as stale; compare ticket platform CTA |
| `checkout_vs_consumer_cta` | 2 | ticketUrl | comparison | `semantic-field-comparison.ts` | NM checkout ≠ TK consumer page |
| `price_label_mismatch` | **4** | price | third_party / importer | `ticket-io-pilot.ts` | Genuine price drift or sold-out semantics |
| `description_residual_diff` | **1** | description | importer | `official-website-pilot.ts` | Wrong meta extraction (`Doors: 22:00` vs full body) |
| `ticket_io_sold_out_vs_zero_price` | 1 | price | third_party | production projection | REVIEW_REQUIRED — not BOTH_INCORRECT |

Full cluster JSON: [`docs/real-data/_phase4813_difference_clusters.json`](real-data/_phase4813_difference_clusters.json)

## BOTH_INCORRECT review (42 → 5)

### Resolved (37)

- **26** price label format differences (`ab 23,90 €` vs `Tickets ab 23,90 Euro`)
- **7** description HTML entity / tag / emoji noise
- **4** stale JSON-LD offer URLs reclassified as `STALE_EVIDENCE` (Public Source)

### Remaining (5) — all explained

| Event | Importer | Field | Primary cause | Explanation |
|-------|----------|-------|---------------|-------------|
| Ship Vol. III | ticket-io | price | **Third-party Platform** | Ticket.io reports `Ausverkauft`; production still shows `Tickets ab 32,00 Euro` — stale production price, not importer bug |
| cazpz3d | ticket-io | price | **Third-party Platform** | Live list price `25,90 €` vs production `23,90 Euro` — genuine price drift |
| m5ugmjh | ticket-io | price | **Third-party Platform** | `49,90 €` vs `69,90 €` — tier/phase change on platform |
| yhn81xp | ticket-io | price | **Third-party Platform** | `22,00 €` vs `19,00 €` — genuine drift |
| Underland tfaixrr | official-website | description | **Importer** | Pilot extracted `Doors: 22:00` meta snippet instead of full event body |

Detail: [`docs/real-data/_phase4813_both_incorrect_analysis.json`](real-data/_phase4813_both_incorrect_analysis.json)

## LEGACY_BETTER review (249 → 69)

| Group | Count | Meaning |
|-------|-------|---------|
| **Intentionally unsupported** | 182 | Importer correctly does not own field (e.g. ticket-io title/venue/description) |
| **Future supported** | 69 | Unified importer should eventually extract this field |
| **Review required** | 4 | Stale evidence slugs (Sommerfest TK, Underland JSON-LD) |

### Future supported breakdown (69)

Predominantly **official-website** missing `venue` and `ticketUrl` on gold-standard pages where JSON-LD/OG does not surface them, plus **ticket-kings** title/venue on 8 events.

Detail: [`docs/real-data/_phase4813_legacy_better_analysis.json`](real-data/_phase4813_legacy_better_analysis.json)

## Contract gap analysis

| Capability | Contract supports? | Gap type | Module |
|------------|-------------------|----------|--------|
| HTML entity decode | Yes | importer_implementation | `official-website-pilot.ts` — **fixed in 4.8.1.3** |
| Canonical price labels | Yes | importer_implementation | `format-ticket-price.ts` |
| Stale JSON-LD offer tier | Yes | importer_implementation | `official-website-pilot.ts` |
| TK public catalog discovery | Yes | importer_implementation | `live-sample-builder.ts` |
| Multi-source merge at scale | Yes | importer_implementation | `merge-simulation.ts` |
| AI-assisted scanner | No | contract_extension_future | out of scope |

Detail: [`docs/real-data/_phase4813_contract_gap_analysis.json`](real-data/_phase4813_contract_gap_analysis.json)

## Field ownership validation

No ownership conflicts. Validated denials:

| Importer | Denied fields |
|----------|---------------|
| ticket-io | title, description, venue, lineup, genres |
| ticket-kings | checkout_url |
| nacht-manager | title, description, venue, lineup, genres, ticketUrl, consumer_cta |
| official-website | price, ticket_phases, availability, sold_out, checkout_url |

Detail: [`docs/real-data/_phase4813_field_ownership.json`](real-data/_phase4813_field_ownership.json)

## Live regression vs 4.8.1.2

- **Resolved:** 217 field comparisons
- **Unchanged semantic:** 497
- **Regressions:** 0
- **New issues:** 0

Detail: [`docs/real-data/_phase4813_live_regression.json`](real-data/_phase4813_live_regression.json)

## Shadow readiness

**Production shadow: NOT approved** (global gates: 5 BOTH_INCORRECT, 69 LEGACY_BETTER future_supported)

| Importer | Previous | Current | Blockers |
|----------|----------|---------|----------|
| official-website | READY_FOR_MORE_STAGING | READY_FOR_MORE_STAGING | 1 BOTH_INCORRECT, 61 future_supported |
| ticket-io | READY_FOR_MORE_STAGING | READY_FOR_MORE_STAGING | 4 BOTH_INCORRECT (price drift / sold-out) |
| ticket-kings | READY_FOR_MORE_STAGING | READY_FOR_MORE_STAGING | 8 future_supported |
| nacht-manager | READY_FOR_MORE_STAGING | READY_FOR_MORE_STAGING | none per-importer; blocked by global gates |

Detail: [`docs/real-data/_phase4813_shadow_readiness.json`](real-data/_phase4813_shadow_readiness.json)

## Code changes in 4.8.1.3

| File | Change |
|------|--------|
| `src/features/import/pilots/semantic-field-comparison.ts` | Semantic comparison, ownership rules, clustering |
| `src/features/import/normalization/text-normalizer.ts` | Named HTML entity decode (Ä, ö, ndash, etc.) |
| `src/features/import/pilots/official-website-pilot.ts` | `normalizeText` for description evidence |
| `scripts/operations/_phase4813-gap-analysis.ts` | Gap analysis orchestrator |
| `src/features/import/pilots/__tests__/semantic-field-comparison.test.ts` | Unit tests |

## Remaining blockers before production shadow

1. **5 BOTH_INCORRECT** — 4 genuine Ticket.io price drift/sold-out vs stale production; 1 wrong description extractor
2. **69 future_supported LEGACY_BETTER** — mostly official-website venue/ticketUrl gaps
3. **Ticket Kings corpus** — still DB-linked only, not full public catalog
4. **1 REVIEW_REQUIRED** — sold-out vs `ab 0,00 €` production placeholder
5. **4 STALE_EVIDENCE** — production canonical refresh needed (not importer fix)

## Proof of zero production mutations

Every artifact reports `productionMutationsInThisRun: 0`. Phase 4.8.1.3 performs read-only JSON reclassification — no Supabase writes, no connector changes, no scheduling changes.
