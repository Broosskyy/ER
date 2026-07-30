# Sprint 33.3 — Ticket Platform Production Activation Report

**Date:** 2026-07-30  
**Verdict:** **TICKET PLATFORM IMPORTS PRODUCTION ACTIVE**

Live imports for `source-bootshaus-ticket-io` and `source-affenkaefig-ticket-kings` completed successfully. Duplicate detection matched existing canonical events; no duplicate events created. Second import pass idempotent.

---

## Phase 1 — Repository Audit

| Component | Path | Status |
|-----------|------|--------|
| `TicketPlatformConnector` | `ticket-platform-connector.ts` | ✅ Generic orchestration |
| `ticket_io` adapter | `adapters/ticket-io-adapter.ts` | ✅ JSON-LD MusicEvent |
| `ticket_king` adapter | `adapters/ticket-kings-adapter.ts` | ✅ JSON-LD + Tribe fallback |
| Fetch layer | `ticket-platform-fetch.ts` | ✅ Live HTTP (fixed `defaultHttpClient` export) |
| Enrichment | `import-update-service`, `ticket-platform-enrichment` | ✅ |
| Duplicate detection | `duplicate-detection-service` | ✅ Enrichment scoring |
| Event origins | `EventOriginService` | ✅ On publish (not import) |
| Scheduler | Sprint 15/26 pipeline | ✅ Unchanged |
| Migrations | `20260763000000`, `20260764000000` | ✅ Applied in production |

**Open TODOs (roadmap, not blockers):**

- `SOURCE_REGISTRY_ROADMAP.md`: Eventbrite/RA adapters not started
- Ticket origins appear after admin publish — import alone creates `needs_review` records
- Review queue auto-population for ticket enrichment TBD (manual review flow)

---

## Phase 2 — Source Validation

| Check | Ticket.io | Ticket Kings |
|-------|-----------|--------------|
| Source present | ✅ | ✅ |
| Enabled / active | ✅ | ✅ |
| Scheduler | `interval` / `every_6_hours` | same |
| Polling | 360 min | 360 min |
| `publish_mode` | `manual_review` | `manual_review` |
| Platform config | `ticket_io` / `bootshaus-club` | `ticket_king` / `ticketkings` |
| Rate limit | 15 req/min | 15 req/min |
| Credentials | None required | None required |
| Fixture HTML in DB | No | No |

No duplicate source rows created — migrations 631/632 only.

---

## Phase 3 — Live Import

Script: `npx tsx scripts/operations/_sprint333-ticket-platform-activation.ts`

### Ticket.io (Bootshaus)

| Metric | Run 1 | Run 2 |
|--------|------:|------:|
| Live fetch | 17 events | 17 events |
| Fetched | 17 | 17 |
| Parsed | 7 | 7 |
| Created records | 17 | 0 |
| Duplicate matches | 10 | 10 |
| Errors | 0 | 0 |
| Status | completed | completed |

Sample: prices in EUR (€15–€32), ticket URLs on `bootshaus-club.ticket.io`.

### Ticket Kings (Affenkäfig)

| Metric | Run 1 | Run 2 |
|--------|------:|------:|
| Live fetch | 5 events | 5 events |
| Fetched | 5 | 5 |
| Parsed | 4 | 4 |
| Created records | 5 | 0 |
| Duplicate matches | 1 | 1 |
| Errors | 0 | 0 |
| Status | completed | completed |

---

## Phase 4 — Entity Resolution

Import records carry `duplicate_event_id` linking to existing Bootshaus/Affenkäfig canonical events where matched. No new canonical events created without review. Venue/organizer defaults from `source_config.defaults` applied in pipeline.

---

## Phase 5 — Multi-Origin

`event_source_references` for ticket sources: **0** after import (expected). Origins with `role: ticketing` are created on **publish** via `EventOriginService.upsertFromPublish`. Import records in `needs_review` await admin approval.

Canonical event count unchanged: **65**.

---

## Phase 6 — Ticket Validation

- Ticket URLs: canonical shop URLs per event slug ✅
- Prices: Ticket.io list pages expose `priceAmount`/`priceCurrency` ✅
- External IDs: stable canonical URLs ✅
- No duplicate import records on second pass ✅

---

## Phase 7 — Scheduler

Sources configured for 6-hour interval polling. No scheduler code changes. Sprint 15/26 unit tests pass. Scheduler tick not required for this activation (manual import validated).

---

## Phase 8 — Monitoring

| Source | Trust score | Import records | Duplicate rate (run 1) |
|--------|------------:|---------------:|-----------------------:|
| Ticket.io | 70 | 17 | 10/17 ≈ 59% |
| Ticket Kings | 68 | 5 | 1/5 = 20% |

Connector health: run `npx tsx scripts/operations/run-persist-connector-health.ts` after scheduled imports.

---

## Phase 9 — Regression

**1214 / 1214** tests passing.

---

## Fix Applied

`defaultHttpClient` singleton export added to `default-http-client.ts` — required for live ticket shop HTTP fetch in ops/runtime (was imported but not exported).

---

## Ops Commands

```bash
npx tsx scripts/operations/_sprint333-ticket-platform-activation.ts
npx tsx scripts/operations/run-scheduler-tick.ts
npx tsx scripts/operations/run-queue-worker.ts
```

---

## Next Steps (out of scope)

1. Admin review + publish matched enrichment records → ticket origins on canonical events
2. Monitor first scheduled 6h tick for both sources
3. Ticket.io / Ticket Kings trust-quality pass before auto-publish consideration
