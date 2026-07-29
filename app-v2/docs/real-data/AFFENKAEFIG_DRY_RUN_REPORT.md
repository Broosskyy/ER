# Affenkäfig Dry Run Report

Generated: 2026-07-29  
Sprint: 28  
Branch: `feature/er-012-source-acquisition-foundation`

## Live fetch (read-only)

| Check | Result |
|-------|--------|
| URL | `https://affenkaefig.de/events/` |
| HTTP status | 200 |
| Final URL | `https://affenkaefig.de/events/` |
| Body marker | **„Diese Domain ist unkonfiguriert.“** |
| JSON-LD present | ❌ |
| Schema.org events | ❌ |
| Event links | ❌ |

**Verdict:** Live acquisition **not possible**. Source must remain **disabled**.

## Fixture connector dry run (offline only)

Executed via `affenkaefig-source.test.ts` / `websiteProcessor` with `AFFENKAEFIG_LIST_FIXTURE_HTML`.

| Metric | Value |
|--------|-------|
| Strategy | `json_ld` |
| Extracted events | 2 |
| Valid events | 2 |
| Sample titles | Affenkäfig Open Air 2026; Affenkäfig Warehouse Session |
| Venues | Rheinpark Köln; Warehouse Köln |
| Organizer | Affenkäfig (all events) |
| Images | ❌ in fixture |
| Ticket URLs | Event detail URLs only |
| Lineup | ❌ |
| Timetable | ❌ |

**Note:** Fixture data validates connector wiring only. **Not published** and **removed from DB** by migration `20260760000000`.

## Trust / matching (not executed live)

Blocked by missing live events. Fixture pipeline tests pass in CI (`affenkaefig-integration.test.ts`, `sprint13-production-integration.test.ts`).

## Planned actions when domain goes live

1. Run `affenkaefig-live-smoke.test.ts`
2. Manual dry-run import in staging (`manual_review`)
3. Review queue evaluation
4. Controlled publish sample
5. Reimport idempotency check
6. Enable scheduler
7. Frontend acceptance

## Risks

| Risk | Severity |
|------|----------|
| Domain unconfigured | **Blocking** |
| Variable venues | Medium — entity resolution per event |
| No lineup/timetable on source | Low — placeholder UI acceptable |
| Cross-source duplicates with Bootshaus | Medium — requires matching review |
