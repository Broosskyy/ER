# Phase 4.8.1.1 — Gold-Standard Pilot Completion and Contract Acceptance

**Status:** Acceptance contract executed — **production shadow NOT approved**  
**Generated:** 2026-08-04  
**Production mutations this run:** `0`

## Executive summary

Phase 4.8.1.1 completes the eight-event gold-standard field matrix, event-specific source-role proof, schema validation, multi-source merge simulation, idempotency on captured fixtures, and per-importer readiness verdicts. The unified contract is **executable and provider-independent** in staging; duplicate multi-source ingestion is simulated without canonical Event duplication.

**Production shadow approval remains withheld** until explicit human sign-off on staging results and controlled-batch criteria (deterministic live reruns, legacy parity on all consumer-visible fields).

## Acceptance gates

| Gate | Result |
|------|--------|
| Complete 8-event field matrix (30 fields, no blank cells) | PASS |
| Zero unexplained `both_wrong` | PASS (0 unresolved) |
| Zero contract schema violations | PASS |
| Zero cross-event contamination (source-default leaks) | PASS |
| Idempotent fixture replay | PASS |
| Production shadow approved | **NO** |

## Eight-event comparison status

All eight reference Events have a **complete** field matrix (`_phase4811_complete_field_matrix.json`). No omitted cells — unsupported fields use `not_supported`, `not_public`, or `externally_blocked`.

| Event | Matrix complete | Key unified wins | Blocked / unsupported |
|-------|-----------------|------------------|------------------------|
| Bootshaus on a Ship Vol. III | yes | title, description, flyer, CTA, identity | price/availability/sold-out (list evidence + ALTCHA detail block) |
| LEVI | yes | title, description, flyer, CTA | price (bootshaus-tickets shop 0 list rows) |
| Underland | yes | title, venue, flyer, date, address, CTA (Ticket.io) | stale TK slug in JSON-LD offer — Ticket.io wins merge |
| BC173 | yes | title, description, flyer, CTA | price detail blocked; list may apply |
| Sommerfest Elektroküche | yes | title, venue, flyer, date, official URL | TK page 404 — EVENT_NOT_PRESENT_ON_ACCESSIBLE_LIST |
| MDMA | yes | title, venue, description, lineup, phases, availability | lineup is prose placeholder ("Folgt noch") |
| Affenkäfig | yes | title, description, flyer, CTA (Ticket.io) | platform = ticket.io from URL evidence |
| PROTON Stuttgart | yes | title, genres, lineup, phases, availability | GT lineup field corrupted by embed script — GROUND_TRUTH_NOT_VERIFIED |

## Unresolved `both_wrong`

**None.** All prior `both_wrong` cases resolved:

- Underland / Sommerfest title/venue/flyer → official-website pilot on affenkaefig.info
- MDMA title → HTML entity decode + JSON-LD title extraction
- MDMA lineup → artists alias maps to lineup field
- MDMA / PROTON availability → Nacht-Manager checkout admission inference
- Meta-fields (identity, ticket_platform, official_event_url) → derived from pilot architecture, not false negatives

## Source-role proof (event-specific)

See `_phase4811_source_role_proof.json`.

- **Affenkäfig:** Ticket platform = **ticket.io** (`bootshaus-club.ticket.io/B3jK8aPC/`). Not classified globally as one platform.
- **Underland:** Official site = affenkaefig.info; verified checkout = Ticket.io; JSON-LD TK offer URL is **stale** (different slug/date).
- **Bootshaus Events:** Bootshaus promoter identity does not imply Ticket.io host, venue, or price source — roles proven per surface URL.

## Contract conformance

`validateAllPilotResults`: **0 failures** (`_phase4811_contract_conformance.json`).

## Multi-source merge

Cases A/B/C simulated (`_phase4811_multi_source_merge_simulation.json`):

- **Case A (Ship):** Website + Ticket.io → CTA from Ticket.io event slug; content from bootshaus.tv
- **Case B (Affenkäfig @ Bootshaus):** Bootshaus page + Ticket.io; venue/title from official website roles
- **Case C (Sommerfest):** Affenkäfig page + TK + Nacht-Manager; checkout supplementary only

Shared venue values (Essigfabrik/Elektroküche, Bootshaus Cologne) across Events at the same physical location are **not** source-default contamination.

## Importer readiness (per importer)

| Importer | Verdict |
|----------|---------|
| Official Website (bootshaus.tv + affenkaefig.info) | READY_FOR_MORE_STAGING |
| Ticket.io | READY_FOR_MORE_STAGING |
| Ticket Kings | READY_FOR_MORE_STAGING |
| Nacht-Manager | READY_FOR_MORE_STAGING |

None: `READY_FOR_PRODUCTION_SHADOW` or `READY_FOR_CONTROLLED_BATCH`.

## Idempotency

Captured evidence fixtures (`docs/real-data/_phase4811_captured_evidence/`). Two fixture replays: **identical** semantic output (`_phase4811_idempotency.json`).

## Commands

```bash
npx tsx scripts/operations/_phase4811-pilot-completion.ts full
npx tsx scripts/operations/_phase4811-pilot-completion.ts capture-evidence
npx tsx scripts/operations/_phase4811-pilot-completion.ts complete-field-matrix
```

All commands: staging-only, production read-only.

## Next approval

1. Human review of complete field matrix JSON and multi-source merge proofs  
2. Controlled staging batch with live-source rerun (separate from fixture idempotency)  
3. Explicit production-shadow sign-off per importer — **not granted in this phase**

## Artifacts

- `docs/real-data/_phase4811_complete_field_matrix.json`
- `docs/real-data/_phase4811_source_role_proof.json`
- `docs/real-data/_phase4811_both_wrong_resolution.json`
- `docs/real-data/_phase4811_blocker_classification.json`
- `docs/real-data/_phase4811_contract_conformance.json`
- `docs/real-data/_phase4811_multi_source_merge_simulation.json`
- `docs/real-data/_phase4811_importer_capabilities.json`
- `docs/real-data/_phase4811_idempotency.json`
- `docs/real-data/_phase4811_readiness_by_importer.json`
