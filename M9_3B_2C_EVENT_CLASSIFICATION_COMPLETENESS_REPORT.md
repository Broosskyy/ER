# M9.3B.2C Event Classification & Completeness Report

**Generated:** 2026-09-11T17:33:23Z  
**Status:** `M9_3B_2C_EVENT_CLASSIFICATION_COMPLETENESS_REVIEW_REQUIRED`  
**Branch:** `rebuild/event-core-clean`  
**Baseline:** `dfec9cf187eeaecaa60807996d95e5efb00d0032`  
**Staging:** `gnkjzinwvmrxcadwebhv` (mutations via `--apply` only — not run in this commit)  
**Production:** `irgsllewfrxvbtznqmxh` (zero mutations)

---

## Summary

M9.3B.2C establishes a **generic event classification and completeness foundation**:

- Canonical **genre taxonomy** with parent/child search expansion (`genre-taxonomy.ts`)
- **Evidence-backed genre exhaustion** across source payloads, descriptions, structured metadata, and lineup-derived artist cache (`genre-evidence.ts`)
- **Lineup completeness audit** with `Folgt`/placeholder rejection (`lineup-coverage-audit.ts`)
- **Ticket target/price/status audit** (`ticket-coverage-audit.ts`)
- **Unified field completeness matrix** (`event-completeness-audit.ts`)
- **Search recall simulation** for Techno/Hard Techno/House/Tech House (`genre-search-recall.ts`)
- **Bootshaus official-page genre recovery** path for staging repair (`bootshaus-genre-recovery.ts`)
- Orchestrator: `app-v2/scripts/run-m9-3b-2c-event-classification-completeness.ts`

Working tree forensics preserved unrelated prior work — see `artifacts/m9-3b-2c-event-classification-completeness/working-tree-audit.json`.

---

## Staging Inventory (dry-run)

| Metric | Value |
|--------|-------|
| eligibleEventCount | 34 |
| eventsWithGenre | 22 (64.7%) |
| genreRecoverable | 0 |
| genreUnresolvedAfterEvidenceExhaustion | 12 |
| completeLineups | 15 |
| recoverableLineups | 0 |
| invalidPlaceholderLineups | 2 |
| verifiedTicketTargets | 28 |
| duplicateGroups | 0 |
| saraRenderedCardCount | 1 |
| goldenRegressionFailures | 0 |
| productionMutations | 0 |

Search recall false negatives (recoverable): **0** for Techno, Hard Techno, House, Tech House.

---

## Manual QA Anchors

| Event | Genre | Lineup | Notes |
|-------|-------|--------|-------|
| Deborah de Luca | Unresolved | Partial (headliner only) | No description/structured genre; bootshaus refetch candidate |
| Chris Stussy | Unresolved | Partial | Editorial description lacks explicit genre phrase |
| KitKatClub (30.12) | Unresolved | Not announced | No lineup/genre evidence in sources |
| MDMA | Unresolved | Complete | TicketKings event; no genre evidence in sources |
| 14 Jahre Affenkäfig | Unresolved | Complete (13 acts) | No genre evidence after exhaustion |
| Bootshaus on a Ship | Unresolved | Complete | Lineup present; genre not in evidence |
| Affenkäfig CAPITOL Hagen | Unresolved | `Folgt` placeholder | No structured lineup in source payloads; flyer OCR not used |

---

## Affenkäfig CAPITOL — Lineup Root Cause

Consumer shows `Folgt` because canonical `event_lineup` contains only the placeholder. Source payload audit found **no machine-readable lineup candidates** in `event_sources.raw_payload`. Without trustworthy structured/text evidence, lineup remains `LINEUP_NOT_ANNOUNCED` rather than OCR-hallucinated names from flyer media.

---

## Why REVIEW_REQUIRED

1. **Staging `--apply` not executed** — Bootshaus live genre recovery and any remaining recoverable repairs require `npx tsx scripts/run-m9-3b-2c-event-classification-completeness.ts --apply`
2. **12 events** remain `GENRE_UNRESOLVED_NO_EVIDENCE` after evidence exhaustion (not inflated with fake `Electronic` fallback)
3. **2 placeholder lineups** remain where no recoverable structured evidence exists
4. **Consumer parity check** updated to scope discoverable feed only; re-run orchestrator after final code changes

---

## Tests

- `test:connectors` — 259 passed (incl. genre taxonomy, search recall, lineup placeholders)
- `test:ingestion` — 95 passed
- `typecheck:server` — passed

---

## Artifacts

`artifacts/m9-3b-2c-event-classification-completeness/`

---

## Next Steps (manual)

1. Run orchestrator with `--apply` on staging for Bootshaus genre recovery
2. Re-run dry-run; target `M9_3B_2C_EVENT_CLASSIFICATION_COMPLETENESS_VERIFIED`
3. Manual Android QA before ticket.io scaling

**STOP** — Do not proceed to M9.3B.3 or production.
