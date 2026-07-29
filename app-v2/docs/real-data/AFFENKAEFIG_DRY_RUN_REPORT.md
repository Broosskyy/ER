# Affenkäfig Dry Run Report

Sprint 28.1 — read-only live validation  
Generated: 2026-07-29

## Domain verification

| Domain | HTTP | Result |
|--------|------|--------|
| `affenkaefig.info` | 200 | Active ticket shop + event pages |
| `affenkaefig.info/tickets/` | 200 | 8 upcoming events linked |
| `affenkaefig.de` | 200 | **„Diese Domain ist unkonfiguriert.“** — rejected |
| `affenkaefig.de/events/` | 200 | Same parking page — rejected |

## Live read-only extraction

Executed via `affenkaefig-live-smoke.test.ts` (no import, no publish).

| Metric | Value |
|--------|-------|
| List URL | `https://affenkaefig.info/tickets/` |
| Strategy | `event_detail_page` |
| Detail strategy | `json_ld` |
| Detail pages fetched | 8 |
| Valid events parsed | 8 |
| Fixture data used | ❌ |

## Sample events (titles from live parse)

- Sommerfest Elektroküche 08.08.2026
- MDMA F2F & B2B Edition
- Underland Essigfabrik 05.09.2026
- 14 Jahre Affenkäfig 19.09.2026
- Affenkäfig A8 Saarbrücken
- MDMA 10.10.26
- Affenkäfig Capitol Hagen
- AFFENKÄFIG RULES // BOOTSHAUS KÖLN

## Trust / matching

Not executed (no import). Blocked until controlled staging import with `manual_review`.

## Source status

| Setting | Value |
|---------|-------|
| enabled | false |
| schedule_enabled | false |
| publish_mode | manual_review |

## Risks

| Risk | Severity |
|------|----------|
| Detail-page fetch volume | Low |
| Midnight startDate without doors | Medium |
| Bootshaus cross-source duplicate (23.10.26 event) | Medium — requires matching review |
