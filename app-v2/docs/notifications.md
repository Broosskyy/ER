# Notifications (In-App Activity Center)

Sprint 12.6B implements a **local in-app activity center** for Eternal Rave.

> **Important:** This is not push notifications. There is no Firebase, Expo Notifications, APNs, Supabase Realtime, user accounts, or server-side distribution.

---

## Architecture

```
Home Bell (NotificationButton)
        ↓
NotificationsProvider (state)
        ↓
NotificationRepository
        ↓
Local AsyncStorage datasource
        ↑
Notification Generation Service ← EventRepository + Favorites
        ↑
Event Snapshot (compact diff baseline)
```

| Layer | Responsibility |
|-------|----------------|
| `NotificationButton` | Opens `/notifications`, shows badge |
| `NotificationsProvider` | Single source of truth for UI state |
| `NotificationRepository` | CRUD, unread count, deduplication |
| `notification-generation` | Detects changes vs snapshot |
| `notification-deduplication` | Stable `deduplicationKey` builder |
| AsyncStorage datasource | Persistence only — no UI access |

---

## Data model

```typescript
interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  eventId: string | null;
  createdAt: string;
  readAt: string | null;
  deletedAt: string | null;
  deduplicationKey: string;
  metadata: NotificationMetadata;
}
```

### Notification types

| Type | Trigger |
|------|---------|
| `new_event` | New published event matching city/genre preferences (after baseline) |
| `saved_event_updated` | Favorite event changed (date, time, venue, status) |
| `saved_event_cancelled` | Favorite event cancelled |
| `saved_event_starting_soon` | Favorite event within 24 hours |
| `ticket_available` | Ticket URL newly available on favorite event |
| `general` | Reserved for manual/system messages |

---

## Repository API

`NotificationRepository` (`src/data/repositories/notification-repository.ts`):

- `list()` — active (non-deleted) notifications, newest first
- `getById(id)`
- `create(input)` / `createBatch(inputs)`
- `markAsRead(id)` / `markAllAsRead()`
- `delete(id)` — soft delete (`deletedAt`)
- `clear()`
- `getUnreadCount()`
- `existsByDeduplicationKey(key)` — includes deleted entries
- `sync({ favoriteIds })` — runs generation after bootstrap

---

## Persistence

Storage keys (AsyncStorage / `localStorage` on web):

| Key | Content |
|-----|---------|
| `@eternal_rave/notifications_v2` | Notification array |
| `@eternal_rave/event_snapshot_v2` | Compact event snapshot |
| `@eternal_rave/notification_sync_v2` | Last successful sync timestamp |

Corrupt JSON returns empty defaults — never crashes the app.

---

## Snapshot system

Compact entries per event:

- `id`, `title`, `startDateTime`, `venue`, `status`, `ticketUrl`, `updatedAt`

**First sync = baseline only.** No notifications are generated on the initial snapshot.

---

## Deduplication

Central builder: `buildDeduplicationKey({ eventId, type, version })`

Format: `eventId:type:version`

Deleted notifications keep their `deduplicationKey` in storage so the same activity is not recreated on the next sync.

---

## Badge

| Unread count | Display |
|--------------|---------|
| 0 | hidden |
| 1–9 | number |
| ≥10 | `9+` |

Updated automatically via `NotificationsProvider` when notifications change.

---

## Navigation

| Action | Behaviour |
|--------|-----------|
| Bell tap | `router.push('/notifications')` |
| Item tap | Mark read → navigate to `/event/[id]` |
| Missing event | Mark read → alert → no crash |
| Delete | Soft delete, persists across restarts |

---

## Bootstrap order

1. `RepositoryProvider` — `EventRepository` ready
2. `FavoritesProvider` — favorites hydrated
3. `NotificationsProvider` — load persistence → `sync()`

Sync errors are caught and shown on the notifications screen; they do not block app startup.

---

## Tests

| Area | File |
|------|------|
| Repository CRUD | `notification-repository.test.ts` |
| Generation | `notification-generation.test.ts` |
| Deduplication | `notification-deduplication.test.ts` |
| Badge | `notification-badge.test.ts` |
| Storage | `notification-storage.test.ts` |
| Navigation routes | `notification-navigation.test.ts` |

Run: `npm test`

---

## Known limitations

- Local device only — no cross-device sync
- New event matching uses default city + genres from saved events
- No push delivery when app is closed
- Remote `imageUrl` values may fail on web due to CORS
- `general` type reserved but not auto-generated yet

---

## Build and verify

```bash
cd app-v2
npm run typecheck
npm run lint
npm test
npm run web
npm run build:web
```
