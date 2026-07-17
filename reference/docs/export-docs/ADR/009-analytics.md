# ADR-009: Analytics

**Status:** Proposed (nicht implementiert)  
**Datum:** Juni 2026 · Sprint 0

## Kontext

Band 5 `06_Analytics_KPIs.md` (Stub). V1 Launch Checklist: Analytics. Keine Analytics-Library im Code (Sprint 0).

## Entscheidung (geplant)

**Phase 1 (V1 Launch):** Minimal Product Analytics

| Kandidat | Begründung |
|----------|------------|
| PostHog | Open Source, EU-freundlich, RN SDK |
| Firebase Analytics | Android-first, Play Store Integration |
| Amplitude | Product Analytics Standard |

**Empfehlung für Entscheidung in Sprint 16:** PostHog oder Firebase — final bei V1 Sprint.

## Events (Minimum)

- `screen_view` (Home, Events, Detail, …)
- `event_favorite_toggle`
- `event_ticket_click`
- `submission_created`
- `admin_publish`

## Datenschutz

- DSGVO: Opt-in / Privacy Policy vor Tracking (Band 4 Security Stub)
- Keine PII in Analytics ohne Consent

## Konsequenzen Sprint 0

- Keine SDK installieren
- Kein Tracking-Code im App-Bundle
- ADR update when vendor chosen

## Referenzen

- Band 5 Kap. 06, analysis/10_migration_roadmap Sprint 16
- MOCKUP-ALIGNMENT V1 Launch Checklist
