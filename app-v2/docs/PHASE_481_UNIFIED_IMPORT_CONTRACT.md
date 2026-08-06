# Phase 4.8.1 — Unified Import Contract & Parallel Connector Modernization

**Status:** Phase 4.8.1.1 acceptance contract executed — staging-only  
**Production shadow:** NOT approved (see `PHASE_4811_PILOT_COMPLETION_REPORT.md`)  
**Production mutations:** 0

## Goal

One unified Import and Evidence contract for all Sources. Legacy path remains active.
New pilot importers run in parallel against Gold Standard events — no production writes.

## Deliverables

See `docs/ARCHITECTURE_*.md` and `docs/real-data/_phase481_*.json`.

## Pilot ecosystems

1. Bootshaus official Website
2. Ticket.io
3. Ticket Kings public event pages
4. Nacht-Manager supplementary checkout only

## Gold Standard comparison summary

- **Bootshaus on a Ship Vol. III:** identical=3 newBetter=4 legacyBetter=0 blocked=3
- **LEVI:** identical=3 newBetter=4 legacyBetter=0 blocked=3
- **Underland:** identical=3 newBetter=1 legacyBetter=0 blocked=3
- **BC173:** identical=3 newBetter=4 legacyBetter=0 blocked=3
- **Sommerfest Elektroküche:** identical=6 newBetter=1 legacyBetter=0 blocked=0
- **MDMA:** identical=2 newBetter=3 legacyBetter=0 blocked=0
- **Affenkäfig:** identical=3 newBetter=4 legacyBetter=0 blocked=3
- **PROTON Stuttgart:** identical=2 newBetter=3 legacyBetter=0 blocked=0

## Identity matching

- 8 gold-standard identity matches
- Cross-event contamination issues: 0

## Legacy contract violations

- **CONNECTOR_NORMALIZED_FLAT:** ConnectorNormalizedOutput mixes fields without per-field evidence candidates
- **MERGE_IN_IMPORT_STEP:** PriorityBasedMergeStrategy runs pre-publish without unified evidence contract
- **NO_EVIDENCE_TIER:** Legacy ticket-io adapter does not distinguish list vs detail vs checkout tiers uniformly
- **TK_CHECKOUT_AS_CTA:** Historical paths could prefer Nacht-Manager URL over Ticket Kings event page
- **AUDIT_SCORE_FIRST:** Phase 4.7 audits scored projection without mandatory public ground truth fetch
- **AFFENKAEFIG_TK_ASSUMPTION:** Affenkäfig source must not imply Ticket Kings — destination host determines platform

## Connector recommendations

| Legacy connector | Recommendation |
|------------------|----------------|
| club_website (Bootshaus) | migrate after shadow validation |
| ticket-io adapter | migrate after shadow validation |
| ticket-kings adapter | migrate after shadow validation |
| Nacht-Manager enrichment | migrate as evidence tier, not primary connector |
| ImportOrchestrator (legacy adapters) | keep temporarily |
| Score-first audit scripts | replace after ground-truth harness adoption |

## Next approval required

Per-source **shadow validation sign-off** before switching production scheduling to unified-contract importers.

Do **not** onboard new external Sources until Phase 4.8.1 review is approved.
