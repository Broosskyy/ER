# Data Completeness Recovery Round 7

Date: 2026-10-16

## Scope

Live-source recovery for existing published events where the current bound official/ticket page exposed materially better event content.

## Applied lineup changes

### Affenkäfig XXX CAPITOL XXX Hagen

The stale placeholder `Folgt` was removed. The official Affenkäfig event page currently exposes 11 named artists:

KAACEE, KOMACASPER, TAKTSTÖRER, ZAPRAVKA, 8288, HELLMAYER, KIMIK KARAMUSTAN, LEE-ANN, MATTHIAS OLCK, TOMMY LIBERA, UNROMANTIC.

### BERRYLECTRO x HIGH VOLTAGE - RAVE

The exact stagedates event page exposes:

ÆRES, Bodytricks, VÆGENT, LEVAA.

## Applied description changes

- BERRYLECTRO received a clean factual summary based on the exact stagedates event page.
- DRUM & BASS BUNDESLIGA received a clean factual summary based on the exact Rausgegangen ticket page.

No copied ticket boilerplate or anti-bot output was promoted.

## Safety

The apply ran in one PostgreSQL transaction with:
- exact pre-apply table-count guards
- exact stale-placeholder guard for Affenkäfig
- zero-existing-lineup guard for BERRYLECTRO
- empty-current-description guards
- exact event/source identity guards
- exact lineup and description readback
- no event / venue / source / genre / ticket row-count changes

## Verified counts

Before:
- events: 122
- venues: 75
- event_sources: 185
- event_lineup: 266
- event_genres: 204
- event_tickets: 61

After:
- events: 122
- venues: 75
- event_sources: 185
- event_lineup: 280
- event_genres: 204
- event_tickets: 61

Upcoming events with descriptions after the apply: 40 / 56.

Status: `ROUND7_LINEUP_DESCRIPTION_RECOVERY_VERIFIED`
