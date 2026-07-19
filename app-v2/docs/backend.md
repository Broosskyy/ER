# Backend Architecture

## Overview

Sprint 11 introduces a cloud-ready backend foundation without changing the public app UX. All data access flows through repositories; the UI never talks to Supabase or local stores directly.

```
UI (screens)
  ↓
Repository (EventRepository, GenreRepository, …)
  ↓
Datasource (LocalDatasource | SupabaseDatasource)
  ↓
Data (pipeline/mock | Supabase PostgreSQL)
```

## Feature Flag

`EXPO_PUBLIC_USE_SUPABASE=false` (default) → local mock data via pipeline  
`EXPO_PUBLIC_USE_SUPABASE=true` + Supabase env vars → cloud backend

Configured in `src/core/config/feature-flags.ts`. UI components must not read this flag.

## Environment

See `.env.example`:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_USE_SUPABASE`

No secrets in source code.

## Error Handling

- `AppError` with codes: NETWORK, OFFLINE, UNAUTHORIZED, VALIDATION, UNKNOWN
- `withRetry()` for transient network failures (3 attempts)
- Admin screens show Loading / Empty / Error / Retry states

## Cache

`MemoryCache` in repositories supports read-through caching: Cloud → Cache → UI. Invalidated on `EventRepository.refresh()`.

## Auth

Admin login via `authService` (`src/services/supabase/auth-service.ts`):

- **Local mode:** `admin@eternalrave.app` / `admin-local-dev`
- **Supabase mode:** Supabase Auth email/password

## Folder Structure

```
src/core/           config, errors, cache
src/data/
  datasources/      local + supabase implementations
  mappers/          row ↔ domain mapping
  repositories/     repository classes + registry
  types/            shared record types
src/services/supabase/   client + auth
src/features/admin/      admin UI logic
app/admin/               admin routes (not public)
supabase/migrations/     database schema
```

## Sprint 12 Readiness

Prepared for: import engine, RSS/JSON-LD ingestion, role-based admin, realtime sync, production Supabase deployment.
