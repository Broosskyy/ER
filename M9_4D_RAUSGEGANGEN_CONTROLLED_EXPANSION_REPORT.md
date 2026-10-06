# M9.4D — Controlled High-Coverage Rausgegangen Expansion Import

Generated: 2026-09-17  
Branch: `rebuild/event-core-clean` @ `6cc4f873cf7a77cc589cb0d5e6adc1d66d3e0ab1`  
Staging: `gnkjzinwvmrxcadwebhv`  
Production: `irgsllewfrxvbtznqmxh` (0 mutations)  
Status: **M9_4D_RAUSGEGANGEN_CONTROLLED_HIGH_COVERAGE_EXPANSION_VERIFIED**

---

## Relevance / Quality Reconciliation

| Metric | Value |
|--------|-------|
| quality-ready pool | 5,614 |
| qualityReady HIGH | 464 |
| qualityReady LIKELY | 9 |
| qualityReady AMBIGUOUS | 81 |
| qualityReady IRRELEVANT | 5,060 |
| **True ImportEligibility pool** | **473** |

Root cause: `passesQualityContract` ≠ import eligibility. New `ImportEligibility` requires HIGH/LIKELY + ELECTRONIC domain + quality contract.

---

## Frozen cohort (40, no replacements)

| Outcome | Prewrite count |
|---------|----------------|
| ELIGIBLE_NEW | 27 |
| ELIGIBLE_EXISTING_MATCH | 9 |
| BLOCKED_MEDIA | 2 |
| BLOCKED_OTHER (lifecycle) | 2 |
| **Proceed** | **36 / 40** |

Blocked (not replaced): Afterwork Deepdive IV, Dominext Kinky-Psytrance Party (media); Giddens @Hard Rock Cafe, FLUCHTGEFAHR Escape-Room (lifecycle ended).

---

## Staging apply (actual)

**Target verified:** `gnkjzinwvmrxcadwebhv` only. Production untouched.

### First apply

| Write | Count |
|-------|-------|
| eventInserts | 27 |
| eventUpdates | 2 |
| sourceBindingWrites | 30 |
| lineupWrites | 12 |
| genreWrites | 42 |
| descriptionWrites | 0 |
| mediaWrites | 0 |
| ticketInserts | 0 |
| ticketUpdates | 0 |
| canonicalCreated | 27 |
| canonicalMatched | 3 |
| canonicalEnriched | 2 |

### Repair apply (structured description leakage)

| Write | Count |
|-------|-------|
| eventUpdates | 1 |
| descriptionWrites | 1 |
| canonicalEnriched | 1 |

**Repaired:** Frame Sommer Closing (`8633bcf2-4172-424d-842d-6c027f8de19a`) — `repair_structured_description_leakage` via reconciliation policy.

### Combined manifest totals

| Write | Total |
|-------|-------|
| eventInserts | 27 |
| eventUpdates | 3 |
| sourceBindingWrites | 30 |
| lineupWrites | 12 |
| genreWrites | 42 |
| descriptionWrites | 1 |

---

## Existing matches (9)

All 9 prewrite existing matches reconciled without duplicate canonical creation:

| Title | Canonical ID | Result |
|-------|--------------|--------|
| Utopian Summer | 8e941ad1-5c30-46d2-b85d-0e77bbd3a336 | noop / binding preserved |
| Bootshaus Sommerfest Closing | 2f72a4f7-2efd-4d6c-b269-31cd330f5a00 | noop |
| SARA LANDRY pres. by BOOTSHAUS | 339c811c-ce1f-44f0-9c38-2fe212a63878 | noop |
| Weiberfastnacht im Bootshaus | e36a5e6b-f079-436c-a546-af479ee80e06 | noop |
| A TECHNO BALLET ODYSSEY | 546d7369-0d9d-4251-9882-4dfed910b926 | noop |
| ELECTRIC LIGHTS | caf57fa9-b061-4e3f-810d-b5c9b395e1c9 | noop |
| Wintergarden Halloween | c354451b-7f96-452f-9569-655c814d5c77 | noop |
| KYTES (Erfurt) | deda385d-a477-474d-9b4d-fa1ac728ee65 | noop |
| Electronic Garden of Love | 79bda680-e106-4019-968f-7105f0949700 | noop |

Post-apply all 36 cohort proceed targets bind as `ELIGIBLE_EXISTING_MATCH` (expected identity migration).

---

## Post-apply recertification

| Gate | Result |
|------|--------|
| highConfidenceDuplicateGroups | 0 |
| affectedStructuredDescriptionLeakage | 0 |
| recoverableLineups | 0 |
| recoverableExplicitGenreMissing | 0 |
| wrongGenreAssignments | 0 |
| genrePresenceCoverage | 95.0% |
| explicitGenreEvidenceParity | 100% |
| knownWrongEventMedia | 0 |
| unsafeTicketTargets | 0 |
| wrongEventTicketTargets | 0 |
| consumerParityFailures | 0 |
| searchFalseNegatives | 0 |
| pastRenderedCards | 0 |
| goldenRegressionIssues | 0 |

**Note:** Global `structuredDescriptionLeakage = 1` on one pre-existing non-M9.4D staging canonical; all **affected** M9.4D canonicals pass.

---

## Existing genre gaps (generic architecture)

| Title | Evidence | Resolution |
|-------|----------|------------|
| NOSTALGIA • MEGA 90er RAVE \| Dresden | `GENRE_UNRESOLVED_NO_EVIDENCE`; layers exhausted | Left unresolved |
| COFFEE PARTY RAVE | `GENRE_UNRESOLVED_NO_EVIDENCE`; layers exhausted | Left unresolved |

No hardcoded title overrides applied.

---

## Idempotency (second identical run)

| Write | Second run |
|-------|------------|
| eventInserts | 0 |
| eventUpdates | 0 |
| sourceBindingWrites | 0 |
| lineupWrites | 0 |
| genreWrites | 0 |
| descriptionWrites | 0 |
| mediaWrites | 0 |
| ticketInserts | 0 |
| ticketUpdates | 0 |

`structurallyIdempotent: true`

---

## Consumer / runtime QA

| Check | Status |
|-------|--------|
| Consumer read model parity | PASS (0 failures) |
| Automated consumer runtime | PASS (staging readback path) |
| REAL_ANDROID | PENDING_USER_VERIFICATION |
| AUTOMATED_RUNTIME | SKIPPED_ENVIRONMENT |

Manual Android QA pack: `artifacts/m9-4d-rausgegangen-controlled-expansion/manual-android-qa-pack.json` (14 cases).

---

## ImportEligibility regression

Permanent contract preserved:

- `qualityReady + IRRELEVANT` → NOT import eligible
- `qualityReady + AMBIGUOUS` → NOT automatically import eligible
- `HIGH/LIKELY + ELECTRONIC + Quality Contract` → may be eligible

7/7 tests passing in `import-eligibility.test.ts`.

---

## Artifacts

`artifacts/m9-4d-rausgegangen-controlled-expansion/` — apply-manifest, staging-readback, affected-canonicals, duplicate-audit, global-inventory-recertification, consumer-parity, idempotency, manual-android-qa-pack, summary.json.

---

## STOP boundary

M9.4D complete. Do **not** import remaining 473-event pool, enable scheduler, or start M9.4E without explicit user direction.
