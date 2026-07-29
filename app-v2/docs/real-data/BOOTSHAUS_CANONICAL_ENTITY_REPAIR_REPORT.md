# Bootshaus Canonical Entity Repair Report

**Sprint:** 26.8 P0  
**Date:** 2026-07-29  
**Target:** `gnkjzinwvmrxcadwebhv.supabase.co`  
**Migration:** `20260758000000_sprint268_bootshaus_canonical_entity_repair.sql`

---

## Summary

Live drift between **staging-seed IDs** and **production canonical IDs** was repaired additively. The production venue `venue-bootshaus-koeln` was created; Bootshaus `source_config.defaults` now points to it. Staging rows were left untouched.

---

## Phase 1 — Preconditions (verified before mutation)

| Check | Result |
|-------|--------|
| `staging-seed-city-koeln` exists | ✅ exactly 1 |
| `staging-seed-venue-bootshaus` exists | ✅ exactly 1 |
| `organizer-bootshaus` exists | ✅ exactly 1 |
| `venue-bootshaus-koeln` absent | ✅ |
| slug `bootshaus-koeln` absent | ✅ |
| `source-bootshaus-koeln` → staging IDs | ✅ `venueId: staging-seed-venue-bootshaus` |

---

## What changed

| Object | Change |
|--------|--------|
| `venues` | **INSERT** `venue-bootshaus-koeln` (slug `bootshaus-koeln`) |
| `sources` (`source-bootshaus-koeln`) | **UPDATE** `defaults.venueId` → `venue-bootshaus-koeln`, `defaults.venueName` → `Bootshaus` |

### Production venue fields

| Field | Value |
|-------|-------|
| `id` | `venue-bootshaus-koeln` |
| `slug` | `bootshaus-koeln` |
| `name` | Bootshaus |
| `city` | Köln |
| `country` | Germany |
| `city_id` | `staging-seed-city-koeln` |
| `address` | Auenweg 173, 51063 Köln |
| `street` | Auenweg 173 |
| `postal_code` | 51063 |
| `website` | https://bootshaus.tv |
| `venue_type` | club |
| `latitude` / `longitude` | Copied from `staging-seed-venue-bootshaus` (50.9234 / 6.9672) |

### Source defaults after repair

| Key | Before | After |
|-----|--------|-------|
| `venueId` | `staging-seed-venue-bootshaus` | `venue-bootshaus-koeln` |
| `venueName` | Bootshaus | Bootshaus (unchanged) |
| `cityId` | `staging-seed-city-koeln` | `staging-seed-city-koeln` (unchanged) |
| `organizerId` | `organizer-bootshaus` | unchanged |
| All other defaults | — | unchanged |

---

## What did NOT change

- `staging-seed-city-koeln` — untouched
- `staging-seed-venue-bootshaus` — untouched
- `organizer-bootshaus` — untouched
- Other `sources` rows — untouched
- `import_records` (72) — untouched
- `import_review_queue` (72) — untouched
- Published events — none exist (0)
- `publish_mode`, schedule, connector config — untouched

---

## Root cause — why migration 570 never created the venue

Migration `20260757000000` used a **too-broad `NOT EXISTS` guard**:

```sql
where not exists (
  select 1 from public.venues v
  where v.id = 'venue-bootshaus-koeln'
     or v.slug = 'bootshaus-koeln'
     or (lower(v.name) = 'bootshaus' and lower(city) in ('köln', ...))
     ...
)
```

Because `staging-seed-venue-bootshaus` already matched `name = Bootshaus` + `city = Köln`, the insert was skipped. The subsequent `source_config.defaults` fallback then resolved to the staging venue ID.

**This was not an architecture change** — staging seed and production canonical IDs coexisted on the same DB without reconciliation.

---

## Why this repair migration fixes the drift cleanly

1. **Narrow guard** — only checks `id = venue-bootshaus-koeln` OR `slug = bootshaus-koeln`; staging venue no longer blocks insert.
2. **Additive** — `ON CONFLICT (id) DO NOTHING`; no overwrites of existing rows.
3. **City reuse** — `city_id = staging-seed-city-koeln`; runtime code reads `defaults.cityId`, no hard requirement for `id = koeln`.
4. **Surgical source update** — only `venueId` and `venueName` in defaults; all other config preserved.
5. **Staging preserved** — demo/UI data remains for rollback reference; can be removed in a later cleanup phase.

---

## City ID strategy

| Option | Decision |
|--------|----------|
| Create new `id = koeln` city | **Rejected** — would duplicate slug `koeln`, FK migration risk |
| Reuse `staging-seed-city-koeln` | **Accepted** — slug `koeln`, name `Köln`; code uses `defaults.cityId` at runtime |

Future optional step: rename `staging-seed-city-koeln` → `koeln` via additive FK-safe migration if product requires canonical city ID — not needed for import/normalization today.

---

## Verification

Run: `docs/real-data/SPRINT268_CANONICAL_ENTITY_REPAIR_VERIFICATION.sql`

Post-repair expectations:

- ✅ exactly 1 `venue-bootshaus-koeln`
- ✅ slug `bootshaus-koeln` present
- ✅ `defaults.venueId = venue-bootshaus-koeln`
- ✅ `staging-seed-venue-bootshaus` still exists
- ✅ `organizer-bootshaus` unchanged

---

## Not yet executed (by design)

- Cleanup SQL (`BOOTSHAUS_REVIEW_DEDUP_CLEANUP.sql`)
- Review queue deduplication
- Bootshaus re-import
- Publish / Discovery validation

These follow after canonical repair is confirmed stable.
