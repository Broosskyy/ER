# Follow UI Integration — Phase 2E

`FollowButton` connected to `FollowService` via `useEntityFollow` hook.

## FollowService

Registry export: `followService`

- Storage: `AsyncStorageFollowStorage` (production), `InMemoryFollowStorage` (vitest)
- Canonical resolution via `resolveFollowCanonicalEntityId`
- Bootstrap hydrates follows on app start (`hydrateFollowService`)

## UI Hook

`useEntityFollow({ entityType, entityId })`

| Return | Purpose |
|--------|---------|
| `followState` | Maps to `FollowButton` states |
| `isFollowing` | Boolean status |
| `toggle()` | Follow / unfollow with double-tap guard |
| `error` | User-visible error string |

Used on:

- Public entity profiles (`PublicEntityProfileScreen`)
- Event detail organizer card (when `organizerId` resolved)

## Entity Types

`organizer` | `venue` | `artist` — strictly separated storage keys.

## Canonical IDs

Follow/unfollow/isFollowing all resolve alias ids to canonical ids before storage. Following `legacy-org` and `org-1` is the same record when alias maps legacy → canonical.

## Persistence

Records stored at `@eternal_rave/follows_v1`. Survives service re-instantiation and app restart (AsyncStorage).

## Domain Events

Internal only via `realDataDomainEventBus`:

- `entity_followed`
- `entity_unfollowed`

Payload: `entityType`, `canonicalEntityId`, `occurredAt`. No push/email.

## Follower Counts

Not displayed. No local follow list used as global follower metric.

## Later Notification Wiring

Domain events prepared for:

- `new_event_for_followed_organizer`
- `new_event_for_followed_artist`
- `new_event_for_followed_venue`

Not implemented in Phase 2E.

## Code

- `src/features/follows/follow-service.ts`
- `src/features/profiles/hooks/useEntityFollow.ts`
- `src/data/repositories/registry.ts`
