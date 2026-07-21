# ER-009 — Venue Admin CMS — Completion Report

**Date:** 21 July 2026  
**Branch:** `feature/er-009-venue-admin-cms`  
**Status:** Complete

---

## A. Executive summary

ER-009 establishes Venue as a canonical, reusable location entity with extended domain fields, slug support, local/Supabase datasource parity, `VenueService`, admin CMS routes, event editor venue picker, import review venue resolution, scoped RLS, and comprehensive tests — without public venue pages or map features.

---

## B. Repository analysis findings

| Finding | Detail |
|---------|--------|
| Pre-ER-009 `venues` table | Minimal: `name`, `address`, `city_id`, coordinates, `website`, `instagram` |
| `events.venue_id` | Already existed; underused in admin event editor |
| `VenueRepository` | Read-only `getAll()` via generic table datasource |
| No venue mapper | Supabase snake_case not mapped (risk vs ER-007 artists) |
| Import matching | `VenueMatchingService` + `matchedVenueId` persisted on approve |
| Admin gap | Venues loaded in event editor but discarded (`void venues`) |
| Public reads | Previously all venues readable anonymously |

---

## C. Architecture decisions

- **Canonical source:** `venues` table + `events.venue_id` FK
- **Legacy fields retained:** `events.venue_name`, `events.venue_city`, pipeline `Event.venue` string — derived from canonical venue on save where possible
- **Delete strategy:** Prevent deletion when events reference venue (service + FK RESTRICT behavior)
- **Public visibility:** Venues readable only when referenced by published events (RLS)
- **No venue merge tooling** in ER-009 — duplicate detection warns/blocks on create

---

## D. Schema and migration

**Migration:** `20260735000000_er009_venue_admin_foundation.sql`

Extended `venues` with: `slug`, `street`, `house_number`, `postal_code`, `city`, `state`, `country`, `capacity`, `notes`

Backfill: slug from name, city/country from `cities` FK, street from legacy `address`, deterministic `events.venue_id` from `venue_name` + `venue_city` where possible.

Indexes: unique `slug`, `name`, `city`, `country`, `events.venue_id`

---

## E. Domain and service

- `VenueRecord` extended with canonical fields + timestamps
- `venue-slug.ts`, `venue-validation.ts`, `venue-duplicate.ts`
- `VenueService`: create, update, delete (with event guard), list, duplicate detection
- `VenueRepository` + `AdminVenueRepository`
- `venue-mapper.ts` for snake_case parity

---

## F. Admin CMS

| Route | Purpose |
|-------|---------|
| `/admin/venues` | List + search |
| `/admin/venues/new` | Create |
| `/admin/venues/[id]` | Edit / delete |

- `VenuePicker` in admin event editor
- `AdminShell` nav item added
- Permissions: `canViewVenues`, `canEditVenues`, `canCreateVenues`, `canDeleteVenues`

---

## G. Event and import integration

- Admin event save persists `venueId`; local datasource derives consumer `Event.venue`/address/city/country from canonical venue
- Supabase event reads use expanded venue relation (`city`, `country`, `street`)
- Import review shows raw venue name + resolved canonical venue label
- Import approve continues persisting `matchedVenueId` → `events.venue_id`

---

## H. RLS

| Policy | Access |
|--------|--------|
| `anon_read_public_event_venues` | SELECT when referenced by published event |
| `admin_read_venues` | CMS reads via `is_admin()` |
| `admin_insert/update/delete_venues` | `editor`+ |

---

## I. Test results

| Suite | Result |
|-------|--------|
| `npm test` | **427/427 passed** |
| `npm run validate:migrations` | **PASS** (17 migrations) |
| `npm run typecheck` | Pre-existing failures only (`en.ts`, staging-seed, location) — ER-009 venue UI/router issues fixed |
| `npm run lint` | Pre-existing project warnings |

**New tests:** `venue-domain.test.ts`, `venue-service.test.ts`, `er009-venue-admin-migration.test.ts`

---

## J. Deferred work

- Public venue pages / routing
- Maps, geocoding, nearby search
- Venue merge tooling
- Automatic venue creation from imports
- Remove deprecated `city_id` / combined `address` after full consumer migration
- Organizer / festival / stage domains (ER-010+)

---

## K. Recommended next epic

**ER-010** — per product backlog (organizer domain, festival domain, or event_genres junction per architecture docs).

---

## L. Files changed (summary)

Migration, `VenueRecord`, venue domain/service/mapper, local/supabase venue datasources, repositories, registry, admin permissions/routes, `AdminShell`, `/admin/venues/*`, `VenuePicker`, event editor, import review UI, `VenueAutocomplete` city context, docs.
