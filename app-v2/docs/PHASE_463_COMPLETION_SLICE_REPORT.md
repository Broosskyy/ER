# Phase 4.6.3 Completion Slice Report

Generated: 2026-08-02T16:58:00.000Z

## Recommendation: **READY_FOR_PART_4**

All five release-blocking areas are resolved or have documented truthful lifecycle outcomes. Targeted re-import pass 2 is idempotent (`createdCount = 0` across all 8 sources). Lineup projection losses are **0** after repair.

Full machine-readable artifact: `docs/real-data/_phase463_completion_slice.json`

---

## 1. Root cause — lost lineups

**Primary loss stage (code):** `resolveArtistIdsForNames` only auto-created unverified artists for ≤2 unmatched structured names. Ticket.io list payloads with 3–5 `artistNames` produced zero artist IDs → `writeImportPublishLineup` exited without writing `event_artists`.

**Secondary loss stage (ops):** Stable published re-import skipped `publishRecord` for unchanged Ticket.io sources (Lehmann, Technodampfer). Lineup writer never ran until the `repair-lineup` pass.

**Fixes:** resolver unverified create for structured lineups; orchestrator lineup repair on stable-skip; `candidateCanRepairEvent` lineup gap detection.

---

## 2. Events repaired — lineup table

| Event ID | Title | Source | Import | Before | After | Unresolved | Reason |
|---|---|---|---:|---:|---:|---|---|
| evt-1785506391332-nkworm2 | LEHMANN Schranznacht… | lehmannclub | 4 | 0 | 4 | — | stable skip + resolver cap |
| evt-1785506408508-ema5ssy | LEHMANN Clubnacht w/ ÜBERREST… | lehmannclub | 5 | 0 | 5 | — | same |
| evt-1785506410605-aqbkr1h | BOUNCE N SCHRANZ… | lehmannclub | 5 | 0 | 5 | — | same |
| evt-1785506399922-djrhhqv | LEHMANN Clubnacht w/ Len Faki… | lehmannclub | 5 | 0 | 5 | — | same |
| evt-1785506393455-qkc3qd0 | HALBWELT pres. AFEM SYKO… | lehmannclub | 4 | 0 | 4 | — | same |
| evt-1785339382025-cazpz3d | LOONYLAND pres. LUCA DANTE… | bootshaus-ticket-io | 3 | 0 | 3 | — | resolver cap (pass1 republish) |
| evt-1785506435192-azaw5p4 | TECHNO DAMPFER w/ Moonbootica | technodampfer | 1 | 0 | 1 | — | stable skip |

**Audit after repair:** `unresolvedLosses = 0` / 39 events with import lineup.

---

## 3. Structured fallback behavior

`canonical-event-projection.ts` → `resolveKnownArtistNames`: (1) canonical `event_artists`, (2) structured lineup arrays, (3) title inference, (4) empty state. `lineupCompleteness` / `resolveLineupSectionTitle` prevent false “full lineup” or unsupported headliner labels.

---

## 4. LEVI ticket URL

| Field | Value |
|---|---|
| Event | `evt-1785339383539-0lxvjlp` |
| Purchase URL | `https://bootshaus.ticket.io/` (`shop_root`) |
| Official page | `https://bootshaus.tv/events/nightswithus-presents-levi` |
| Reason | Best available destination; no fabricated Ticket.io deep link |

---

## 5. Bootshaus ticket destination audit (multi-origin sample)

| Event | Purchase URL | Official page | Quality |
|---|---|---|---|
| LOONYLAND | bootshaus-club.ticket.io/tA3dBrv7/ | bootshaus.tv | event_specific |
| Bootshaus Sommerfest | bootshaus-club.ticket.io/vB0cAmWg/ | bootshaus.tv | event_specific |
| LEVI | bootshaus.ticket.io/ | bootshaus.tv/levi | shop_root |
| PLAY! (archived) | bootshaus-club.ticket.io/gPHSUV3l/ | bootshaus.tv | event_specific |

---

## 6. Affenkäfig / Ticket Kings matching matrix

| Website | Ticket Kings | Score | Matched | Decision | Canonical ID |
|---|---|---:|---|---|---|
| Sommerfest Elektroküche | sommerfest-elektrokueche | 95 | date, venue, ticket URL | merged | evt-1785389055557-ux20897 |
| MDMA F2F & B2B | mdma-musik-die-mich-antreibt | 95 | date, venue, ticket URL | merged | evt-1785389054496-ns9b6la |
| Underland Essigfabrik | underland-essigfabrik | 95 | date, venue, ticket URL | merged (via Bootshaus canonical) | evt-1785389049895-4mb7dub |
| Affenkäfig A8 | — | — | website only | single origin | evt-1785389056612-4cwtdmo |

---

## 7. Origins merged

Affenkäfig website + Ticket Kings: Sommerfest, MDMA edition (confirmed dual `event_source_references`). Cross-URL and normalized-venue rules in `duplicate-detection-service.ts`.

---

## 8. Missing regression events

| Sample | ID | State | Action |
|---|---|---|---|
| PLAY! Open Air | evt-1785339406307-kw5r61q | archived (2026-08-01) | Legitimately past — do not republish |
| SHOCKONE | evt-1785506388701-qd8n1fh | archived (2026-07-31) | Past Proton event — use title “DNB CONNECTION pres. SHOCKONE” |
| Technodampfer | evt-1785506435192-azaw5p4 | published | Replacement: “TECHNO DAMPFER Düsseldorf w/ Moonbootica” |

---

## 9. Re-import pass 1 and pass 2

- **Pass 1:** 8 sources, `createdCount = 0`, Bootshaus Ticket.io + Affenkäfig republished
- **Pass 2:** `createdCount = 0`, idempotent
- **repair-lineup:** 6 events, 24 unverified artists created
- **repair-ticket:** no-op (LEVI already correct)

---

## 10. Canonical / origin counts

Lineup losses: 7 → **0**. Pass 2 created: **0**.

---

## 11. Live validation

Verify on `http://localhost:8081` after cache refresh: LEVI (shop root ticket), Sommerfest (dual origin), Lehmann lineup (5 artists), LOONYLAND lineup (3), Technodampfer Moonbootica, PLAY!/SHOCKONE archived cards absent from feed.

---

## 12. Tests / build

`typecheck:app` ✓ · `typecheck:operations` ✓ · focused vitest 16/16 ✓ · `build:web` ✓ · `validate:build-output` ✓

---

## 13. Remaining blockers

None within Part 4.6.3 scope. Ticket.io detail phases (PoW) remain Part 4+.

---

## 14. Recommendation

**READY_FOR_PART_4** — success criteria met: lineups truthful, LEVI destination correct, Affenkäfig high-confidence merges, regression samples documented, idempotent pass 2, no duplicate canonical events created.
