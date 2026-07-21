# ER-007 — Artist Domain Foundation — Completion Report

**Date:** 21 July 2026  
**Branch:** `feature/er-007-artist-domain-foundation`  
**Status:** Complete

---

## A. Executive summary

ER-007 introduces Artists as first-class, reusable, administrable platform entities. The epic adds a canonical domain model, local and Supabase datasource parity, repository and service layers, admin CMS routes, role-scoped RLS, public read filtering for published artists, and comprehensive tests — without migrating event lineups or adding join tables.

---

## B. Repository analysis findings

| Finding | Detail |
|---------|--------|
| Pre-existing `artists` table | Minimal columns: `id`, `name`, `spotify`, `instagram`, `website`, timestamps |
| `events.artist_id` | Single optional FK; unchanged in ER-007 |
| No `event_artists` junction | Deferred to ER-008 |
| `ArtistRepository` | Previously only `getAll()`; unused by UI |
| Import matching | Uses published artists catalog; unchanged workflow |
| RLS | `admin_manage_artists` was broad; anon read exposed all artists |
| Admin UI | No artist routes before ER-007 |

---

## C. Architecture implemented

```
Admin UI (/admin/artists)
  → ArtistService (validation, permissions, lifecycle)
  → AdminArtistRepository / ArtistRepository
  → ArtistDatasource (local | supabase)
  → PostgreSQL artists table + RLS
```

Public reads use `ArtistRepository.getPublished*` methods; admin CMS uses `ArtistService` with role checks.

---

## D. Artist domain model

`ArtistRecord` (`src/data/types/records.ts`):

| Field | Purpose |
|-------|---------|
| `id`, `name`, `slug` | Identity |
| `bio`, `imageUrl` | Profile content |
| `genreIds[]` | Genre references (no junction table) |
| `country`, `city` | Location labels |
| `website`, `instagram`, `facebook`, `soundcloud`, `spotify` | Social/links |
| `status` | Lifecycle: `draft` \| `published` \| `archived` |
| `verificationStatus` | `unverified` \| `verified` |
| `createdAt`, `updatedAt` | Timestamps |

---

## E. Status and verification model

- **Lifecycle** and **verification** are separate fields (not overloaded).
- Lifecycle transitions centralized in `artist-status-transitions.ts`.
- Privileged transitions (`draft→published`, `*→archived`, restore from archived) require `admin`/`owner` (mirrors event publish pattern).
- Verification changes require `admin`/`owner`.

---

## F. Database and RLS changes

**Migration:** `20260733000000_er007_artist_domain_foundation.sql` (15 migrations total)

- Additive column extensions on `artists`
- Slug backfill + unique index
- Replace `anon_read_artists` with `anon_read_published_artists`
- Replace `admin_manage_artists` with scoped insert/update/delete + admin read
- Trigger `enforce_admin_artist_sensitive_rules` for verification and lifecycle

---

## G. Admin UI and routes

| Route | Screen |
|-------|--------|
| `/admin/artists` | Artist list (search, status filter, create) |
| `/admin/artists/new` | Create artist |
| `/admin/artists/[id]` | Edit artist |

`AdminShell` nav item added. Dashboard shows artist count.

---

## H. Permission matrix

| Role | View | Create/Edit | Publish/Archive | Verify |
|------|------|-------------|-----------------|--------|
| viewer | yes | no | no | no |
| editor | yes | yes | no | no |
| reviewer | yes | no | no | no |
| source_manager | yes | no | no | no |
| admin / owner | yes | yes | yes | yes |

Helpers: `canViewArtists`, `canEditArtists`, `canCreateArtists`, `canPublishArtists`, `canArchiveArtists`, `canVerifyArtists`.

---

## I. Event compatibility strategy

**Approach A (chosen):** Artists introduced independently; legacy event artist data untouched.

| Layer | Behavior |
|-------|----------|
| `events.artist_id` | Unchanged single FK |
| `Event.artists[]` / `lineup?` | Pipeline/display strings remain |
| Import approve | Still uses `matchedArtistIds[0]` only |
| Event admin | No artist picker added (out of scope) |

**ER-008 must:** `event_artists` junction, multi-artist persistence, event editor lineup wiring.

---

## J. Import compatibility strategy

- Import adapters continue emitting `artistNames[]` as raw strings.
- Matching catalog now uses **published** artists only (`getPublished()`).
- No automatic Artist creation from imports.
- `matched_artist_ids[]` preserved; approve still maps first match to `artist_id`.

---

## K. Files changed

### Migration
- `app-v2/supabase/migrations/20260733000000_er007_artist_domain_foundation.sql`

### Domain & service
- `app-v2/src/features/artists/types/artist-status.ts`
- `app-v2/src/features/artists/domain/artist-slug.ts`
- `app-v2/src/features/artists/domain/artist-validation.ts`
- `app-v2/src/features/artists/domain/artist-status-transitions.ts`
- `app-v2/src/features/artists/services/artist-service.ts`

### Data layer
- `app-v2/src/data/types/records.ts`
- `app-v2/src/data/mappers/artist-mapper.ts`
- `app-v2/src/data/datasources/types.ts`
- `app-v2/src/data/datasources/local/local-artist-datasource.ts`
- `app-v2/src/data/datasources/local/local-datasource.ts`
- `app-v2/src/data/datasources/supabase/supabase-artist-datasource.ts`
- `app-v2/src/data/datasources/supabase/supabase-datasource.ts`
- `app-v2/src/data/repositories/repositories.ts`
- `app-v2/src/data/repositories/registry.ts`

### Admin
- `app-v2/src/features/admin/admin-permissions.ts`
- `app-v2/src/features/admin/admin-route-utils.ts`
- `app-v2/src/features/admin/components/AdminShell.tsx`
- `app-v2/app/admin/artists/index.tsx`
- `app-v2/app/admin/artists/[id].tsx`
- `app-v2/app/admin/index.tsx`

### Import
- `app-v2/src/features/import/matching/matching-catalog.ts`

### Tests
- `app-v2/src/features/artists/__tests__/artist-domain.test.ts`
- `app-v2/src/features/artists/__tests__/artist-service.test.ts`
- `app-v2/src/features/artists/__tests__/artist-permissions.test.ts`
- `app-v2/src/data/__tests__/artist-repository.test.ts`
- `app-v2/src/data/__tests__/er007-artist-domain-migration.test.ts`

### Tooling
- `app-v2/scripts/validate-migrations.ts`

### Documentation
- `docs/ER-007_ARTIST_DOMAIN_FOUNDATION_COMPLETION_REPORT.md` (this file)
- `app-v2/docs/admin-web.md`
- `AI_CONTEXT.md`
- `BACKLOG.md`
- `docs/PROJECT_STATE.md`

---

## L. Tests added

60 new tests across 5 files covering domain validation, slug collision, lifecycle transitions, local datasource parity, service permissions, admin route resolution, and migration SQL intent.

---

## M. Full test results

```
npm test — PASS — 78 files, 402/402 tests
```

---

## N. Migration validation

```
npm run validate:migrations — PASS — 15 migration files
```

---

## O. Remaining limitations

- No `event_artists` junction table
- Event admin has no artist picker
- No public artist profile screen
- Staging seed SQL not updated (migration backfills slugs; existing rows default to `published`)
- Image upload to `artists` storage bucket not wired in CMS (URL field only)

---

## P. Explicit ER-008 recommendations

**ER-008 — Multi-Artist Event Lineup**

1. Add `event_artists` junction table (`event_id`, `artist_id`, `sort_order`, optional `role`)
2. Migrate `events.artist_id` as primary artist reference (keep FK for compatibility)
3. Wire import approve to persist all `matched_artist_ids`
4. Add artist picker to event admin editor
5. Expose lineup from canonical artists on public event detail
6. Deprecate pipeline-only `lineup[]` strings gradually

Do not start ER-008 in this branch.
