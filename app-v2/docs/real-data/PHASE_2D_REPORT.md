# Phase 2D Report — Domain Integration & Event Lifecycle

Sprint 8 Phase 2D completion report. Stops before Phase 2E. No productive source, scheduler, or social import.

## Verification

| Check | Result |
|-------|--------|
| Typecheck | ✅ `tsc --noEmit` |
| Tests | ✅ **847** passed (168 files) |
| Lint | ✅ 0 errors (1014 pre-existing warnings) |
| Migrations | ✅ No new migration; `validate:migrations` unchanged |

## Implemented Relationships

### Event Model
- Consumer `Event` extended: `venueId`, `organizerId`, `artistIds`, `genreIds`, `canonicalEventId`, lifecycle timestamps, `ticketStatus`
- `event-mapper.ts` maps FK and lifecycle columns from Supabase rows

### Lifecycle
- Single `EventLifecycleResolver` — no duplicate status logic
- `rejected` editorial status → `archived` lifecycle
- `toEventLifecycleInput` bridges Event → resolver
- `EventDisplayModel.lifecycleStatus` for UI layers
- `event-status-resolver` respects lifecycle for cancelled/postponed/sold_out

### Discovery
- `discovery-feed-service` filters cancelled, postponed, ended, archived before ranking
- Canonical ID resolution in rank/diversity pipeline
- Diversity uses `organizerId ?? organizer`

### Search
- Unified `buildEventSearchIndex`: title, venue, city, organizer, genres, artists
- `EventRepository` uses shared index (no second search logic)

### Profiles (services)
- `entity-profile-events-service`: upcoming / happening_now / past buckets
- `loadOrganizerProfileEvents`, `loadVenueProfileEvents`, `loadArtistProfileEvents`
- Artist datasource: `listEventIdsForArtist`, `countEventsForArtist`

### Saved Events
- `FavoritesContext` resolves canonical event IDs
- `saved-presentation` shows cancelled/postponed via `lifecycleStatus`
- Merge survival: `EventRepository.resolveCanonicalId` + alias map (tested in `search-relationship-index.test.ts`)

### Follow System
- `FollowService` with canonical entity IDs (`organizer` | `venue` | `artist`)
- AsyncStorage + in-memory storage; dedupe on follow
- Exported via `registry.ts` as `followService`

### Domain Events (notification prep)
- `InMemoryRealDataDomainEventBus` in registry
- Types: `event_created`, `event_updated`, `event_cancelled`, `event_postponed`, `lineup_changed`, `new_event_for_followed_*`
- `importReviewService` publishes `event_created` on approve

### Source Trust
- `SourceTrustMetrics` type + `buildSourceTrustMetrics()`
- Source mapper maps health/trust columns from `sources` table
- No automatic scoring

## Tests Added

`src/features/events/__tests__/phase-2d-domain-integration.test.ts` (8 cases):

- Lifecycle cancelled/postponed priority
- Rejected → archived
- Profile event buckets
- Discovery excludes ended/archived
- Search index (organizer, venue, artist)
- Follow canonical IDs
- Source trust metrics
- Domain event publish

Existing coverage also applies: lifecycle resolver tests, discovery foundations, search relationship index (merge alias), saved presentation.

## Documentation

- `DOMAIN_RELATIONS.md` — mapping matrix (Phase 1 deliverable)
- `EVENT_LIFECYCLE.md` — updated
- `DISCOVERY_DOMAIN.md` — new
- `SOURCE_TRUST.md` — new
- `PHASE_2D_REPORT.md` — this file

## Remaining Blockers (not Phase 2D scope)

| Area | Status |
|------|--------|
| Profile UI wiring | Services exist; organizer/venue/artist screens still use denormalized event strings |
| Follow UI | `FollowButton` not connected to `followService` |
| Follow persistence prod | AsyncStorage implementation ready; no screen integration |
| Domain event consumers | Bus in-memory only; no notification delivery |
| Source trust UI | Metrics prepared; admin dashboard not extended |
| Productive source | Explicitly out of scope |
| Scheduler | Out of scope |
| Supabase follow table | Local storage only; no server sync |

## Intentionally Not Started

- Phase 2E
- Productive source onboarding
- Scheduler / cron
- Social / Instagram import
- Automatic source trust scoring
- Push notifications
