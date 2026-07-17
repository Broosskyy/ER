# Eternal Rave

**Discover. Connect. Rave.**

Premium mobile-first event discovery platform for electronic music, raves, clubs, festivals and underground culture.

## Documentation

**Start here:** [docs/00-master-index/README.md](./docs/00-master-index/README.md) (Band 0 — Master Index)

Sprint 0 project readiness: [docs/PROJECT_READY.md](./docs/PROJECT_READY.md)

## Development Workflow

Official development process for Eternal Rave:

```
Master Prompt
      ↓
   Sprint
      ↓
 Code Review
      ↓
    Tests
      ↓
    Merge
      ↓
 Nächster Sprint
```

**Principles:**

- **Clear sprint goal** — each sprint has one defined objective; scope is agreed before coding starts.
- **No parallel major refactors** — avoid overlapping large rewrites; finish one stream before opening the next.
- **Incremental development only** — small, reviewable changes; no big-bang reimplementation.
- **Documentation first** — when code and docs conflict, documentation wins; update docs in the same sprint.
- **Quality over speed** — correctness, consistency and maintainability before feature velocity.
- **Sprint review required** — every sprint ends with a review (code, docs, deliverables) before merge.

See also: [Definition of Done](./docs/project/definition-of-done.md) · [Versioning](./docs/project/versioning.md)

## Sprint Deliverables

After **every** sprint, the following artifacts must be created automatically:

| File | Purpose |
|------|---------|
| `SPRINT_X_REPORT.md` | Executive summary: goals, changes, risks, readiness for next sprint |
| `CHANGED_FILES.md` | Complete list of modified/added/deleted files with brief rationale |
| `OPEN_ISSUES.md` | Known bugs, gaps and follow-ups not resolved in this sprint |
| `NEXT_STEPS.md` | Prioritized backlog for the next sprint |
| `DECISIONS.md` | Architectural and product decisions made during the sprint |
| `TEST_RESULTS.md` | Build, typecheck, lint and test outcomes |
| `METRICS.md` | Optional quantitative notes (performance, bundle size, coverage) |
| `KNOWN_LIMITATIONS.md` | Explicit constraints, stubs and deferred scope |
| `SPRINT_X_REPORT.zip` | ZIP archive of all sprint reports for direct download |

Deliverables live in the repo root (or `docs/sprint-X/` when grouped). The ZIP is published on `main` for one-click download.

## Branch Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Always stable; production-ready baseline; sprint reports and releases target this branch |
| `develop` | Optional integration branch for future multi-team workflows (not required today) |
| `feature/*` | One feature or sprint scope per branch (e.g. `cursor/sprint-2-ui-a932`) |

**Rules:**

- **One sprint = one pull request** — all sprint work merges via a single PR after review.
- Feature branches are short-lived; delete after merge.
- Direct commits to `main` only for hotfixes or approved doc-only updates.

## Tech Stack

- React Native + Expo (SDK 56)
- TypeScript
- Expo Router
- NativeWind (Tailwind-style styling)
- Supabase (Auth + Postgres — Sprint 2)

## Sprint 2 — Supabase Backend

See [supabase/README.md](./supabase/README.md) for setup.

1. Copy `.env.example` → `.env` with your Supabase URL + anon key
2. Run `supabase/migrations/001_initial_schema.sql` in Supabase SQL Editor
3. Register in app, then promote role via SQL (`admin` / `organizer`)

Without env vars the app runs in **local demo mode** with mock data.

## MVP Features

- Event feed with featured & weekend highlights
- Event detail with lineup, tickets & guestlist
- Search & filters
- Map placeholder (Mapbox in V0.3)
- Favorites (Supabase sync when logged in, local fallback otherwise)
- Auth (login / register)
- Event lifecycle + admin review (Supabase or local demo)
- Realistic dummy event data (Hamburg/Berlin)

## Download APK (Android)

**[Download v1.7.0 APK](https://github.com/Broosskyy/Eternal-Rave/releases/download/v1.7.0/Eternal-Rave-v1.7.0.apk)** (~105 MB)

Previous: [v1.6.0](https://github.com/Broosskyy/Eternal-Rave/releases/download/v1.6.0/Eternal-Rave-v1.6.0.apk) · [v1.5.0](https://github.com/Broosskyy/Eternal-Rave/releases/download/v1.5.0/Eternal-Rave-v1.5.0.apk) · [v1.3.0](https://github.com/Broosskyy/Eternal-Rave/releases/download/v1.3.0/Eternal-Rave-v1.3.0.apk)

1. Download the APK on your Android device
2. Allow installation from unknown sources if prompted
3. Open and install

Or browse all releases: https://github.com/Broosskyy/Eternal-Rave/releases

## Getting Started (Development)

```bash
npm install
npm start
```

Press `a` for Android emulator, or scan the QR code with Expo Go.

## Scripts

- `npm start` — Start Expo dev server
- `npm run android` — Start on Android
- `npm run typecheck` — TypeScript check

## Project Structure

```
app/           # Expo Router screens
src/
  components/  # Reusable UI components
  data/        # Dummy event data
  constants/   # Theme & config
  types/       # TypeScript types
  utils/       # Formatting & filter helpers
  hooks/       # Auth, EventStore, Favorites
  services/    # Supabase API layer
  lib/supabase/# Client & env config
supabase/      # SQL migrations & seed
```

## Roadmap

- **V0.2** — Supabase backend, auth, organizer registration
- **V0.3** — Real database, map integration
- **V1** — Play Store launch
