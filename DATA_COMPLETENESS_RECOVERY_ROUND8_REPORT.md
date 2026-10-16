# Data Completeness Recovery Round 8

Date: 2026-10-16

## Scope

Controlled event-specific ticket-target recovery for existing published events with no consumer ticket row.

## Applied

- Mariybu "FRECH"-Tour — Bremen
  - exact Ticketmaster event target 774626075
  - status intentionally `availability_unverified`
  - no price promoted
- Mariybu "FRECH"-Tour — Münster
  - exact Ticketmaster event target 303647217
  - status intentionally `availability_unverified`
  - no price promoted
- Fraktur — München
  - exact Permanent Entertainment checkout
  - live page shows "WENIGE TICKETS VERFÜGBAR"
  - status `low_availability`
  - no price promoted because no price was visible in the current checkout step

## Safety

The apply ran in one PostgreSQL transaction with:
- exact pre-apply table-count guards
- published/future target guards
- zero-existing-ticket-row guards
- official source ticket-target token matching
- exact HTTPS/status validation
- exact post-write ticket and provenance readback
- no event / venue / lineup / genre row-count changes

## Verified counts

Before:
- events: 122
- venues: 75
- event_sources: 185
- event_lineup: 280
- event_genres: 204
- event_tickets: 61

After:
- events: 122
- venues: 75
- event_sources: 188
- event_lineup: 280
- event_genres: 204
- event_tickets: 64

Status: `ROUND8_TICKET_TARGET_RECOVERY_VERIFIED`
