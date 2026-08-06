# Phase 4.6.2 Part 3 — Production Readiness, E2E Validation & Regression Closure

**Date:** 2026-08-02  
**Scope:** Production readiness gate only — no new features, sources, or redesign  
**Decision:** **Not ready for Phase 5** (see §18)

---

## 1. Regression inventory (user-test baseline)

Source: `PHASE_46_USER_TEST_REGRESSION_INVENTORY.md` + Part 1/2 reports.  
**Validation rule:** Manual browser confirmation required; unit tests alone do not close an item.

| # | Issue | Reproduction | Root cause | Fix (code/docs) | Manual validation | Remaining risk |
|---|--------|--------------|------------|-----------------|-------------------|----------------|
| R1 | Search entity rows don't navigate | Search Bootshaus/Lehmann → tap entity | Plural routes / unwired handlers | `UniversalSearchResults` + singular routes; `phase46-universal-search-routes.test.ts` | **Not re-run in browser this session** | Low if tests match prod routes |
| R2 | Inconsistent profile links on detail | Lineup/venue/organizer labels | Text-only relations vs canonical IDs | `profileNavigable` gating; internal entity block | **Pending** named events | 127 text-only organizers still inert |
| R3 | Follow not authoritative | Follow venue → reload | AsyncStorage / migration not deployed | `SupabaseFollowStorage` + migration `20260801120000_phase46_entity_follows.sql` | **Blocked** — migration not applied | **High** — counts not cross-device |
| R4 | Owner profile guest-like UI | Log in as owner → Profile tab | Local profile without role surfacing | Auth-scoped storage, hydration fixes (4.6) | **Pending** owner walkthrough | Medium |
| R5 | Nested interactive controls | Favorite inside card on web | Pressable nesting | Card action placement refactor (4.6) | **Pending** DOM audit | Medium on some cards |
| R6 | GO_BACK not handled | Deep link detail → Back | Raw `router.back()` | `navigateBackSafely` on detail/profile | **Pending** refresh + back | Low |
| R7 | Demo/internal data on public surfaces | Home/search/map lists | Eligibility not unified | `internal-event-eligibility.ts` + discovery/search/detail filters | **Pending** Charlotte/staging grep in UI | Medium without RLS |
| R8 | Price/badge mismatch across surfaces | Same event home vs detail | Independent formatters | `ticket-presentation.ts`, `TicketPriceLabel`, shared view models (4.6.2 P2) | **Pending** cross-surface spot check | Low for label text; badges partial |
| R9 | Raw/compressed descriptions | Detail enriched events | HTML not structured in UI | `normalizePublicEventDescription`, `ExpandableText` | **Pending** Bootshaus/SHOCKONE | Structured sections still missing |
| R10 | Lineup unknown vs description artists | Sommerfest, SHOCKONE | Priority chain / timetable stub | Part 1 pipeline + Part 2 lineup UX | **Pending** + **re-import** | Data not live until re-import |
| R11 | Home section limits inconsistent | Compare home rails | Dual limit authorities | `home-config` 6 cards (4.6) | **Pending** | Low |
| R12 | Venue shown as street address | Bootshaus/Mallorca route | Address validity | `address-validity.ts`, `VenueDetailCard` (4.6) | **Pending** | Low |
| R13 | GPS blocks location on HTTP | Web without secure context | No capability messaging | Partial location messaging (4.6) | **Pending** on LAN HTTP | Medium for dev testing |
| R14 | Blank loading/empty rails | Home/search during load | Per-surface shells | Skeleton components (partial) | **Pending** | Low–medium |
| R15 | Verification labels misleading | Official venue “Nicht verifiziert” | Source vs claim conflation | `entity-verification-status.ts`, `official_source` label | **Pending** profile audit | Medium |

**MP4 user-test video:** Not replayed in this session; checklist above is the written regression baseline.

---

## 2. Root causes (summary)

| Category | Root cause |
|----------|------------|
| Data | Published events not re-imported after Part 1 lineup/description fixes |
| Persistence | `entity_follows` table migration not deployed; follow falls back to device storage |
| Bundle | `getSupabaseServiceClient` / `SUPABASE_SERVICE_ROLE_KEY` string shipped in web JS (tree-shaking) |
| Routing | Resolved in code; needs browser confirmation |
| Presentation | Shared ticket semantics fixed in P2; badge chip coverage still partial |
| Scope | Location/filter unification deferred from P2 |

---

## 3. End-to-end event validation

**Tool:** `scripts/operations/_phase462-import-trace-audit.ts` (read-only)

**Run result:** **Failed in Node** — `demo-image-assets.ts` loads binary PNG under tsx (not a production bug; ops script needs `USE_IN_MEMORY` or image stub).

**Pipeline contract (code-level):**

```
Source → import_records → publish → Event record → canonical-event-projection → display-event → view models → UI
```

| Stage | Validation events | Status |
|-------|-------------------|--------|
| Import / raw | Sommerfest, PLAY!, Technodampfer, SHOCKONE, etc. | **Not traced live** — script blocked |
| Projection | `canonical-event-projection.ts`, Part 1 tests | Unit tests pass |
| Public Event | `toEventDisplayModel` | Unit tests pass |
| Home/search/map | `toEventCardViewModel` + eligibility | Shared mapper; manual pending |
| Detail | `event-detail-view-model.ts` | Manual pending |
| Share | `shareEvent` | Manual pending |

**Requirement:** Run import trace against production or staging Supabase after fixing ops script bootstrap for Node.

---

## 4. Manual browser validation

**Status:** **Not completed** in this session.

| Target | Planned check | Result |
|--------|---------------|--------|
| Bootshaus Sommerfest | Detail, lineup, venue, price | Pending |
| PLAY! Open Air | Detail, outdoor badges | Pending |
| Technodampfer | Lineup partial | Pending |
| Affenkäfig | Profile + events | Pending |
| Musik die mich antreibt | Search + detail | Pending |
| SHOCKONE | Lineup/description | Pending |
| Lehmann / Proton / Area51 | Profile routing | Pending |
| Mallorca event | Geography/venue | Pending |
| Festival profile | Route + events | Pending |
| Saved event | Save/remove/reload | Pending |
| Owner profile | Identity consistency | Pending |
| Search / Map / Filters / Location | Cross-surface | Pending |

**Dev server:** Port 8081 occupied; Expo start skipped non-interactive. Use `npx expo start --web --port 8082` or free 8081 before walkthrough.

---

## 5. Search validation

| Check | Code status | Manual |
|-------|-------------|--------|
| Preview (`SearchExplorePanel`) | Hardcoded DE section titles | Pending |
| Ranking | `universal-search-service.ts` weighted scores | Pending |
| Entity routing | Tests in `phase46-universal-search-routes.test.ts` | Pending |
| Filters | `filter-config.ts` | Pending |
| Duplicate results | Dedup in search service | Pending |
| Images/metadata | View model mappers | Pending |

---

## 6. Filter validation

| Check | Status |
|-------|--------|
| Unified Home/Search/Map/Calendar | **Not unified** — separate config sources |
| Active filter chips | Partial on search/map |
| Reset | Surface-specific |
| Manual matrix | **Pending** |

---

## 7. Location validation

| Check | Status |
|-------|--------|
| Shared `UserLocationProvider` state | Implemented |
| City search in picker | Partial (`filter-config` cities) |
| ZIP / address search | **Not implemented** |
| Radius parity home vs map | **Split presets** |
| GPS secure context messaging | Partial |
| Manual | **Pending** |

---

## 8. Profile validation

| Check | Code | Manual |
|-------|------|--------|
| Route/slug canonical redirect | `PublicEntityProfileScreen` | Pending |
| Images, bio, website | Profile headers | Pending |
| Verification labels | `entity-verification-status.ts` | Pending |
| Follow + followers | Header stats + `useEntityFollow` | Pending (migration) |
| Upcoming events | `EntityProfileEventsSection` | Pending |
| Text-only placeholders | Not navigable | By design |

---

## 9. Price & badge validation

| Surface | Shared `resolvePublicTicketPresentation` | Manual |
|---------|---------------------------------------------|--------|
| Home rails | ✓ via `toEventCardViewModel` | Pending |
| Search / map / saved / similar / detail | ✓ wired in P2 | Pending |
| Semantic colors | `TicketPriceLabel` + `design/ticket-semantics.ts` | Pending |
| Status badges (today, featured, etc.) | Partial chip coverage | Pending |

---

## 10. Lineup validation

| State | Behavior (P2) | Manual |
|-------|---------------|--------|
| Complete | `LINE-UP` + artist cards | Pending |
| Partial | `ARTIST` / `BEKANNTE ARTISTS` | Pending |
| No lineup | Placeholder card | Pending |
| Inferred vs structured | Part 1 publish guard | Needs **re-import** for live data |

---

## 11. Description validation

| Check | Status |
|-------|--------|
| Paragraphs / expand | `ExpandableText` + normalizer | Unit tests |
| Structured admission/FAQ/timetable | **Not implemented** | — |
| Source parity | Pending manual vs ticket.io/bootshaus pages |

---

## 12. Demo-data validation

| Guard | Implementation |
|-------|----------------|
| `isInternalEntityId` | staging-seed, demo-, regression-, test-, search-test, Charlotte slug |
| Detail API | `isInternalPublicEvent` → NOT_FOUND |
| Search | Filtered in `universal-search-service` |
| Profiles | `entity-profile-loader` rejects internal IDs |
| Discovery engine | `discovery-eligibility-resolver` |

**Manual grep in running UI:** Pending (search “Charlotte”, “staging-seed”).

**RLS defense-in-depth:** Not verified.

---

## 13. Saved events validation

| Check | Implementation | Manual |
|-------|----------------|--------|
| v1→v2 migration flag | `saved_events_migrated_v2` | Pending reload test |
| Remove always allowed | `FavoritesContext` | Pending |
| Archived/deleted handling | Eligibility on add | Pending |
| Cross-device sync | **Not implemented** (local AsyncStorage) | N/A |

---

## 14. Performance validation

| Check | Status |
|-------|--------|
| Duplicate renders | Not profiled this session |
| Duplicate discovery requests | Cache keys in `discovery-event-detail-client` | Code review only |
| Skeletons | Present on major surfaces | Visual pending |
| Follow hydration | Per-profile fetch | Acceptable |

---

## 15. Build & release validation

| Gate | Result | Notes |
|------|--------|-------|
| `npm run typecheck:app` | ✓ Pass | |
| `npm run lint` | ✗ 2 errors | `react-hooks/set-state-in-effect` in `UserProfileProvider.tsx`, `app/profile/edit.tsx` |
| `npm test` (vitest) | ✓ 1413 pass | After ticket label test + boundary fix |
| `npm run build:web` | ✓ Pass | `dist/` exported |
| `npm run validate:build-output` | ✗ **Fail** | `SUPABASE_SERVICE_ROLE_KEY` string in `entry-*.js` (function names + ops client in bundle) |
| `npm run validate:env` | ✓ Pass | development mode |
| Expo Web manual | **Not run** | Port 8081 busy / timeout |
| React/hydration warnings | **Not audited** in browser | |

**Bundle note:** No JWT-shaped secrets found in `dist/`; failure is env **name** and ops client code path in public bundle — still a **release blocker** per existing policy.

---

## 16. Documentation updates

| Document | Action |
|----------|--------|
| `PHASE_462_PART3_PRODUCTION_READINESS_REPORT.md` | **Created** (this file) |
| `PHASE_462_PART2_PUBLIC_UX_REPORT.md` | Reference for P2 scope |
| `PHASE_462_PART1_DATA_INTEGRITY_REPORT.md` | Reference for pipeline |
| `PHASE_46_USER_TEST_REGRESSION_INVENTORY.md` | Baseline inventory |
| `PROJECT_STATE.md` / `CHANGELOG.md` | **Not updated** — no release shipped |

---

## 17. Remaining blockers (explicit)

1. **Manual browser regression** — full walkthrough §4 not executed; Phase 4.6.2 Part 3 success criteria require it.
2. **`validate:build-output`** — service-role client code in web bundle (`registry.ts` static import of `getSupabaseServiceClient`).
3. **`entity_follows` migration** — not deployed; authenticated follow/follower counts not production-grade.
4. **Production re-import** — Part 1 lineup/description fixes not applied to live published rows.
5. **ESLint errors** (2) — profile hydration effects; may indicate cascading render risk.
6. **Location + filter unification** — cross-surface inconsistency remains.
7. **Structured descriptions** — admission/ticket notes/FAQ not split in UI.
8. **Import trace ops script** — cannot run E2E field trace in Node without image bootstrap fix.
9. **Ticket.io detail POW** — SHOCKONE-class events may lack live detail HTML (documented in Phase 43).

---

## 18. Production readiness decision

### Verdict: **NOT READY for Phase 5**

Automated gates are green for typecheck and unit tests, but **production readiness requires manual validation and clean release artifacts**. The application has materially improved since Phase 4.6 (eligibility, saved events, search routes, ticket parity, similar events ranking, lineup UX), yet:

- Real-user regressions are **not closed without browser proof**.
- **Release build validation fails** (service-role surface in client bundle).
- **Follow persistence** depends on undeployed migration.
- **Live event data** may still diverge from code fixes until re-import.

### Minimum before Phase 5

1. Complete manual checklist §4 in Expo Web (desktop + one mobile viewport).
2. Deploy `20260801120000_phase46_entity_follows.sql` and verify follow + counts.
3. Split or tree-shake `getSupabaseServiceClient` from public web bundle; re-run `validate:build-output`.
4. Run controlled production re-import for validation event corpus.
5. Fix or waive ESLint profile hydration errors with explicit React review.
6. Re-run import trace audit against staging/production Supabase.

### Partial credit (safe to continue fixing in parallel)

- Price/badge semantic layer is shared and test-covered.
- Internal/demo eligibility is centralized.
- Similar events query no longer over-filters.
- Saved-event v1 ghost migration is addressed in code.

---

## Appendix: commands for validation replay

```powershell
cd c:\ER\app-v2
npm run typecheck:app
npm test
npm run build:web
npm run validate:build-output   # expected fail until bundle split
npx expo start --web --port 8082
```

After Supabase access:

```powershell
npx tsx scripts/operations/_phase462-import-trace-audit.ts
```
