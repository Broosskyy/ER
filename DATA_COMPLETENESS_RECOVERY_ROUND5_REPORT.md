# Data Completeness Recovery Round 5

Date: 2026-10-16

## Scope

Controlled consumer-ticket recovery for existing published events that had official source ticket evidence but no `event_tickets` row.

## Applied

- WYLDHEARTS — exact checkout, 14.00 EUR currently selectable, available
- OSWALD • WIR WAREN HIER TOUR 2026 — exact Frankfurt/Zoom stop, sold out
- ROYAL RUMBLE & HD BASS präsentieren: DRUM & BASS BUNDESLIGA — exact event page, 13.16 EUR incl. VVK fee, available
- KAROTTE - ALL NIGHT LONG — exact checkout, 14.00 EUR Early Bird available

## Explicitly not promoted

- #MittWochenende — stored ticket target currently returns HTTP 404
- Connected & Friends — provider returned HTTP 403; current event identity/status could not be independently verified

## Safety

The apply ran inside one PostgreSQL transaction with:
- exact pre-apply table-count guards
- published + future event guards
- zero-existing-ticket-row guard
- HTTPS URL and status validation
- exact post-write ticket readback
- exact ticket-source provenance readback
- no unrelated event / venue / lineup / genre mutations

## Verified counts

Before:
- events: 122
- venues: 75
- event_sources: 181
- event_lineup: 263
- event_genres: 204
- event_tickets: 57

After:
- events: 122
- venues: 75
- event_sources: 185
- event_lineup: 263
- event_genres: 204
- event_tickets: 61

Status: `ROUND5_TICKET_RECOVERY_VERIFIED`
