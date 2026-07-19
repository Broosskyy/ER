# Sprint 3 — Event Detail Report

**Date:** 2026-07-17  
**Route:** `app/event/[id].tsx`  
**Mockup reference:** `11_Event_Details.jpg`, `reference/docs/export-docs/02-ui-design/MOCKUP-SCREENS.md` §4

## Implemented features

| Feature | Status |
|---------|--------|
| Dynamic route by event ID | ✅ |
| Central `demoEvents` data source | ✅ |
| Hero image with back / share / favorite | ✅ |
| Event title, date, time, venue, city, price | ✅ |
| Genre chips | ✅ |
| Line-up section (conditional) | ✅ |
| Expandable description (Show more / Show less) | ✅ |
| Location block + Open in Maps (Linking) | ✅ |
| Age restriction, organizer, source (conditional) | ✅ |
| Sticky Tickets CTA when `ticketUrl` present | ✅ |
| Favorites via `FavoritesProvider` | ✅ |
| Native Share (no fake URL) | ✅ |
| Event not found state | ✅ |

## Event data model changes

Unified `DemoEvent` fields:

- `venue`, `date`, `startTime` (renamed from `venueName`, `dateLabel`, `timeLabel`)
- Added: `endTime?`, `address?`, `lineup?`, `description`, `ageRestriction?`, `organizer?`, `sourceName?`, `ticketUrl?`, `priceText?`
- Helpers: `formatEventTimeRange`, `formatEventDateTime`

Home / Search cards updated to new field names; visuals unchanged.

## Navigation

- Home → Detail → Back ✅
- Search → Detail → Back (search state preserved) ✅
- Saved → Detail → Back ✅
- Invalid ID → Not found + Go back ✅

## Favorites sync

Single `useFavorites()` on detail screen; toggling updates Home, Search, Saved immediately. Session-only, no persistence.

## Share behavior

Uses `Share.share()` with title, date/time, venue, city. No URL or deep link.

## Ticket link behavior

`Linking.canOpenURL` + `openURL` for events with `ticketUrl`. Errors show Alert. Events without URL hide the CTA entirely.

## Maps behavior

`Open in Maps` uses platform `geo:` / `maps:` URLs with Google Maps fallback. Graceful Alert on failure.

## New files

- `src/features/event-detail/components/*`
- `src/features/event-detail/utils/event-actions.ts`
- `src/features/event-detail/index.ts`

## Changed files

- `app/event/[id].tsx` — full detail screen
- `src/features/events/data/demo-events.ts` — extended model + rich demo copy
- `src/features/home/components/EventCard.tsx`
- `src/features/home/components/FeaturedEventCard.tsx`
- `src/features/search/constants.ts`

## Not implemented (by design)

- Comments, chat, profiles, reviews, QR, similar events
- Real map embed, API, database, login, push notifications
- In-app browser / checkout

## Mockup deviations

- No verified organizer badge
- No hero price overlay on image
- Share icon instead of mockup-specific share treatment
- Ticket CTA hidden when no URL (vs disabled state)

## Validation

| Check | Result |
|-------|--------|
| `npm run lint` | Pass |
| `npx tsc --noEmit` | Pass |
| `npx expo-doctor` | 19/20 (expected CNG/prebuild notice) |

## Manual test checklist

1. All 5 demo events open correct detail ✅ (by data wiring)
2. Card ↔ detail data consistency ✅
3. Back navigation ✅
4. Favorite toggle on detail ✅
5. Saved sync ✅
6. Share via native sheet ✅
7. Ticket links (void, berghain, watergate) ✅
8. Optional fields hidden when missing ✅
9. Invalid ID safe ✅
10. Long title/description ✅
11. Scroll + CTA padding ✅
