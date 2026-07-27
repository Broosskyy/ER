# Events Discovery + Event Detail Final

## Scope

This UI-only sprint finalizes the existing Events discovery presentation and connects the already available Event Detail building blocks. It does not add an event source, query backend, ticket sale, organizer flow, crawler, or aggregation logic.

## Changed files

- `src/features/search/components/ExploreFeed.tsx`
- `app/event/[id].tsx`
- `src/features/event-detail/components/BottomTicketCTA.tsx`
- `src/features/event-detail/components/EventInfoRow.tsx`
- `src/features/event-detail/components/LineupList.tsx`
- `src/features/event-detail/components/ExpandableDescription.tsx`
- `scripts/capture-rc2-screenshots.mjs`

## Events discovery

- The existing Events tab remains the discovery hub and keeps its search, filter access, chips, result list, and existing empty/loading/error presentation components.
- Explore now presents a stable hierarchy: Trending in Köln, Heute Abend, Dieses Wochenende, Neu hinzugefügt, In deiner Nähe, Nach Genres, and Top Clubs.
- Trending remains the only poster-first treatment. All normal event discovery rows reuse `compactPremium`.
- Top Clubs reuses the established `VenueSpotlightCard` and Home fixture data. Its press action returns to the active Events discovery tab; it does not imply a newly implemented club detail route.
- Search types (events, clubs, artists, users, friends, organizers) remain a documented future capability. No false multi-entity search UI or filtering behavior was introduced.

## Event detail

- The real detail route now shows a deterministic countdown based on the demo reference date, only from the event start timestamp.
- A native local report dialog is available with clearly non-submitting reason choices. No moderation API or report persistence exists in this sprint.
- Similar events are derived only from published local events sharing at least one genre. The section is omitted only when no such local data exists.
- Ticket CTA wording clarifies that the app opens an existing external ticket URL. The existing no-ticket state remains honest.
- Maps is only offered when an address exists; the existing URL action provides the external fallback.
- The visible event title, metadata, lineup, and description now consume theme-aware typography roles, correcting unreadable light-theme text on the real detail route.

## Verification

- `npm run typecheck` passed.
- Focused Vitest suites passed: 24 tests in 4 files.
- Screenshots generated in `docs/visual-qa/events-discovery-event-detail-final/`:
  - Events mobile and desktop
  - Event Detail mobile and desktop

## Remaining data-dependent gaps

- There is no real multi-entity search index or category-aware result model.
- “In deiner Nähe” is a presentation label until location/radius filtering is connected.
- Similarity is genre overlap, not personalized recommendations.
- Report reasons do not submit to a moderation backend.
- External ticket and map availability remain dependent on source data.

## Recommendation

The next sprint can implement the Event Discovery data and interaction layer only after the required event, club, artist, and location data contracts are agreed. The visual foundation is complete without pretending that unavailable product data exists.
