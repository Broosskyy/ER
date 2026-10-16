# Data Completeness Recovery Round 4

Date: 2026-10-16

## Scope

Controlled price recovery for existing published Eternal Rave events with a current consumer ticket row and a price visibly confirmed on the live ticket/official page.

## Applied

- 12 Jahre Richtig DICK Techno! — 18.00 EUR
- BERRYLECTRO x HIGH VOLTAGE - RAVE — 16.45 EUR
- ELECTRIC LIGHTS — 29.00 EUR regular admission
- Elektronisch Draussen @Fridas Pier — 13.00 EUR
- AESTHETIC PERFECTION — 35.00 EUR VVK, excluding additional fees

## Explicitly not promoted

- Harder Horror Night — provider blocked browser verification with HTTP 403
- UNREAL x KUKO — sold out and provider blocked current price verification
- A TECHNO BALLET ODYSSEY — no visible current price on the accessible official page

## Safety

The apply ran in one PostgreSQL transaction with:
- exact pre-apply table-count guards
- exact event/ticket identity and URL guards
- null-current-price guards
- positive-price/currency validation
- post-write readback for all 5 ticket rows
- provenance readback for all 5 events
- one missing ticket-source provenance row added for ELECTRIC LIGHTS
- no event, venue, lineup, genre, or ticket row-count changes

## Verified counts

Before:
- events: 122
- venues: 75
- event_sources: 180
- event_lineup: 263
- event_genres: 204
- event_tickets: 57

After:
- events: 122
- venues: 75
- event_sources: 181
- event_lineup: 263
- event_genres: 204
- event_tickets: 57

Status: `ROUND4_PRICE_RECOVERY_VERIFIED`
