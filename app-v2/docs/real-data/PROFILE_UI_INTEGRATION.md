# Profile UI Integration — Phase 2E

Consumer profile screens wired to existing domain services. No new profile architecture.

## Routes

| Entity | Route | Screen |
|--------|-------|--------|
| Organizer | `/organizer/[id]` | `PublicEntityProfileScreen` |
| Venue | `/venue/[id]` | `PublicEntityProfileScreen` |
| Artist | `/artist/[id]` | `PublicEntityProfileScreen` |

Contributor self-edit remains at `/profile/organizer` (unchanged).

## Data Flow

```
Route param (id or slug)
  → resolveCanonicalEntityId (entity alias store + repository)
  → loadEntityProfile (organizer/venue/artist repository)
  → admin listEventIdsFor* / artist listEventIdsForArtist
  → eventRepository.getEventById
  → filterProfileEvents (dedupe, exclude archived)
  → groupEventsByProfileBucket (upcoming / happening_now / past)
  → ProfileHeader + EntityProfileEventsSection
```

## Event Detail Links

When FK IDs exist and repository records resolve:

- `OrganizerDetailCard` → `/organizer/{organizerId}` + FollowButton
- `VenueDetailCard` → `/venue/{venueId}`
- `LineupItem` → `/artist/{artistId}` (deduped by artistId)

Without canonical ID: text only, no navigation (`profileNavigable: false`).

Loader: `loadEventDetailEntities` + `useEventDetailEntities`.

## Canonical ID Behavior

1. Direct repository hit by id
2. Entity alias store (`external_id`, `manual`, `normalized_name`)
3. Slug lookup (`getBySlug`)
4. Route replace to canonical id when alias resolves

Unknown id → `EntityNotFoundState`.

## Legacy Fallback

Venue profile only: if no venue record, match published events by venue name/slug (legacy denormalized data). No invented links on event detail.

## Loading / Error / Empty

| State | Component |
|-------|-----------|
| Loading | `Skeleton` cards |
| Not found | `EntityNotFoundState` |
| Error | Not found + retry `TextButton` |
| No events | Empty copy in `EntityProfileEventsSection` |

## Follower Counts

Not shown — no persistent global follower aggregation. `OrganizerProfileCard` hides empty follower stat.

## Code

- `src/features/profiles/components/PublicEntityProfileScreen.tsx`
- `src/features/profiles/services/entity-profile-loader.ts`
- `src/features/profiles/hooks/useEntityProfile.ts`
- `src/features/event-detail/hooks/useEventDetailEntities.ts`
- `app/event/[id].tsx`

## Known Limitations

- Artist genres on profile header not resolved from `genreIds` yet
- Venue/organizer verification always `unverified` until DB fields exist
- No global entity search — search still routes to events
- QA screenshots require manual capture (`npm run qa:capture` not present)
