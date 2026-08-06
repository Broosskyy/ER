# Phase 4.6.2 Part 2 — Public UX, Mobile Experience & Entity Consistency

**Date:** 2026-08-02  
**Scope:** Public application only (no new sources, no social/commerce/ticketing, no visual identity redesign)

---

## Executive summary

Part 2 focused on **cross-surface consistency** for ticket/price semantics, **similar-events ranking**, **truthful lineup states**, **event-detail deduplication**, **profile header completeness**, and **map preview parity**. Part 1 (data integrity) and Phase 4.6 Final Polish remain prerequisites for live data quality.

---

## 1. Event Detail consistency

**Status:** Improved

| Section | Behavior |
|---------|----------|
| Hero | Title, venue, city, time, ticket label, status badges |
| Genre chips | Dedicated row below hero (hero genre tags hidden on detail to avoid duplication) |
| Info | Date/time, environment, festival, age — venue & organizer moved to dedicated cards |
| Tickets | Dedicated ticket section (price removed from info when ticket section present) |
| Lineup | Always rendered with truthful empty/partial/full states |
| Venue | `VenueDetailCard` with route action |
| Organizer | Card when canonical organizer exists; removed from info list |
| Similar events | Discovery query + ranking (see §19) |
| Timetable | Still hidden until real slot data exists |

**Gaps:** `galleryImageUrls`, `shortDescription`, structured admission blocks; timetable still stubbed.

---

## 2. Lineup presentation

**Status:** Improved

- **Complete:** `LINE-UP` section title, artist cards from canonical IDs
- **Partial:** `ARTIST` (single) / `BEKANNTE ARTISTS` (multiple inferred)
- **No lineup:** Placeholder card — *"Kein Line-up verfügbar."* vs *"Line-up wird bald bekannt gegeben."*
- Section always visible on detail (no silent hide)
- Headliner flag still uses first position only (no explicit headliner field yet)

**Files:** `lineup-completeness.ts`, `event-detail-view-model.ts`, `LineupSection.tsx`

---

## 3. Description UX

**Status:** Partial (unchanged from Part 1 projection)

- `ExpandableText` + `normalizePublicEventDescription` preserve paragraphs
- **Not implemented:** Separate Admission, Venue Notes, Ticket Notes, FAQ blocks from structured source fields

---

## 4. Price & availability parity

**Status:** **Major improvement**

Introduced shared layer:

- `ticket-presentation.ts` — `resolvePublicTicketPresentation()`, `resolveSemanticThemeColor()`
- `TicketPriceLabel` component — single semantic color mapping

**Surfaces now wired:**

| Surface | Price label | Semantic color |
|---------|-------------|----------------|
| EventCard (featured, compactPremium, verticalPremium, legacy) | ✓ | ✓ |
| EventListItem (similar events, search lists) | ✓ | ✓ |
| EventHero | ✓ | ✓ |
| Map preview + bottom sheet | ✓ | ✓ |
| Map selectors (`map-discovery-selectors`) | ✓ | via presentation resolver |
| Saved / home rails | ✓ | via `toEventCardViewModel` |

Ticket badges (`TicketStatusBadge`) remain separate from price text; sold-out/limited use badge + label semantics.

---

## 5. Badge experience

**Status:** Partial

- `event-status-resolver` maps lifecycle + price semantics to consumer statuses
- Card badges: status + ticket status on premium variants
- **Gaps:** Not all `ConsumerEventStatus` values surface as visible chips on every card type; indoor/outdoor/free badges need dedicated chip row on detail

---

## 6. Semantic colors

**Status:** Implemented (foundation)

| Token | Theme mapping |
|-------|----------------|
| `success` | `theme.colors.success` (available, free) |
| `accent` | `theme.colors.accent` (paid, limited) |
| `unavailable` | `theme.colors.textMuted` (sold out) |
| `muted` | `theme.colors.textMuted` (unknown) |

All `TicketPriceLabel` usages share this mapping. Warning token reserved for future age/warning badges.

---

## 7. Profile experience

**Status:** Improved

- **Artist genres:** Loaded from `genreRepository` → profile header subtitle
- **Follower count:** Shown in `ProfileHeader` stats when `useEntityFollow` hydrates
- Cover image, bio, website, location, events tabs remain as before
- **Gaps:** Past events tab contract, social links UI, cover images for all entity types, placeholder profiles still possible for text-only entities

---

## 8. Profile routing

**Status:** Stable (from Phase 4.6)

- Internal/test entity IDs blocked at loader level
- Canonical slug → ID redirect on profiles
- Text-only organizer names on events without `organizerId` are not navigable (by design)

---

## 9. Follow experience

**Status:** Partial

- Optimistic toggle, loading state, duplicate prevention in `useEntityFollow`
- Follower count updates on profile header
- **Gaps:** `entity_follows` migration may not be deployed to production; no login CTA for unauthenticated users; follow only on organizer card on event detail (not venue/artists)

---

## 10. Location Picker

**Status:** Not changed in Part 2

- Cities from `filter-config`; Köln/Berlin coords in `discovery-city-options`
- **Gaps:** ZIP/address search, unified radius presets (home vs map), map clear-location, full searchable city catalogue

---

## 11. Search preview

**Status:** Not changed in Part 2

- `SearchExplorePanel` on empty focused search
- **Gaps:** Configurable preview sections, i18n keys vs hardcoded German labels

---

## 12. Filters

**Status:** Not unified in Part 2

- Search/map use `filter-config.ts`; home chips partially configured
- **Gaps:** Single filter state across home/search/map/calendar

---

## 13. Venue presentation

**Status:** Stable (Phase 4.6 polish)

- `VenueDetailCard` vertical layout with route button
- **Gap:** Minor mobile cramping on very long venue names

---

## 14. Mobile UX

**Status:** Incremental

- Ticket labels on compact cards improve information density without horizontal cramming
- **Gaps:** Full mobile audit (action rows, profile headers) not re-run in browser this session

---

## 15. Home consistency

**Status:** Stable (Phase 4.6)

- Rails use `toEventCardViewModel` → same ticket semantics as other surfaces
- Default 6 cards per rail

---

## 16. Owner profile

**Status:** Stable (Phase 4.6)

- Auth-scoped profile storage, edit hydration, saved count from `savedEvents.length`

---

## 17. Verification states

**Status:** Stable

- `entity-verification-status.ts` + `VerificationBadge` differentiate official source, unclaimed, organizer confirmed
- Heuristic official-source IDs for known venues/organizers

---

## 18. Search relevance

**Status:** Stable (Phase 4.6)

- Ranking improvements in `universal-search-service.ts`
- **Gap:** Further tuning per Part 2 spec (description should not outrank exact title matches) — monitor in manual QA

---

## 19. Similar Events

**Status:** **Fixed**

**Problem:** `buildSimilarEventsQuery` AND-filtered venue + organizer + city + genres → often zero results.

**Fix:**

- Hard filters: `genres` + `city` only
- Ranking signals via `DiscoveryQuery.similarTo`: venue, organizer, festival, artist overlap bonuses in `discovery-ranking-service`

**Files:** `discovery-query-types.ts`, `discovery-query-presets.ts`, `discovery-engine.ts`, `discovery-ranking-service.ts`

---

## 20. Manual validation

**Status:** Pending

Recommended manual pass (browser + mobile):

- Bootshaus, PLAY!, Technodampfer, Affenkäfig, SHOCKONE, Lehmann, Mallorca
- Saved events, owner profile, search, location picker, profile navigation, follow, mobile layouts

Dev server: `http://localhost:8081` (Expo Web)

---

## 21. Remaining UX issues

| Priority | Issue |
|----------|-------|
| High | Production re-import for Part 1 lineup fixes to affect live data |
| High | Deploy `entity_follows` migration for persistent follow |
| Medium | Structured description sections (admission, FAQ, ticket notes) |
| Medium | Unified filters + location picker (ZIP, address, radius parity) |
| Medium | Search preview configurability |
| Medium | Follow on venue + lineup artists; login CTA |
| Low | Timetable extraction from sources |
| Low | Explicit headliner flag vs positional inference |
| Low | `validate:build-output` service-role key in bundle |

---

## Testing

| Check | Result |
|-------|--------|
| `npm run typecheck:app` | ✓ Pass |
| Vitest (event-detail, discovery, map) | ✓ 35 tests pass |
| ESLint | Not re-run this session |
| Expo Web manual | Pending |
| Mobile/tablet manual | Pending |

---

## Key files changed (Part 2 session)

- `src/features/events/formatting/ticket-presentation.ts` (new)
- `src/components/discovery/TicketPriceLabel.tsx` (new)
- `src/features/events/formatting/event-card-view-model.ts`
- `src/components/discovery/EventCard.tsx`, `EventListItem.tsx`, `view-models.ts`
- `src/components/event-detail/EventHero.tsx`, `view-models.ts`
- `src/features/event-detail/utils/event-detail-view-model.ts`, `lineup-completeness.ts`
- `src/features/discovery/domain/discovery-query-types.ts`
- `src/features/discovery/api/discovery-query-presets.ts`
- `src/features/discovery/services/discovery-engine.ts`
- `src/features/events/discovery/discovery-ranking-service.ts`
- `src/features/map/components/MapEventPreview.tsx`, `MapEventPreviewBottomSheet.tsx`
- `src/features/map/utils/map-discovery-selectors.ts`
- `src/features/profiles/hooks/useEntityProfile.ts`
- `src/features/profiles/components/PublicEntityProfileScreen.tsx`
- `app/event/[id].tsx`

---

## Success criteria checklist

| Criterion | State |
|-----------|-------|
| Event detail canonical information | Improved; timetable/structured desc open |
| Truthful lineup | ✓ |
| Clean descriptions | Partial |
| Price/badge parity across surfaces | ✓ (ticket label + colors) |
| Complete profile pages | Improved (genres, followers) |
| Consistent entity routing | ✓ (existing) |
| Follow for supported entities | Partial (persistence/migration) |
| Location picker searchable cities | Open |
| Search preview defined | Open |
| Unified filtering | Open |
| Mobile layouts not cramped | Incremental |
| Home section consistency | ✓ via shared view models |
| Manual testing confirmed | Pending |
