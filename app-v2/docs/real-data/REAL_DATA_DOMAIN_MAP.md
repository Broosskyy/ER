# Real Data Domain Map

Sprint 8 Phase 2 — architecture inventory and connection status.

## Mapping Matrix

| Entity | Datenmodell | Repository | Supabase-Tabelle | Beziehungen | Consumer | Import | Status |
|--------|-------------|------------|------------------|-------------|----------|--------|--------|
| Events | `Event`, `AdminEventRecord` | `EventRepository`, `AdminEventRepository` | `events`, `event_artists` | venue, organizer, artists, sources | Home, Search, Detail, Saved | Aggregation + Orchestrator | **produktiv** |
| Organizer | `Organizer`, admin records | `OrganizerRepository`, `AdminOrganizerRepository` | `organizers` | events.organizer_id | Profil-Screen (denormalisiert über Event.organizer) | Matching + Identity Resolver | **vorbereitet** |
| Venues | `Venue`, admin records | `VenueRepository`, `AdminVenueRepository` | `venues` | events.venue_id | Profil-Screen (denormalisiert über Event.venue) | Matching + Identity Resolver | **vorbereitet** |
| Artists | `Artist`, lineup | `ArtistRepository`, `EventLineupRepository` | `artists`, `event_artists` | lineup | Profil-Screen (Event.artists[]) | Matching + Identity Resolver | **vorbereitet** |
| User Profiles | Auth user + contributor | Supabase Auth | auth.users, contributor tables | submissions | Settings, Contributor | — | **produktiv (Auth)** |
| Saved Events | `SavedEventRecord` | AsyncStorage | — | canonical event id | FavoritesContext | — | **Demo / lokal** |
| Follow System | UI-State | — | — | — | Organizer/Venue/Artist UI | — | **Demo** |
| Notifications | `NotificationRecord` | `NotificationRepository` (lokal) | — | event ids | Activity | Domain Events vorbereitet | **Demo** |
| Search | `EventFilters`, Index | `EventRepository` | events (read) | venue, organizer, artists | Search/Map | — | **produktiv** |
| Discovery | RankableEvent, Eligibility | `discovery-feed-service` | collections + Code-Pipeline | canonical ids | Home, Collections | — | **produktiv verdrahtet** |
| Admin Review | Import records, conflicts | `ImportAdminRepository` | `import_records`, `event_conflicts` | sources, events | Admin UI | Import pipeline | **produktiv** |
| Source Registry | `Source`, acquisition fields | `SourceRepository` | `sources` | import jobs | Admin Sources | Connectors/Adapters | **produktiv** |
| Import Records | `ImportRecord` | `ImportRecordRepository` | `import_records` | sources, events | Admin Review | Orchestrator/Aggregation | **produktiv** |
| Event Lifecycle | `LifecycleStatus` | `EventLifecycleResolver` | `events` (+ neue Spalten) | editorial status | Discovery, Detail | Import update | **implementiert** |
| Canonical IDs | alias map | `EventRepository.resolveCanonicalId` | `duplicate_decisions` | merges | Saved, Discovery, Search | Multi-source merge | **vorbereitet** |
| Provenance | field + source refs | `MergeProvenanceService` | `event_source_references` | events, sources | Admin only | Import | **produktiv** |

## Kanonische Beziehungen

```
Event → organizerId?, venueId?, artistIds[], sourceReferenceIds,
        canonicalEventId?, duplicateGroupId?, provenance
Organizer/Venue/Artist → canonicalId, aliases, sourceReferences, verification
```

## Consumer-Verdrahtung Phase 2

- Discovery: Eligibility + Ranking + Diversity + Lifecycle
- Search: Index inkl. Organizer
- Saved: Canonical-ID-Auflösung in FavoritesContext
