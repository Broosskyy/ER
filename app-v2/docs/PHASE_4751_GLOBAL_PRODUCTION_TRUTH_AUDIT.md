# Phase 4.7.5.1 — Global Production Truth Audit

Generated: 2026-08-04T09:11:10.197Z

**READ ONLY — no production mutations.**

Independent re-evaluation of current production state from database → canonical read → projection → consumer surfaces. Prior repair reports were not trusted.

## Reference

- **Bootshaus on a Ship Vol. III** (`evt-1785339420043-obhyeev`)
- Reference scores: ticket 90 · venue 80 · lineup 100 · badge 60 · media 100 · consumer 100 · **overall 88**

## Executive summary

| Metric | Value |
|--------|------:|
| Total published events | **108** |
| Events matching Ship quality (≥88) | **4** (3.7%) |
| Real import events (excl. 15 staging seeds) | **93** |
| Real events matching Ship quality | **4** (4.3%) |

**Phase 4.8 ready: NO**

Production contains **15 published staging-seed events** (`staging-seed-*`, `klangkuenstler-berghain`) that severely distort aggregate quality. These should be unpublished before any Phase 4.8 gate review.

## Domain issue counts

| Domain | Issues |
|--------|-------:|
| Tickets | 59 |
| Wrong destinations / shop roots | 18 |
| Missing prices | 38 |
| Missing lineups | 62 |
| Missing badges | 22 |
| Wrong venues | 23 |
| Media (OCR pending) | 91 |

## Root cause distribution

| Stage | Count |
|-------|------:|
| Source | 263 |
| Projection | 133 |
| Persistence | 75 |
| Canonical Merge | 41 |
| Import | 1 |

## Repairability

| Class | Count |
|-------|------:|
| repairable_now | 151 |
| requires_OCR | 130 |
| blocked_by_missing_public_evidence | 95 |
| requires_connector | 75 |
| requires_external_source | 38 |
| requires_review | 24 |

## Representative events vs Ship Vol. III

| Event | Overall | First divergence |
|-------|--------:|------------------|
| Mallorca (6× Palma) | 39–53 | Canonical Merge (shop root CTA) + Persistence (no lineup) |
| Blacklist Festival | 58 | Source (missing lineup, OCR pending) |
| Technodampfer (8×) | 68–73 | Source (missing price) |
| LEVI | 68 | Source |
| PROTON Stuttgart | 70 | Source |
| MDMA | 71–83 | Source / Import (garbage artist entities) |
| Underland | 73 | Source |
| Unreal Weekender I | 75 | Source |
| Affenkäfig (4×) | 77–87 | Source |
| **Ship Vol. III** | **88** | reference |
| Unreal Weekender II | 88 | meets reference |
| Sommerfest Elektroküche | 88 | meets reference |

## Phase 4.8 blockers (must finish first)

1. **Ticket domain (56 issues)** — 6× Mallorca shop-root CTAs, wrong destinations, missing prices on Ticket.io list-only imports
2. **Consumer projection (111 gaps)** — lineup/price not reaching display on filtered garbage artists
3. **Venue projection (113)** — missing coordinates, promoter-as-venue inference on Mallorca/122 pres.
4. **Badge projection (22)** — ticket badges missing on events with ticket URLs but no price evidence
5. **Media / OCR (130)** — flyer images present, OCR provider not configured (blocked in 4.7.5)
6. **Staging seed pollution** — 15 demo events published in production
7. **Missing public evidence (95)** — no lineup/ticket/venue data at source level

## Artifacts

- `docs/real-data/_phase4751_global_truth.json`
- `docs/real-data/_phase4751_ticket_truth.json`
- `docs/real-data/_phase4751_lineup_truth.json`
- `docs/real-data/_phase4751_badge_truth.json`
- `docs/real-data/_phase4751_venue_truth.json`
- `docs/real-data/_phase4751_media_truth.json`
- `docs/real-data/_phase4751_consumer_truth.json`
- `docs/real-data/_phase4751_gold_standard_diff.json`
- `docs/real-data/_phase4751_quality_scores.json`
- `docs/real-data/_phase4751_repairability.json`

## Ops script

```bash
npx tsx scripts/operations/_phase4751-global-production-truth-audit.ts audit
npx tsx scripts/operations/_phase4751-global-production-truth-audit.ts report
npx tsx scripts/operations/_phase4751-global-production-truth-audit.ts full
```


## Phase 4.7.7.1 taxonomy update

- Earliest-blocker classification rules (phase4771-v1)
- See `_phase4771_reclassification.json` and `_phase4771_phase47_closure.json`
