# Events + Event Detail Component System Restoration

## Changed files

- `app/event/[id].tsx`
- `app/(tabs)/search.tsx`
- `app/(tabs)/_layout.tsx`
- `src/components/discovery/EventCard.tsx`
- `src/features/events/formatting/event-card-view-model.ts`
- `src/features/events/data/demo-images.ts`
- `src/features/events/index.ts`
- `src/features/events/status/event-status-resolver.ts`
- `src/features/event-detail/utils/event-detail-view-model.ts`
- `src/features/saved/utils/saved-presentation.ts`
- `src/features/search/components/ExploreFeed.tsx`
- `src/features/search/components/FilterSummaryBar.tsx`
- `src/features/i18n/locales/de.ts`
- `src/features/i18n/locales/en.ts`
- `src/platform/tab-bar-insets.ts`

## New files

- `src/features/events/status/event-status-resolver.ts`
- `src/features/events/status/__tests__/event-status-resolver.test.ts`
- `src/features/event-detail/utils/event-detail-view-model.ts`
- `src/features/events/__tests__/events-event-detail-restoration.test.ts`
- `docs/COMPONENT_USAGE_BEFORE_AFTER.md`
- `docs/BADGE_LABEL_FUNCTION_MATRIX.md`
- `docs/EVENT_STATUS_RESOLVER.md`
- `scripts/capture-events-restoration-screenshots.mjs`

## Reused components

`EventHero`, `EventInfoSection`, `EventMetaRow`, `EventTicketSection`, `EventNoticeBanner`, `LineupSection`, `VenueDetailCard`, `OrganizerDetailCard`, `SimilarEventsSection`, `CategoryChip`, `EventStatusBadge`, `TicketStatusBadge`, `EventDiscoveryCard` (`compactPremium`, `verticalPremium`, `featuredHome`), `VenueSpotlightCard`, `SearchSectionHeader`, `MapListToggle`

## Events screen status

- Explore discovery uses component-system cards (no poster grid)
- Trending: horizontal `verticalPremium` / `featuredHome` rail
- Other sections: vertical `compactPremium` lists
- Search results: `compactPremium` with status badges
- Header: title, search, quick filters, map/list toggle, localized filter summary
- Favorites wired through explore + search

## Event detail status

- Rebuilt with Phase 2F specialized components
- German localization via `eventDetail.*` keys
- Ticket section visible with sold-out/cancelled/free modes
- Notice banner for cancelled/postponed
- Venue, organizer, source, report, similar events connected

## Verification

```
npm run typecheck → passed
npm test          → 124 files, 676 tests passed
```

## Screenshots

```bash
cd app-v2
npx expo start --web --port 8091
node scripts/capture-events-restoration-screenshots.mjs
```

Output: `docs/visual-qa/events-event-detail-restoration/`

## Known open points

- Organizer profile route still placeholder (card is informational)
- Club detail not implemented
- `newly_added` status not yet bound to import timestamps
- Genre filter deep link via query param needs SearchContext wiring for full activation

## Recommended next sprint

**EVENT SUBMISSION WIZARD FINAL**
