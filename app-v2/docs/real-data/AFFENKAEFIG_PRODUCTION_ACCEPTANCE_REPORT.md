# Affenkäfig Production Acceptance Report

Sprint 28.1 update — controlled live readiness

## Executive summary

The official live source **`affenkaefig.info`** is verified. Read-only parsing succeeds for 8 upcoming events. Source remains **disabled** — no import, publish, or scheduler activation in this sprint.

## Source

| Item | Status |
|------|--------|
| Official domain | ✅ `affenkaefig.info` |
| Legacy domain | ❌ `affenkaefig.de` unconfigured |
| Source enabled | ❌ false (intentional) |
| Scheduler | ❌ disabled |
| Publish mode | `manual_review` |

## Connector

| Item | Status |
|------|--------|
| List strategy | `event_detail_page` |
| Detail JSON-LD | ✅ |
| Live smoke test | ✅ 8 events |
| Fixture CI tests | ✅ |

## Import / publish (live)

| Metric | Result |
|--------|--------|
| Live imports | 0 (not in scope) |
| Live publishes | 0 (not in scope) |

## Next steps for go-live (separate sprint)

1. Apply migration `20260761000000_sprint281_affenkaefig_live_domain.sql` on staging
2. Controlled staging import (`manual_review`)
3. Review queue + cross-source matching (esp. Bootshaus overlap)
4. Sample publish + reimport idempotency
5. Discovery/frontend acceptance
6. Enable scheduler

## Tag

`affenkaefig-production-ready` — **not created** (controlled import not yet executed)

## Verdict

**READY FOR CONTROLLED LIVE IMPORT** (read-only verification complete; activation still pending)
