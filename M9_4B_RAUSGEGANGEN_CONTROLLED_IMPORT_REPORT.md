# M9.4B Rausgegangen Controlled Staging Import Report

Generated: 2026-09-16T11:07:30.077Z (Europe/Berlin)  
Branch: `rebuild/event-core-clean`  
Status: **M9_4B_RAUSGEGANGEN_CONTROLLED_STAGING_IMPORT_VERIFIED**

## 1. Git baseline

| Check | Value |
|---|---|
| M9.4A commit | `92ab897f356d0c602cf46651e2e797cb7a121685` |
| Test-fix commit | `409fe93970b6d93b6fa62fe6d72208a63fd0ff2b` |
| Local HEAD (pre-B.4 commit) | `409fe93970b6d93b6fa62fe6d72208a63fd0ff2b` |
| Remote HEAD | `409fe93970b6d93b6fa62fe6d72208a63fd0ff2b` |
| local == remote | true |

Uncommitted M9.4A test fix was committed separately as `test(sources): stabilize Rausgegangen discovery qualification`.

## 2. M9.4A test-fix disposition

**Category A** — legitimate M9.4A correction (`categoryHints` no longer scrape global nav). Committed and pushed before B.4.

## 3. Metric reconciliation (181 vs 195)

**Root cause:** different denominators and filters.

- `netNewRelevant` (181): detail-enriched **upcoming**, relevance **HIGH/LIKELY**, identity **NET_NEW**
- `qualityReady` (195, old): all detail-enriched, **no relevance filter**, domain ELECTRONIC + quality contract + NET_NEW

AMBIGUOUS events with strong_positive genre hits could pass domain `ELECTRONIC_MEDIUM` and quality contract while excluded from netNewRelevant.

**Fix:** reporting in `run-m9-4a-rausgegangen-germany-discovery.ts` now aligns qualityReady with upcoming NET_NEW + HIGH/LIKELY relevance.

Artifact: `artifacts/m9-4b-rausgegangen-controlled-import/m9-4a-metric-reconciliation.json`

## 4. False-positive relevance root cause

- Weak `rave`/`house` signals without core genre evidence
- Missing STRONG_NEGATIVE patterns for flea market, workshop, seller recruitment
- Conflict resolution treated spurious `house` hints as overriding definitive culture negatives

**Fixes (generic):**
- Added STRONG_NEGATIVE patterns: `flea_market`, `market_seller`, `workshop`, `exhibition`, `food`, `film`, etc.
- Added `definitive_non_electronic_override` when definitive culture negative without unambiguous electronic genre (techno/trance/…)

## 5. Original 15 candidates

Frozen from `artifacts/m9-4a-rausgegangen-germany-discovery/proposed-m9-4b-batch.json` — no replacements.

## 6. Live revalidation

All 15 candidates live-fetched from Rausgegangen (no M9.4A cache-only).  
`liveRevalidated: 15`

## 7. Rejected / blocked candidates (6)

| Title | State | Reason |
|---|---|---|
| Verkäufer werden beim Vintage Flohmarkt… | BLOCKED_RELEVANCE | flea market / seller recruitment |
| Vintage Flohmarkt | BLOCKED_RELEVANCE | flea market |
| SONG-WRITING SESSION | BLOCKED_RELEVANCE | workshop |
| SPRUNGBRETT 2026 Liveshow… | BLOCKED_RELEVANCE | liveshow / non-electronic |
| Afterwork Deepdive IV | BLOCKED_MEDIA | stock/workbook graphic |
| Henge – Galaktischer Rave | BLOCKED_MEDIA | no acceptable event media |

## 8. Identity / dedup

- **NET_NEW imported:** 8
- **EXISTING match (enriched binding):** 1 (COFFEE PARTY RAVE from first apply pass)
- **highConfidenceDuplicateGroups:** 0

## 9–13. Content gates

| Gate | Result |
|---|---|
| structuredDescriptionLeakage (imported) | 0 |
| recoverableLineups (imported) | 0 |
| explicitGenreEvidenceParity | 100% |
| recoverableExplicitGenreMissing | 0 |
| wrongEventTicketTargets | 0 |
| unsafeTicketTargets | 0 |
| knownWrongEventMedia (imported) | 0 |
| qualityContractBypass | 0 |

## 14. Quality Contract

All 9 applied candidates passed NEW_EVENT_QUALITY_CONTRACT at prewrite. No bypass.

## 15. Exact writes (final apply)

```
eventInserts: 8
eventUpdates: 0
lineupWrites: 1
genreWrites: 11
sourceBindingWrites: 8
ticketInserts: 0
ticketUpdates: 0
canonicalCreated: 8
canonicalMatched: 0 (1 READY_EXISTING_MATCH reconciled idempotently)
```

## 16–18. Readback / parity

- Canonical readback: 9/9 applied keys present
- consumerParityFailures: 0
- field-source-parity: no unresolved mismatches on core fields

## 19. Search / filter

recoverableSearchFalseNegatives: 0 (tested affected cases)

## 20. Global inventory recertification

| Metric | Value | Gate |
|---|---|---|
| genrePresenceCoverage | 96.2% | ≥95% ✓ |
| explicitGenreEvidenceParity | 100% | ✓ |
| recoverableExplicitGenreMissing | 0 | ✓ |
| publishedDescriptionStructuredLeakage | 0 | ✓ |
| recoverableLineups | 0 | ✓ |
| highConfidenceDuplicateGroups | 0 | ✓ |
| pastRenderedCards | 0 | ✓ |

## 21. Second-run idempotency

`structurallyIdempotent: true` — all structural writes 0 on identical re-run.

## 22. Mobile QA

`mobileQa: SKIPPED_ENVIRONMENT` — canonical + consumer read-model assertions passed.

## 23. Manual Android QA pack

`artifacts/m9-4b-rausgegangen-controlled-import/manual-android-qa-pack.json`  
**manualAndroidQaRequired: true**

## 24–25. Safety

| Environment | Project | Mutations |
|---|---|---|
| Staging | gnkjzinwvmrxcadwebhv | 9 events (first controlled batch) |
| Production | irgsllewfrxvbtznqmxh | **0** |

Scheduler: NOT enabled. Bulk import: NOT started.

## 26. Remaining limitations

- Stratified M9.4A sample, not full Germany enumeration
- Rausgegangen lineup structure weaker than ticket.io
- 2 candidates blocked on media (workbook/stock imagery)
- 4 culture false-positives correctly blocked; liveshow edge case remains conservative
- Manual Android QA authoritative before expansion

## Imported event titles (9)

1. Utopian Summer
2. FIVE 2 NINE - 001 HOUSE-BOOT
3. Frame Sommer Closing
4. FRIENDS HOUSE
5. TRANCE STATION
6. COFFEE PARTY RAVE (existing match)
7. KYTES /// Indie Rave Tour 2026 & 2027
8. Techno Dampfer Düsseldorf w/ Klaudia Gawlas
9. NOSTALGIA • MEGA 90er RAVE | Dresden - 19.09.

Artifacts: `artifacts/m9-4b-rausgegangen-controlled-import/`
