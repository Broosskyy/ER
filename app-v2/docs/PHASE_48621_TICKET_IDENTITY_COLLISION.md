# Phase 4.8.6.2.1 — Ticket.io Slug Collision and Event Identity Resolution

Generated: 2026-08-06T01:46:00.000Z

## Collision under investigation

| Dimension | Value |
|-----------|-------|
| Platform | Ticket.io |
| Host | `bootshaus-club.ticket.io` |
| Slug | `C7JPnatZ` |
| Composite key | `ticket_io:bootshaus-club.ticket.io:C7JPnatZ` |

### Canonical Events sharing this composite identity

| Event | ID | Date | Venue | Owner source |
|-------|-----|------|-------|--------------|
| R3HAB pres. by BOOTSHAUS | `evt-1785339421539-k3swcrl` | 2026-09-04 | Bootshaus | `source-bootshaus-koeln` |
| Underland Essigfabrik 05.09.2026 | `evt-1785389049895-4mb7dub` | 2026-09-05 | Essigfabrik | `source-affenkaefig` |

## Fresh public ground truth

| Surface | Identity | Match |
|---------|----------|-------|
| Ticket.io list row `C7JPnatZ` | **R3HAB pres. by BOOTSHAUS** | R3HAB exact |
| Ticket.io list price | `Tickets ab 23,90 Euro` → `ab 23,90 €` | R3HAB |
| Bootshaus official page CTA | `https://bootshaus-club.ticket.io/C7JPnatZ/` | R3HAB exact |
| Affenkäfig official page | Underland title; CTA → Ticket Kings | Underland |
| Ticket Kings Underland page | Underland Essigfabrik 05.09.2026 | Underland exact |

**Public owner of composite identity:** R3HAB (`ticket_io + bootshaus-club.ticket.io + C7JPnatZ`)

## Verdicts

### Underland — `CURRENT_TICKET_KINGS_EVENT_CONFIRMED`

- Official public destination: `https://ticketkings.de/event/underland-essigfabrik-05-09-2026/`
- Canonical `ticketUrl` holds wrong Ticket.io URL (`C7JPnatZ` = R3HAB)
- Stale Ticket.io source reference and borrowed R3HAB price in canonical DB
- Classification: wrong Event association in database, not a Ticket.io slug reassignment

### R3HAB — `ELIGIBLE_FOR_CONTROLLED_TICKETIO_ENRICHMENT`

Proof (all satisfied on public evidence):

- Bootshaus official CTA → `C7JPnatZ`
- Ticket.io list row title matches R3HAB
- Date/venue compatible (2026-09-04, Bootshaus)
- Event-specific price evidence present
- Public identity guard: sole match when Underland claim evaluated as mismatch

**Apply still blocked** until Underland stale canonical association is corrected (canonical DB collision must be cleared).

## Historical origin

| When | Event | Action | Source |
|------|-------|--------|--------|
| 2026-08-02 | Underland | Ticket.io import linked `C7JPnatZ` | `source-bootshaus-ticket-io` batch — **no identity guard** |
| 2026-08-02 | Underland | Source reference + price `ab 23,90 €` persisted | Wrong Event identity |
| Phase 4.8.5 | Underland | Flagged `REVIEW_REQUIRED` (Ticket Kings vs Ticket.io) | Website field comparison |
| Phase 4.8.6 | R3HAB | Correct `ticketUrl` set from Bootshaus official page | `source-bootshaus-koeln` explicit publish |

**Not the cause:** Ticket.io slug reassignment, cross-Event website parser, merge copy, structured-data contamination.

**Root cause:** Ticket.io batch import matched/persisted composite identity to Underland without title/date/venue validation or composite collision guard.

## Earliest responsible system stage

| | |
|---|---|
| Stage | Import-record matching / canonical identity resolution |
| Module | `import-event-publish-service` + `duplicate-detection-service` |
| Function | `resolveExistingEventId` + `ticketUrlsReferToSameEvent` |
| Missing guard | One active composite identity may not enrich two unrelated canonical Events |

Phase 4.8.6.2 URL resolver **prevents** future ambiguous enrichment writes but **would repeat** stale association if import path lacks composite guard at publish time.

## Generic code guards (implemented)

New module: `src/features/import/ticket-platform-identity/`

- `buildTicketPlatformCompositeIdentity` — platform + host + slug
- `findCompositeIdentityCollisions` — production-wide collision detection
- `assertEnrichmentNotBlockedByCollision` — blocks enrichment on unresolved collision
- `evaluatePublicIdentityMatch` — title/date/venue validation
- `findSlugCollisions` updated to use composite host+slug (not slug alone)

## Global collision audit

| Platform | Collisions |
|----------|------------|
| Ticket.io | **2** (`C7JPnatZ`, `BcDqml12`) |
| Ticket Kings | 0 |
| Nacht-Manager checkout | 0 |
| Cross-host slug-only | 0 |

## Correction preview (not executed)

### Underland (`evt-1785389049895-4mb7dub`)

1. `ticketUrl`: `C7JPnatZ` → `https://ticketkings.de/event/underland-essigfabrik-05-09-2026/`
2. Deactivate stale `source-bootshaus-ticket-io` reference to `C7JPnatZ`
3. Clear borrowed `priceText` (`Tickets ab 23,90 Euro`)

### R3HAB (`evt-1785339421539-k3swcrl`)

- Retain `ticketUrl` `C7JPnatZ` (no change)
- After Underland correction: controlled Ticket.io enrichment preview `price_text: ab 23,90 €`

## R3HAB enrichment preview (after identity resolution)

| Field | Proposed |
|-------|----------|
| `priceText` | `ab 23,90 €` |
| `ticketStatus` | unchanged (`external_link`) |
| Ticket.io provenance | create enrichment reference on apply |
| Website-owned fields | frozen |

`productionMutationsInThisRun: 0`

## Ops commands

```bash
npm run audit-phase48621
```

Individual: `capture-public-truth`, `trace-history`, `audit-composite-identities`, `identify-root-cause`, `verdict-underland`, `verdict-r3hab`, `preview-corrections`, `preview-r3hab-enrichment`, `audit-global-collisions`, `report`, `full`

## Tests

`src/features/import/ticket-platform-identity/__tests__/phase48621-ticket-identity-collision.test.ts` — 10 tests

## Next approval required

1. **Approve Underland identity correction preview** (wrong Ticket.io URL, stale source ref, borrowed price)
2. **Then approve R3HAB controlled Ticket.io enrichment batch** (price only)
3. Do **not** enable broad Ticket.io scheduling until both apply steps validated

## Artifacts

| File | Purpose |
|------|---------|
| `_phase48621_public_truth.json` | Fresh public surfaces |
| `_phase48621_historical_trace.json` | Provenance timeline |
| `_phase48621_composite_identity_audit.json` | Composite identity audit |
| `_phase48621_root_cause.json` | Root cause analysis |
| `_phase48621_underland_verdict.json` | Underland verdict |
| `_phase48621_r3hab_verdict.json` | R3HAB verdict |
| `_phase48621_correction_preview.json` | Correction preview |
| `_phase48621_r3hab_enrichment_preview.json` | Price enrichment preview |
| `_phase48621_global_collision_audit.json` | Global collisions |
