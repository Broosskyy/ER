# Phase 4.8.0 — Gold Standard Validation & Reference Dataset

**Status:** Complete (read-only)  
**Generated:** 2026-08-04T19:26:39.625Z  
**Production mutations this run:** 0

## Goal

Establish indisputable production ground truth from **public sources** for 8 permanent reference events.
Audits alone are insufficient — every field is traced through the full pipeline.

## Reference events

- Bootshaus on a Ship Vol. III (`evt-1785339420043-obhyeev`)
- LEVI (`evt-1785339383539-0lxvjlp`)
- Underland (`evt-1785389049895-4mb7dub`)
- BC173 (`evt-1785339392687-tbdwup4`)
- Sommerfest Elektroküche (`evt-1785389055557-ux20897`)
- MDMA (`evt-1785443911160-owt97y3`)
- Affenkäfig (`evt-1785339005035-wam829k`)
- PROTON Stuttgart (`evt-1785443914377-7g9l545`)

## Deliverables

| Artifact | Path |
|----------|------|
| Ground truth JSON | `docs/real-data/_phase480_ground_truth.json` |
| Pipeline trace | `docs/real-data/_phase480_pipeline_trace.json` |
| Field validation | `docs/real-data/_phase480_field_validation.json` |
| Source comparison | `docs/real-data/_phase480_source_comparison.json` |
| Connector decisions | `docs/real-data/_phase480_connector_decision.json` |
| Root cause matrix | `docs/real-data/_phase480_root_cause_matrix.json` |
| Architecture reuse matrix | `docs/ARCHITECTURE_REUSE_MATRIX.md` |
| Reuse matrix JSON | `docs/real-data/_phase480_reuse_matrix.json` |
| Ops script | `scripts/operations/_phase480-gold-standard-validation.ts` |

## Final verdict (explicit)

### 1. Event Engine reusable?

**Yes.** — merge + persistence + projection proven on gold-standard events when public evidence is extractable.

### 2–6. See `docs/ARCHITECTURE_REUSE_MATRIX.md` for full subsystem classification and reuse list.

## Special validation summaries

### Bootshaus on a Ship Vol. III

- **whySucceeds:** Multi-source merge: bootshaus.tv og metadata + bootshaus-club.ticket.io list sold-out evidence when detail ALTCHA-blocked.
- **evidenceSources:** documented in pipeline trace JSON
- **mergeDecisions:** documented in pipeline trace JSON
- **qualityFields:** documented in pipeline trace JSON

### LEVI

- **ticketUrl:** identical (—)
- **missingPrice:** identical (Public Source)
- **availability:** third_party_behaviour (—)
- **genres:** missing_public_evidence (—)
- **lineup:** identical (—)
- **altchaBlocked:** documented in pipeline trace JSON
- **listRowCount:** documented in pipeline trace JSON

### Underland

- **ticketDestination:** documented in pipeline trace JSON
- **browserRedirect:** documented in pipeline trace JSON
- **eventSpecificUrl:** documented in pipeline trace JSON
- **cacheBehaviour:** Read-only observation — no cache invalidation in this phase
- **classification:** browser_behaviour

### BC173

- **ticketIoEvidence:** documented in pipeline trace JSON
- **prices:** identical (Public Source)
- **phases:** identical (Public Source)
- **badges:** identical (Public Source)

### Sommerfest Elektroküche

- **ticketKingsCheckout:** documented in pipeline trace JSON
- **publicPage:** documented in pipeline trace JSON
- **ticketPhases:** missing_public_evidence (Public Source)
- **badges:** missing_public_evidence (Public Source)
- **provider:** incorrect (Projection)
- **genres:** missing_public_evidence (Public Source)
- **venue:** identical (Public Source)
- **lineup:** missing_public_evidence (Public Source)

### MDMA

- **ticketKingsCheckout:** documented in pipeline trace JSON
- **publicPage:** documented in pipeline trace JSON
- **ticketPhases:** incorrect (Projection)
- **badges:** identical (Public Source)
- **provider:** incorrect (Projection)
- **genres:** identical (Public Source)
- **venue:** identical (Public Source)
- **lineup:** filtered (Evidence Extraction)
- **garbageArtistPrevention:** documented in pipeline trace JSON

### Affenkäfig

- **primaryPlatform:** ticket_io
- **ticketUrl:** identical (Public Source)
- **lineup:** identical (Public Source)
- **venue:** missing_public_evidence (Public Source)
- **badges:** identical (Public Source)
- **note:** Gold-standard event uses Ticket.io (bootshaus-club), not Ticket Kings

### PROTON Stuttgart

- **ticketKingsCheckout:** documented in pipeline trace JSON
- **publicPage:** documented in pipeline trace JSON
- **ticketPhases:** incorrect (Projection)
- **badges:** identical (Public Source)
- **provider:** incorrect (Projection)
- **genres:** identical (Public Source)
- **venue:** identical (Public Source)
- **lineup:** filtered (Evidence Extraction)

## Root cause summary

Total non-identical field observations: **73**

- Public Source: 33
- Projection: 19
- Third-party platform: 13
- Browser: 1
- Canonical Merge: 3
- Evidence Extraction: 2
- Connector: 2

## Closure criteria

- [x] Every reference event has manually verified ground truth (public fetch + observation notes)
- [x] Every displayed field traced through pipeline layers
- [x] Every discrepancy has earliest root cause assigned
- [x] No production mutations (`productionMutationsInThisRun: 0`)
- [x] KEEP / KEEP WITH REFACTOR / MODERNIZE / REBUILD / REMOVE for every subsystem
- [x] Import Platform foundation identified in reuse matrix

## Next steps (blocked until review)

Do **not** begin Connector SDK, Import Platform implementation, AI Import Scanner, or new Source onboarding until this report is reviewed.
