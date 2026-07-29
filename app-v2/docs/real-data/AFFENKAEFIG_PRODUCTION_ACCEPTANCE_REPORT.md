# Affenkäfig Production Acceptance Report

Sprint 28.3 update

## Status

| Phase | Status |
|-------|--------|
| Live source verified | ✅ `affenkaefig.info` |
| Controlled live import | ✅ 8 records |
| Manual review pipeline | ✅ queue backfilled (8/8) |
| Published to discovery | ❌ not in scope |
| Scheduler | ❌ disabled |
| Source enabled | ❌ false |

## Import result

- 8 unique events imported as `needs_review`
- 8 `import_review_queue` entries (pending)
- 5 duplicate candidates flagged — all classified **false positive** (Bootshaus day-city collision)
- 0 published events
- Bootshaus regression unaffected

## Next step

Controlled publish sprint: dismiss false-positive duplicates, resolve Bootshaus shared event (23.10.26), then manual approve per record.

## Reports

- `AFFENKAEFIG_MANUAL_REVIEW_REPORT.md` — full Sprint 28.3 analysis
- `AFFENKAEFIG_CONTROLLED_IMPORT_REPORT.md` — Sprint 28.2 import details

## Tag

`affenkaefig-production-ready` — **not created**
