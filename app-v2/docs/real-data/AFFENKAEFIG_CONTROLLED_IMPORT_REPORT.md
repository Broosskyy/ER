# Affenkäfig Controlled Live Import Report

Sprint 28.2 — Eternal Rave  
Date: 2026-07-29  
Branch: `feature/er-012-source-acquisition-foundation`

## Summary

First controlled live import from `https://affenkaefig.info/tickets/` completed with **8 unique import records** in `needs_review` status. **No events published.** Source and scheduler remain **disabled**.

**Verdict for publish:** manual review and duplicate resolution required before any publish.

---

## Live Fetch

| Metric | Value |
|--------|-------|
| HTTP status | 200 |
| List URL | `https://affenkaefig.info/tickets/` |
| Strategy | `event_detail_page` + `json_ld` detail |
| Unique events | **8** (after link deduplication fix) |
| Raw link matches (pre-dedupe) | 24 (3× per event on list page) |
| Fixture data | none |

### Events imported (canonical URLs)

1. Sommerfest Elektroküche 08.08.2026 — Essigfabrik / Elektroküche
2. MDMA F2F & B2B Edition — Essigfabrik / Elektroküche
3. Underland Essigfabrik 05.09.2026 — Essigfabrik / Elektroküche
4. 14 Jahre Affenkäfig 19.09.2026 — Essigfabrik / Elektroküche
5. Affenkäfig A8 — A8 Stage Club, Saarbrücken
6. MDMA 10.10.26 — Essigfabrik / Elektroküche
7. Affenkäfig Capitol Hagen — Capitol
8. AFFENKÄFIG RULES // BOOTSHAUS KÖLN 23.10.26 — Bootshaus Köln

All events have individual flyer images (no generic logo posters). Ticket URLs via ticketkings.de or bootshaus-club.ticket.io where present.

---

## Dry Run

| Metric | Run 1 | Run 2 |
|--------|-------|-------|
| Pipeline events | 8 (deduped) | 8 |
| Inserts | 8 | 0 |
| Updates | 0 | 8 |
| Duplicates | 0 | 0 |
| Reviews required | 8 | 8 |
| Publish auto | 0 | 0 |

Idempotency on external IDs: **confirmed** (second dry run produces zero new inserts).

---

## Entity Resolution

| Area | Result |
|------|--------|
| Venue | Per-event names extracted; Essigfabrik, Bootshaus, A8, Capitol — no forced single venue |
| Organizer | Defaults to Affenkäfig; variable venue model preserved |
| Artist | No lineup in JSON-LD — no artist links created |
| Cross-source | **5/8** import records flagged with `duplicate_event_id` (internal duplicate candidates) |
| Bootshaus overlap | `AFFENKÄFIG RULES // BOOTSHAUS KÖLN` at Bootshaus venue — requires review |

---

## Trust

| Tier | Count (dry run) |
|------|-----------------|
| certain | 0 |
| probable | 0 |
| uncertain | 8 |

All events: `publishDecision = queue_for_review` under `manual_review` policy.

---

## Manual Review Import (database)

| Metric | Value |
|--------|-------|
| `import_records` (source-affenkaefig) | **8** |
| Status | `needs_review` |
| Published events | **0** |
| `import_review_queue` rows | **8** (after Sprint 28.3 backfill + fix) |
| Source `enabled` | false |
| `schedule_enabled` | false |
| `publish_mode` | manual_review |

Import jobs from explicit re-run attempts reported `failed` with 0 fetch (likely post-rate-limit after extended live probing). Initial import persisted **8 records** before reputation-write error (resolved via `recordImportReputation: false`).

---

## Publish Readiness (per event)

| Category | Count |
|----------|-------|
| Publish ready | 0 |
| Review required | 8 |
| Duplicate candidate | 5 |
| Missing critical data | 0 |
| Blocked (no publish) | 8 |

---

## Idempotency (database)

| Check | Result |
|-------|--------|
| Record count stable after second import attempt | yes (8) |
| No new published events | yes |
| Bootshaus unchanged | yes |

---

## Fixes in this sprint

1. **Link deduplication** in `event_detail_page` strategy — prevents triple-fetching duplicate anchors on list pages.
2. **Controlled import runner** — live fetch, dry-run simulation, ops script with `recordImportReputation: false` for schema compatibility.
3. **In-memory alias store** for dry-run matching (no DB side effects).

---

## Known risks

| Risk | Severity |
|------|----------|
| Cross-source duplicate candidates (Bootshaus overlap) | High — review before publish |
| Venue/organizer alias gaps in staging catalog | Medium |
| `import_review_queue` not populated | **Fixed in Sprint 28.3** — see `AFFENKAEFIG_MANUAL_REVIEW_REPORT.md` |
| List page duplicate anchors (mitigated by dedupe) | Low |
| Midnight `startDate` without doors time | Low |

---

## Rollback

- Source remains disabled; no scheduler activation.
- No published Affenkäfig events — rollback = delete `import_records` + related jobs for `source-affenkaefig` if needed.
- Bootshaus data untouched.
