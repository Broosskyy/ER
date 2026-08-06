# Phase 4.8.2.1 — Controlled Batch Review

**Read-only human-review package — no production batch executed**

Generated: 2026-08-05

---

## Classification summary (56 preview proposals reviewed)

| Classification | Count |
|----------------|------:|
| FORMATTING_ONLY | 45 |
| REVIEW_REQUIRED | 9 |
| REAL_PRODUCTION_FIX | 2 |
| Elevated from field comparison | 1 |
| PUBLIC_SOURCE_HAS_NO_FIELD | 0 |
| DIFFERENT_EVENT_CONTEXT | 0 |
| IMPORTER_UNSUPPORTED | 0 |

## Final controlled batch (preview only)

| Metric | Value |
|--------|------:|
| **Final batch size** | **3** |
| Affected events | 2 |
| HIGH risk (manual approval) | 1 |
| MEDIUM risk | 2 |

### Approved REAL_PRODUCTION_FIX items

1. **Bootshaus Sommerfest** (`evt-1785339391167-tfaixrr`) — **description** (HIGH)  
   - **Before:** Underland contamination text  
   - **After:** Official Bootshaus Sommerfest page body (`Electro/EDM vs. Deep/TechHouse…`)  
   - *Elevated from shadow field comparison (missed in Phase 4.8.2 preview builder)*

2. **Bootshaus Sommerfest** — **flyer** (MEDIUM)  
   - Wrong PNG → official og:image JPEG from bootshaus.tv

3. **R3HAB pres. by BOOTSHAUS** (`evt-1785339421539-k3swcrl`) — **flyer** (MEDIUM)  
   - Stale flyer asset → current official og:image

## Excluded (45 FORMATTING_ONLY)

- All `| Bootshaus Club` og:title suffix proposals (consumer title unchanged)
- Description whitespace / `&nbsp;` / HTML entity decode-only diffs
- Same-instant dateTime ISO representation changes
- Emoji/spacing normalization without semantic change

## REVIEW_REQUIRED (9) — not in batch

- 6× dateTime / city proposals (timezone or JSON-LD location semantics)
- 3× long-form description HTML-entity decode candidates (KitKatClub, R3HAB body text)

## Rollback strategy

- Snapshot `events` rows for affected IDs before any future apply
- Per-field restore from snapshot on rollback
- No cache invalidation in this phase

## Commands

```bash
node --import tsx scripts/operations/_phase4821-controlled-batch-review.ts full
node --import tsx scripts/operations/_phase4821-controlled-batch-review.ts verify-no-write
```

## Artifacts

- `docs/real-data/_phase4821_review_package.json`
- `docs/real-data/_phase4821_real_production_fixes.json`
- `docs/real-data/_phase4821_rejected_proposals.json`
- `docs/real-data/_phase4821_batch_preview.json`

`productionMutationsInThisRun: 0`
