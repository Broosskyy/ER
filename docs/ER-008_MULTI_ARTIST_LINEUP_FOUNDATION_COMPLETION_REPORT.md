# ER-008 — Multi-Artist Lineup Foundation — Completion Report

**Date:** 21 July 2026  
**Branch:** `feature/er-008-multi-artist-lineup-foundation`  
**Status:** Complete

---

## A. Executive summary

ER-008 introduces a canonical ordered many-to-many relationship between Events and Artists via the `event_artists` junction table. The epic adds domain types, mappers, local and Supabase datasource parity, `EventLineupRepository`, `EventLineupService`, admin event lineup editor, import approval for multiple matched artists, RLS aligned with ER-006/ER-007, backfill from legacy `events.artist_id`, and comprehensive tests — without public artist profile pages or ER-009 scope.

---

## B. Repository analysis findings

| Finding | Detail |
|---------|--------|
| Pre-ER-008 lineup | Single optional `events.artist_id` FK only |
| No `event_artists` table | Deferred from ER-007 |
| Import matching | Produced `matchedArtistIds[]` but approve persisted only `[0]` |
| Pipeline display | `Event.artists[]` / optional `lineup?` as string arrays for UI |
| ER-007 stack | `ArtistService`, repositories, admin CMS, published-only public reads — reused |
| Admin event editor | No lineup UI before ER-008 |

---

## C. Architecture decisions

```
Event (canonical)
  └── event_artists[] (ordered junction)
        ├── artist_id → artists
        ├── billing_role (headliner | support | special_guest | other)
        └── sort_order (0-based, deterministic)

Legacy compatibility:
  events.artist_id ← derived primary artist (deprecated, synced on lineup save)
```

**Primary artist rule (documented and tested):**

1. First ordered headliner
2. Else first ordered artist
3. Else `null`

**Artist deletion:** `ON DELETE RESTRICT` on `artist_id` — prevents silent lineup corruption.

**Event deletion:** `ON DELETE CASCADE` on `event_id`.

**Sync mechanism:** Application-layer sync on lineup replace (no new RPC/trigger for `artist_id` sync). Contributor-review protection trigger on `event_artists` mutations.

---

## D. Schema and migration

**Migration:** `app-v2/supabase/migrations/20260734000000_er008_multi_artist_lineup_foundation.sql` (16 migrations total)

| Column | Type | Notes |
|--------|------|-------|
| `id` | text PK | `gen_random_uuid()::text` |
| `event_id` | text FK | cascade on event delete |
| `artist_id` | text FK | restrict on artist delete |
| `billing_role` | text | constrained enum-like check |
| `sort_order` | integer | `>= 0` |
| `created_at`, `updated_at` | timestamptz | standard defaults |

**Indexes:** `event_id`, `artist_id`, `(event_id, sort_order)`  
**Unique:** `(event_id, artist_id)`

**Backfill:** For each event with non-null `artist_id`, one row with `billing_role = 'headliner'`, `sort_order = 0`, `ON CONFLICT DO NOTHING`.

---

## E. RLS policies

| Policy | Access |
|--------|--------|
| `anon_read_published_event_lineups` | SELECT when parent event `status = 'published'` |
| `admin_read_event_artists` | SELECT for `is_admin()` |
| `admin_insert/update/delete_event_artists` | `editor`+ role checks |
| Trigger `enforce_event_artists_mutation_rules` | Blocks non-admin/owner lineup changes on contributor `review` events |

Public lineup visibility follows **event** publication status, not artist publication alone.

---

## F. Domain model

- `ArtistBillingRole` — `headliner` \| `support` \| `special_guest` \| `other`
- `EventArtistRecord` — junction row
- `EventLineupArtist` — junction + nested `ArtistRecord`
- `EventLineupInput` — save input (`artistId`, `billingRole`)

Files: `src/features/events/domain/event-lineup*.ts`, `artist-billing-role.ts`

---

## G. Service and repository behavior

**`EventLineupRepository`**

- `getLineupForEvent`, `getLineupsForEvents`, `replaceEventLineup`

**`EventLineupService`**

- Permission checks via `canEditEventLineup` / contributor review rules
- Validates artist existence, uniqueness, billing roles, archived artists
- Normalizes sort order to sequential 0..n
- `replaceFromMatchedArtistIds` for import approval

**`replaceEventLineup`:** Full replace — removes obsolete rows, upserts current state, syncs `events.artist_id`.

---

## H. Admin UI changes

**`/admin/events/[id]`**

- `EventLineupEditor` component: search/select artists, billing roles, reorder (Up/Down), remove, duplicate prevention
- Shows artist status and verification
- Create flow: save event first, then persist lineup
- Edit flow: load existing lineup, save complete desired state

**`/admin/imports/review/[id]`**

- Shows imported artist names (ordered)
- Shows matched canonical artist IDs with default billing on approve
- Shows unmatched names and duplicate-match warnings

---

## I. Import pipeline changes

On approve:

1. Create draft event (unchanged workflow)
2. Persist **all** deduplicated `matchedArtistIds` via `buildLineupFromMatchedArtistIds`
3. First → `headliner`, remainder → `support`
4. Sync deprecated `events.artist_id` from canonical lineup

Raw import names preserved; no automatic artist creation.

---

## J. Public reads and UI compatibility

- Supabase published-events query batch-loads lineups
- `mapEventRowToDomain` receives ordered artist names for `artists[]` and `lineup?`
- Compact cards continue using primary/first artist display patterns
- No public artist profile routes added

---

## K. Permission helpers

- `canEditEventLineup` in `admin-permissions.ts`
- `canAssignArtistToEvent`, `canReorderEventLineup` in `event-lineup-service.ts` (delegate to `canEditEvents`)

---

## L. Test results

| Suite | Result |
|-------|--------|
| `npm test` | **417/417 passed** |
| `npm run validate:migrations` | **PASS** (16 migrations) |
| `npm run typecheck` | Pre-existing failures only (`en.ts` TranslationTree, location provider) — no ER-008-specific errors |
| `npm run lint` | Pre-existing project warnings; ER-008 admin `Date.now` lazy-init fixed |

**New tests:**

- `event-lineup-domain.test.ts`
- `event-lineup-service.test.ts`
- `event-lineup-repository.test.ts`
- `er008-multi-artist-lineup-migration.test.ts`

---

## M. Known limitations

- `events.artist_id` retained as deprecated compatibility field (planned cleanup epic)
- Local datasource duplicate prevention relies on service validation (DB unique constraint on Supabase)
- Admin UI uses Up/Down controls (no drag-and-drop)
- Import review shows artist IDs, not resolved names (catalog lookup not wired in review screen)
- No dedicated admin UI component tests (manual verification via service/repository coverage)

---

## N. Deferred work

- Remove `events.artist_id` after all consumers migrate to canonical lineup
- Public artist profile pages and routing (ER-009+)
- Artist resolution/creation from imports
- Stage schedules, set times, performance slots
- Venue domain migration
- `event_genres` junction (separate epic)

---

## O. Recommended next epic

**ER-009 — Venue Admin CMS** (or next numbered venue epic per `BACKLOG.md`): dedicated venue management screens and snapshots, building on ER-007/ER-008 entity patterns.

---

## P. Files changed (summary)

| Area | Key files |
|------|-----------|
| Migration | `20260734000000_er008_multi_artist_lineup_foundation.sql` |
| Domain | `event-lineup.ts`, `event-lineup-primary.ts`, `event-lineup-validation.ts`, `artist-billing-role.ts` |
| Data | `event-lineup-mapper.ts`, `local-event-lineup-datasource.ts`, `supabase-event-lineup-datasource.ts`, `local-datasource.ts`, `supabase-datasource.ts`, `repositories.ts`, `registry.ts`, `types.ts` |
| Services | `event-lineup-service.ts` |
| Admin UI | `EventLineupEditor.tsx`, `app/admin/events/[id].tsx` |
| Import | `import-review-service.ts`, `app/admin/imports/review/[id].tsx` |
| Permissions | `admin-permissions.ts` |
| Tests | 4 new test files |
| Docs | This report, `AI_CONTEXT.md`, `BACKLOG.md`, `docs/PROJECT_STATE.md`, `app-v2/docs/admin-web.md` |
