# Saved + Profile Final

## Scope

This sprint finalizes the consumer **Saved** and **Profile** tabs for Eternal Rave V1. Both screens reuse the existing design system, discovery components, and local persistence. Home, Events, Event Detail, and Map Discovery were not structurally changed.

## Changed files

- `app/(tabs)/saved.tsx`
- `app/(tabs)/profile.tsx`
- `app/_layout.tsx`
- `app/profile/edit.tsx`
- `app/settings/index.tsx`
- `app/settings/account.tsx`
- `app/settings/notifications.tsx`
- `app/settings/appearance.tsx`
- `app/settings/location.tsx`
- `app/settings/privacy.tsx`
- `app/settings/help.tsx`
- `app/settings/about.tsx`
- `src/features/favorites/FavoritesContext.tsx`
- `src/features/favorites/saved-event-storage.ts`
- `src/features/favorites/useFavoriteToggle.ts`
- `src/features/favorites/types.ts`
- `src/features/favorites/index.ts`
- `src/features/favorites/__tests__/use-favorite-toggle.test.ts`
- `src/features/home/components/HomeHeader.tsx`
- `src/features/home/__tests__/home-location-header.test.ts`
- `src/features/saved/components/SavedEventCard.tsx`
- `src/features/saved/components/SavedEmptyState.tsx`
- `src/features/saved/components/SavedHeader.tsx`
- `src/features/saved/components/index.ts`
- `src/features/saved/index.ts`
- `src/features/saved/utils/saved-presentation.ts`
- `src/features/saved/utils/saved-filters.ts`
- `src/features/profile/components/ProfileScreenContent.tsx`
- `src/features/profile/UserProfileProvider.tsx`
- `src/features/profile/user-profile-storage.ts`
- `src/features/profile/types/user-profile.ts`
- `src/features/profile/components/SettingsPlaceholderScreen.tsx`

## New files

- `src/features/saved/types/saved-event.ts`
- `src/features/saved/__tests__/saved-filters.test.ts`
- `src/features/saved/__tests__/saved-presentation.test.ts`
- `src/features/saved/__tests__/saved-profile-final.test.ts`
- `scripts/capture-saved-profile-screenshots.mjs`
- `docs/SAVED_PROFILE_FINAL_REPORT.md`

## 3. Saved screen status

- **Header:** German title „Gespeichert“ with optional count subtitle when events exist.
- **Filters:** Alle / Demnächst / Vergangen / Abgesagt via existing `SavedFilterBar`.
- **Cards:** `compactPremium` `EventDiscoveryCard` — no separate Saved card family.
- **Interactions:** open event (card tap), remove from Saved (bookmark), share, ticket CTA, status badges.
- **Feedback:** toast on save/remove via root `ToastProvider`.
- **States:** skeleton loading while hydrating, empty state, empty filter results, unavailable event notice.
- **Navigation:** empty CTA → Events tab (`/(tabs)/search`).

## 4. Profile screen status

- **Guest state:** local profile preview, saved count, login/register CTAs, organizer entry, settings list, favorites note.
- **Authenticated state:** `ProfileHeader`, edit + settings shortcuts, my events link, organizer entry, full settings list, sign-out with confirmation dialog.
- **Profile edit:** display name, username, city, bio; validation; unsaved-changes alert (continue / discard / save).
- **Settings:** overview screen plus placeholder subpages (Account, Notifications, Appearance, Location, Privacy, Help, About) — all with working back navigation.
- **Organizer entry:** „Events veranstalten“ → `/create` (existing onboarding hub).
- **Activity:** profile settings row + home header icon → `/activity`.

## 5. Supported Saved states

| State | Support |
| --- | --- |
| Normal upcoming | Yes |
| Featured | Yes (via event card styling) |
| Sold out | Yes (`priceText` / badge, ticket CTA disabled) |
| Cancelled | Yes (`archived` → cancelled badge, ticket disabled) |
| Postponed | Yes (demo override: `klangkuenstler-berghain`) |
| Changed / updated | Prepared via existing status tokens |
| Unavailable / removed | Yes (placeholder event, notice, not auto-removed) |
| Past events | Yes (Vergangen filter) |
| Loading / skeleton | Yes |
| Empty | Yes |
| Empty filter results | Yes |
| Error / offline | Prepared (shared discovery patterns; no artificial async) |

## 6. Auth presentation states

| State | Behavior |
| --- | --- |
| Guest | Browse and save events locally; profile shows guest label + auth CTAs |
| Signed in | Profile data from `UserProfileProvider` + Supabase auth user |
| Sign out | Confirmation dialog before `signOut()` |

No new auth backend was introduced. Existing login/register routes are used.

## 7. Persistence check

- **Storage key v2:** `@eternal_rave/saved_events_v2` with `SavedEventRecord` (`eventId`, `savedAt`, `source`, `notificationPreference`).
- **Migration:** legacy v1 ID array auto-migrates on first hydrate.
- **Guest saves:** enabled — no login gate on favorite toggle.
- **Cross-screen sync:** `FavoritesProvider` at root; `useFavoriteToggle` tracks source (`home`, `events`, `map`, `detail`, `saved`).
- **Unavailable events:** retained in storage and shown with placeholder (no longer stripped on hydrate).
- **Profile:** local AsyncStorage via `user-profile-storage.ts`.
- **Cloud sync:** not implemented (by design).

## 8. Navigation results

| Flow | Result |
| --- | --- |
| A Home → save → Saved → open → Detail | Wired via shared favorites + card navigation |
| B Events → save → Saved → remove | Wired with toast feedback |
| C Map preview → save → Saved | Source `map` tracked; appears in Saved |
| D Saved empty → Events | `router.navigate('/(tabs)/search')` |
| E Profile → edit → save → back | `/profile/edit` with persistence + unsaved dialog |
| F Profile → settings → subpage → back | All settings routes resolve to placeholders |
| G Profile → Events veranstalten → `/create` | Wired |
| H Home notification icon → Activity → back | `router.push('/activity')` |

## 9. Responsive test

- Mobile web: safe areas, bottom inset, horizontal padding via `ResponsiveScreen` / `spacingRoles`.
- Desktop web: screens stay inside responsive shell; no layout breakage observed in structure.
- Long titles: handled by existing `EventDiscoveryCard` truncation.
- Forms: profile edit uses scroll + keyboard-safe inputs.
- Bottom navigation unchanged (Home / Events / Saved / Profile).

## 10. Light / dark theme test

- All new UI uses theme tokens (`useTheme`, `AppText` roles, surface/border colors).
- Status badges reuse existing discovery tokens — no new status colors invented.
- Screenshot script supports `colorScheme: 'dark'` for Saved dark capture.

## 11. Test results

```
npm run typecheck  → passed
npm test           → 122 files, 666 tests passed
```

Focused new coverage:

- `saved-filters.test.ts` — filter tabs and counts
- `saved-presentation.test.ts` — status, sold out, postponed, saved-at labels
- `saved-profile-final.test.ts` — screen wiring, profile edit, settings, activity link
- `use-favorite-toggle.test.ts` — guest local persistence contract
- `home-location-header.test.ts` — activity navigation

## 12. Known open points

- No cloud sync for favorites or profile.
- Settings subpages are high-quality placeholders — no real account/notification backend.
- Profile avatar upload not enforced (field prepared in model only).
- Preferred genres UI on profile edit not yet exposed (model + storage ready).
- `SavedEventRow` legacy component still exists but is unused — safe to remove in a cleanup pass.
- Screenshot capture requires a running web dev server (`SCREENSHOT_BASE_URL`, default `http://localhost:8091`).
- Demo postponed status uses a single fixture override (`klangkuenstler-berghain`).
- Undo on Saved remove not implemented (no existing undo component in V1 scope).

## 13. Visual deviations from mockups

- Event count shown as subtitle under „Gespeichert“ when non-zero (aligned with sprint allowance).
- „Abgesagt“ filter tab added beyond the three core tabs — grouped cancelled/archived events for clarity.
- Profile settings duplicated between header shortcut and settings card (both route to working destinations).
- Authenticated profile uses email as fallback handle when username is empty.

## 14. Screenshots / preview

Generate with dev server running:

```bash
cd app-v2
npx expo start --web --port 8091
node scripts/capture-saved-profile-screenshots.mjs
```

Output directory: `docs/visual-qa/saved-profile-final/`

| Screenshot | Route |
| --- | --- |
| Saved with events | `/saved` (save events first, or extend demo query) |
| Saved empty | `/saved` |
| Saved cancelled/postponed | save `klangkuenstler-berghain` or archived demo event |
| Profile guest | `/profile` (logged out) |
| Profile signed in | `/profile` (logged in) |
| Profile edit | `/profile/edit` |
| Settings overview | `/settings/index` |
| Organizer entry | `/create` |
| Activity empty | `/activity` |

Manual preview routes:

- Saved: `/(tabs)/saved`
- Profile: `/(tabs)/profile`
- Activity: `/activity`

## Recommended next sprint

**EVENT SUBMISSION WIZARD FINAL** — complete the contributor event submission flow from the existing `/create` hub, building on the organizer entry prepared in Profile.
