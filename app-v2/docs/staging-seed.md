# Staging Seed Data

Reproducible test data for the Supabase **staging** environment. All records use the `staging-seed-*` prefix (plus two featured demo IDs reused for Home highlights).

## Contents

| Entity | Count | IDs prefix |
|--------|------:|------------|
| Cities | 2 | `staging-seed-city-*` (Köln, Berlin) |
| Venues | 5 | `staging-seed-venue-*` |
| Artists | 8 | `staging-seed-artist-*` |
| Genres | 6 | `staging-seed-genre-*` |
| Collections | 3 | `staging-seed-collection-*` |
| Sources | 1 | `staging-seed-source-manual` |
| Events | 18 | 16 `published`, 2 `draft` |

### Event scenarios covered

- Tonight / tomorrow / weekend / upcoming (aligned with `EVENT_REFERENCE_DATE = 2026-05-24`)
- Featured Home events: `void-techno-saturday`, `klangkuenstler-berghain`
- Multiple genres (title + primary `genre_id`)
- B2B artist billing in title
- With / without `ticket_url`
- With / without `image_url`
- Free entry (`subtitle = Free Entry`, no ticket URL)
- Sold out (`subtitle = Ausverkauft`)
- Draft events (not public via RLS)

## Files

| File | Purpose |
|------|---------|
| `scripts/staging/seed-staging-app-data.sql` | Idempotent upsert seed |
| `scripts/staging/validate-staging-seed.sql` | Post-seed validation queries |
| `scripts/validate-staging-seed.ts` | CI check for seed file structure |

## Apply seed (Supabase SQL Editor)

1. Open Supabase Dashboard → SQL Editor
2. Paste the full contents of `scripts/staging/seed-staging-app-data.sql`
3. Run
4. Run `scripts/staging/validate-staging-seed.sql` and verify expected counts

**Prerequisites:** All migrations applied, including `20260724000000_anon_authenticated_grants.sql`.

## Idempotency

- Uses `INSERT … ON CONFLICT (id) DO UPDATE`
- Safe to re-run without duplicates
- Does **not** delete non-staging rows
- Only upserts known staging IDs

## Validation queries

After seeding, run `scripts/staging/validate-staging-seed.sql`.

Expected counts:

```
cities: 2
venues: 5
artists: 8
genres: 6
collections: 3
events_published: 16
events_draft: 2
```

Quality checks should return **0 rows** for orphan/invalid data.

### Local CI check

```bash
cd app-v2
npm run validate:staging:seed
```

## Reset staging test data

To remove only staging seed rows (manual, destructive for staging test data only):

```sql
DELETE FROM public.events
WHERE id LIKE 'staging-seed-%' OR id IN ('void-techno-saturday', 'klangkuenstler-berghain');

DELETE FROM public.collections WHERE id LIKE 'staging-seed-%';
DELETE FROM public.sources WHERE id LIKE 'staging-seed-%';
DELETE FROM public.artists WHERE id LIKE 'staging-seed-%';
DELETE FROM public.venues WHERE id LIKE 'staging-seed-%';
DELETE FROM public.genres WHERE id LIKE 'staging-seed-%';
DELETE FROM public.cities WHERE id LIKE 'staging-seed-%';
```

Re-run the seed SQL afterwards.

## Local mock mode vs Supabase staging

| | `EXPO_PUBLIC_USE_SUPABASE=false` | `EXPO_PUBLIC_USE_SUPABASE=true` |
|--|----------------------------------|-----------------------------------|
| Data source | Local pipeline (`runDefaultEventPipeline`) | Supabase staging DB |
| Seed SQL | Not used | Required for populated UI |
| Featured IDs | From demo pipeline | From `seed-staging-app-data.sql` |
| Filters | Static `filterConfig` + pipeline events | `filterConfig` + Supabase events |
| RLS | N/A (in-memory) | `anon` reads only `published` |

Both modes use the same `EventRepository` bootstrap and UI components.

## Data flow

```
Supabase (published events + joins)
  → supabase-datasource (venues/cities/genres/artists embed)
  → EventRepository.initialize()
  → MemoryCache
  → Home / Search / Map / Detail / Favorites
```

## Images

Seed events use `NULL` for `image_url` to verify placeholder/fallback UI. No external image downloads.

## App validation checklist

After seeding staging:

- [ ] Home shows published events (Highlights, Tonight, Weekend, Upcoming)
- [ ] Today filter returns tonight events
- [ ] Weekend filter returns weekend events
- [ ] Search finds event title, artist, venue
- [ ] Genre filter (Techno, House, …) works
- [ ] City filter (Köln / Berlin) works
- [ ] Collections screens show filtered events
- [ ] Event detail opens
- [ ] Favorites add/remove works
- [ ] Missing images show fallback (no crash)
- [ ] Draft events not visible to anon
- [ ] Bootstrap loading/error states still work
