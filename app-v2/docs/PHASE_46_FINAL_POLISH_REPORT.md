# Phase 4.6 Final Polish — Production UI Completion Report

**Date:** 2026-08-01  
**Scope:** Fix remaining production issues from real testing only — no feature expansion  
**Production writes:** none

## Validation gates

| Gate | Result |
|------|--------|
| `npm run typecheck:app` | Pass |
| Phase 4.6 unit tests (eligibility, search, profile, lineup, polish) | Pass (18 tests) |
| `sprint23-home-feed.test.ts` | Pass |
| Expo Web dev server | Running at http://localhost:8081 |
| `validate:build-output` (service role in bundle) | **Still failing** — pre-existing blocker |
| `entity_follows` migration deployed | **Not applied** — requires approval |
| Manual browser regression (Bootshaus, Affenkäfig, Saved reload, Owner profile) | **Pending manual QA** |

---

## 1. Demo / test data cleanup

**Done**
- Centralized `isInternalEntityId()` in `internal-event-eligibility.ts` (staging, demo-, regression, test-, search-test, Charlotte demo slug).
- `isInternalPublicEvent()` now delegates entity-id checks to shared helper.
- Internal events blocked on event detail API (`discovery-query-platform.getEventDetail` → NOT_FOUND).
- Entity profile loader rejects internal slugs/ids for organizer, venue, artist.
- Profile event lists filter internal events via `filterProfileEvents`.
- Universal search uses shared internal filters.

**Intentional**
- Saved tab still shows user-saved unavailable/internal placeholders (by design).

**Remaining**
- Activity/notifications may still link to archived events by direct id.
- No DB/RLS defense-in-depth for staging rows.

---

## 2. Saved events fix

**Root cause fixed**
- Empty v2 store re-imported legacy v1 favorites on every cold start.

**Changes**
- Migration flag `saved_events_migrated_v2` + one-time v1→v2 migration with v1 key removal.
- `toggleFavorite` always allows **remove**; add still requires published event.
- Persist marks migration complete on every save.

**Files:** `FavoritesContext.tsx`, `saved-event-storage.ts`

**Remaining**
- Saved events remain device-local (AsyncStorage); no cross-device sync.

---

## 3. Profile fix

**Changes**
- Auth-scoped profile storage (`user_profile_v1_{userId}`).
- Profile hydrates from auth session; seeds display name from email when still `Rave Guest`.
- Edit profile syncs draft after hydration (`hydrated` + `useEffect`).
- Functional `updateProfile` updates.
- Header uses saved `displayName` when set; saved count uses `savedEvents.length`.
- Removed duplicate header **Einstellungen** button (inline settings card remains).

**Files:** `UserProfileProvider.tsx`, `user-profile-storage.ts`, `ProfileScreenContent.tsx`, `app/profile/edit.tsx`

**Remaining**
- No Supabase `profiles` table (local-only profile).

---

## 4. Search relevance

**Changes**
- Event scoring: title ×2, artists ×1.5, venue ×1.25, organizer ×1.1, genres ×1, description ×0.45.
- Weak description matches gated; merged events sorted by relevance score.
- Shared internal entity filtering (no duplicate local helpers).

**Files:** `universal-search-service.ts`

---

## 5. Profile routing

**Changes**
- Internal entity deep links return null from profile loader.
- Text-only organizers remain inert (`profileNavigable: false`, `profile_not_claimed` label).
- Canonical routes unchanged (`/venue|organizer|artist/:slug`).

**Files:** `entity-profile-loader.ts`, `event-detail-view-model.ts`

**Remaining**
- 127 text-only relationships still inert until approved repair/backfill.

---

## 6. Event detail consistency

**Changes**
- Venue row removed from info section when dedicated venue card is shown (no triple venue surfacing).
- Description normalization retained.
- Source label uses ticket provider / source display labels.

**Files:** `app/event/[id].tsx`, `event-detail-view-model.ts`

**Remaining**
- Hero still shows venue+city overlay (intentional hero pattern).

---

## 7. Lineup improvements

**Changes**
- Empty lineup sections hidden (no placeholder card when no artists).
- Single known artist → section title **ARTIST** (not large “BEKANNTE ARTISTS”).
- Misleading “Nicht verifiziert” badge removed from non-navigable lineup artists.

**Files:** `event-detail-view-model.ts`, `lineup-completeness.ts`, `LineupSection.tsx`, `ArtistLineupCard.tsx`

---

## 8. Price / badge parity

**Changes**
- `EventDiscoveryTile` now shows `ticketLabel` (price text) from shared presentation path.
- Search tile view model includes `displayPriceText ?? priceText`.

**Files:** `discovery-tile-view-model.ts`, `EventDiscoveryTile.tsx`, `view-models.ts`

**Remaining**
- `EventHero` ticket color still uses success green (not semantic `colorToken`).
- `explanatoryLabel` from price semantics still unused in UI.

---

## 9. Address / venue cleanup

**Changes**
- Venue card: name + city on row; address row only when street differs from name/city.
- `toVenueDetailFromRecord` no longer falls back to `"{name}, {city}"` as address.
- Street address only in `addressLabel` when resolvable.

**Files:** `VenueDetailCard.tsx`, `profile-view-models.ts`, `event-detail-view-model.ts`

---

## 10. Location picker

**Changes**
- Home location selector opens during GPS loading (manual city + radius always reachable).
- City selector no longer disabled while GPS resolves.

**Files:** `LocationSelector.tsx`

**Note:** GPS + manual city + radius were already implemented in `LocationPickerModal`.

---

## 11. Home card configuration

**Changes**
- `DEFAULT_HOME_RAIL_PREVIEW_LIMIT`: **5 → 6** (rails now match list sections).
- Single SSOT in `home-feed-section-config.ts`.

**Files:** `home-feed-section-config.ts`

---

## 12. Verification labels

**Changes**
- New statuses: `official_source`, `profile_not_claimed`, `organizer_confirmed`.
- Labels: **Offizielle Quelle**, **Profil nicht beansprucht**, **Veranstalter bestätigt**.
- Imported Bootshaus/Affenkäfig/Technodampfer/Lehmann/Proton/Ticket.io entities → `official_source`.
- Venue detail card shows official badge for imported venues.

**Files:** `verification-styles.ts`, `view-models.ts`, `entity-verification-status.ts`, `profile-view-models.ts`

---

## 13. Loading states

**Changes**
- Home feed sections show skeleton placeholders while loading (no blank gaps after initial skeleton).

**Files:** `HomeFeedSectionView.tsx`

**Remaining**
- Similar-events block on detail has no dedicated skeleton strip.

---

## 14. Test results

| Suite | Result |
|-------|--------|
| `phase46-final-polish.test.ts` | Pass (internal ids, verification labels) |
| `phase46-eligibility.test.ts` | Pass |
| `phase46-universal-search-routes.test.ts` | Pass (Bootshaus, WESTBAM, routes) |
| `lineup-completeness.test.ts` | Pass |
| `account-capability-resolver.test.ts` | Pass |
| `sprint23-home-feed.test.ts` | Pass |
| `npm run typecheck:app` | Pass |

**Not automated in this pass:** live browser walkthrough with production entities (Bootshaus, Affenkäfig, Technodampfer, Lehmann, Proton, PLAY!, Owner profile, Saved reload).

---

## 15. Remaining visible issues

1. **`validate:build-output`** — `SUPABASE_SERVICE_ROLE_KEY` in web export bundle.
2. **`entity_follows` migration** not deployed to production Supabase.
3. **Manual browser regression** not completed in this session.
4. **Text-only entity relationships** (127) — inert until repair approval.
5. **Saved events** — local only, no server sync.
6. **Profile** — no server-side profile table.
7. **Price semantics** — `colorToken` / `explanatoryLabel` not surfaced in hero/detail ticket UI.
8. **Activity feed** — may surface links to non-public/archived events.

---

## Success criteria checklist

| Criterion | Status |
|-----------|--------|
| No demo data on public surfaces | **Most surfaces** — deep links + activity gaps remain |
| Saved events persist correctly | **Fixed** (migration + unsave guard) |
| Profile editing truthful | **Improved** — local storage only |
| Search feels correct | **Improved** — manual QA pending |
| Profiles behave consistently | **Improved** — text-only still inert |
| Event details complete | **Improved** |
| Lineup truthful | **Improved** |
| Price/badge parity | **Partial** — tiles fixed, hero colors pending |
| Addresses not duplicated | **Improved** |
| Location GPS + manual + radius | **Yes** |
| Home shows 6 configurable cards | **Yes** (rails + lists) |
| Loading consistent | **Improved** on Home sections |

Phase 4.6 Final Polish is **ready for manual QA**. After migration deploy, build-output fix, and browser validation, the public app should be stable enough to begin **Phase 5** (bulk sources, Rausgegangen, Ticket.io shops, placement engine, social feed, commerce).
