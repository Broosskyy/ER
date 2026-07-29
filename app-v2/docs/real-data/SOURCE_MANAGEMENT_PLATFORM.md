# Source Management Platform

Sprint 10 — Verwaltungsebene über dem Connector Framework.

## Architektur

```
Admin / API (vorbereitet)
  → SourceManagementService
      → SourceService (CRUD, Permissions)
      → SourceConnectorRegistry (Health, Metrics, Test Import)
      → InMemorySourceImportHistoryStore (Import History)
  → SourceRecord (erweitert)
  → Aggregation Pipeline (unverändert, nur bei Test Import)
```

## Erweitertes SourceRecord

Additive Felder auf `SourceRecord`:

| Feld | Beschreibung |
|------|--------------|
| `stableKey` | Stabile Registry-ID |
| `category` | Admin-Kategorie |
| `status` | Zentrales Management-Statusmodell |
| `connectorKey` | Aggregation-Connector |
| `connectorType` | Connector-Typ |
| `region`, `stateCode`, `city` | Geo |
| `genreNames`, `tags` | Klassifikation |
| `organizerId/Name`, `venueId/Name` | Entity-Referenzen |
| `autoEnabled` | Auto-Aktivierung (vorbereitet) |
| `metadata` | Erweiterbare JSON-Metadaten |
| `lastAttemptAt`, `averageDurationMs` | Ops-Telemetrie |

Bestehende Felder (`lastImportAt`, `lastSuccessfulSyncAt`, `lastFailedImportAt`, `pollingIntervalMinutes`, etc.) bleiben erhalten.

## Statusmodell

`draft` | `active` | `disabled` | `archived` | `error` | `maintenance`

Implementierung: `src/features/sources/domain/source-status.ts`

## Kategorien

`website`, `api`, `ticket_provider`, `rss`, `ical`, `json_ld`, `html`, `partner_feed`, `manual`, `social`, `other`

Implementierung: `src/features/sources/domain/source-categories.ts`

## Validierung

`validateSourceRecord()` in `source-management-validation.ts`:

- Pflichtfelder
- URL-Format (ohne Fetch)
- Connector-Registrierung
- Kategorie/Status
- Konfigurationsvollständigkeit

## SourceManagementService

| Operation | Beschreibung |
|-----------|--------------|
| `createSource()` | Erstellt validierte Source |
| `updateSource()` | Aktualisiert mit Merge + Validierung |
| `deleteSource()` | Soft-Delete via Archivierung |
| `archiveSource()` | Archiviert |
| `enableSource()` / `disableSource()` | Status-Steuerung |
| `validateSource()` | Strukturierte Validierung |
| `getSource()` / `listSources()` | Admin-Views |
| `runTestImport()` | Fixture-basierter Connector-Test |
| `getImportHistory()` | In-Memory Import-Historie |
| `buildEditorModel()` | Admin-Editor-Vorbereitung |

## Import History

In-Memory (`InMemorySourceImportHistoryStore`):

- Zeitpunkt, Status, Laufzeit
- Eventanzahl, Fehler, Warnungen
- Connector-Version
- `testImport`-Flag

Keine Persistenz in Sprint 10.

## Test Import

`runTestImport()` nutzt bestehenden `SourceConnectorExecutor` — nur Fixture/Reference-Payloads, keine echten Webseiten.

## Admin-Vorbereitung

View-Modelle in `src/features/sources/admin/source-admin-models.ts`:

- `SourceAdminListItem`
- `SourceAdminDetailView`
- `SourceAdminEditorModel`
- `SourceAdminTestImportResult`

## Datenfluss Test Import

```
SourceRecord
  → mapSourceRecordToImportSource / mapSourceRecordToAggregationSource
  → SourceConnectorRegistry.getExecutor().execute()
  → Diagnostics + Health/Metrics Update
  → ImportHistoryEntry (in-memory)
  → SourceAdminTestImportResult
```

## Bewusst nicht implementiert

- Scheduler / Auto-Import
- Echte Webseiten-Fetches
- Neue Connector-Frameworks
- Admin-UI
- Persistente Import History

## Nächste Phase (Sprint 11)

- Persistente Import History (Supabase)
- Admin-UI für Source Management
- Post-Import Metrics Writeback
- Source Groups / Relations Repositories
