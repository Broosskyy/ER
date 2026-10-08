# M9.4E — Rausgegangen Scale Validation

Date: 2026-10-06  
Base: `main` after rebuild promotion and scheduler safety hotfix  
Branch: `feature/m9-4e-scale-validation`

## Goal

Validate the current Rausgegangen truth pipeline at a materially larger cohort size without mutating staging.

M9.4E is intentionally split into two separate decisions:

1. **Preview / scale validation** — implemented by this branch.
2. **Controlled staging apply** — not implemented and requires separate explicit authorization.

## Frozen cohort contract

The preview selects exactly **100** candidates from the M9.4C quality-ready artifact.

A candidate is snapshot-eligible only when:

- relevance is `HIGH_RELEVANCE` or `LIKELY_RELEVANT`,
- domain is `ELECTRONIC_HIGH` or `ELECTRONIC_MEDIUM`,
- the quality contract passes,
- the quality contract is not bypassed,
- the snapshot lifecycle is not ended.

The 40 identities from M9.4D are excluded.

Selection is deterministic and diversity-aware across:

- city,
- Bundesland,
- primary genre,
- location-only acquisition coverage.

Target location-only share: **25%**, when enough eligible location-only candidates exist.

## Live validation

Each of the 100 frozen candidates is live revalidated against its current Rausgegangen detail page.

For each candidate the runner recomputes:

- lifecycle,
- relevance,
- domain classification,
- quality contract,
- media qualification,
- genre evidence,
- identity classification,
- first-class ImportEligibility.

Only live `ELIGIBLE_NEW` / `ELIGIBLE_EXISTING_MATCH` candidates are converted to official evidence and passed to the write planner.

## Critical safety boundary

This phase is **preview-only** and deliberately split into two read-only layers.

### GitHub Actions source layer

The PR workflow runs without Supabase credentials:

- refuses `--apply`,
- live-revalidates the frozen Rausgegangen cohort,
- recomputes relevance/domain/quality/media/lifecycle,
- does not connect to Supabase,
- does not call the apply executor,
- does not persist tickets,
- does not enable a scheduler.

### Direct staging reconciliation layer

Current staging reconciliation is performed separately through the authenticated Supabase connection:

- project must be exactly `gnkjzinwvmrxcadwebhv`,
- read-only SQL only,
- production remains unset and untouched,
- checks source URLs, source event keys, ticket URLs and canonical title/time identity,
- no mutation is authorized by M9.4E preview.

The runner still supports a linked read-only mode for a controlled local environment, but GitHub Actions intentionally does not require or store a Supabase access token.

Projected writes are planning output only.

## Outputs

GitHub Actions uploads:

- `snapshot-pool-summary.json`
- `frozen-cohort.json`
- `live-revalidation.json`
- `prewrite-plans.json`
- `prewrite-plan-issues.json`
- `planned-mutations.json`
- staging / production safety records
- source-only CI safety state

Direct DB reconciliation is recorded separately in the M9.4E report rather than embedding database credentials into GitHub Actions.
- `summary.json`

## Exit criteria for preview

Hard failure if:

- staging identity is wrong,
- production is configured for the run,
- the frozen cohort is not exactly 100 unique identities,
- an M9.4D identity leaks into the cohort,
- snapshot relevance/domain gates are violated,
- any blocking write-plan issue remains,
- a candidate throws an unhandled preview error,
- staging fingerprint changes.

Live eligibility attrition itself is not silently treated as a failure; it is an M9.4E measurement and must be reviewed before any controlled apply.

## STOP boundary

Do not:

- apply the cohort,
- import the remaining pool,
- enable Rausgegangen scheduling,
- enable Bootshaus/Affenkäfig cron,
- configure production writes,

until the preview artifact has been reviewed and a separate controlled-apply step is explicitly authorized.
