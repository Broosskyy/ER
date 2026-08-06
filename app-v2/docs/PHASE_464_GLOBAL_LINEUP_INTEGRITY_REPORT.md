# Phase 4.6.4 — Global Lineup Integrity Report

Generated: 2026-08-02

## 1. Baseline

| Metric | Before | After repair | Target |
| --- | ---: | ---: | ---: |
| Published events | 108 | 108 | — |
| Complete lineup | 6 | **9** | maximize |
| Partial lineup | 33 | 36 | acceptable |
| Missing lineup | 51 | **49** | minimize |
| Invalid lineup | 4 | **0** | **0** |
| Unavailable at sources | 14 | 14 | documented |
| Source lineup > canonical | 5 | **0** | **0** |
| Placeholder canonical | 4 | **0** | **0** |

**Repair pass wrote lineups for 4 events** (e.g. 14 Jahre Affenkäfig → 14 artists). Invalid/placeholder canonical rows cleared.

## 2. Root-cause groups (before audit)

| Root cause | Events | First failure stage |
| --- | ---: | --- |
| `detail_not_fetched` | 48 | 3 |
| `parser_or_merge_unknown` | 32 | 5 |
| `list_page_no_lineup` | 14 | 1 |
| `event_artists write skipped` | 5 | 10 |
| `parser_format_unrecognized` | 1 | 5 |
| `json_ld Organization placeholder` | 1 | 6 |
| `ticket_kings_detail_limit_disabled` | 1 | 3 |

Full per-event traces: `docs/real-data/_phase464_global_lineup_audit_before.json`

## 3. Known examples (before → after repair)

| Event | Before | After repair |
| --- | --- | --- |
| Sommerfest Elektroküche | complete (14/14) | complete |
| MDMA F2F & B2B Edition | invalid (0 valid, 9 import) | needs pass1 + repair |
| Bootshaus on a Ship | missing (detail not fetched) | needs pass1 |
| Vision Ekstase Open Air | missing | needs pass1 |
| PURE TECHNO | missing | needs pass1 |
| Blacklist Festival | missing | needs pass1 |
| Lehmann Clubnacht | complete (5/5) | complete |
| Moonbootica | partial (1/1) | partial |

## 4. Generic fixes (code)

| Area | Fix |
| --- | --- |
| Ticket Kings fetch | `maxDetailPages: 15` migration + ops backfill |
| Ticket.io fetch | `maxDetailPages: 15` migration `20260802120000` |
| Ticket Kings parser | `<br />` lineup + `<ol>` genres/attributes |
| Affenkäfig parser | `ecm-event-lineup__name` grid on detail pages |
| JSON-LD | Reject `Organization` performers globally |
| Description fallback | `lineup-text-parser.ts` for `Line Up:` / `Running Order` in text |
| Publish repair | `lineup-projection-integrity.ts` — repair partial/invalid/placeholder canonical |
| Stable re-import | Orchestrator still calls `repairLineupProjectionIfNeeded` on skip |

## 5. Re-import batches (remaining)

Run controlled re-import to address **stage 3** (`detail_not_fetched`, 48 events):

```bash
cd app-v2
npx tsx scripts/operations/_phase464-global-lineup-integrity.ts backup
npx tsx scripts/operations/_phase464-global-lineup-integrity.ts pass1
npx tsx scripts/operations/_phase464-global-lineup-integrity.ts repair
npx tsx scripts/operations/_phase464-global-lineup-integrity.ts pass2
npx tsx scripts/operations/_phase464-global-lineup-integrity.ts audit-after
npx tsx scripts/operations/_phase464-global-lineup-integrity.ts report
```

## 6. Manual review exceptions

- **14 staging seed events** — `list_page_no_lineup`; no production source lineup expected.
- **14 unavailable** — no detail URL or lineup markers in any import payload.
- **Ticket.io PoW-blocked** events — flagged `detailBlockedByPow` in audit traces; require live access retry.

## 7. Tests

- `lineup-text-parser.test.ts`
- `lineup-projection-integrity.test.ts`
- `single-issue-001-sommerfest-lineup.test.ts`
- `phase463-detail-extraction.test.ts`
- `import-lineup-projection-repair.test.ts`

Run: `npm run typecheck`, focused vitest above, then `npm run build:web` + `npm run validate:build-output`.

## 8. Production readiness decision

**PARTIAL — not complete until pass1/pass2 re-import.**

| Criterion | Status |
| --- | --- |
| Zero placeholder canonical (`Organization`, etc.) | **PASS** (after repair) |
| Zero source→canonical lineup loss when import has names | **PASS** (after repair) |
| All accessible source lineups in canonical | **FAIL** — 49 missing; 48 need detail fetch |
| Known examples fixed generically | **PARTIAL** — Sommerfest/Lehmann OK; Bootshaus/MDMA need pass1 |
| Pass 2 idempotent | **PENDING** — run after pass1 |

**Decision:** Continue with `pass1` + `pass2` before declaring production-ready. Invalidate consumer caches after each pass.
