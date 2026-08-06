# Phase 4.6.9.5 — Root Cause Fix Sprint Report

**Date:** 2026-08-03  
**Pass 1 mutations:** 53  
**Pass 2 mutations:** 0 (idempotent)

## Success metrics (post-repair audit)

| Metric | Before | After |
|--------|--------|-------|
| Pipeline healthy events | 42 | 49 |
| `H_TITLE_INFERENCE_PROMOTED` events | 21 | 0 |
| `G_DESCRIPTION_AS_LINEUP` events | 6 | 1 |
| Title-inference provenance in DB | >0 | 0 |
| Description garbage lineups | 1 | 0 |
| Event-specific ticket URLs | 91 | 92 |
| Shop-root ticket URLs remaining | 14 | 13 |
| `C_DETAIL_SOURCE_INACCESSIBLE` (audit class) | 21 | 38* |

\*Increase reflects reclassification: events no longer masked by wrong title-inferred lineups now surface as detail-blocked + empty.

## Reference events (after)

| Event | Lineup | Ticket URL |
|-------|--------|------------|
| MDMA | ✓ 9 entries | ✓ Ticket Kings event URL |
| Sommerfest | ✓ 14 artists | ✓ per-event URL |
| LEVI | ✓ empty (was wrong `LEVI`) | ✗ shop root (no slug in imports) |
| Into The Madness | ✓ empty | ✓ ticket.io slug |
| Bootshaus Ship III | ✓ 4×B2B | ✓ ticket.io slug |
| Bootshaus Ship IV | empty (collapsed source) | ✓ ticket.io slug |
| Vision Ekstase | empty (external block) | ✓ ticket.io slug |
| PURE TECHNO | empty (external block) | ✓ ticket.io slug |
| Blacklist | empty (was 44 garbage; 4 B2B not republished) | ✗ shop root |
| BC173 Sept | ✓ empty TBA | ✗ shop root |
| KitKatClub | ✓ empty | ✓ vault-events URL |

## Code changes (proven root causes only)

- **IMPORT:** `canRunTitleInference()` → always `false`
- **CONNECTOR_EXTRACTION:** lineup-text-parser gates; website enrichment/mapper description lineup gated; metadata overflow skip; ticket-io JSON-LD segmentation; html-strategies ticket.io slug links
- **SHOP ROOT:** `pickBestOutboundTicketLink` / `pickBestTicketUrl` deprioritize shop roots
- **EXTERNAL_BLOCKER:** `classifyExternalLineupBlocker` on ticket.io `detailEnrichment`

## Artifacts

- `docs/real-data/_phase4695_validation.json`
- `docs/real-data/_phase4695_repair_runs.json`
- `scripts/operations/_phase4695-root-cause-fix-sprint.ts`
