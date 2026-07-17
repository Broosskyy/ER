# Supabase Setup — Eternal Rave Sprint 2

## 1. Create project

Create a project at [supabase.com](https://supabase.com).

## 2. Run migration

In **SQL Editor**, run:

- `supabase/migrations/001_initial_schema.sql`
- `supabase/migrations/002_event_sources.sql` (Sprint 2.1 — Source Manager)
- `supabase/migrations/003_user_submission_rls.sql` (Sprint 2.2 — user submissions)
- `supabase/migrations/004_duplicate_warning_events.sql` (Sprint 2.4 — duplicate warnings on events)
- `supabase/migrations/005_auth_roles_moderator.sql` (Sprint 2 — moderator role + auth helpers)
- `supabase/migrations/006_event_foundation.sql` (Sprint 3 — event domain extensions + audit)

Optional seed data (Sprint 2.1 — 30 published events):

- `supabase/seed_published_events.sql` — run in SQL Editor after migrations
- Regenerate with: `node scripts/generate-seed-events.js`

After seeding, pull-to-refresh on Home or Events to load live data. If Supabase returns zero published events, the app falls back to demo data.

## 3. Configure app

Copy `.env.example` to `.env`:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

Restart Expo after changing env vars.

## 3b. Auth redirect URLs (Sprint 2)

In Supabase **Authentication → URL Configuration**, add:

- Site URL: `eternalrave://`
- Redirect URLs: `eternalrave://reset-password`, `eternalrave://verify-email`

Required for password reset and email verification deep links.

## 4. Create admin user

1. Register in the app (`/register`)
2. In Supabase SQL Editor:

```sql
update public.profiles set role = 'admin' where email = 'your@email.com';
```

For organizer access:

```sql
update public.profiles set role = 'organizer' where email = 'your@email.com';
```

## 5. Architecture

| Layer | Path |
|-------|------|
| Client | `src/lib/supabase/client.ts` |
| DB types | `src/types/database.ts` |
| Services | `src/services/` |
| Auth | `src/hooks/useAuth.tsx` |
| Event state | `src/hooks/useEventStore.tsx` |
| Source Manager | `src/hooks/useEventSources.tsx` |

## 6. Offline / demo mode

Without env vars, the app uses local mock data (Sprint 1.2 behavior).

## 7. Import pipeline (Sprint 2.3)

**Source Manager** (`/admin/sources`) — admins manage `event_sources` (club sites, ticket platforms, Instagram, CSV, text paste, flyer upload). Mock import creates linked `import_sources` + event drafts.

**URL / Text Importer** (`/admin/import`) — paste a URL or unstructured event text. Text mode uses **regex/rules parser** (Sprint 2.5) to extract title, date, time, city, venue, genres, lineup, price, and ticket URL. Creates:
- `import_sources` row
- `events` row with `lifecycle_status = imported_draft` (or `needs_review` if duplicate warning)
- Preview at `/admin/import/preview/[id]` with edit, send to review, approve, publish, reject, duplicate

No real scraping yet — workflow foundation only.

Optional seed: `supabase/seed_event_sources.sql`

## 8. Event lifecycle

Events only appear in the public feed when `lifecycle_status = 'published'`.

Flow: user submission (`pending_review`) → approved → published (or rejected / duplicate)

User submissions are stored in `events` with `source_type = user_submission`. Only admins can publish.
