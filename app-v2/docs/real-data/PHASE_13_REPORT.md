# Sprint 13 — Multi-Source Production Integration Abschlussbericht

## 1. Analyse des vorherigen Zustands

Nach Sprint 12 war die technische Integration von Bootshaus als erste reale Quelle abgeschlossen, aber **nicht produktionsreif verbunden**:

| Bereich | Vor Sprint 13 |
|---------|----------------|
| Bootshaus Source | Nur im Code (`bootshaus-source.ts`), nicht in `public.sources` |
| Affenkäfig | Nicht implementiert (Domain unkonfiguriert) |
| Publish | `PublishStep` war No-Op; nur manuelles `approveRecord()` |
| Import-Trigger | `startManualImport` existierte, aber **kein Admin-UI-Wiring** |
| Consumer App | Default: Demo-Pipeline (`runDefaultEventPipeline`) |
| Source-Rollen | Kein persistiertes Multi-Rollen-Modell |
| Publish-Mode | Nicht vorhanden (`review_required` nur boolean) |
| Provenance bei Import | Nicht automatisch bei Publish |

## 2. Änderungen an Architektur und Datenbank

### Datenbank-Migration `20260744000000_sprint13_production_integration.sql`

- `country_code` (fehlende Spalte für bestehenden Index ergänzt)
- `publish_mode` (`auto_publish` | `manual_review` | `conditional_review`)
- `source_roles text[]` (mehrere Rollen pro Quelle)
- `last_error text`
- **Seed:** `source-bootshaus-koeln` (club + venue, live fetch, auto_publish)
- **Seed:** `source-affenkaefig` (organizer + festival, JSON-LD fixture in DB, auto_publish)

### Architektur-Erweiterungen

| Komponente | Änderung |
|------------|----------|
| `PublishDecisionService` | Entscheidet publish / queue / skip nach `publish_mode` |
| `ImportEventPublishService` | Event Upsert + Provenance + Record-Update |
| `ImportPublishOrchestratorService` | Batch-Publish nach Import-Job |
| `ImportAggregationService` | Ruft Publish-Orchestrator nach `createMany` auf |
| `PublishStep` | Markiert publish-eligible Records (kein No-Op mehr) |
| `organizer-website-connector` | Live-Fetch wie `club_website` (kein erzwungenes Fixture) |
| `app-bootstrap` | Kein Demo-Fallback mehr in Consumer App |
| Admin Source Detail | Button „Start production import“ |

### Fachliche Trennung

- **Source** = Datenherkunft (Konfiguration in DB)
- **Organizer / Venue / Festival** = separate Entitäten; Source verknüpft optional über `metadata`, nicht identisch
- `source_roles` beschreiben die **Rolle der Quelle**, nicht die Entität selbst

## 3. Neue und geänderte Dateien

### Neu

| Datei | Zweck |
|-------|-------|
| `supabase/migrations/20260744000000_sprint13_production_integration.sql` | Schema + Production Seeds |
| `src/features/import/domain/publish-mode.ts` | Publish-Mode Domain |
| `src/features/sources/domain/source-entity-roles.ts` | Source-Rollen Domain |
| `src/features/import/services/publish-decision-service.ts` | Publish-Entscheidung |
| `src/features/import/services/import-event-publish-service.ts` | Event Publish + Upsert + Provenance |
| `src/features/import/services/import-publish-orchestrator-service.ts` | Auto-Publish nach Import |
| `src/features/sources/production/production-source-records.ts` | Test-Factories (spiegeln DB) |
| `src/features/sources/production/affenkaefig-fixture.ts` | Test-Fixtures |
| `src/features/sources/production/__tests__/sprint13-production-integration.test.ts` | E2E Sprint-13-Tests |
| `src/features/aggregation/__tests__/in-memory-multi-source-repositories.ts` | Test-Infrastruktur |
| `src/data/__tests__/sprint13-production-migration.test.ts` | Migrations-Test |

### Geändert (Auswahl)

- `source-mapper.ts`, `records.ts`, `aggregation-source.ts`, `source-registry.ts`
- `import-aggregation-service.ts`, `publish-step.ts`, `import-review-service.ts`
- `organizer-website-connector.ts`, `registry.ts`, `app-bootstrap.ts`
- `app/admin/sources/[id].tsx` (Import-Button)
- `bootshaus-source.ts` → Re-Export für Tests (Production in DB)

## 4. Vollständiger End-to-End-Datenfluss

```
public.sources (Bootshaus / Affenkäfig)
        ↓
Admin: „Start production import“ → ImportOperationsService.startManualImport()
        ↓
ImportAggregationService.runFromSourceRecord()
        ↓
AggregationPipeline: Fetch → Normalize → Validate → Duplicate → Merge → Review → PublishStep
        ↓
import_jobs + import_records (Staging)
        ↓
ImportPublishOrchestratorService (auto_publish / conditional_review)
        ↓
ImportEventPublishService.publishRecord()
        ├─ Upsert public.events (status: published)
        ├─ event_source_references (Provenance)
        └─ import_records.status → imported
        ↓
EventRepository.refresh()
        ↓
Consumer App (Home, Search, Saved, Event Detail)
```

## 5. Nachweis Import beider Quellen

| Quelle | Connector | Strategie | Test |
|--------|-----------|-----------|------|
| Bootshaus | `club_website` | `html_selector` | `sprint13-production-integration.test.ts` |
| Affenkäfig | `organizer_website` | `json_ld` (@graph) | `sprint13-production-integration.test.ts` |

Beide durchlaufen **dieselbe** `ImportAggregationService` + `ImportPublishOrchestratorService` Pipeline.

## 6. Nachweis Veröffentlichung

- Auto-Publish bei `publish_mode: auto_publish`
- Events landen in `public.events` mit `status: published`
- `import_records.resulting_event_id` gesetzt
- `event_source_references` geschrieben
- Re-Import aktualisiert bestehende Events (kein Duplikat) — getestet

## 7. Nachweis Consumer App

- `app-bootstrap.ts`: Supabase-Modus lädt `events WHERE status = published`
- Local-Modus ohne Supabase: **leerer Feed** (keine Demo-Daten)
- `EventRepository.refresh()` nach Publish

## 8. Testergebnisse

| Check | Ergebnis |
|-------|----------|
| Tests | **932** bestanden (+10) |
| Typecheck | grün |
| Lint | grün |

## 9. Bekannte Einschränkungen

| Einschränkung | Details |
|---------------|---------|
| Affenkäfig Live-Site | `affenkaefig.de` derzeit unkonfiguriert; DB enthält Reference-HTML bis Live-Site verfügbar |
| Trust Engine | Nur Architektur-Vorbereitung (`conditional_review`, `publishPolicy`) |
| Scheduler | Nicht implementiert (`schedule_policy` in DB vorhanden) |
| Detail-Anreicherung Bootshaus | Weiterhin list-only (`maxDetailPages: 0`) |
| Home Club-Spotlight | Weiterhin `HOME_CLUB_FIXTURES` (UI-Dekoration, keine Event-Daten) |

## 10. Skalierbarkeitsbewertung

Die Architektur ist **grundsätzlich geeignet für tausende Quellen**:

| Aspekt | Bewertung |
|--------|-----------|
| Source-Konfiguration in DB | ✅ Skalierbar |
| Generische Pipeline ohne Quellen-Sonderlogik | ✅ |
| Publish-Mode pro Source | ✅ |
| Multi-Rollen pro Source | ✅ |
| Event Upsert via external_id + source_id | ✅ |
| Provenance-Tabellen | ✅ Vorbereitet |
| Import Jobs/Records Staging | ✅ |

**Empfohlene Verbesserungen vor Sprint 14:**

1. Scheduler-Runner für `schedule_enabled` Sources
2. Affenkäfig Live-Fetch sobald Domain aktiv
3. Dedizierte `source_config` Tabelle statt großem JSONB bei sehr vielen Quellen
4. Consumer Realtime-Subscription auf `events` für Live-Updates ohne App-Neustart
5. Trust Engine Implementierung für `conditional_review`

## Erfolgskriterien

| Kriterium | Status |
|-----------|--------|
| Bootshaus als DB-Quelle | ✅ |
| Affenkäfig als DB-Quelle | ✅ |
| Gleiche generische Pipeline | ✅ |
| Beide veröffentlichen Events | ✅ |
| Events in public.events | ✅ |
| Consumer ohne Demo-Daten | ✅ |
| Keine Quellen-Sonderlogik | ✅ |
| Re-Import Upsert | ✅ |
| Tests/Typecheck/Lint grün | ✅ |
