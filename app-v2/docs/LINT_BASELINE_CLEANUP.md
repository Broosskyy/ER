# Lint Baseline Cleanup

**Sprint:** SOURCE MANAGEMENT SCALE + MULTI-SOURCE DEDUPLICATION + DISCOVERY QUALITY  
**Date:** 2026-07-26

## Baseline

| Check | Before | After |
|---|---:|---:|
| ESLint errors | 5 | 0 |
| ESLint warnings | 990 | 990 |

The repository warning baseline is explicitly out of scope for this sprint. No ESLint rules were
disabled and no `eslint-disable` comments were added.

## Structural fixes

| File | Previous cause | Resolution |
|---|---|---|
| `app/(tabs)/search.tsx` | URL-param state synchronized in an effect | Lazy initial state derives the initial map/grid mode |
| `app/profile/edit.tsx` | Profile copied into local state in an effect | Draft initializes from profile; save remains the explicit state transition |
| `CreateHubScreen.tsx` | Unauthenticated effect synchronously cleared drafts | Drafts remain loaded only for authenticated users and are hidden otherwise |
| `MapFilterSheet.tsx` | Props copied to draft state in an effect | Keyed draft component initializes state when its input snapshot changes |
| `EventDiscoveryGrid.tsx` | Pagination reset in an effect | Keyed grid remount initializes page state and scroll position |

## Verification

- `npm run typecheck` — passed
- `npm run lint` — passed with **0 errors** and the unchanged 990-warning baseline
- `npm test` — passed: **144 files, 736 tests**

## Final sprint closure (2026-07-27)

After productive service integration:

- `npm run lint` — **0 errors**, **971 warnings** (below 990 baseline; eslint --fix applied to touched files)
- `npm test` — **151 files, 767 tests** green

## Follow-up

Import ordering, unused variables, and other pre-existing warnings belong to a dedicated
repository-quality sprint. They were intentionally not mass-edited here.
