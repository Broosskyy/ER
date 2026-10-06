# M9.3B.2 Controlled ticket.io Staging Import Report

**Generated:** 2026-09-11 (Europe/Berlin)  
**Branch baseline:** `c1833cf` (`rebuild/event-core-clean`)  
**Staging target:** `gnkjzinwvmrxcadwebhv` (restored / ACTIVE_HEALTHY)  
**Production:** `irgsllewfrxvbtznqmxh` — **not mutated** (`productionMutations = 0`)

## Status

**`M9_3B_2_CONTROLLED_TICKETIO_STAGING_IMPORT_VERIFIED`**

## Context (M9.3B.2A)

Staging Supabase had been auto-paused (Free Tier inactivity). After manual restore, connectivity was re-verified with bounded retries. The previous timeout was **not** an ingestion architecture defect.

## Approved batch (5 events)

| Identity key | Title | Venue |
|---|---|---|
| `ticket_io:bootshaus-club:usxejhhu` | DEBORAH DE LUCA pres by Bootshaus | Bootshaus |
| `ticket_io:gewoelbe:ylgm2drq` | Jack This w/ aphasit, Lingy & Polschi, Mike Starr | Gewölbe |
| `ticket_io:gewoelbe:auhcwfap` | Schleuse Eins w/ Beste Hira, Maxim Vukovic & Tils, Reduks -live- | Gewölbe |
| `ticket_io:bootshaus-club:jhup7wql` | SARA LANDRY pres. by BOOTSHAUS | Bootshaus |
| `ticket_io:gewoelbe:zaqmqtzu` | SOUNDSOUND w/ Janis Zielinski & Mike Momburg | Gewölbe |

Jack This (`2026-09-11 23:00 CEST`) remained eligible on execution date 2026-09-11.

## Pipeline

Generic controlled import bridge used end-to-end:

`Network Discovery → validation → relevance → identity → dedup → reconciliation → write planning → staging apply`

Orchestrator: `app-v2/scripts/run-m9-3b-2-controlled-staging-import.ts`

## Final counters

| Metric | Value |
|---|---|
| stagingReachable | true |
| stagingProjectVerified | true |
| readOnlyProbePassed | true |
| approvedBatchCount | 5 |
| eligibleAtApplyCount | 5 |
| eventInserts | 5 |
| eventUpdates | 0 |
| ticketInserts | 5 |
| ticketUpdates | 0 |
| ticketDeletes | 0 |
| mediaWrites | 5 |
| lineupWrites | 12 |
| genreWrites | 3 |
| sourceBindingWrites | 5 |
| reviewRequiredCount | 0 |
| dbReadbackPass | true |
| consumerReadbackPass | true |
| renderedEventsExpected | 5 |
| renderedEventsActual | 5 |
| ctaChecked | 5 |
| ctaFailures | 0 |
| mobileTicketTargetFailures | 0 |
| wrongPrices | 0 |
| wrongStatuses | 0 |
| wrongActions | 0 |
| wrongTargets | 0 |
| wrongMedia | 0 |
| wrongLineups | 0 |
| wrongGenres | 0 |
| wrongDescriptions | 0 |
| eventsWithUnresolvedMismatch | 0 |
| highConfidenceDuplicateGroups | 0 |
| duplicateRenderedCards | 0 |
| pastRenderedCards | 0 |
| secondRunEventWrites | 0 |
| secondRunTicketWrites | 0 |
| secondRunMediaWrites | 0 |
| secondRunMetadataWrites | 0 |
| existingGoldenRegressionFailures | 0 |
| productionMutations | 0 |

## Idempotency

Second controlled apply on 2026-09-11 confirmed zero semantic writes (`planIdempotent: true`, `ticketPlanIdempotent: true`, `idempotent: true`). See `second-run-idempotency.json`.

## Mobile UI + CTA E2E

Consumer: `http://localhost:8081` (Expo web, 390×844 viewport).

All 5 events: card + detail screenshots captured; ticket CTA rendered, clicked, reached correct event-specific ticket.io page with price parity. Evidence: `artifacts/m9-3b-2-controlled-ticketio-import/cta-e2e.json` and `screenshots/`.

## Tests

- `test:connectors`: 250 passed
- `test:ingestion`: 93 passed
- `typecheck:server`: pass
- `git diff --check`: clean

## Key fixes during M9.3B.2 / 2A

1. **Ticket pipeline** — ticket.io event page used as primary self-target (`ticket_io_event_page_self`)
2. **Semantic fingerprint** — stable hash for source-binding idempotency (no HTML churn)
3. **Parity matrix** — timestamp comparison for `startsAt`
4. **Golden regression** — ENDED lifecycle + Bootshaus NYE pattern
5. **Mobile CTA capture** — per-event Playwright pages + `data-testid="ticket-cta"`

## Artifacts

`artifacts/m9-3b-2-controlled-ticketio-import/`

- `connectivity-diagnostic.json`
- `staging-readonly-probe.json`
- `pre-write-live-evidence.json`
- `identity-results.json`
- `write-plans.json`
- `apply-result.json`
- `db-readback.json`
- `consumer-readback.json`
- `source-consumer-parity.json`
- `rendered-parity.json`
- `cta-e2e.json`
- `duplicate-audit.json`
- `lifecycle-audit.json`
- `golden-regression.json`
- `second-run-idempotency.json`
- `summary.json`
- `screenshots/` (mobile card, detail, CTA target per event)

## Stop boundary

M9.3B.2 complete. **Do not** expand ticket.io imports, enable scheduler, or touch production. Manual real-device QA is next.
