# Data Completeness Recovery Round 6

Date: 2026-10-16

## Scope

Conservative structured-lineup recovery for existing published upcoming events where an artist/headliner was explicitly named by the bound official source.

## Applied

- KAROTTE - ALL NIGHT LONG — KAROTTE
- UNREAL x KUKO All Night Long World Tour (Cologne) — KUKO
- Technophil — Troppo Zump

## Deliberately left empty

Other missing-lineup events were not filled when the current official source had no explicit artist names. Examples include Bootshaus Halloween/NYE pages with no visible artist roster and the KitKatClub event whose official description states that the DJ lineup is still to be announced.

## Safety

The apply ran in one PostgreSQL transaction with:
- exact pre-apply table-count guards
- published/future target guards
- exact official-source binding guards
- zero-existing-lineup guard
- billing role/name/order validation
- exact post-write readback
- source provenance marker on each official source
- no event / venue / source / genre / ticket row-count changes

## Verified counts

Before:
- events: 122
- venues: 75
- event_sources: 185
- event_lineup: 263
- event_genres: 204
- event_tickets: 61

After:
- events: 122
- venues: 75
- event_sources: 185
- event_lineup: 266
- event_genres: 204
- event_tickets: 61

Status: `ROUND6_LINEUP_RECOVERY_VERIFIED`
