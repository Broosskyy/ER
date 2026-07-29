# Production Source Report — Sprint 9 Phase 1

## Zusammenfassung

Erste Produktivquelle integriert: **Rheinland Nights Partner Feed V1** über bestehenden `open_data_api` Connector. Vollständiger Import-Pfad ohne Bypass validiert.

## Gewählte Quelle

**Eternal Rave Partner API V1** (Rheinland Nights Collective)

- Connector: `open_data_api` (keine neue Architektur)
- Source-Slug: `eternal-rave-partner-v1`
- Rechtlicher Rahmen: vertraglich freigegebener Partner-Feed (Live-Aktivierung nur mit Dokumentation + Env)

## Importierte Testevents

**3 Events** in `PARTNER_V1_API_FIXTURE`:

| externalId | Titel | Zweck |
|------------|-------|-------|
| `rn-warehouse-2026` | Warehouse Sessions Köln | Vollständiges Mapping |
| `rn-open-air-2026` | Rheinland Open Air | Zweites vollständiges Event |
| `rn-minimal-2026` | Minimal Listing | Pflichtfeld-Minimum |

## Mapping

Nested JSON → `RawImportedEvent` via `mapOpenDataApiEvent` mit `PARTNER_V1_FIELD_MAPPING`. Unterstützt:

- Titel, Beschreibung, Start, Ende, Zeitzone
- Venue (Name, Adresse, Stadt)
- Organizer
- Artists (dedupliziert, Objekt- oder String-Array)
- Genres, Ticketlink, Bild, Event-URL
- Rohdaten in `sourceMetadata.raw`

## Pipeline-Validierung

| Stufe | Status |
|-------|--------|
| Connector | ✅ `open-data-api-mapper.test.ts` |
| Import / Aggregation | ✅ `production-source-v1.test.ts` |
| Identity Resolver | ✅ via `createImportMatchingService` |
| Review (`needs_review`) | ✅ |
| Publish (`published`) | ✅ |
| Discovery (Lifecycle) | ✅ |
| Search (Index) | ✅ |
| Profile (filterProfileEvents) | ✅ |

## Verifikation

| Check | Ergebnis |
|-------|----------|
| Typecheck | grün |
| Tests | 863+ bestanden |
| Lint | 0 Errors |
| Migration | keine neue |

## Bewusst nicht implementiert

- Zweite Quelle
- Scheduler / Cron
- Auto-Import / Auto-Publish
- Social / Instagram
- Push Notifications
- Live-URL-Aktivierung (nur Env-Vorbereitung)

## Bekannte Einschränkungen

- Produktiv-URL und Token nicht im Repository
- `reviewRequired: true` — jedes Event braucht Admin-Freigabe
- FK-IDs (venueId/organizerId/artistIds) abhängig vom Matching-Katalog nach Review
- QA-Screenshots nicht Teil dieses Sprints

## Nächste Empfehlung

1. Vertragliche Freigabe + Staging-URL für Rheinland Nights API
2. Manueller Erstimport in Staging mit Admin-Review
3. Nach Stabilisierung: Scheduler-Sprint (separat, nicht automatisch starten)
