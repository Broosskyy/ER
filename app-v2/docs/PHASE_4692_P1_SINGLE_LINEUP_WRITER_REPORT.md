# Phase 4.6.9.2 — P1 Single Structured Lineup Writer Report

Generated: 2026-08-03T08:16:11.737Z

## Architecture outcome

- **Authoritative writer:** `writeCanonicalStructuredLineup` in `canonical-structured-lineup-writer.ts`
- **Candidate producers:** import structured writer, title inference candidate module
- **Flat `event_artists`:** derived only via `buildCompatibilityProjectionFromStructured`
- **Title inference:** last-resort SOLO candidates, `partial` completeness, `title_inferred_only` provenance

## Acceptance metrics

- Authoritative structured writers: **1** (target 1)
- Independent event_artists writers: **0** (target 0)
- Preflight structured/legacy mismatches: **1**
- Post-repair representative mismatches: **0**
- Total repair mutations: **0**
- Final pass idempotent: **YES**

## Representative validation

- sommerfest14Structured: **PASS**
- mdma9Entries18Artists: **PASS**
- intoTheMadnessEmpty: **PASS**
- kitkatNoLineup: **PASS**
- bootshausOnShipStructured: **PASS**

## Repair runs

1. **repair-mismatches** — 0 mutations
2. **repair-mismatches** — 0 mutations

## Oscillation validation

- Can normal import undo a repair? **No**
- Can repair create state the next import removes? **No**
- Exactly one authoritative writer? **Yes** (`writeCanonicalStructuredLineup`)

## 9 mismatch event classification

| Event | Classification | Action |
|-------|----------------|--------|
| LOONYLAND | projection_stale | Already aligned (structured truth kept) |
| Bootshaus Sommerfest | flat_fallback_only | Blocked — no structured evidence |
| Bootshaus on a Ship IV | flat_fallback_only | Blocked — prose-only API artifact |
| BC173 Airport Session | flat_fallback_only | Blocked — no structured evidence |
| Sommerfest Closing | flat_fallback_only | Blocked — no structured evidence |
| Blacklist Festival | projection_stale | Already aligned |
| CHROME COLOGNE | flat_fallback_only | Blocked — no structured evidence |
| AFFENKÄFIG RULES | flat_fallback_only | Blocked — no structured evidence |
| MDMA Proton Stuttgart | flat_fallback_only | Blocked — no structured evidence |

## Remaining blockers

- Events with API-only prose in `primary_artist_id` projection require separate cleanup (not lineup tables)
- `structured_wrong_legacy_correct` mismatches need evidence-backed structured repair (not auto-invented)
- P2 flyer reconciliation not started in this phase
