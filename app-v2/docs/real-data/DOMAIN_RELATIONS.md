# Domain Relations — Phase 2D Mapping Matrix

Sprint 8 Phase 2D domain integration inventory. No new architecture — connections across existing models only.

## Mapping Matrix

| Entity | Domain Model | Repository / Service | Supabase Table | Consumer Usage | Import Usage | Missing / Partial Relations |
|--------|--------------|----------------------|----------------|----------------|--------------|----------------------------|
| **Event** | `Event`, `EventDisplayModel`, `AdminEventRecord` | `EventRepository`, `AdminEventRepository` | `events`, `event_artists` | Home, Discovery, Search, Detail, Saved | Aggregation, Orchestrator, Review approve | FK IDs now on consumer `Event`; profile screens still mostly denormalized |
| **Organizer** | `Organizer` | `OrganizerRepository`, `loadOrganizerProfileEvents` | `organizers` | `/organizer/[id]`, Event detail | Identity resolver, alias store | **verdrahtet** |
| **Venue** | `Venue` | `VenueRepository`, `loadVenueProfileEvents` | `venues` | `/venue/[id]`, Event detail | Identity resolver, alias store | **verdrahtet** |
| **Artist** | `Artist` | `ArtistRepository`, `loadArtistProfileEvents` | `artists`, `event_artists` | `/artist/[id]`, Event detail lineup | Identity resolver, alias store | **verdrahtet** |
| **Saved Events** | `SavedEventRecord` | `FavoritesContext`, AsyncStorage | — (local) | Saved tab, cards | — | Canonical ID resolution via `resolveCanonicalId`; merge alias map in repository |
| **Follow** | `FollowRecord` | `FollowService`, `useEntityFollow` | — (local AsyncStorage) | Profile screens, Event detail organizer | — | **verdrahtet (lokal)** |
| **Discovery** | `RankableEvent`, Eligibility | `getDiscoveryFeedEvents` | `events` (read) | Home, Collections | — | Lifecycle filter active; cancelled/postponed/ended/archived excluded |
| **Search** | `EventFilters`, index | `EventRepository.searchEvents` | `events` (read) | Search, Map filters | — | Unified `buildEventSearchIndex` (title, venue, city, organizer, genres, artists) |
| **Lifecycle** | `LifecycleStatus` | `EventLifecycleResolver` | `events` lifecycle columns | Discovery, Display, Saved, Profiles | Import update fields | Single resolver; `rejected` → `archived` |
| **Canonical IDs** | alias map | `CanonicalEventIdResolver`, `EventRepository.resolveCanonicalId` | `duplicate_decisions`, `entity_aliases` | Saved, Discovery, Search | Multi-source merge | Merge redirect tested in search-relationship-index |
| **Domain Events** | `RealDataDomainEvent` | `InMemoryRealDataDomainEventBus` (registry) | — | Notification prep (future) | `event_created` on approve | No push; bus not persisted |
| **Source Trust** | `SourceTrustMetrics` | `buildSourceTrustMetrics`, `SourceRepository` | `sources` health columns | Admin (future) | Connector runs | Metrics mapped; no auto scoring |
| **Provenance** | field + source refs | `MergeProvenanceService` | `event_source_references`, `event_field_provenance` | Admin only | Import merge | Produktiv |
| **Entity Aliases** | resolution decisions | `SupabaseEntityAliasStore`, write-back | `entity_aliases` | Resolver on import | Review write-back | Phase 2C complete |

## Canonical Relationships

```
Event
  ├── organizerId?  → organizers.id
  ├── venueId?      → venues.id
  ├── artistIds[]   → artists.id (via event_artists)
  ├── genreIds[]    → genres (optional)
  ├── canonicalEventId? → duplicate merge target
  └── source + sourceEventId → sources

Organizer / Venue / Artist
  ├── canonical id (table PK)
  ├── aliases (entity_aliases)
  └── source references (import)

Saved / Follow
  └── canonical entity ids (events, organizers, venues, artists)
```

## Import → Consumer Data Flow

```
Source → Connector → ImportRecord → Review → approveRecord
  → entity resolution write-back (aliases)
  → AdminEvent create / update
  → EventRepository (published)
  → Discovery / Search / Saved / Profiles
```

## Editorial vs Lifecycle Status

| Editorial (`Event.status`) | Lifecycle (`LifecycleStatus`) |
|----------------------------|-------------------------------|
| `draft` | `draft` |
| `review` | `needs_review` |
| `published` | computed (scheduled, on_sale, …) |
| `rejected` | `archived` |
| `archived` | `archived` |

`published` is not a lifecycle status — it is the gate for consumer visibility (`getPublishedEvents`).

## Code References

- Event model: `src/features/events/types/event.ts`
- Lifecycle: `src/features/events/lifecycle/`
- Discovery: `src/features/events/discovery/discovery-feed-service.ts`
- Search index: `src/features/search/constants.ts` → `buildEventSearchIndex`
- Profile buckets: `src/features/events/domain/entity-profile-events-service.ts`
- Follow: `src/features/follows/follow-service.ts`
- Saved presentation: `src/features/saved/utils/saved-presentation.ts`
- Domain events: `src/features/events/domain/real-data-domain-events.ts`
- Source trust: `src/features/sources/domain/source-trust-metrics.ts`
