# Mockup Comparison — Sprint 5.7

**Reference:** `/assets/mockups/` ZIP archives + extracted PNGs in `/assets/onboarding/`

## Home (`09_Home.png`)

| Element | Mockup | Before 5.7 | After 5.7 |
|---------|--------|------------|-----------|
| Header logo + wordmark | Purple logo, ETERNAL RAVE caps | ✅ Present | ✅ Unchanged |
| Location pill | Berlin, Germany + filter icon | ✅ Present | ✅ Unchanged |
| Search bar | Full-width, DE placeholder | ✅ Present | ✅ Unchanged |
| Category chips | Alle, Heute, Dieses Wochenende, Techno, House | Partial (date-only) | ✅ Full DE set |
| Hero section | Horizontal carousel, date badge, heart, purple price | Single featured card, purple "Featured" badge | ✅ Carousel + DateBadge |
| Heute Abend | Compact rows, time top-right, date on thumb | Generic compact card | ✅ `homeCompact` variant |
| Top Clubs | Vertical image cards with name overlay | Story circles | ✅ ClubCard carousel |
| Extra sections | Not in mockup | Trending, New, More near you | ✅ Removed for fidelity |
| Bottom nav | 5 tabs, purple active | ✅ Present | ✅ Unchanged |

## Events (`10_Events.png`)

| Element | Mockup | Before 5.7 | After 5.7 |
|---------|--------|------------|-----------|
| Screen title | "Events" large bold | ✅ Present | ✅ Larger (2xl) |
| Category chips | Alle, Heute, Wochenende, Techno, House, Hard Techno | 3 separate genre/city/date rows | ✅ Single DE chip row |
| Filter bar | Filter, Datum, Genre, Ort, Sortieren | Missing | ✅ EventsFilterBar |
| Results row | Count + "Karte anzeigen" | Count only | ✅ Map link added |
| Event cards | Date badge, genre caps, time, green price, tags, heart | Generic compact | ✅ `events` variant |
| Card price color | Green "Ab X,XX €" | White/primary | ✅ `Colors.success` |

## Navigation

| Element | Mockup | Status |
|---------|--------|--------|
| Bottom nav labels | Home, Events, Map, Saved, Profile | ✅ |
| Active tab indicator | Purple icon + underline | ✅ |
| Back buttons | Standard stack | ✅ (unchanged) |
| Press animation | Subtle scale | ✅ AnimatedPressable |

## Branding gaps closed

- Unified card radius via `BorderRadius.md` / `BorderRadius.lg`
- Filter chips: inactive = elevated surface (no border), active = primary fill
- German price format: `Ab 15,00 €` via `formatPriceGerman`
- Date badge: white box with day + month (mockup-accurate)

## Remaining minor gaps

- Filter dropdowns on Events are toggle stubs (no full picker UI — out of scope, no new features)
- Sort order not persisted (visual filter bar only)
- Event Details / Map / Saved / Profile not re-audited in this sprint (focus: Home + Events)

## Mockup Match Estimate

| Screen | Before | After |
|--------|--------|-------|
| Home | ~72% | **~91%** |
| Events | ~68% | **~89%** |
| Navigation | ~85% | **~88%** |
| **Overall** | **~75%** | **~89%** |
