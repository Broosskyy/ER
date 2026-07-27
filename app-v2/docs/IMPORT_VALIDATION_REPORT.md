# Import Validation Report

**Sprint:** FIRST REAL SOURCES + IMPORT VALIDATION  
**Date:** 2026-07-26

## Validation scope

This sprint validates the complete import lifecycle using real connector shapes and the existing aggregation pipeline. Validation occurs at three layers: pipeline steps, import orchestration, and admin review.

## Layer 1 — Pipeline validation (`ValidateStep`)

Reuses `ImportCandidateValidator`. Checks before record creation:

| Check | Rule | Result |
|-------|------|--------|
| Required fields | Title, start date present | `rejected` if missing |
| Date validity | Parseable ISO date | Error on invalid |
| Venue | Venue name or matched venue | Warning/error per config |
| URLs | Ticket, event, image URL format | Invalid URLs flagged |
| Empty events | No title + no date | Skipped / rejected |
| Coordinates | Optional lat/lng range | Prepared |

Invalid events receive `rejected` pipeline status → `invalid` import record status.

## Layer 2 — Deduplication (`DuplicateCheckStep`)

`ScoreBasedDuplicateStrategy` evaluates signals:

- Title similarity
- Date proximity
- Venue match
- Organizer match
- Image URL (prepared)
- Original link (prepared)

High duplicate score → `duplicate` status. Admin can dismiss duplicate flag before approve.

## Layer 3 — Merge (`MergeStep`)

When multiple sources contribute to the same event:

- One primary dataset selected by source priority
- `sourceContributions` history preserved on envelope
- `mergeGroupId` links related records
- No duplicate consumer events created

## Layer 4 — Update detection (`ImportUpdateService`)

On re-import, compares canonical candidate against existing published event:

| Change | Detection |
|--------|-----------|
| Description | Text diff |
| Start/end date | ISO comparison |
| Ticket URL | String comparison |
| Cancelled (iCal) | `cancelled` flag → `cancelled` change type |
| Missing from source | `findMissingExternalIds()` → archive |

Updates do not create new events when `resultingEventId` exists.

## Layer 5 — Admin review

Import records with `needs_review` status enter admin queue at `/admin/imports/review`.

Review screen shows:

- Source name and type
- Import date (`retrievedAt`)
- Original URL
- Normalized payload preview
- Validation warnings/errors
- Duplicate score (if any)

Actions:

- **Approve** → creates `published` event, refreshes consumer repository
- **Reject** → no event created
- **Edit** → reviewer edits merged into candidate before approve

## Layer 6 — Consumer validation

After approve:

1. `AdminEventRepository.save()` persists event with `status: 'published'`
2. `EventRepository.refresh()` invalidates consumer cache
3. Published events appear in Home, Events, Search, Saved, Map, Event Detail via existing `EventRepository` — no screen-specific logic

## Test coverage

| Area | Test file |
|------|-----------|
| Connectors load data | `source-connectors.test.ts` |
| Pipeline steps | `aggregation-pipeline.test.ts`, `validate-step.test.ts`, `normalize-step.test.ts` |
| Duplicate strategy | `duplicate-strategy.test.ts` |
| Merge strategy | `merge-strategy.test.ts` |
| Update/archive | `import-update-service.test.ts` |
| Full aggregation flow | `import-aggregation-service.test.ts` |
| Admin review approve | `import-review.test.ts` |
| E2E acceptance | `import-acceptance.test.ts` |
| Logging | `aggregation-logging.test.ts` |

## QA flow documented

See `QA_IMPORT_RESULTS.md` for step-by-step validation:

```
Quelle → Import → Normalisierung → Review → Freigabe → Consumer → Update → Archivierung
```

## Known limitations

- Image reachability (HTTP HEAD) is prepared but not executed in this sprint
- Live URL fetching uses fixtures in test/CI environments
- `sourceName` on import records depends on repository persistence layer (Supabase impl stores it; local test datasource omits optional fields)
