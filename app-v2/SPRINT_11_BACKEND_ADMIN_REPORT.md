# Sprint 11 — Backend Foundation & Admin Core

**Version:** 0.2.0 (versionCode 5)  
**Branch:** `cursor/sprint-11-backend-admin-6b06`

## Summary

Sprint 11 introduces a cloud-ready backend foundation and admin area without changing the public app UX. All data access now flows through the repository pattern with swappable local/Supabase datasources.

## Architecture

```
UI → Repository → Datasource → Local | Supabase
```

**Feature flag:** `EXPO_PUBLIC_USE_SUPABASE=false` (default) uses local pipeline data.  
**No UX change** for Home, Events, Saved, Profile, Map, Event Detail.

## New Folders

| Path | Purpose |
|---|---|
| `src/core/` | env, feature flags, errors, cache |
| `src/data/datasources/` | local + supabase datasource implementations |
| `src/data/mappers/` | DB row ↔ domain mapping |
| `src/data/repositories/` | repository classes, registry, provider |
| `src/data/types/` | shared record interfaces |
| `src/services/supabase/` | client + auth service |
| `src/features/admin/` | admin auth + shared states |
| `app/admin/` | admin routes (login, dashboard, events) |
| `supabase/migrations/` | database schema + RLS + storage |
| `docs/` | backend, repository, database, admin, migration docs |

## Repository Structure

| Repository | Entities |
|---|---|
| EventRepository | Published events (sync, backward compatible) |
| AdminEventRepository | Full event CRUD |
| GenreRepository | Genres |
| CityRepository | Cities |
| VenueRepository | Venues |
| ArtistRepository | Artists |
| CollectionRepository | Collections |
| SourceRepository | Sources |
| StatsRepository | Dashboard counts |

## Database Schema

Tables: `events`, `genres`, `cities`, `venues`, `artists`, `collections`, `sources`  
Storage buckets: `events`, `artists`, `venues`, `collections`  
RLS: anonymous read published; authenticated full access

## ENV Variables

```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_USE_SUPABASE=false
```

## Admin Area

| Route | Feature |
|---|---|
| `/admin/login` | Email/password auth |
| `/admin` | Dashboard stats |
| `/admin/events` | Search, filter, sort, pagination |
| `/admin/events/[id]` | Event editor with status actions |

**Local credentials:** `admin@eternalrave.app` / `admin-local-dev`

## Changed Files (key)

- `app/_layout.tsx` — RepositoryProvider
- `src/features/events/repository/event-repository.ts` — re-export shim
- `src/features/events/index.ts` — registry exports
- `package.json` — `@supabase/supabase-js`
- `.env.example` — Supabase vars

## Validation

| Check | Result |
|---|---|
| `npm run lint` | Pass (0 errors) |
| `npx tsc --noEmit` | Pass |
| `npx expo-doctor` | 19/20 (CNG warning) |
| `npm test` | 35/35 |

## APK

**Download:** https://github.com/Broosskyy/ER/releases/download/v1-android-0.2.0-sprint11-backend/eternal-rave-0.2.0-sprint11-backend-admin-preview.apk

## Open TODOs (Sprint 12)

- Seed migration (genres, cities, Köln venues)
- Role-based admin (editor vs admin JWT claims)
- Image upload to Supabase Storage
- Import engine / RSS / JSON-LD acquisition
- Filter config from Supabase instead of static `filterConfig`
- Production Supabase deployment + env in EAS secrets

## Recommendations for Sprint 12

1. **Import Engine** — use `EventSourceAdapter` pipeline server-side, write to Supabase
2. **Admin CRUD screens** for genres, cities, venues (repositories ready)
3. **Realtime** — Supabase subscriptions for live event updates
4. **Offline cache** — persist repository cache to AsyncStorage
