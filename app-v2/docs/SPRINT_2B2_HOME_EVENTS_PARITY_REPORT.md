# Sprint 2B.2 — Home & Events Mockup Parity + Search Interaction Fix

**Date:** July 2026  
**Status:** Implementation complete — manual visual QA recommended before Saved migration  
**Scope:** Consumer Home + Events tab only (no Saved migration)

---

## A. Root-Cause Audit

| # | Problem | Root cause | File(s) | Fix |
|---|---------|------------|---------|-----|
| 1 | Dominant Home SearchBar | `HomeSearchEntry` rendered full-width disabled `SearchBar` | `HomeSearchEntry.tsx`, `index.tsx` | Removed from Home; replaced with header icon trigger |
| 2 | Permanent filter chips on Home | `FilterChipRow` wired in Home scroll | `index.tsx` | Removed from Home (filters remain on Events tab) |
| 3 | Overloaded Home header | `CreateHeaderButton` in `HomeHeader` left slot | `HomeHeader.tsx` | Removed from consumer Home header; Create remains at `/create` via profile/organizer flows |
| 4–6 | Single almost-full-width featured card | `getFeaturedCardWidth()` used peek formula for one-up carousel | `featured-card-layout.ts`, `index.tsx` | Two-up width: `(viewport − 2×16px − 12px) / 2`; `featuredHome` variant |
| 7–8 | Weak image priority / heavy chrome | `featured` variant with 16:9 + elevated card + large text block | `EventCard.tsx`, `event-card-styles.ts` | `featuredHome`: 11:10 image ratio, compact meta, favorite on image, price trailing |
| 9–11 | List row trailing collision | Time inside text `topMeta`; `InteractiveCard` trailing overlapped content | `EventListItem.tsx` | Four zones: thumbnail · text (flex) · time · favorite (sibling column) |
| 12 | Events search not editable | `TouchableWithoutFeedback` wrapped `SearchInput`, swallowing taps on web | `search.tsx` | Removed wrapper; `SearchInput` forwardRef + imperative focus |
| 13 | Token-correct but wrong composition | Library components used without mockup-specific variant/config | Multiple | Variant extensions + screen composition changes |
| 14 | Prior report too generous | Layout math and interaction blockers not validated | — | This report uses strict parity statuses |

---

## B. Vorher/Nachher-Struktur

| Zone | Before | After |
|------|--------|-------|
| **Home Header** | Create · Wordmark · Notification | Spacer · Wordmark · Search icon · Notification |
| **Home Search** | Full disabled SearchBar | Header magnifier → Events tab + focus |
| **Home Filters** | Permanent `FilterChipRow` | Removed (Events tab only) |
| **Featured** | ~1 card width (`width − padding − peek`) | Two full cards at 390px: **173px** each |
| **Tonight Rows** | Thumbnail + text/time mixed + trailing favorite overlap | Thumbnail + text + time column + favorite column |
| **Clubs** | Not on Home | Horizontal `VenueSpotlightCard` rail (fixture data) |
| **Events Search** | Wrapped in dismiss pressable | Standalone editable `SearchInput` with ref focus |
| **Favorites** | Featured overlay on whole card; list trailing collision | Featured: on image; List: dedicated trailing column |

---

## C. Geänderte Dateien

- `app/(tabs)/index.tsx`
- `app/(tabs)/search.tsx`
- `src/features/home/components/HomeHeader.tsx`
- `src/features/home/components/featured-card-layout.ts`
- `src/features/home/components/index.ts`
- `src/features/collections/event-collection-config.ts`
- `src/components/discovery/EventCard.tsx`
- `src/components/discovery/EventListItem.tsx`
- `src/components/discovery/EventImage.tsx`
- `src/components/discovery/event-card-styles.ts`
- `src/components/index.ts`
- `src/design/layout.ts`
- `src/features/search/components/SearchInput.tsx`
- `src/features/search/components/index.ts`
- `src/features/search/index.ts`
- `src/features/home/__tests__/home-location-header.test.ts`
- `src/features/home/__tests__/featured-card-layout.test.ts`
- `src/features/search/__tests__/search-interaction-layout.test.ts`
- `src/features/collections/__tests__/collections.test.ts`

## D. Neue Dateien

- `src/features/home/components/HomeHeaderSearchButton.tsx`
- `src/components/discovery/VenueSpotlightCard.tsx`
- `src/features/home/data/home-club-fixtures.ts`
- `docs/SPRINT_2B2_HOME_EVENTS_PARITY_REPORT.md`

## E. Entfernte Dateien

- `src/features/home/__tests__/home-search-entry.test.ts` (replaced by header search + layout tests)

**Note:** `HomeSearchEntry.tsx` retained but no longer used on Home (safe to remove in cleanup sprint).

## F. Wiederverwendete Komponenten

- `EventCard` / `EventDiscoveryCard` (extended variant)
- `EventListItem` / `EventDiscoveryListItem` (layout restructure)
- `EventImage`, `FavoriteButton`, `IconButton`, `SearchSectionHeader`
- `LocationSelector`, `NotificationButton`, `SearchInput`

## G. Erweiterte Komponenten

| Component | Extension | Reason |
|-----------|-----------|--------|
| `EventCard` | `featuredHome` variant | Mockup 09 two-up cards: image-dominant, favorite on image, compact footer |
| `EventImage` | `featuredHome`, `spotlight` variants | Aspect ratios for home featured + club cards |
| `EventListItem` | Four-zone row layout | Mockup Tonight rows |
| `SearchInput` | `forwardRef`, theme tokens, web outline fix | Functional search + focus from Home |
| `VenueSpotlightCard` | New discovery presentational card | Top Clubs rail (not a parallel EventCard) |

---

## H. Featured-Card-Proportionen (390px viewport)

| Token | Value |
|-------|-------|
| Screen horizontal padding | 16px × 2 = 32px |
| Inter-card gap | 12px (`spacing.md`) |
| **Card width** | `(390 − 32 − 12) / 2 = **173px**` |
| Image aspect (`featuredHome`) | 11:10 → height ≈ 157px |
| Text block padding | 8px (`spacing.sm`) |
| Snap interval | 173 + 12 = 185px |

At 360px: card width = **158px**.

---

## I. List-Row-Layout (vier Zonen)

```
[Thumbnail 64×64 + date badge] | [Text flex:1 minWidth:0] | [Time min 48px] | [Favorite 44×44]
```

- Favorite is **outside** the main `InteractiveCard` pressable
- Genre chips (max 2) below venue in text zone
- Time removed from text `topMeta`

---

## J. Search-Interaktionsfluss

1. **Home trigger:** `HomeHeaderSearchButton` → `requestSearchFocus()` + `router.push('/(tabs)/search')`
2. **Navigation:** Events tab mounts
3. **Focus:** `searchInputRef.current?.focus()` via `requestAnimationFrame`
4. **Eingabe:** `SearchInput` `editable` + `onChangeText={setQuery}` (no parent pressable)
5. **Filterung:** `applyEventFilters` reacts to `filters.query`
6. **Clear:** `events-search-clear` button → `onChangeText('')`

---

## K. Light/Dark

- `SearchInput` uses `useTheme()` for surface, border, text colors
- Cards use existing theme tokens (`surface`, `accent`, `overlay`)
- Manual device QA still required for warm light / deep graphite dark against reference PNGs

---

## L. Side-by-Side-Paritätsmatrix

| Zone | Reference | Current | Deviation | Status | Notes |
|------|-----------|---------|-----------|--------|-------|
| Header | Logo + notification, no Create | Logo + search + notification | Create removed | **NEAR MATCH** | Mockup shows logo left; we center wordmark |
| Home search trigger | Small icon (2B.2 spec) | Header search icon | No inline search bar | **NEAR MATCH** | Mockup 09 still shows inline bar; 2B.2 spec overrides |
| Home filters | Not on Home (2B.2) | Removed | — | **NEAR MATCH** | Per sprint scope |
| Featured section | 2 cards visible, image-dominant | 2×173px `featuredHome` | Typography density | **NEAR MATCH** | Needs device visual check |
| Tonight rows | 4-zone layout | Implemented | Row height may differ slightly | **NEAR MATCH** | |
| Favorite featured | On image top-right | On image overlay | — | **NEAR MATCH** | |
| Favorite list | Trailing column | Dedicated column | — | **NEAR MATCH** | |
| Top Clubs | Image cards horizontal | Fixture rail + `VenueSpotlightCard` | Real venue API not wired | **ACCEPTABLE MINOR DEVIATION** | `BLOCKED BY ASSET/DATA` for production venues |
| Bottom nav | 5 tabs | Unchanged | — | **NEAR MATCH** | Not modified this sprint |
| Events search | Editable field | Fixed interaction | — | **NEAR MATCH** | Verify on physical device |
| Light mode | Warm off-white | Theme tokens | — | **ACCEPTABLE MINOR DEVIATION** | Manual QA |
| Dark mode | Deep graphite | Theme tokens | — | **ACCEPTABLE MINOR DEVIATION** | Manual QA |

---

## M. Tests und Builds

| Check | Result |
|-------|--------|
| Tests | **639 passed** (116 files) |
| TypeScript | ✅ |
| ESLint | ✅ 0 errors (pre-existing warnings) |
| Web build | ✅ `dist` exported |

New/updated test coverage:
- Home: no SearchBar/FilterChipRow; header search; featuredHome; two-up width formula
- Search: no TouchableWithoutFeedback; editable input + ref
- List row: four zones; favorite outside pressable
- Featured: favorite on image for `featuredHome`

---

## N. Verbleibende Abweichungen

1. **Home inline search vs header icon:** Sprint 2B.2 explicitly requires header trigger; differs from Mockup 09 PNG inline bar.
2. **Top Clubs:** Fixture data only — no venue discovery API on Home.
3. **Section titles:** English ("Events near you", "Tonight") vs German mockup labels.
4. **Create button:** Removed from Home header; still at `/create` — confirm profile entry is obvious to users.
5. **Manual visual QA** on 360/390/430px + light/dark not automated.

---

## O. Empfehlung

**2. Weitere konkret benannte Minor-Fixes sind erforderlich.**

Home and Events are substantially closer to the approved references and the search blocker is fixed. Before Saved migration:

1. Manual visual sign-off on 390px light/dark against `09_Home.png`
2. Device test of Events search keyboard + scroll
3. Decide i18n for section titles (DE vs EN)
4. Wire Top Clubs to real venue data or accept fixture rail until venue discovery ships

**Saved migration remains blocked until product visual approval.**
