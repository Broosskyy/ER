# Sprint 4 — Known Limitations

## Backend

- Requires Supabase env vars + migration 006 for live organizer/admin flows
- Without Supabase, app uses in-memory demo data from `useEventStore`
- Soft delete only (`deleted` lifecycle status); no hard delete UI

## Organizer

- Event statistics (views, followers) show real counts for lifecycle buckets only; no analytics pipeline
- Flyer/image upload remains placeholder
- Timetable upload deferred
- No pagination on dashboard lists (limit 200 server-side)

## Admin

- Review queue foundation only — not a full admin platform
- Import/user submission demo cards remain on store in demo mode
- Request changes sets status to `pending_review` (organizer must edit and resubmit)

## Validation

- Description not required at domain level (optional field)
- Genre required in wizard step 0 only (UI rule)

## Quality

- No ESLint or automated test suite
- Web build not configured (missing react-dom / react-native-web)

## Explicitly not in Sprint 4

Discovery, Home Feed, Search, Filters, Maps, AI, RSS, OAuth, Push, Payments, Chat, Social
