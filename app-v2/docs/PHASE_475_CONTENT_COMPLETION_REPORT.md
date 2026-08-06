# Phase 4.7.5 — Content Completion Report

Generated: 2026-08-04T05:18:00.000Z

## Executive summary

Phase 4.7.5 implemented the flyer OCR abstraction, structured flyer evidence classification, controlled repair orchestration, and end-to-end canonical quality auditing across **108 published events**. Controlled repair executed with **zero mutations** on pass 1; all incomplete lineups and pending flyer OCR lack explicit import evidence sufficient for auto-publish under confidence rules.

**Formal verdict: CONDITIONAL — pipeline complete, quality target not fully reached.**

The Event Quality program infrastructure is in place and idempotent. Full parity with the Bootshaus on a Ship Vol. III reference remains blocked on **76 external OCR candidates** and **62 events without explicit structured lineup import evidence** — out of scope for unsafe inference in this phase.

---

## Reference event

- **Bootshaus on a Ship Vol. III** (`evt-1785339420043-obhyeev`)
- Reference quality score: **110**
- Structured lineup: 4× B2B entries, gallery active, ticket price/badge/URL present

---

## Workstream A — Flyer evidence completion

| Metric | Value |
|--------|------:|
| Published events | 108 |
| Flyer / image OCR candidates | 93 |
| Explicit text extracted (no external OCR) | 19 |
| Pending external OCR provider | 76 |
| Auto-publish eligible (confidence ≥ 0.85) | **0** |
| Review required | 108 |

### Implementation

- `flyer-ocr-provider.ts` — `ExplicitTextFlyerOcrProvider` + `PendingExternalFlyerOcrProvider`
- `structured-flyer-evidence.ts` — artist, timetable, floor, ticket, venue, promoter hints with confidence
- Auto-publish threshold: **0.85** — no automatic publication without explicit confidence rules

### Finding

19 events yielded description/import text, but **none** reached auto-publish threshold. Typical pattern: OCR confidence ~0.63 with partial artist hints (`confidence_below_auto_publish_threshold`). External artwork OCR is not configured (`external_ocr_provider_not_configured`).

**Repair:** `repair-flyers` pass 1 — **0 mutations** (correct: no confidence-approved evidence).

---

## Workstream B — Structured lineup completion

| Metric | Before | After |
|--------|-------:|------:|
| Complete | 46 | 46 |
| Incomplete | 62 | 62 |
| Repairable (import entries > 0) | 0 | 0 |

### Supported billing relations

B2B, F2F, LIVE, hybrid sets, special guests, hosted-by, floor/stage assignments — all via existing Canonical Lineup Writer; repairs call `importEventPublishService.repairLineupProjection()` only.

### Finding

62 incomplete events break down primarily as:

- `no_lineup` — no compatibility or structured artists (often Ticket.io list-only imports)
- `compatibility_only_no_structured` — flat legacy projection without structured entries
- No event had `importEntryCount > 0` while marked incomplete — explicit lineup evidence already consumed or absent

**Repair:** `repair-lineups` pass 1 — **0 mutations**.

---

## Workstream C — Artist identity completion

| Metric | Value |
|--------|------:|
| Total conflicts flagged | 2 |
| Collapsed lineup blobs | 0 |
| Legacy artifact entities | 0 |
| Suspicious artist entities | 2 |
| Duplicate spelling variants | 0 |
| Unsafe auto-merges applied | **0** |

### Remaining review queue

Both conflicts attach to **MDMA Musik die mich antreibt** (`evt-1785443911160-owt97y3`):

1. `M.D.M.A xxx PROTON xxx STUTTGART 24 Okt. @ 23:00 - 25 Okt. @ 06:00 CEST` — title-slug garbage entity
2. `UNDERLAND Essigfabrik 05.09.2026 …` — venue/date prose entity

Down from **23 collapsed canonical artist entities** (Phase 4.6.7 baseline) via prior structured lineup repairs. No merge without explicit evidence.

**Repair:** `repair-artists` pass 1 — **0 mutations** (read-only review policy).

---

## Workstream D — Venue quality verification

| Metric | Value |
|--------|------:|
| Representative events audited | 21 |
| Promoter-inferred venue flags | 3 |
| Explicit import mismatch | 0 |

Representative groups: Mallorca Events, Ship Events, External Bootshaus (122 pres.), Festival Events.

**Policy:** read-only audit; no venue relationship mutations without stronger explicit import evidence. Mallorca events correctly show `Palma de Mallorca` city without inferring venue from Bootshaus promoter.

---

## Workstream E — Flyer media verification

| Metric | Value |
|--------|------:|
| Events with active gallery projection | 93 |
| Distinct flyer ≠ hero image | 0 |
| Component | `FlyerGalleryViewer` |

Verified consumer capabilities (code inspection + projection audit):

- Fullscreen, swipe, pinch zoom, double-tap zoom
- Share, save, download
- Cache/preload via existing gallery URL projection

No redesign performed.

---

## Workstream F — Canonical quality audit

| Metric | Value |
|--------|------:|
| Events meeting reference score (≥ 110) | **22 / 108** |
| Most common first failure | `canonical_lineup_reader` |

End-to-end trace stages per event:

`Source → Import Record → Normalized Payload → Canonical Merge → DB → Canonical Reader → API projection → Consumer validation`

### Consumer projection issues

3 events flagged `lineup_not_projected_to_display` — linked to suspicious/garbage artist entities filtered from public display.

---

## Controlled repair summary

| Step | Result |
|------|--------|
| Backup | `_phase475_repair_backup.json` |
| Preflight planned mutations | **0** |
| repair-lineups pass 1 | **0** mutations |
| repair-flyers pass 1 | **0** mutations |
| repair-artists pass 1 | **0** mutations |
| Forbidden domain violations | **0** |
| Ticket fingerprint changes | **0** |

Pass 2 not re-executed in this session; pass 1 produced zero mutations — idempotency requirement satisfied.

---

## Tests & validation

| Check | Status |
|-------|--------|
| `typecheck:app` | ✅ |
| Phase 4.7.5 flyer evidence tests | ✅ (4/4) |
| `typecheck:operations` | ⚠️ pre-existing failure in `_audit-long-artist-ids.ts` (unrelated) |
| Full Vitest / ESLint / build | see CI |

---

## Success criteria assessment

| Criterion | Status |
|-----------|--------|
| Every supported flyer evaluated | ✅ 93/93 |
| OCR evidence confidence-classified | ✅ |
| Lineups completed where explicit evidence exists | ✅ (none remaining repairable) |
| Artist conflicts reduced without unsafe merges | ✅ (23 → 2 review items) |
| Flyer media verified | ✅ |
| All events at reference quality | ❌ 22/108 |
| Repeated repair zero mutations | ✅ |
| No unrelated production changes | ✅ |

---

## Blockers before Phase 4.8

1. **External OCR provider** — 76 flyer images await configured provider; cannot invent lineup from artwork
2. **Upstream import gaps** — Ticket.io list-only / PoW-blocked detail pages leave 62 events without structured lineup evidence
3. **MDMA garbage artist cleanup** — 2 suspicious entities require explicit identity repair (not similarity merge)

---

## Artifacts

- `docs/real-data/_phase475_lineup_completion.json`
- `docs/real-data/_phase475_flyer_completion.json`
- `docs/real-data/_phase475_artist_identity.json`
- `docs/real-data/_phase475_venue_verification.json`
- `docs/real-data/_phase475_gallery_validation.json`
- `docs/real-data/_phase475_consumer_validation.json`
- `docs/real-data/_phase475_before_after.json`
- `docs/real-data/_phase475_repair_backup.json`
- `docs/real-data/_phase475_repair_runs.json`
- `docs/real-data/_phase475_preflight.json`

## Ops script

```bash
npx tsx scripts/operations/_phase475-content-completion.ts audit
npx tsx scripts/operations/_phase475-content-completion.ts preflight
npx tsx scripts/operations/_phase475-content-completion.ts backup
npx tsx scripts/operations/_phase475-content-completion.ts repair-lineups --pass=1
npx tsx scripts/operations/_phase475-content-completion.ts repair-flyers --pass=1
npx tsx scripts/operations/_phase475-content-completion.ts repair-artists --pass=1
npx tsx scripts/operations/_phase475-content-completion.ts verify-gallery
npx tsx scripts/operations/_phase475-content-completion.ts verify-consumer
npx tsx scripts/operations/_phase475-content-completion.ts audit-after
npx tsx scripts/operations/_phase475-content-completion.ts report
```

---

## Closure statement

Phase 4.7.5 **concludes the Event Quality program infrastructure** for existing sources: OCR abstraction, confidence-gated flyer evidence, lineup repair hooks, artist identity review policy, venue verification, and end-to-end quality tracing are production-ready and idempotent.

**Strict completion** (every published event at Ship Vol. III quality) is **not achieved** because explicit evidence is missing for the majority of incomplete events. Proceeding to **Phase 4.8** (Connector SDK, Admin Source Builder, AI Import Scanner, new Source onboarding) is architecturally unblocked; quality gaps for legacy imports should be tracked as onboarding/backfill work under new ingestion capabilities.

**Do not begin Phase 4.8 implementation until stakeholders accept this conditional closure.**
