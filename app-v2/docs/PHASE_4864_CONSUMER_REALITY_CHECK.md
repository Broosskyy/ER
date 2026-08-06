# Phase 4.8.6.4 — Consumer Reality Check

Pre-correction baseline (read-only report run).

## Local URLs

| Event | URL |
|-------|-----|
| R3HAB | `/event/evt-1785339421539-k3swcrl` |
| Underland | `/event/evt-1785389049895-4mb7dub` |
| Bootshaus Sommerfest | `/event/evt-1785339391167-tfaixrr` |

## Post-correction status (2026-08-06)

All three required Events **pass** consumer verification.

### R3HAB — pass

- Ticket.io CTA `C7JPnatZ`, price `ab 23,90 €`, venue Bootshaus, 5-artist lineup

### Underland — pass

- Ticket Kings CTA, no R3HAB Ticket.io URL, no borrowed price, venue Essigfabrik

### Bootshaus Sommerfest — pass

- Venue Bootshaus, Auenweg 173, Ticket.io `vB0cAmWg`, price `ab 11,90 €`

## Pre-correction status (archived)

### R3HAB — partial pass

- September description, Ticket.io CTA, venue Bootshaus, 5-artist lineup: **OK**
- Display price `ab 23,90 €`: **missing** (Gate C target)

### Underland — fail (contamination)

- Ticket URL still `C7JPnatZ` (R3HAB Ticket.io)
- Borrowed price `Tickets ab 23,90 Euro`
- Venue Essigfabrik: **OK**

### Bootshaus Sommerfest — partial fail

- Ticket.io CTA `vB0cAmWg`, price `ab 11,90 €`: **OK**
- Venue shows **Essigfabrik** with Auenweg 173 (contradiction) — Gate B target

## Human checklist (post-apply)

1. Open each Event Detail in web/mobile
2. Confirm ticket button opens correct public destination
3. Confirm displayed price matches public evidence
4. Confirm venue label matches address
5. R3HAB: verify five lineup artists visible
6. Sommerfest: verify TBA lineup, no Underland contamination

Full machine-readable results: `docs/real-data/_phase4864_consumer_verification.json`
