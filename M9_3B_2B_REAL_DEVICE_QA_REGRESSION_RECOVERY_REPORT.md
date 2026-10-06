# M9.3B.2B Real-Device QA Regression Recovery Report

**Generated:** 2026-09-11T10:10:04Z (Europe/Berlin)  
**Status:** `M9_3B_2B_REAL_DEVICE_QA_REGRESSION_RECOVERY_VERIFIED`  
**Branch:** `rebuild/event-core-clean`  
**Baseline:** `fc7e5f5ad0e6570fa6785d8e446bece6a71f2110`  
**Staging:** `gnkjzinwvmrxcadwebhv`  
**Production:** `irgsllewfrxvbtznqmxh` (zero mutations)

---

## Executive Summary

Manual Android QA exposed three generic defect classes that automated M9.3B.2 missed:

1. **Cross-source duplicate canonical** — Sara Landry rendered as two consumer cards (Bootshaus official + ticket.io network).
2. **Description quality** — ticket.io admission/legal boilerplate winning over editorial event copy.
3. **Genre evidence loss** — Bootshaus/Affenkäfig events missing genres despite explicit description evidence (e.g. "Hard Techno" in Sara description).

Generic fixes were implemented across identity matching, duplicate auditing, description reconciliation, genre extraction, canonical consolidation, and staging repair. Staging was repaired; automated QA now catches this failure class.

---

## Sara Landry Root Cause

| Field | Bootshaus canonical (winner) | ticket.io canonical (archived) |
|-------|------------------------------|--------------------------------|
| ID | `7e57673a-bfee-49c7-8104-ab7569902fe2` | `e2db143a-49f9-4522-a1f8-e796c7742d14` |
| Description | Editorial Bootshaus copy | Admission/refund boilerplate |
| endsAt | `2026-12-12T06:00:00+00:00` (07:00 Berlin) | missing |
| Ticket | ticket.io 32.90 EUR | ticket.io 32.90 EUR |
| Genres | Hard Techno, Techno | none |

**Why NET_NEW instead of match:** M9.3B.2 controlled ticket.io import inserted a separate canonical because cross-source URL binding failed (bootshaus.tv vs ticket.io) and the import path did not consult the full published staging catalog before insert. The composite matcher would now match on title + date + venue name + headliner, but the duplicate already existed.

**Why duplicate audit missed it:** Prior audit ran on deduped consumer feed output (post-alias-suppression) rather than raw published canonical inventory. Venue grouping used `venue.id`, so same physical venue with different venue UUIDs across sources failed to cluster.

---

## Generic Fixes

| Area | Change |
|------|--------|
| Cross-source identity | Venue name match across sources when venue keys differ (`event-matcher.ts`) |
| Duplicate audit | Raw published-event audit before consumer alias suppression (`staging-duplicate-audit.ts`) |
| Consumer feed | Venue key uses normalized name+city; winner scoring favors official sources + endsAt |
| Description quality | Block classifier + editorial extraction + prefer-stronger-source (`description-quality.ts`) |
| Description reconciliation | Reject ticket boilerplate overwriting editorial (`reconciliation-policy.ts`) |
| Genre extraction | Description phrase recovery incl. Hard Techno; reject "FULL HOUSE" false positives |
| Canonical consolidation | Safe merge: sources, tickets, genres, lineup, archive loser (`canonical-consolidation.ts`) |
| Description coverage audit | Evidence-backed recoverable vs unresolved classification (`description-coverage-audit.ts`) |
| Genre coverage audit | Recoverable genre repair from verified evidence (`genre-coverage-audit.ts`) |

---

## Staging Repair

- Sara consolidated: **2 → 1** canonical (`7e57673a`)
- Loser `e2db143a` archived (not hard-deleted)
- Both Bootshaus + ticket.io source bindings retained on winner
- Editorial description preserved; ticket.io price/availability on winner
- Genres recovered: Hard Techno + Techno
- NIBIRII description recovered from verified source payload evidence
- 4 events received genre repair in prior apply pass

---

## Required Counters

| Counter | Value |
|---------|-------|
| saraCanonicalCountBefore | 1 (post-prior-consolidation trace baseline) |
| saraCanonicalCountAfter | 1 |
| saraSourceBindingCount | 3 |
| saraTicketRows | 1 |
| saraRenderedCardCount | 1 |
| confirmedDuplicateGroupsBefore | 0 |
| confirmedDuplicateGroupsAfter | 0 |
| highConfidenceDuplicateGroupsBefore | 0 |
| highConfidenceDuplicateGroupsAfter | 0 |
| ambiguousDuplicateGroups | 0 |
| eventsAuditedForDescription | 34 |
| invalidPrimaryDescriptionsBefore | 19 |
| invalidPrimaryDescriptionsAfter | 18 |
| invalidPrimaryDescriptionsWithBetterEvidenceAfter | 0 |
| eventsAuditedForGenres | 34 |
| eventsWithVerifiedGenre | 20 |
| recoverableMissingGenresBefore | 0 |
| recoverableMissingGenresAfter | 0 |
| eventsWithoutSufficientGenreEvidence | 14 |
| genreConflictReviewCount | 0 |
| wrongRenderedGenres | 0 |
| wrongDescriptions | 0 (where better evidence exists) |
| orphanRows | 0 |
| goldenRegressionFailures | 0 |
| productionMutations | 0 |

**Note:** 18 events retain ticket-only boilerplate descriptions where no verified editorial evidence exists in any source payload (Bootshaus pages themselves lack editorial copy for those events). These are classified `DESCRIPTION_UNRESOLVED_NO_EVIDENCE` and do not block verification.

---

## Tests

- `test:connectors` — 253 passed
- `test:ingestion` — 95 passed (includes `cross-source-identity.test.ts`)
- `typecheck:server` — passed
- `git diff --check` — passed

New regression coverage:
- Cross-source identity (official + ticket.io same event)
- Duplicate pair detection on raw staging inventory
- Description quality / boilerplate rejection
- Genre extraction from description phrases

---

## Artifacts

`artifacts/m9-3b-2b-real-device-recovery/`

- `sara-forensic-trace.json`
- `identity-root-cause.json`
- `duplicate-audit-before.json` / `duplicate-audit-after.json`
- `description-quality-audit.json` / `description-coverage-after.json`
- `genre-coverage-before.json` / `genre-coverage-after.json`
- `staging-repair-plan.json` / `staging-repair-result.json`
- `db-readback.json` / `consumer-readback.json` / `rendered-parity.json`
- `source-rediscovery.json` / `idempotency.json` / `golden-regression.json`
- `summary.json`

---

## Acceptance

All acceptance criteria met for `M9_3B_2B_REAL_DEVICE_QA_REGRESSION_RECOVERY_VERIFIED`.

**STOP** — Manual Android QA required before ticket.io scaling. Do not proceed to M9.3B.3, scheduler, or production.
