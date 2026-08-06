# Phase 4.6.8 — Structured Lineup Pipeline Completion

Generated: 2026-08-03T06:41:30Z

## Final verdict: **CONDITIONALLY COMPLETE** (pending mobile Event Detail spot-check)

Phase 4.6.8 cutover criteria are met for schema, structured writes, representative repair, and idempotency. Mobile validation of public Event Detail remains the explicit gate before starting the next data domain.

---

## 1. Migration / schema validation

| Metric | Value |
|--------|-------|
| `event_lineup_entries` | 334 |
| `event_lineup_entry_artists` | 334 |
| Entries without artists | 0 |
| Orphan join rows | 0 |
| Duplicate `(entry_id, artist_id)` | 0 |
| Max `entry_id` length | 39 |
| Backfill from legacy `event_artists` | 297 (pre-repair) |
| **Schema `pass`** | **true** |

**Applied:** `20260803130000_phase468_structured_lineup_service_grants.sql` (service_role GRANT confirmed — queries succeed).

**Warning:** 13 join rows reference `artist_id` > 96 chars (pre-existing title-inferred garbage on non-representative events; not a migration integrity failure).

---

## 2. Shared domain contract

- `StructuredLineupEntry` — connector/import metadata
- `CanonicalLineupEntry` / `ResolvedCanonicalLineupEntry` — merge, persistence, projection
- `BillingRelation`: SOLO, B2B, F2F, VS, LIVE, SUPPORT, HOSTED_BY, SPECIAL_GUEST

---

## 3. Connector normalized output

Connectors emit `lineupEntries` in metadata; `artistNames` remains backward-compatible fallback. `lineup-entry-builder.ts` groups billing without synthetic combined artist names.

---

## 4. Import preservation

**Fixes this session:**

1. **`structured-lineup-replace-decision.ts`** — structured writes no longer skipped when flat `event_artists` matches but structured storage is empty/legacy backfill.
2. **`import-structured-lineup-from-record.ts`** — billing lines (`DYSTOPIA F2F VALKYRIE`) are parsed before sanitization; `isLineupPlaceholderArtist` no longer rejects valid billing lines as "collapsed" placeholders.

---

## 5. Artist resolution

Per-artist resolution inside each entry; legacy/blob artists excluded via `lineup_legacy_artifact` and quality gates.

---

## 6. Structured persistence

`EventLineupEntryRepository.replaceEventLineupEntries` + `EventLineupService.replaceStructuredLineupFromImport` (transactional replace + dual-write to `event_artists`).

---

## 7. Canonical merge

`mergeCanonicalLineupEntries` in merge strategy — no B2B/F2F downgrade without stronger evidence.

---

## 8. Dual-write compatibility

`event_lineup_entries` authoritative; `event_artists` derived via `buildLineupFromResolvedEntries` only.

---

## 9. Projection / API

`Event.lineupEntries[]` batch-loaded in `supabase-datasource.ts`; flat `artists[]` retained for current public UI (no redesign).

---

## 10. Admin support

`StructuredLineupAdminSection` — view/edit billing, order, stage, times, provenance.

---

## 11. Backfill reconstruction

SQL backfill created low-confidence SOLO rows; import repair upgraded representatives from `lineupEntries` / billing-preserved `artistNames`.

---

## 12. Representative production results

| Event | Result | Entries | Artists | Notes |
|-------|--------|---------|---------|-------|
| **Sommerfest** | **PASS** | 14 SOLO | 14 | No HYPNO TIZED / STIMU LATE |
| **LEVI** | **PASS** | 1 SOLO | 1 | No false Headliner |
| **MDMA** | **PASS** | 9 | 18 | 5× F2F + 4× B2B preserved |
| **Bootshaus** | **PASS** | 5 | 5 | Evidence-based only; collapsed names retained (documented blocker) |
| Vision Ekstase | BLOCKER | 0 | 0 | No authoritative lineup evidence |
| PURE TECHNO | BLOCKER | 0 | 0 | No authoritative lineup evidence |

---

## 13. Idempotency

| Pass | Mutations |
|------|-----------|
| Pass 1 | 1 (MDMA: 18 SOLO → 9 billing entries) |
| Pass 2 | **0** |

Final pass: 0 created / updated / deleted entries, 0 compatibility mutations.

---

## 14. Performance

- Batch load: `getEntriesForEvents`
- Indexes: `event_lineup_entries(event_id, sort_order)`, `event_lineup_entry_artists(entry_id)`

---

## 15. Tests / build

| Check | Result |
|-------|--------|
| `typecheck:app` | PASS |
| `typecheck:operations` | FAIL (pre-existing `_audit-long-artist-ids.ts` typing) |
| ESLint | PASS (warnings only) |
| Structured lineup tests | PASS |
| Full Vitest | 1534/1540 pass (6 unrelated pre-existing failures) |
| `build:web` | PASS |
| `validate:build-output` | PASS |

---

## 16. Remaining blockers

1. **Mobile Event Detail** — user must confirm flat artist display unchanged on device.
2. **Bootshaus** — `source_text_structurally_insufficient`; no unsafe splitting of COLLINSOLIVER / IDENTITYDAVE.
3. **Vision Ekstase / PURE TECHNO** — no structured import evidence; remain without lineup entries.
4. **13 global long `artist_id` rows** — non-representative garbage from historical title inference (outside this repair scope).

---

## 17. Cutover recommendation

**Proceed to mobile validation.** Do not start the next data domain until Event Detail is confirmed on device.

Structured lineup is authoritative in production for repaired representatives. `event_artists` remains a derived compatibility projection. `event_artists` table is **not** removed.
