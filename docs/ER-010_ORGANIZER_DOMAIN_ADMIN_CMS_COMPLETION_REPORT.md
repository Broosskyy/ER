# ER-010 — Organizer Domain & Admin CMS — Completion Report

**Date:** 22 July 2026  
**Branch:** `feature/er-010-organizer-domain-admin-cms`  
**Status:** Complete

---

## A. Executive summary

ER-010 introduces Organizer as a canonical event-related entity with extended domain fields, slug support, local/Supabase datasource parity, `OrganizerService`, admin CMS routes, event editor organizer picker, import organizer matching and review display, scoped RLS, and comprehensive tests — without public organizer pages or team-management features.

---

## B. Repository analysis findings

| Finding | Detail |
|---------|--------|
| Pre-ER-010 organizers | Not persisted; `organizer-foundation.ts` held planning types only |
| `events.organizer` | Free-text display field in domain/pipeline only; not in Supabase schema |
| Import | `organizerName` on normalized candidates; no `matchedOrganizerId` |
| `createdBy` on events | Contributor/auth ownership — **not** an Organizer entity |
| `organizer-foundation` team roles | Future ER-011+ scope; not implemented |
| Product cardinality | Single organizer per event (import `organizerName`, one UI row, one display string) |
| Venue/Artist patterns | ER-009 / ER-007 provide CMS, slug, duplicate detection, RLS templates |

---

## C. Architecture decisions

### Selected relationship: single organizer per event

**Model:** `events.organizer_id` → `organizers.id` (nullable FK, `ON DELETE RESTRICT`)

**Evidence:**
- Import exposes one `organizerName` per candidate
- Public event detail shows one organizer line (`event.organizer` string)
- Admin event editor supports one picker (mirrors `events.venue_id`)
- No product/UI evidence for multiple organizers per event

**Not used:** `event_organizers` junction table (reserved for future multi-organizer product requirements)

### Legacy compatibility

| Field | Role |
|-------|------|
| `events.organizer` (text) | Deprecated display/import fallback; preserved on migration |
| `AdminEventRecord.organizerName` | Legacy free-text; synced from canonical organizer name on save |
| `Event.organizer` (domain) | Public display: canonical name when `organizer_id` set, else legacy text |

### Backfill rules

- Create organizers only from repeated non-generic normalized `events.organizer` text
- Skip: Various, Unknown, TBA, Private, Self-organized, Community, Local crew
- Link events by exact normalized name + city context
- No fuzzy merges; ambiguous data left unlinked

### Delete behaviour

- `ON DELETE RESTRICT` on `events.organizer_id`
- Service blocks delete when events reference organizer
- Events never cascade-deleted

### Public data boundary

- RLS: anonymous read only for organizers referenced by **published** events
- Public event queries join organizer **name** only (no notes, email, phone)
- Internal notes admin-only via CMS + RLS

---

## D. Database schema

**Migration:** `20260736000000_er010_organizer_domain_foundation.sql`

- `organizers` table (slug, name, contact/social fields, notes, timestamps)
- `events.organizer_id` FK + `events.organizer` legacy text column
- `import_records.matched_organizer_id` FK
- Indexes: slug (unique), name, city, country, `events.organizer_id`
- RLS: `anon_read_public_event_organizers`, admin CRUD policies

---

## E. Application architecture

| Layer | Implementation |
|-------|----------------|
| Domain | `organizer-slug.ts`, `organizer-validation.ts`, `organizer-duplicate.ts` |
| Mapper | `organizer-mapper.ts` (+ public projection helper) |
| Datasources | `local-organizer-datasource.ts`, `supabase-organizer-datasource.ts` |
| Repositories | `OrganizerRepository`, `AdminOrganizerRepository` |
| Service | `OrganizerService` |
| Permissions | `canViewOrganizers`, `canEditOrganizers`, `canCreateOrganizers`, `canDeleteOrganizers` |
| Admin CMS | `/admin/organizers`, `/admin/organizers/[id]` |
| Event editor | `OrganizerPicker` |
| Import | `OrganizerMatchingService`, `matchedOrganizerId` persistence, review UI |

---

## F. Import integration

- Matching uses name similarity with `minOrganizerConfidence` (80)
- Generic names → `invalid` match type (preserved raw text, no canonical link)
- Unmatched / ambiguous states preserved; no auto-create on approval
- Review UI shows imported organizer text + resolved canonical name

---

## G. Test results

| Suite | Result |
|-------|--------|
| `npm test` | **443/443 passed** |
| `npm run validate:migrations` | PASS (18 migrations) |
| Organizer domain/service/matching tests | PASS |
| Migration test | PASS |

---

## H. Validation notes

| Check | Result |
|-------|--------|
| `npm run typecheck` | Pre-existing failures (`en.ts` TranslationTree, `pg` types); ER-010 fixed `staging-seed` / `event-venue-domain` EventRow fixtures |
| `npm run lint` | Pre-existing warnings; import order warnings on new files |

---

## I. Deferred work (ER-011+)

- Public organizer profile/discovery routes
- Multi-organizer events (`event_organizers` junction)
- Organizer team membership / ownership (`organizer-foundation` roles)
- Organizer merge tooling
- CRM, billing, messaging

---

## J. Files changed (summary)

- `supabase/migrations/20260736000000_er010_organizer_domain_foundation.sql`
- `src/features/organizers/**`
- `src/data/mappers/organizer-mapper.ts`
- `src/data/datasources/local/local-organizer-datasource.ts`
- `src/data/datasources/supabase/supabase-organizer-datasource.ts`
- `app/admin/organizers/**`
- `src/features/admin/components/OrganizerPicker.tsx`
- Event mapper, import matching, review UI, registry, permissions

---

## K. Recommended next epic

**ER-011** — Festival / multi-stage domain (per architecture roadmap), or public SEO hardening per product backlog.
