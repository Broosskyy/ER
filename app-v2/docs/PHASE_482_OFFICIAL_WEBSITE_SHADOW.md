# Phase 4.8.2 — Official Website Production Shadow

**Importer:** `official-website` @ `phase4814-official-website`  
**Sources:** Bootshaus.tv, Affenkäfig.info  
**Scope:** 43 events from Phase 4.8.1.4 staging sample  
**Mode:** Read-only shadow — **no production writes**

Generated: 2026-08-05

---

## Executive summary

| Item | Result |
|------|--------|
| Shadow verdict | **MORE_SHADOW_REQUIRED** |
| `productionMutationsInThisRun` | **0** |
| Events observed | **43** (43 unique canonical IDs) |
| Observations | **3** (replay-seeded from Phase 4.8.1.2 captured HTML + deterministic replay validation) |
| Identity collisions | **0** |
| Cross-event contamination | **0** |
| Deterministic replay | **Pass** (semantic field hash stable across replay) |
| Controlled-batch proposals | **56** (preview only, `execute: false`) |

**Important:** This run used `full-replay` (cached public HTML from `_phase4812_live_evidence`). A **live** `full` run (two separated live recaptures + final replay) is still required to close the 72-hour observation window.

---

## No-write enforcement

- `shadow-no-write-guard.ts` — write methods on wrapped Supabase client throw `ShadowWriteBlockedError`
- Deliberate `insert(events)` attempt blocked in `verify-no-write`
- No event/import/origin/review/scheduler mutations invoked
- `productionMutationsInThisRun: 0` in all artifacts

---

## Field comparison totals (602 field-rows = 43 events × 14 claimed fields)

| Status | Count |
|--------|------:|
| PUBLIC_SOURCE_HAS_NO_FIELD | 209 |
| LEGACY_BETTER | 149 |
| BOTH_MATCH_PUBLIC_TRUTH | 90 |
| UNIFIED_MATCHES_PUBLIC_TRUTH | 57 |
| UNIFIED_BETTER | 56 |
| BOTH_INCORRECT | 35 |
| LEGACY_MATCHES_PUBLIC_TRUTH | 6 |

**Blockers for preview approval:** 35 `BOTH_INCORRECT`, 149 `LEGACY_BETTER` (many are classification candidates — e.g. legacy JSON-LD venue/date retained when public page lacks explicit body evidence; organizer on Bootshaus pages without explicit public promoter field).

---

## Required visible traces

### Ship genre (`evt-1785339420043-obhyeev`)

| Stage | Value |
|-------|-------|
| Public Source | **No genre tags** in page HTML (`.genres-container` absent/empty) |
| Unified importer | **Not extracted** |
| Canonical DB | **Empty** |
| API projection | `[]` |

**First divergence:** aligned — public page genuinely lacks genre evidence. Prior “missing genre” is **not** recoverable from current Bootshaus Ship page HTML.

### Bootshaus Sommerfest description (`evt-1785339391167-tfaixrr`)

| Stage | Value |
|-------|-------|
| Public Source (bootshaus.tv) | `Electro/EDM vs. Deep/TechHouse vs. Techno vs. DnB/Trap/Dubstep Lineup TBA` |
| Unified importer | Same (normalized whitespace) |
| Canonical DB | **Contaminated Underland text** (stale wrong event body) |
| API projection | Same contaminated Underland text |

**Verdict:** Unified matches **official Bootshaus Sommerfest** public truth. Production canonical is **stale/wrong** — safe future correction candidate (consumer-visible).

### Affenkäfig @ Bootshaus (`evt-1785339005035-wam829k`)

- Bootshaus.tv page: venue evidence via legacy/canonical (`Bootshaus`), description from official page
- Import records: `source-bootshaus-koeln` (website) + `source-bootshaus-ticket-io` (tickets) — **no role inversion**
- Unified does **not** set Affenkäfig as venue or Bootshaus as organizer automatically

### Underland (`evt-1785389049895-4mb7dub`)

- Affenkäfig public body: empty → unified correctly **does not fabricate** description
- Ticket.io destination remains on separate import record (not overwritten by website shadow)

---

## Consumer-visible controlled-batch preview (sample)

| Event | Field | Current → Proposed | Reason |
|-------|-------|-------------------|--------|
| Bootshaus Sommerfest | description | Underland text → official Sommerfest lineup text | Unified matches bootshaus.tv public truth |
| Bootshaus on a Ship Vol. III | description | Legacy spacing/HTML entities → normalized body text | Unified matches public page |
| Multiple Bootshaus events | title | Strip/normalize `\| Bootshaus Club` suffix handling | Unified matches og:title public truth |

Full proposal list: `_phase482_controlled_batch_preview.json` (56 items, all `execute: false`).

---

## Commands

```bash
# No-write proof
node --import tsx scripts/operations/_phase482-official-website-shadow.ts verify-no-write

# Live shadow (required to close observation window)
node --import tsx scripts/operations/_phase482-official-website-shadow.ts full

# Replay from Phase 4.8.1.2 captured HTML (analysis only)
node --import tsx scripts/operations/_phase482-official-website-shadow.ts full-replay
```

---

## Next approval required

1. **Live shadow completion** — run `full` with two separated live recaptures (≤30 req/min)
2. **Classification pass** — reclassify formatting-only / JSON-LD-legacy `LEGACY_BETTER` rows
3. **Human approval** of `_phase482_controlled_batch_preview.json` before any controlled production batch

**Do not** activate scheduling or replace legacy importer in this phase.

---

## Artifacts

- `docs/real-data/_phase482_shadow_scope.json`
- `docs/real-data/_phase482_shadow_runs.json`
- `docs/real-data/_phase482_live_evidence_manifest.json`
- `docs/real-data/_phase482_identity_validation.json`
- `docs/real-data/_phase482_multi_source_validation.json`
- `docs/real-data/_phase482_field_comparison.json`
- `docs/real-data/_phase482_visible_problem_traces.json`
- `docs/real-data/_phase482_shadow_stability.json`
- `docs/real-data/_phase482_performance.json`
- `docs/real-data/_phase482_controlled_batch_preview.json`
- `docs/real-data/_phase482_shadow_verdict.json`
