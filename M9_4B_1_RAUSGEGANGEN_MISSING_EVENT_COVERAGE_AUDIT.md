# M9.4B.1 Rausgegangen Missing Event Coverage Audit

Generated: 2026-09-16T15:44:23.046Z  
Status: **M9_4B_1_MISSING_EVENT_AUDIT_COMPLETE_ACQUISITION_GAP_FOUND**

## Executive summary

User-reported **"Ehreklub" / "Ehreklub im Schrotty"** is live on Rausgegangen as **EhrenKlub im Schrotty #14** but was **never discovered** by M9.4A because it appears only on `/locations/schrotty/`, not on `/cologne/` city listing HTML. M9.4A crawls `/{city}/` surfaces only → **DISCOVERY_SURFACE_GAP** (primary root cause).

Secondary: if discovered today, relevance = **AMBIGUOUS** and quality contract = **fail** (no explicit genres; lineup in description prose not recovered). This does not explain consumer absence today — discovery never ran.

## Answers (spec §36)

| # | Question | Answer |
|---|---|---|
| 1 | On Rausgegangen? | **Yes** — `https://rausgegangen.de/events/ehrenklub-im-schrotty-14-0/` |
| 2 | M9.4A discovered? | **No** — zero artifact/http-cache hits |
| 3 | Among 2,500 enriched? | **No** — never in discovery pool |
| 4 | Classified? | **No** |
| 5 | Quality Contract? | **Not evaluated in M9.4A**; live dry-run: **fail** |
| 6 | Outside 15-batch? | **N/A** — never classified |
| 7 | Canonical staging? | **No** (BACK2BASICS @ Schrotty exists via ticket.io only) |
| 8 | Why absent from Eternal Rave? | **Discovery surface gap** + never imported |
| 9 | Similar misses? | **2** in bounded audit; **66** location-only URLs not on any city listing |
| 10 | Dominant reason? | **DISCOVERY_SURFACE_GAP** |
| 11 | 2500 cap causing loss? | **Yes secondarily** (22.5% detail coverage); not EhrenKlub's primary cause |
| 12 | Acquisition model? | **Hybrid D** — city + `/locations/` + rolling 90d window |

## Coverage funnel (labeled populations)

| Stage | Count | Population |
|---|---:|---|
| DISCOVERED_ONLY | 11,095 | City listing URLs (M9.4A) |
| DETAIL_CLASSIFIED | 2,500 | Top 2,500 by listing-title pre-score |
| ELECTRONIC_RELEVANT | 182 | Detail-enriched HIGH/LIKELY |
| NET_NEW_RELEVANT | 181 | + NET_NEW identity |
| SELECTED_FOR_IMPORT | 15 | Frozen B.4 cohort |
| IMPORTED | 9 | M9.4B applied |
| CONSUMER_VISIBLE | — | Not exhaustively measured |

**detailCoverageRate:** 22.53% (2,500 / 11,095)

## Sample selection (M9.4A)

- **Method:** Sort all city-discovered URLs by listing-title relevance score + priority city bonus → take top 2,500
- **Not used:** `/locations/{venue}/`, organizers, pagination, sitemap bulk
- **Blind spot:** Venue-only listings (EhrenKlub case)

## Next acquisition model

**Recommended: Hybrid D**

1. Continue city `/{slug}/` enumeration  
2. Add bounded `/locations/{venue}/` for known electronic venues  
3. Rolling **90-day** detail enrichment for union of city + location upcoming URLs  
4. Prequalification sampling for backlog beyond 90d  

## Safety

- Staging mutations: **0**
- Production mutations: **0**
- No imports, no scheduler

Artifacts: `artifacts/m9-4b-1-rausgegangen-missing-event-audit/`
