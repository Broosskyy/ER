# Phase 4.7.4.2 — Closure Correction Report

Generated: 2026-08-03T20:51:00.000Z

## Executive summary

Phase 4.7.4.2 formal closure blockers are resolved:

1. **Palma/JUNO shop-root availability** — unsupported `on_sale` from shop-level JSON-LD reverted on all 6 shop-root events; canonical availability restored to `unknown` with provenance reason `shop_level_signal_not_event_specific`.
2. **Ticket Kings admission prices** — fresh checkout evidence confirms all 4 published Ticket Kings events; no admission price repairs required (Flex Option and discount controls excluded).
3. **Nacht-Manager purchase URL integrity** — root cause identified: URL normalization stripped required query parameters from embedded checkout URLs, producing broken bare `native_event.php` CTAs. Classification fix preserves parameters; embedded checkouts validate as `valid_embedded_checkout`.

## Palma/JUNO shop-root availability

| Event | Event-specific evidence | Action |
|---|---|---|
| 122 pres. TRIPOLISM @ Palma | No | Reverted `on_sale` → `unknown` |
| 122 pres. MARTEN LOU @ Palma | No | Reverted `on_sale` → `unknown` |
| 122 pres. NOTRE DAME @ Palma | No | Reverted `on_sale` → `unknown` |
| 122 pres. MAXI MERAKI @ Palma | No | Reverted `on_sale` → `unknown` |
| 122 pres. KAZ JAMES @ Palma | No | Reverted `on_sale` → `unknown` |
| 122 pres. JUNO @ Palma | No | Reverted `on_sale` → `unknown` |

Shop-level signals only: `list_json_ld`, `list_overview_row` on `https://bootshaus.ticket.io/` without event slug or list-row identity match.

## Ticket Kings admission verification (4 published events)

| Event | Fresh admission price | Gate C1 price | Change explanation |
|---|---|---|---|
| MDMA 10.10.26 | ab 15,00 € (Early Bird) | ab 2,50 € | Gate C1 corrected Flex Option leak; current price is admission Early Bird |
| MDMA F2F & B2B Edition | ab 20,00 € (Phase 1) | ab 2,50 € | Same Gate C1 correction; Phase 1 admission |
| MDMA PROTON Stuttgart | ab 15,00 € (Early Bird) | ab 2,50 € | Same Gate C1 correction |
| Sommerfest Elektroküche | ab 15,00 € (Phase 3) | ab 2,50 € | Same Gate C1 correction |

**Note:** Phase 4.7.4.2 consumer report cited Sommerfest `ab 11,90 €`, MDMA `ab 34,90 €`, Affenkäfig `ab 19,90 €` — those events are **not** in the published Ticket Kings set (4 events). Fresh evidence for the 4 published Ticket Kings events matches persisted prices; no repair needed.

Excluded from all summaries: Ticket Flex Option (2,50 €), Rabattcode controls, add-on checkboxes.

## Ticket Kings URL integrity

| Metric | Count |
|---|---:|
| Published Ticket Kings events audited | 4 |
| Valid checkout/embed destinations | 4 |
| Broken bare `native_event.php` CTAs (before fix) | 4 |
| Repaired via classification (query param preservation) | 4 |
| Fallback to official Ticket Kings event page required | 0 |

**Root cause:** `classifyTicketUrl` normalization stripped `?id=` and embed parameters from phase `purchaseUrl` values, causing canonical reader to emit bare `https://nacht-manager.de/ticketing/native_event.php` as public CTA.

**Fix:** `ticket-destination-classification.ts` now classifies Nacht-Manager URLs via `ticket-kings-checkout-url-integrity.ts`, rejects bare endpoints as `invalid`, and preserves full query strings on valid embedded checkouts.

## Repair execution

| Pass | Mutations |
|---|---:|
| Pass 1 | 5 (Palma availability revert) |
| Pass 2 | 0 (idempotent) |

Forbidden-domain fingerprints unchanged. Consumer projection issues: **0**.

## Code changes

- `ticket-io-shop-availability-evidence.ts` — event-specific vs shop-level availability audit
- `ticket-kings-checkout-url-integrity.ts` — Nacht-Manager URL classification and validation
- `ticket-destination-classification.ts` — preserve checkout query parameters; reject bare endpoints
- `_phase4742-closure-correction.ts` — audit, backup, repair, verify ops script
- `phase4742-closure-correction.test.ts` — regression tests

## Artifacts

- `docs/real-data/_phase4742_palma_availability_correction.json`
- `docs/real-data/_phase4742_ticketkings_admission_audit.json`
- `docs/real-data/_phase4742_ticketkings_url_integrity.json`
- `docs/real-data/_phase4742_ticketkings_end_to_end_traces.json`
- `docs/real-data/_phase4742_closure_repair_backup.json`
- `docs/real-data/_phase4742_closure_repair_runs.json`
- `docs/real-data/_phase4742_closure_before_after.json`

## Closure verdict

**Phase 4.7.4.2 is formally complete** when this report and pass-2 idempotency are accepted:

- No shop-level availability without event-specific identity
- All Ticket Kings prices match fresh admission products
- Add-ons excluded from canonical summary
- CTAs reach valid embedded checkout (full parameters) or Ticket Kings event page
- No bare `native_event.php` treated as valid
- Pass 2: 0 mutations
- Consumer projection aligned
- No unrelated production data changes
