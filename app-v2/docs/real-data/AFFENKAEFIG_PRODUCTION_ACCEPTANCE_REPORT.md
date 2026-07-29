# Affenkäfig Production Acceptance Report

Sprint 28 — Eternal Rave  
Date: 2026-07-29

## Executive summary

Affenkäfig connector infrastructure is **implemented and tested offline**, but **NOT production-ready** because the official domain `affenkaefig.de` remains unconfigured and serves no event data.

## Source

| Item | Status |
|------|--------|
| Source ID | `source-affenkaefig` |
| Registry | ✅ Present (migration Sprint 13) |
| Sprint 28 migration | ✅ Connector config + `organizer-affenkaefig` |
| Enabled | ❌ **false** (intentional) |
| Scheduler | ❌ disabled |
| Publish mode | `manual_review` |

## Connector

| Item | Status |
|------|--------|
| Type | `organizer_website` |
| Strategy | `json_ld` |
| Module | `affenkaefig-source.ts` |
| Fixture tests | ✅ 6 tests |
| Live smoke | ⏭️ skipped (domain unconfigured) |

## Import / publish (live)

| Metric | Result |
|--------|--------|
| Imported events (live) | 0 |
| Published events (live) | 0 |
| Fixture publish in CI | ✅ (test pipeline only) |

## Duplicate / matching / trust

| Check | Live | Fixture CI |
|-------|------|------------|
| Idempotent reimport | N/A | ✅ |
| confidenceTier canonical | N/A | ✅ |
| Bootshaus regression | N/A | ✅ |
| Cross-source matching | N/A | Not tested (no live Affenkäfig events) |

## Discovery / search / frontend

| Surface | Status |
|---------|--------|
| Home | N/A — no published Affenkäfig events |
| Search | N/A |
| Venue filter | N/A |
| Event detail | Generic components ready |
| Images | N/A |
| Lineup / timetable | Placeholder path ready |

## Reimport / stable closure

Fixture pipeline idempotency verified. Live stable reimport **not verified**.

## Open points

| Point | Classification |
|-------|----------------|
| Domain unconfigured | **Blocking** |
| Live smoke test | **Blocking** |
| Staging import + review | **Blocking** |
| Scheduler activation | **Blocking** |
| Frontend acceptance with real data | **Blocking** |
| Lineup/timetable from source | Future extension |
| Affenkäfig-specific venue canonical IDs | Future (per-event resolution) |

## Go-live decision

**DO NOT ACTIVATE** `source-affenkaefig` until:

1. `affenkaefig.de/events/` serves real JSON-LD or equivalent structured events
2. Live smoke test passes
3. Staging dry-run import reviewed
4. Publish acceptance on staging completed
5. Reimport idempotency verified on staging
6. Bootshaus regression suite green (currently ✅)

## Tag

`affenkaefig-production-ready` — **not created** (criteria not met)
