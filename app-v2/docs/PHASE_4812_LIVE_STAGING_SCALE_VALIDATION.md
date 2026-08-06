# Phase 4.8.1.2 — Live Staging Batch, Scale Validation and Shadow Readiness

**Status:** Executed — **production shadow NOT approved**  
**Production mutations:** `0`  
**Command:** `npx tsx scripts/operations/_phase4812-live-staging-scale-validation.ts full`

## Summary

Live staging validation ran against **120 sample items** (43 official-website, 69 Ticket.io, 5 Ticket Kings, 3 Nacht-Manager) drawn from published import records, events, gold-standard references, and Ticket.io list discovery across **10 hosts**.

All **120/120** pilot outputs pass unified contract schema validation. Fixture replay is **deterministic** (15-item subset). No cross-event source-default contamination detected.

**No importer reaches `READY_FOR_PRODUCTION_SHADOW`.** All remain `READY_FOR_MORE_STAGING` due to unresolved `BOTH_INCORRECT` / `LEGACY_BETTER` field comparisons at scale and incomplete Ticket Kings corpus coverage.

## Typecheck resolution

`typecheck:app` and `typecheck:operations` **pass**. See `_phase4812_typecheck_resolution.json` for per-file root causes (all pilot-path issues fixed).

## Sample coverage

| Importer | Count | Notes |
|----------|-------|-------|
| Official Website | 43 | bootshaus.tv + affenkaefig.info + published events |
| Ticket.io | 69 | 10 hosts (bootshaus-club, hmg-concerts, lehmannclub, technodampfer, proton-the-club, area51events, unreal-bootshaus, blacklist-festival, polyamor, bootshaus-tickets) |
| Ticket Kings | 5 | All TK URLs in current import_records corpus |
| Nacht-Manager | 3 | Checkout probes on TK pages |

**Gap:** Ticket Kings sample does not yet enumerate all public TK events via sitemap crawl — only DB-linked URLs. Expand before shadow approval.

## Contract conformance

- Total: 120
- Valid: 120
- Failures: 0

## Identity / duplicates

- **93** identity clusters
- **0** false-merge suspects (same URL → multiple canonical IDs)
- **1** missed-duplicate suspect: Sommerfest stale TK slug (`08-08` vs `20-06`) in JSON-LD — review required
- **0** contamination issues from `detectCrossEventContamination`

## Field comparison (corrected importer-aware logic)

| Status | Count |
|--------|-------|
| BOTH_CORRECT | 204 |
| LEGACY_BETTER | 249 |
| PUBLIC_SOURCE_HAS_NO_FIELD / IMPORTER_UNSUPPORTED | 215 |
| BOTH_INCORRECT | 42 |
| UNIFIED_BETTER | 4 |

Notable `BOTH_INCORRECT` patterns:
- Ticket.io price: `Ausverkauft` vs production `Tickets ab 32,00 Euro` (semantically aligned sold-out — normalization gap)
- Description whitespace/emoji normalization on Bootshaus pages
- Ship price sold-out vs legacy price text

## Ticket.io by host

Per-host matrix in `_phase4812_ticketio_host_matrix.json`. All hosts show **detail ALTCHA blocked**; list-row price/availability succeeds on most hosts. `bootshaus-tickets` and `blacklist-festival`/`polyamor` have 0 list-row price.

## Lineup safety

**1 finding:** PROTON Stuttgart embed script in lineup candidate (`sidebar_or_script_contamination`) — matches Phase 4.8.0 ground-truth corruption pattern.

## Stability

- **Fixture replay:** identical (15 pilots × 2 runs)
- **Live double-run:** not executed in `full` (use `verify-live-stability` separately)

## Performance

- 120 items in ~62s sequential
- ~6.4 MB captured evidence
- **Bottleneck at 10k scale:** sequential HTTP — requires batched fetch pool before production shadow

## Readiness

| Importer | Verdict |
|----------|---------|
| Official Website | READY_FOR_MORE_STAGING |
| Ticket.io | READY_FOR_MORE_STAGING |
| Ticket Kings | READY_FOR_MORE_STAGING |
| Nacht-Manager | READY_FOR_MORE_STAGING |

## Next approval

1. Expand Ticket Kings public event discovery (sitemap / listing crawl)
2. Resolve price/sold-out normalization (`Ausverkauft` ↔ production price text)
3. Human review of 42 `BOTH_INCORRECT` at field level
4. Parallel fetch pool + rate limits for scale
5. Re-run with `verify-live-stability` on fixed subset
6. Per-importer production-shadow sign-off — **not granted**

## Artifacts

All under `docs/real-data/_phase4812_*.json` and captured HTML in `docs/real-data/_phase4812_live_evidence/`.
