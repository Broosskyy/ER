# Phase 4.6.3 Part 2 — Public Application Consistency Report

**Date:** 2026-08-02  
**Scope:** Public UX consistency (no new sources, no social/commerce/ticketing, no visual redesign)

---

## Executive summary

Part 2 closes cross-surface gaps found in real-user testing: **generic entity profiles**, **configurable search preview**, **unified local filter predicates**, **location city search**, **price/ticket parity on search tiles and detail info**, and **vertical venue address layout**.

Part 1 data-quality fixes (lineup, descriptions, ticket URLs) still require a **production re-import** before live data reflects those changes.

---

## Deliverables

| # | Area | Status | Notes |
|---|------|--------|-------|
| 1 | Profile completeness | **Improved** | About tab with description, location, genres, social links; hero/cover from image URLs; follower count; upcoming/past events; empty sections hidden |
| 2 | Profile consistency | **Improved** | Single `PublicEntityProfileScreen`; venue type labels via `entity-type-labels.ts` (no Bootshaus-specific UI) |
| 3 | Universal search | **Existing + prior** | Short-query score gate in `universal-search-service.ts`; local filters extended for price/environment/entities/distance |
| 4 | Search preview | **Done** | `search-preview-config.ts` — Upcoming, Today, Tomorrow, weekends, Trending, Nearby, Recently Added (not fixed window) |
| 5 | Filter unification | **Improved** | `applyEventFilters` now applies price, venue environment, entity IDs, custom date window, distance (with location context) |
| 6 | Location experience | **Improved** | City search input in `LocationPickerModal`; scalable city list from filter config |
| 7 | Event detail consistency | **Improved** | Info price row uses `resolvePublicTicketPresentation` |
| 8 | Badge system | **Prior work** | Canonical ticket presentation layer; no new badge redesign in this pass |
| 9 | Price parity | **Improved** | `discovery-tile-view-model.ts` wired to `resolvePublicTicketPresentation` |
| 10 | Address presentation | **Improved** | `VenueDetailCard` — venue name, street, city, route button stacked vertically |
| 11 | Home consistency | **Prior work** | Home cards already use `EventDiscoveryCard` / ticket presentation |
| 12 | Saved events | **Prior work** | AsyncStorage + canonical ID dedupe in `FavoritesContext` |
| 13 | Loading states | **Partial** | Profile skeletons; explore sections omit empty buckets |
| 14 | Mobile UX | **Partial** | Location sheet search field; venue card vertical stack |
| 15 | Manual validation | **Pending** | Requires browser walkthrough on listed entities |

---

## Key files

```
src/features/search/config/search-preview-config.ts
src/features/search/utils/filter-events.ts
src/features/search/utils/discovery-tile-view-model.ts
src/features/profiles/components/PublicEntityProfileScreen.tsx
src/features/profiles/components/EntityProfileAboutSection.tsx
src/features/profiles/utils/entity-profile-about.ts
src/features/profiles/utils/entity-type-labels.ts
src/features/location/components/LocationPickerModal.tsx
src/components/event-detail/VenueDetailCard.tsx
src/features/event-detail/utils/event-detail-view-model.ts
```

---

## Testing

| Check | Result |
|-------|--------|
| `npm run typecheck:app` | Pass |
| `vitest` filter-events + profiles | 24 tests pass |
| Expo Web manual walkthrough | **Not run in this session** |
| Mobile validation | **Not run in this session** |

---

## Remaining gaps (Part 3 / follow-up)

- Gallery section (contract reserved; no media pipeline yet)
- Related artists/clubs on profiles
- Server-backed follow counts (local AsyncStorage foundation remains)
- ZIP / address provider geocoding (search field placeholder only)
- Full Home ↔ Search ↔ Map filter state single provider (Discovery API path vs local `applyEventFilters` for explore)
- Manual validation checklist for Bootshaus, Affenkäfig, Lehmann, Proton, Area51, Technodampfer, PLAY!, Sommerfest, etc.
- Production re-import after Part 1 data fixes

---

## Go / no-go

**Conditional GO** for Part 3 browser acceptance after:

1. Manual walkthrough of Search preview sections, profiles, and event detail price parity
2. Production re-import (`_phase462-production-activation.ts`) to apply Part 1 data quality fixes
