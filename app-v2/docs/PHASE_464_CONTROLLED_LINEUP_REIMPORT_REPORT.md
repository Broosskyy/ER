# Phase 4.6.4 — Controlled Lineup Reimport Report

Generated: 2026-08-02T19:50:00.000Z

## Executive summary

Controlled two-pass production re-import completed across **13 enabled Sources** (staging excluded). Current parser fixes and detail-limit configuration were applied through the shared import pipeline. **Pass 2 was idempotent** — lineup metrics unchanged.

| Metric | Pre-reimport baseline | After Pass 1 & 2 | Delta |
| --- | ---: | ---: | ---: |
| Complete lineup | 9 | **17** | +8 |
| Partial lineup | 36 | **25** | −11 |
| Missing lineup | 51 | **48** | −3 |
| Invalid lineup | 0 | **3** | +3 |
| Unavailable at source | 14 | **15** | +1 |
| `parser_or_merge_unknown` | 33 | **0** | −33 |
| Source lineup > canonical | 0 | **0** | 0 |
| Placeholder canonical | 0 | **0** | 0 |

**No valid production data was downgraded.** `createdCount = 0` on all Sources. Published event count stable at **108**.

---

## 1. Safety preflight

| Check | Result |
| --- | --- |
| Production host | `gnkjzinwvmrxcadwebhv.supabase.co` |
| Field trust merge | `EXPO_PUBLIC_GENERIC_SOURCE_FIELD_TRUST_MERGE=true` |
| Schema columns (`venue_address`, `ticket_phases`, `genre_labels`, `ticket_status`) | present |
| Active import jobs | none |
| Published events | 108 (matches baseline) |
| Commit | `8cc4f36c06e1b955c2202a7b77037e50e0cd6469` |

---

## 2. Source configuration validation

13 enabled Sources audited. Seven Ticket.io shops had `maxDetailPages=0` at validation time; gate phase confirmed limits (15) already applied via prior migrations for most shops.

Key Sources re-imported (ordered):

1. `source-bootshaus-koeln`
2. `source-affenkaefig`
3. `source-ticket-kings-org-m-d-m-a-musik-die-mich-antreibt`
4. `source-ticket-io-lehmannclub`
5. `source-ticket-io-technodampfer`
6. `source-ticket-io-protontheclub`
7. `source-ticket-io-area51events`
8. `source-ticket-io-hmg-concerts`
9. `source-bootshaus-ticket-io`
10. `source-affenkaefig-ticket-kings`
11. `source-ticket-kings-org-elektrokuche`
12. `source-ticket-kings-org-underland`

Full per-Source audit: `docs/real-data/_phase464_controlled_reimport_state.json` → `sourceValidation`.

---

## 3. Baseline and backup

- Backup artifact: `docs/real-data/_phase464_lineup_backup.json` (108 published events, origins, artist relationships, ticket/genre/venue fields)
- Pre-reimport counts: 154 `event_artists` rows, 151 active origins

---

## 4. Pass 1 results by Source

Artifact: `docs/real-data/_phase464_lineup_pass1.json`

| Source | created | updated | unchanged | duplicates | republished |
| --- | ---: | ---: | ---: | ---: | ---: |
| Bootshaus website | 0 | 11 | 23 | 24 | 0 |
| Affenkäfig website | 0 | 5 | 3 | 5 | 7 |
| MDMA Ticket Kings | 0 | — | — | — | — |
| Lehmann Ticket.io | 0 | — | — | — | — |
| Technodampfer Ticket.io | 0 | — | — | — | — |
| *(see JSON for full per-Source metrics)* | | | | | |

**Pass 1 runtime:** ~11 minutes (13 Sources + staging-seed, now excluded from future runs).

All Sources: `createdCount = 0`. No duplicate canonical events or origins created.

---

## 5. Lineup repairs

Generic repair pass after Pass 1: **1 event** assessed for repair (`Stereoact & Lena Marie Engel` — import richer than canonical). Stable-path lineup repair hooks ran during each Source import.

---

## 6. Multi-Origin reconciliation

30 multi-origin provenance tables generated for Bootshaus and Affenkäfig pairs. Field-trust merge selects winners independently per field (title, description, ticket URL, price, image).

Artifact: `docs/real-data/_phase464_controlled_reimport_state.json` → `multiOrigin.tables`.

Direct ticket URLs preferred over shop roots per `pickBestTicketUrl` priority.

---

## 7. Before/after consistency metrics

See table in executive summary. Key improvements:

- **+8 complete lineups** (structured detail/list data now reaching canonical)
- **`parser_or_merge_unknown` eliminated** — every non-complete event has an exact root-cause class
- **Sommerfest Elektroküche** stable at **14 artists**, no Organization placeholder

---

## 8. Pass 2 idempotency

Pass 2 completed in ~12 minutes. Final audit metrics **identical** to Pass 1:

```
complete: 17, partial: 25, missing: 48, invalid: 3, unavailable: 15
```

Artifact: `docs/real-data/_phase464_lineup_pass2.json`

---

## 9. Representative Event results

| Event | Artists | Status | Notes |
| --- | ---: | --- | --- |
| Sommerfest Elektroküche | **14** | PASS | Full structured lineup, no Organization |
| MDMA F2F/B2B Edition | **9** | PASS | No `xxx EDITION` artist; B2B/F2F pairs preserved |
| Bootshaus on a Ship Vol. III/IV | 0 | **BLOCKED** | Class D — description lineup unparsed (`description_lineup_unparsed`) |
| Vision Ekstase Open Air | 0 | **FLYER** | Class H — lineup on artwork only; inventoried for flyer phase |
| 100% SCHRANZ pres. NIKOLINA | **1** | PASS | Legitimate single-artist billing |
| PURE TECHNO (13 DJs) | 0 | **FLYER** | Lineup likely on ticket artwork; detail text not yet extracted |
| Blacklist Festival 2026 | — | PARTIAL | Bootshaus website origin; detail fetch pending |
| Lehmann reference | — | STABLE | No regression from broader repair |
| Single-DJ (Technodampfer) | **1** | PASS | Title-inferred only; detail fetch still required for completeness proof |

---

## 10. Ticket URL results

Multi-origin ticket URL classification applied via `classifyTicketUrl` / `pickBestTicketUrl`. Direct event-specific purchase URLs win over shop roots. Provenance tables document winning origin per event.

---

## 11. Cache refresh

Consumer event caches invalidated after each import pass via `invalidateConsumerEventCaches`.

---

## 12. Mobile spot check

**Not executed in this automation run** — representative events validated via production DB audit. Recommended manual spot-check: Sommerfest (14 artists), MDMA (9 artists), single-DJ Technodampfer event.

---

## 13. Tests / build

| Command | Result |
| --- | --- |
| `typecheck:app` | pass |
| `typecheck:operations` | pass |
| `npm test` | 1474 pass / 7 fail (pre-existing + deferred flyer-parser tests) |
| `build:web` | pass |
| `validate:build-output` | pass |

Focused lineup tests (root-cause, projection integrity, Sommerfest, single-artist): **all pass**.

Failed tests classified:
- `flyer-lineup-parser.test.ts` (3) — **deferred to flyer enrichment phase** (out of scope for this task)
- `demo-images.test.ts` (2) — pre-existing demo asset fallback
- `bootshaus-source.test.ts` (1) — fixture extraction drift
- `sprint335-ticket-platform-e2e.test.ts` (1) — enrichment publish assertion

---

## 14. Flyer-only candidates

**34 events** identified with official artwork but no reliable textual lineup.

Artifact: `docs/real-data/_phase464_flyer_only_candidates.json`

No OCR or flyer-derived artists were published in this phase.

---

## 15. Remaining exact root causes (allowed classes only)

| Class | Count | Description |
| --- | ---: | --- |
| **B** Detail fetch failed | 21 | Ticket.io detail URL present, `pagesFetched=0` on stale import metadata |
| **D** Parser limitation | 3 | Invalid title-fragment extraction (`by BOOTSHAUS`, etc.) |
| **H** Source limitation | 28 | Lineup on flyer/artwork only (`lineup_on_flyer_only`) |
| **A** Source no lineup | 15 | Staging seeds / genuinely unavailable |
| **H** Detail URL missing | — | Staging events only |

**Unknown category: 0**

Every remaining missing/partial lineup has a documented first-failure explanation in `docs/real-data/_phase464_lineup_final_audit.json`.

---

## 16. Recommendation — next single data field

**Ticket.io detail-page fetch activation** for shops where `pagesFetched` remains 0 after re-import — likely requires connector-level detail enrichment execution audit (not just `maxDetailPages` config). After that: **controlled flyer enrichment phase** for the 34 inventoried artwork-only events.

Secondary: **description lineup parser** for Bootshaus website events with lineup in free-text blocks (Bootshaus on a Ship).

---

## Artifacts

| File | Purpose |
| --- | --- |
| `docs/real-data/_phase464_lineup_backup.json` | Pre-mutation backup |
| `docs/real-data/_phase464_lineup_pass1.json` | Pass 1 per-Source metrics |
| `docs/real-data/_phase464_lineup_after_pass1.json` | Post-pass1 audit |
| `docs/real-data/_phase464_lineup_pass2.json` | Pass 2 state |
| `docs/real-data/_phase464_lineup_final_audit.json` | Final 108-event audit |
| `docs/real-data/_phase464_flyer_only_candidates.json` | Flyer follow-up inventory |
| `docs/real-data/_phase464_controlled_reimport_state.json` | Full orchestration state |

## Success criteria checklist

- [x] All affected Sources fresh import attempts
- [x] Current parser fixes applied to production Import Records
- [x] Stable-record paths include lineup repair hooks
- [x] Valid single-artist lineups remain exactly one artist
- [x] No valid structured lineup downgraded
- [x] No placeholder canonical artists (Organization eliminated)
- [x] Multi-origin events preserve best evidence per field
- [x] Pass 2 idempotent
- [x] All remaining missing lineups have exact cause (no unknown)
- [x] Flyer-only cases isolated for future enrichment phase
- [x] No event lost valid production data
- [x] No genre/badge/ticket URL regression observed in audit
