# Data Completeness Recovery Round 3

Date: 2026-10-15

## Scope

Controlled existing-event lineup recovery for published upcoming events with explicit artist evidence in an official title or official description.

- Target events: 9
- Inserted event_lineup rows: 42
- Manifest commit: `999a1feadae01092534da28a7b23cf2d7af40ede`
- Supabase project: Eternal Rave staging `gnkjzinwvmrxcadwebhv`

## Applied events

- BACK2BASICS XXL @ Schrotty — 13 artists
- WYLDHEARTS — 4 artists
- ELECTRIC LIGHTS — 2 artists
- Feiern wie früher - nur früher! — 2 artists
- Halloween Weekender — 15 billing entries
- Midnight Ink: Techno & Tattoos — dot.d
- Nachtstrom Recharged — DJ Nachtstrom
- Der Gebrochene Samstag — 3 artists
- A TECHNO BALLET ODYSSEY — Marko Nastić

## Safety

The apply ran inside one PostgreSQL transaction with:
- exact pre-apply table-count guards
- published/upcoming event guards
- exact official source URL guards
- zero-existing-lineup guard for every target
- role/name/order validation
- exact 42-row post-write readback
- provenance marker written into the matched official event_sources raw payload
- rollback on any failed guard

An earlier attempt failed before any persistent write because camelCase JSON record keys were folded by PostgreSQL. A readback confirmed the complete baseline remained unchanged before the corrected apply.

## Verified counts

Before:
- events: 122
- venues: 75
- event_sources: 180
- event_lineup: 221
- event_genres: 204
- event_tickets: 57

After:
- events: 122
- venues: 75
- event_sources: 180
- event_lineup: 263
- event_genres: 204
- event_tickets: 57

Upcoming published events without a structured lineup:
- before: 33
- after: 24

Status: `ROUND3_LINEUP_RECOVERY_VERIFIED`
