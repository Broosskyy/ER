# M9.2.2.5A — Ticket Plan vs Persistence Divergence Audit

## Status

**M9_2_2_5_PARTIAL_REVIEW_REQUIRED**

Ticket-row plan vs DB is aligned for affenkaefig and bootshaus (0 price/URL divergences).  
ZAAGSTEP root cause identified and fixed in code; staging apply in progress.

---

## Executive finding

The reported `ticketDelta` (2 prices, 3 URLs) with `appliedWrites = 0` was **not** evidence of silent ticket-row suppression during those runs.

| Layer | Finding | Classification |
|-------|---------|----------------|
| Global pre/post `event_tickets` snapshot | 2 price + 3 URL deltas during overlapping bootshaus + affenkaefig runs | **D) STALE_SNAPSHOT_COMPARISON** — cross-connector concurrent writes + global table scope |
| Planned ticket row vs current DB (live audit) | **0** price deltas, **0** URL deltas on both connectors | Rows already match planner |
| ZAAGSTEP | Planner derives `sold_out` + `presale_registration` but **no `event_tickets` row** | **E) WRITE_PLAN_SUPPRESSED** — `hasVerifiedPresaleCta` blocked by `ticket_identity_unverifiable` |
| 14 Jahre Affenkäfig | DB already has `native_event.php?id=21` @ 25€ | **ALIGNED** (fixed in prior sync) |
| Underland | DB 20€ TicketKings URL matches planner | **ALIGNED** at ticket-row level (lineup/description remain consumer parity gaps) |

---

## Why the snapshot lied

`run-scheduled-staging-sync.ts` compared **all** `event_tickets` rows before vs after each run:

1. **bootshaus** started ~12:41, pre-snapshot captured global table  
2. **affenkaefig** ran ~12:52–12:53 and wrote ticket/provider metadata  
3. **bootshaus** post-snapshot at ~12:53 saw affenkaefig’s writes → reported 2+3 deltas  
4. **affenkaefig** own run also compared global table → same 2+3 pattern from cross-talk  

`appliedWrites` only counts **event content** writes, not ticket persistence — so `0` + non-zero `ticketDelta` looked contradictory but measured different things.

### Fixes applied to observability

- `connectorTicketDelta` — scoped to connector’s official-bound events only  
- `compareTicketSnapshotsDetailed` — per-row field deltas + semantic URL canonicalization  
- `ticketPersistence` result surfaced on `SyncRunResult` and scheduled sync summary  
- `run-m9-2-2-5a-ticket-divergence-audit.ts` — planned vs DB diagnostics per event  
- `ticketsEqual` — canonical URL compare (embed vs direct n8manager)  

---

## Frozen delta audit (planned vs DB)

Audit artifacts: `artifacts/m9-2-2-5a-ticket-divergence/`

### affenkaefig-official

| Metric | Value |
|--------|-------|
| priceDeltaCount | **0** |
| urlDeltaCount | **0** |
| divergentCount | **0** |
| allIdempotent (ticket rows) | ticket rows yes; provider provenance updates still pending |

**Golden cases**

| Event | eventId | DB ticket | Planned | Classification |
|-------|---------|-----------|---------|----------------|
| 14 Jahre Affenkäfig | `451f27ac-…` | `native_event.php?id=21` @ 2500 | same | ALIGNED |
| Underland | `84af63ab-…` | TicketKings @ 2000 | same | ALIGNED |

### bootshaus-official

| Metric | Value |
|--------|-------|
| priceDeltaCount | **0** |
| urlDeltaCount | **0** |
| divergentCount | **2** (not price/URL — pipeline suppression) |

**ZAAGSTEP** (`f560d0f3-…`)

| Field | DB | Planned (live) |
|-------|-----|----------------|
| ticket row | **none** | **none** (should be insert) |
| resolution | — | `verified_presale_registration` |
| status projection | — | `sold_out` / Ausverkauft |
| registration URL | in `event_sources` only | `sibforms.com/serve/…` |
| ticketOperation | `noop` | should be `insert` |
| skipReason | `no_ticket_row_required` | **WRITE_PLAN_SUPPRESSED** |

**Other bootshaus divergences (not golden)**

| Event | eventId | Issue | Classification |
|-------|---------|-------|----------------|
| 122 pres. MARTEN LOU | `d59d7612-…` | Fourvenues fetch `internal_pipeline_failure`, existing row preserved | WRITE_PLAN_SUPPRESSED |
| 122 pres. TRIPOLISM | `5ac59acf-…` | same | WRITE_PLAN_SUPPRESSED |

---

## ZAAGSTEP root cause chain

```
LIVE: bit.ly/ZAAGSTEP → sibforms registration
→ parser: verified_presale_registration
→ enrichResultWithM6_4: statusProjection = sold_out
→ shouldPersistTicketRow: hasVerifiedPresaleCta → FALSE (ticket_identity_unverifiable)
→ mapPlannedTicketRow: undefined
→ resolveTicketOperation: noop / no_ticket_row_required
→ DB: no event_tickets row
→ consumer: no badge / no CTA
```

### Generic fix (no hardcoding)

1. `ticket-evidence-pipeline.ts` — sibforms targets anchored as `ticket_identity_verified` via official CTA  
2. `consumer-ticket-safety-gate.ts` — `presale_registration` source state + registration URL bypasses identity block  
3. `ticket-persistence-planner.ts` — `isVerifiedPresaleRegistrationResult()` always persists registration rows  
4. Test: `plans sold-out presale registration ticket rows for verified sibforms targets`

---

## Staging apply

bootshaus-official re-sync running after ZAAGSTEP fix to insert ticket row (`sold_out` + sibforms URL).

---

## Tests

| Suite | Result |
|-------|--------|
| test:ingestion | 83 passed (+3 ticket-snapshot) |
| test:connectors | 207 passed (+1 ZAAGSTEP presale) |
| typecheck | pending final run |

---

## Gates before M9.2.2.5 final audit

- [ ] ZAAGSTEP ticket row persisted on staging (readback)  
- [ ] bootshaus idempotent re-sync: `connectorTicketDelta` all zeros  
- [ ] affenkaefig idempotent re-sync: `connectorTicketDelta` all zeros  
- [ ] Full 30-event live parity re-run  

**M9.3B MUST NOT START.**
