# M9.2.2.4 Lineup Price Ticket Status Recovery Report

## 1. Preflight
- Branch: `rebuild/event-core-clean`
- Staging linked: Eternal-Rave (`gnkjzinwvmrxcadwebhv`)
- Production untouched (`productionMutations = 0`)
- Consumer dev server: `http://localhost:8081`
- Scope events: **30**

## 2. Null-price source classifications (Playwright-rendered ticket.io)
| Event | Classification | Live evidence |
|---|---|---|
| Unreal Weekender I / II | **REGULAR_ADMISSION_PRICE_AVAILABLE** | `Final Phase` 45,00 EUR (now synced) |
| Polyamor | **REGULAR_ADMISSION_PRICE_AVAILABLE** | `Finale Phase` 35,00 EUR (now synced) |
| Halloween 2026 | **REGULAR_ADMISSION_PRICE_AVAILABLE** | `Early Bird` 32,00 EUR (now synced) |
| Chris Stassy / Stussy | **PRICE_NOT_ANNOUNCED** | Only `Doorsale` + premium/parking add-ons; no regular admission tier |
| NYE 2026 | **PRICE_NOT_ANNOUNCED** | Only `Blind Ticket` (unclassified presale) + VIP/lockers |
| UNREAL x KUKO | **SOLD_OUT + NO_ADMISSION_PRICE_AVAILABLE** | Sold out; only locker add-ons remain |

## 3. Why Previous QA Missed Bootshaus Prices
- M9.2.2.3 expected price came from DB/read model, not rendered ticket.io product pages.
- Raw HTTP fetch to ticket.io returns ALTCHA/security HTML without product rows.
- Parser missed ticket.io shop table DOM (`ticket-price-value`, `select.ticketCount[data-tickettypename]`).
- `26,90 Euro` normalization omitted EUR currency → `verified_current` evidence dropped.

## 4. Generic fixes delivered
- `create-playwright-ticket-browser-ops.ts` — raw fetch first, serialized Playwright fallback.
- `parse-ticket-io-detail-dom.ts` — shop-table parser.
- `normalize-ticket-price.ts` — `Euro` suffix → EUR.
- `ticket-offer-role.ts` — `Final Phase` / `Finale Phase` admission patterns.
- Bootshaus connector wires browser ops through ticket pipeline.
- Consumer badge labels for all known statuses including **Verfügbar**.
- ZAAGSTEP lineup: 9 acts source → DB → consumer verified.

## 5. Staging sync runs
| Run | ticketRowsChanged | ticketPricesChanged | ticketStatusesChanged |
|---|---:|---:|---:|
| Apply #1 (post-fix) | 0 | 4 | 0 |
| Apply #2 (idempotency) | 0 | 0 | 0 |

## 6. Playwright serialization
`createPlaywrightTicketBrowserOps` queues `fetchTicketPage` through a promise chain (`concurrency = 1`) because parallel Chromium navigations against ticket.io triggered intermittent ALTCHA blocks and empty product DOM. **Runtime impact:** ~2–3 min extra per Bootshaus batch (23 events). **Operational stance:** acceptable for controlled staging sync; revisit shared browser pool after provider rate limits are better understood.

## 7. M9.0 `ticket_rows_changed` guard removal — safe
The old abort in `run-scheduled-staging-sync.ts` fired whenever *any* ticket row changed, which blocked legitimate first-time price recovery after parser fixes. Remaining safeguards:
- `assertProductionNotLinked` + `verifyLinkedStagingTarget` (staging-only)
- `evaluateScheduledApplyGuard` (no production scheduler apply)
- Active-run lock via `ingestion_runs`
- Bounded ticket persistence planner (no blind deletes; transient-failure preserve)
- Reconciliation + validation gates on event writes
- Ticket delete protection in `ticket-persistence-apply.ts`
- Run tracking + health counters
- Idempotency verified on second apply (`ticketDelta` all zero)

## 8. `event_source` conflict isolation
`ticket-persistence-planner.ts` now skips global `event_sources` inserts when `source_url` is already bound to another canonical event (`provider_source_url_bound_to_other_event`) instead of failing the whole ticket batch. Ticket row writes for the current event still proceed. Test added: shared Chris Stussy/Stassy ticket.io URL.

## 9. Final counters (post-sync audit)
```json
{
  "scopeEventCount": 30,
  "sourcePricesMissingInDb": 0,
  "sourcePricesMissingInConsumer": 0,
  "wrongConsumerPrices": 0,
  "knownTicketStatusesMissingInDb": 0,
  "knownTicketStatusesMissingInConsumer": 0,
  "wrongConsumerTicketStatuses": 0,
  "explicitLineupsMissingInDb": 0,
  "explicitLineupsMissingInConsumer": 0,
  "wrongLineups": 0,
  "wrongTicketTargets": 0,
  "unsafePurchaseCtas": 0,
  "allBootshausTicketPricesVerified": true,
  "allKnownTicketStatusesRendered": true,
  "allExplicitLineupsStructured": true,
  "productionMutations": 0,
  "failedEvents": 0
}
```

## 10. Tests
- `test:connectors` — 198 passed
- `test:ingestion` — 80 passed
- `typecheck` — passed
- `git diff --check` — clean

## 11. Final Status
**M9_2_2_4_LINEUP_PRICE_TICKET_STATUS_RECOVERY_VERIFIED**

M9.3B MUST NOT START.
