# Repository Layer

## Pattern

Every entity has a repository that exposes domain operations. Repositories depend on datasource interfaces, not concrete storage.

| Repository | Datasource | Public API |
|---|---|---|
| `EventRepository` | `EventDatasource` | Sync reads for app UI |
| `AdminEventRepository` | `EventDatasource` | Async CRUD for admin |
| `GenreRepository` | `GenreDatasource` | `getAll()`, `getActive()` |
| `CityRepository` | `CityDatasource` | `getAll()`, `getActive()` |
| `VenueRepository` | `VenueDatasource` | `getAll()` |
| `ArtistRepository` | `ArtistDatasource` | `getAll()` |
| `CollectionRepository` | `CollectionDatasource` | `getAll()`, `getActive()` |
| `SourceRepository` | `SourceDatasource` | `getAll()` |
| `StatsRepository` | `StatsDatasource` | `getDashboardStats()` |

## Registry

`src/data/repositories/registry.ts` exports singleton repository instances and `initializeRepositories()`.

Local mode initializes synchronously at module load — **zero UX change** for the public app.

## EventRepository (backward compatible)

Existing screens continue using:

```typescript
import { eventRepository } from '@/features/events';

eventRepository.getPublishedEvents();
eventRepository.getEventById(id);
```

The repository now loads from `EventDatasource` instead of calling the pipeline directly.

## Admin Repositories

Admin screens use async repositories:

```typescript
import { adminEventRepository, statsRepository } from '@/data/repositories/registry';

const stats = await statsRepository.getDashboardStats();
const events = await adminEventRepository.list({ status: 'published' });
```

## Provider

`RepositoryProvider` wraps the app in `app/_layout.tsx`. In local mode it is immediately ready. In Supabase mode it initializes asynchronously with error/retry support.

## Testing

`src/data/__tests__/datasource.test.ts` validates local datasource contract.
