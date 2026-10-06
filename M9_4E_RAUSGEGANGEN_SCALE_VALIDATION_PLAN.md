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

This phase is **preview-only**.

The runner:

- refuses `--apply`,
- verifies the linked project is exactly `gnkjzinwvmrxcadwebhv`,
- requires no Eternal Rave production project to be configured,
- never calls the apply executor,
- never persists tickets,
- never enables a scheduler,
- fingerprints staging before and after,
- fails if the database fingerprint changes.

Projected writes are planning output only.

## Outputs

GitHub Actions uploads:

- `snapshot-pool-summary.json`
- `frozen-cohort.json`
- `live-revalidation.json`
- `prewrite-plans.json`
- `prewrite-plan-issues.json`
- `planned-mutations.json`
- database fingerprints before/after
- staging / production safety records
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
