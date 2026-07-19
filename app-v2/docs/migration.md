# Database Migrations

## Policy

All database changes go through Supabase migrations in `supabase/migrations/`. No manually maintained standalone SQL files outside this folder.

## Current Migrations

| File | Description |
|---|---|
| `20260719000000_initial_schema.sql` | Full Sprint 11 schema: tables, indexes, RLS, storage buckets |

## Setup

1. Install [Supabase CLI](https://supabase.com/docs/guides/cli)
2. Link project: `supabase link --project-ref <ref>`
3. Apply: `supabase db push`

## Local Development

```bash
supabase start          # local Supabase stack
supabase db reset       # apply all migrations fresh
```

## Environment

After migration, set in `.env`:

```
EXPO_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
EXPO_PUBLIC_USE_SUPABASE=true
```

## Adding Migrations

```bash
supabase migration new <description>
```

Edit the generated file, then `supabase db push`.

## Sprint 12 TODO

- Seed migration for genres, cities, initial Köln data
- Admin role claims / custom JWT
- Import staging tables
- Audit log table
