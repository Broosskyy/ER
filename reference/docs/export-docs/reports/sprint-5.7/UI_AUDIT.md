# UI Audit — Sprint 5.7

## Scope

Mockup fidelity polish for Home, Events, shared components, and branding tokens. No new features.

## Components Added

| Component | Purpose |
|-----------|---------|
| `DateBadge` | Mockup white date pill (day + month) |
| `ClubCard` / `ClubCardRow` | Top Clubs vertical cards with gradient overlay |
| `EventsFilterBar` | Filter / Datum / Genre / Ort / Sortieren row |

## Components Updated

| Component | Changes |
|-----------|---------|
| `FeaturedEventCard` | Carousel-ready, DateBadge, genre caps, purple price, AnimatedPressable |
| `EventCard` | New `homeCompact` and `events` variants matching mockups |
| `FilterChip` | Inactive chips: elevated surface, primary text |
| `HomeScreenHeader` | Removed redundant location subtitle |
| `home.tsx` | Category filters, hero carousel, club cards, mockup sections only |
| `search.tsx` | DE chips, filter bar, map link, events card variant |

## Design Tokens (`theme.ts`)

- `HomeCategoryFilters` — DE labels for Home chips
- `EventsCategoryFilters` — includes Hard Techno
- Existing `BorderRadius`, `Shadows`, `Spacing` reused consistently

## Typography

- Section titles: `text-xl font-bold`
- Events screen title: `text-2xl font-bold`
- Genre labels: `text-[10px] uppercase tracking-wider text-primary`
- Prices: green on Events list, purple on Home hero

## Spacing & Safe Areas

- Screen horizontal padding: `px-4` (16px) — matches `Spacing.screen`
- Bottom scroll padding: `insets.bottom + BOTTOM_NAV_HEIGHT + 24`
- Section gaps: `mt-4` between major blocks

## Shadows & Radius

- Cards: `BorderRadius.md` (12px) list/compact, `BorderRadius.lg` (16px) featured/clubs
- Shadows: flat border-first UI per Band 2; no new heavy shadows added

## Placeholder Assets

All imagery uses mockup-derived assets from `placeholderAssets.ts` — no gray placeholders in consumer UI.

## Animation

- Card press: `AnimatedPressable` scale 0.97–0.98
- Filter chips: scale 0.94
- Bottom nav: scale 0.96 + haptic on tab change
- No exaggerated transitions added (per sprint spec)
