# Phase 4.6 — Public App Quality Report

**Date:** 2026-08-01  
**Mode:** Reuse of existing working-tree implementation (no Phase 4.6 restart)  
**Production writes:** none

## Executive status

Phase 4.6 public-app hardening is **implemented in the working tree** and **validated at the automated gate level**. Read-only entity relationship audit completed. Remaining blockers are migration deployment, selective presentation polish, release-bundle validation, and manual browser/MP4 regression — not a missing implementation restart.

| Gate | Result |
|------|--------|
| `npm run typecheck` | Pass (app + operations) |
| `npm run lint` | Pass with **0 errors** (2382 pre-existing warnings) |
| `npm test` | Pass **1404 / 1404** (288 files) |
| Expo Web (localhost:8081) | Running, HTTP **200** |
| `npm run web:export` | Pass (`dist` exported) |
| `validate:build-output` | **Fail** — see blockers |
| Entity profile audit (SELECT-only) | Pass → `docs/real-data/_phase46_entity_profile_audit.json` |
| `entity_follows` migration applied to production | **Not applied** (requires separate approval) |

---

## 1. Implemented change summary

### 1.1 Regression inventory & future contracts
- Documented static root causes in `docs/PHASE_46_USER_TEST_REGRESSION_INVENTORY.md`.
- Added design-only contracts:
  - `docs/FUTURE_PLACEMENT_ENGINE_CONTRACT.md`
  - `docs/FUTURE_SOCIAL_NAVIGATION_CONTRACT.md`

### 1.2 Interactions & navigation
- `EventDiscoveryTile`, `VenueDetailCard`, `OrganizerProfileCard` use sibling `InteractiveCard` actions (Favorite / Directions / Follow no longer nested press targets).
- Added `navigateBackSafely()` and migrated Event Detail, public entity profiles, collections, settings placeholders, and notifications headers away from raw `router.back()`.

### 1.3 Universal Search
- Singular canonical routes via `resolveEntityProfileRoute()` (`/artist|venue|organizer/...`).
- Wired result presses in `UniversalSearchResults`; unresolved rows stay inert.
- Extended result-type contract for future `FESTIVAL/USER/COMMUNITY/POST/REEL` without fabricating UI.
- Improved ranking (exact/prefix/short-query gate), city candidates from events + catalogue, internal entity filtering.
- Focused tests cover WESTBAM, Bootshaus, Affenkäfig, Lehmann, Stuttgart, short queries, routes.

### 1.4 Eligibility & Owner truthfulness
- `DiscoveryEligibilityResolver` is surface-authoritative in `DiscoveryEngine`.
- Shared `isInternalPublicEvent()` excludes demo/staging/regression markers from public surfaces; Saved remains permissive.
- `resolveAccountCapabilities()` + Profile tab: Owner/Admin no longer shown as guest; organizer management only when a real linked organizer profile name exists.

### 1.5 Profiles & follows
- Shared alias-store singleton (`createEntityAliasStore`) used by registry + profile runtime.
- Additive migration `20260801120000_phase46_entity_follows.sql` (unique `(user_id, entity_type, entity_id)`, RLS, public count reads).
- `SupabaseFollowStorage` + FollowService follower counts; AsyncStorage retained for non-Supabase/demo/tests.
- SELECT-only audit script `_phase46-entity-profile-audit.ts`.

### 1.6 Presentation
- Public description normalizer (markup strip, entity decode, lists/paragraphs).
- Timetable section hidden when no real slots (no duplicate empty card).
- Lineup completeness labels retained/used.
- Address validity resolver guards directions when venue name masquerades as street.
- Home preview SSOT: rails **5**, lists **6**; collection `homePreviewLimit` reads the same constants.
- LocationPicker already exposes `insecure_context` bounded failure (verified present; not reimplemented).

---

## 2. Phase 4.6 modified / added files

### Added
- `docs/PHASE_46_USER_TEST_REGRESSION_INVENTORY.md`
- `docs/FUTURE_PLACEMENT_ENGINE_CONTRACT.md`
- `docs/FUTURE_SOCIAL_NAVIGATION_CONTRACT.md`
- `docs/PHASE_46_PUBLIC_APP_QUALITY_REPORT.md` (this file)
- `docs/real-data/_phase46_entity_profile_audit.json`
- `supabase/migrations/20260801120000_phase46_entity_follows.sql`
- `scripts/operations/_phase46-entity-profile-audit.ts`
- `src/features/navigation/safe-back-navigation.ts`
- `src/features/navigation/__tests__/safe-back-navigation.test.ts`
- `src/features/follows/entity-follow-row.ts`
- `src/features/follows/supabase-follow-storage.ts`
- `src/features/follows/__tests__/follow-service.test.ts`
- `src/features/profile/account-capability-resolver.ts`
- `src/features/profile/__tests__/account-capability-resolver.test.ts`
- `src/features/profiles/routes/__tests__/entity-profile-routes.test.ts`
- `src/features/events/discovery/internal-event-eligibility.ts`
- `src/features/events/discovery/__tests__/phase46-eligibility.test.ts`
- `src/features/events/formatting/public-description-normalizer.ts`
- `src/features/events/formatting/__tests__/public-description-normalizer.test.ts`
- `src/features/event-detail/utils/address-validity.ts`
- `src/features/event-detail/utils/__tests__/address-validity.test.ts`
- `src/features/search/__tests__/phase46-universal-search-routes.test.ts`
- `src/data/__tests__/phase46-entity-follows-migration.test.ts`
- `src/services/supabase/database.types.ts` (includes `entity_follows`; may also exist from prior work)

### Modified (Phase 4.6 scope)
- `app/event/[id].tsx`
- `app/(tabs)/search.tsx`
- `src/components/discovery/EventDiscoveryTile.tsx`
- `src/components/event-detail/VenueDetailCard.tsx`
- `src/components/profiles/OrganizerComponents.tsx`
- `src/components/search/SearchResultGroup.tsx`
- `src/data/supabase/supabase-query-client.ts`
- `src/features/collections/components/CollectionHeader.tsx`
- `src/features/collections/event-collection-config.ts`
- `src/features/discovery/services/discovery-engine.ts`
- `src/features/discovery/__tests__/sprint21-discovery-engine.test.ts`
- `src/features/discovery/__tests__/sprint22-discovery-api.test.ts`
- `src/features/entity-resolution/create-entity-alias-store.ts`
- `src/features/entity-resolution/__tests__/create-entity-alias-store.test.ts`
- `src/features/event-detail/utils/event-detail-view-model.ts`
- `src/features/events/discovery/discovery-eligibility-resolver.ts`
- `src/features/events/discovery/__tests__/discovery-feed-service.test.ts`
- `src/features/follows/follow-runtime.ts`
- `src/features/follows/follow-service.ts`
- `src/features/home/feed/home-feed-section-config.ts`
- `src/features/home/__tests__/sprint23-home-feed.test.ts`
- `src/features/notifications/components/NotificationsHeader.tsx`
- `src/features/profile/components/ProfileScreenContent.tsx`
- `src/features/profile/components/SettingsPlaceholderScreen.tsx`
- `src/features/profiles/components/PublicEntityProfileScreen.tsx`
- `src/features/profiles/hooks/useEntityFollow.ts`
- `src/features/profiles/profile-runtime-wiring.ts`
- `src/features/profiles/routes/entity-profile-routes.ts`
- `src/features/search/components/UniversalSearchResults.tsx`
- `src/features/search/domain/universal-search-types.ts`
- `src/features/search/services/universal-search-service.ts`

> Note: the git working tree also contains many earlier Phase 4.x / Ticket.io files unrelated to Phase 4.6. Those are **not** listed above.

---

## 3. Regression inventory closure

| # | Inventory item | Status |
|---|----------------|--------|
| 1 | Search plural routes / unwired presses | **Fixed** |
| 2 | Event Detail entity clickability for canonical IDs | **Fixed** (text-only stays inert; audit shows 127 text-only) |
| 3 | Follow persistence + counts | **Implemented** (code + migration; DB deploy pending) |
| 4 | Owner/profile capability truthfulness | **Fixed** |
| 5 | Nested interactive card controls | **Fixed** |
| 6 | Safe contextual back navigation | **Fixed** |
| 7 | Public eligibility / internal data exclusion | **Fixed** |
| 8 | Price/availability cross-surface parity | **Partial** — authoritative resolver already existed; no new full parity matrix landed in this pass |
| 9 | Description HTML/entity normalization | **Fixed** |
| 10 | Lineup truthfulness + hide empty timetable | **Fixed** (timetable hidden; completeness labels present) |
| 11 | Home preview count SSOT (5–6) | **Fixed** |
| 12 | Address validity / directions guard | **Fixed** |
| 13 | LocationPicker insecure-context | **Already present** (verified) |
| 14 | Loading/empty surface consistency | **Partial** — not a full surface-wide redesign |
| 15 | Verification label truthfulness | **Partial** — Owner labels fixed; venue/organizer verification copy not fully reworked |

---

## 4. Read-only entity audit results

Artifact: `docs/real-data/_phase46_entity_profile_audit.json`

| Metric | Value |
|--------|------:|
| Published events scanned | **114** |
| Relationships classified | **281** |
| `canonical_profile_ready` | **154** |
| `text_only_relationship` | **127** |
| Other classifications in this run | **0** |
| Dry-run repair proposals (capped) | **100** (review_only) |

Named observations from samples:
- Bootshaus venue relationships largely `canonical_profile_ready`.
- Lehmann / Proton organizer+venue strings often remain `text_only_relationship` (no dead press target by design).

No production mutations were performed.

---

## 5. Validation evidence

```
typecheck          PASS
eslint             PASS (0 errors; 2382 warnings)
vitest             PASS 1404/1404
expo web :8081     HTTP 200 (already running)
web:export         PASS → dist/
validate-build-output FAIL (see blockers)
entity audit       PASS (SELECT-only)
```

Focused Phase 4.6 suites included: safe-back, entity routes, universal search routes, eligibility, account capabilities, follow service, follows migration, description normalizer, address validity, discovery/home fixture updates.

---

## 6. Remaining blockers

1. **`entity_follows` migration not deployed** — code is ready; production/staging apply requires separate approval. Until then Supabase follow persistence cannot be live-verified.
2. **`validate:build-output` fails** — forbidden pattern `SUPABASE_SERVICE_ROLE_KEY` found in web export bundle string. Release check is blocked until investigated (likely identifier string leakage, not necessarily a live secret).
3. **Manual browser / MP4 regression not completed** — Expo Web is up, but named sample walkthrough (Bootshaus, Affenkäfig, Lehmann, Proton, Area51, Technodampfer, HMG, WESTBAM, deep-link Back, nested controls console) still needs human confirmation.
4. **Presentation leftovers (non-blocking for core Phase 4.6, but incomplete vs inventory):**
   - Full price/availability parity matrix documentation/tests across every card adapter
   - Full verification-label resolver for venue/organizer provenance vs artist verification
   - Homogeneous loading/empty/error shells across all public surfaces
5. **Text-only relationships (127)** — intentional inert UI; converting them to canonical profiles is a **separate dry-run repair approval**, not auto-applied.
6. **Working tree includes unrelated Phase 4.x dirty files** — keep Phase 4.6 commits scoped to the file list above.

---

## 7. Explicit non-claims

- No Feed, commerce, placement billing, or new Sources were added.
- No production repair writes were executed.
- Success of the **running app UX** against the user-test MP4 is **not** claimed until the manual pass completes.
