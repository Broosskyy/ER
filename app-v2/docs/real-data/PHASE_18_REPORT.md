# Sprint 18 — Event Lifecycle Engine Abschlussbericht

## 1. Analyse der bestehenden Architektur

### Bereits vorhanden (wiederverwendet, nicht neu gebaut)

| Komponente | Datei | Rolle in Sprint 18 |
|------------|-------|-------------------|
| `EventLifecycleResolver` | `event-lifecycle-resolver.ts` | Berechnet `LifecycleStatus` (read-path) — **USE AS-IS** |
| `lifecycle-types.ts` | `lifecycle-types.ts` | `LifecycleStatus`, `EventLifecycleInput` — **USE AS-IS** |
| `applyEventPublishLifecycle` | `event-publish-lifecycle.ts` | Timestamp-Stempel — **integriert in Orchestrator** |
| `ImportUpdateService.detectChanges` | `import-update-service.ts` | **Erweitert** — mehr Felder |
| `event_field_provenance` | Sprint 13/14 | Provenance bleibt erhalten |
| `event_conflicts` + `detectConflictingValues` | `event-conflict.ts` | Konfliktdokumentation — **wiederverwendet** |
| `ImportReviewQueueService` | Sprint 16/17 | **Erweitert** — Lifecycle-Reviews |
| `publishLifecycleDomainEvent` | `real-data-domain-events.ts` | Domain Events — **wiederverwendet** |
| `ImportEventPublishService` | `import-event-publish-service.ts` | **Erweitert** — Lifecycle-Orchestrierung |
| `ImportAggregationService` | `import-aggregation-service.ts` | **Erweitert** — Lifecycle-Archivierung |
| `AdminEventRecord` lifecycle fields | `records.ts` | `cancelledAt`, `postponedAt`, `publishedAt`, etc. |

### Vor Sprint 18 fehlend

- Keine versionierte Event-Historie (nur `changeType` in `normalizedPayload`)
- Kein Delta-Änderungsmodell mit alt/neu/Quelle/Confidence
- Keine regelbasierten Lifecycle-Entscheidungen (apply / review / conflict / ignore)
- `detectChanges` unvollständig (venue, organizer, image fehlten)
- Archivierung ohne Lifecycle-Audit
- Kein Fundament für Event-Serien

---

## 2. Neue Architektur

```
ImportEventPublishService.publishRecord()
        │
        ▼
EventLifecycleOrchestrator.processImportPublish()
        │
        ├── applyEventPublishLifecycle() (bestehend)
        ├── EventLifecycleEngine.process()
        │     ├── EventLifecycleChangeDetector (Delta-Erkennung)
        │     └── EventLifecycleDecisionEngine (regelbasiert)
        │
        ├── event_lifecycle_history (Historie)
        ├── event_lifecycle_changes (Feld-Deltas)
        ├── event_conflicts (bei create_conflict)
        ├── import_review_queue (bei review_required)
        └── publishLifecycleDomainEvent() (Domain Event Bus)
```

**Archivierung (fehlende Source-Events):**

```
ImportAggregationService
  → EventLifecycleOrchestrator.processArchive()
  → event_lifecycle_history (event_archived)
```

### Designprinzipien

1. **Ergänzung, kein Ersatz** — Import, Matching, Trust, Publish unverändert
2. **Delta-Verarbeitung** — nur geänderte Felder, keine Full-Rewrites
3. **Regelbasiert** — keine KI, keine quellenspezifischen Sonderfälle
4. **Provenance erhalten** — Konflikte dokumentieren, nicht auflösen
5. **Computed Lifecycle** — `EventLifecycleResolver` bleibt read-path only

---

## 3. Lifecycle-Modell

### Unterstützte Lifecycle-Ereignisse

| Typ | Auslöser |
|-----|----------|
| `event_created` | Neues Event |
| `event_updated` | Generische Aktualisierung |
| `event_moved` | `startDate` geändert |
| `time_changed` | `endDate` geändert |
| `venue_changed` | `venueName` geändert |
| `organizer_changed` | `organizerName` geändert |
| `festival_edition_changed` | `festivalEditionId` geändert |
| `ticket_link_changed` | `ticketUrl` geändert |
| `lineup_changed` | `artistNames` geändert |
| `description_changed` | `description` geändert |
| `image_changed` | `imageUrl` geändert |
| `event_cancelled` | `cancelledAt` gesetzt |
| `event_reactivated` | `cancelledAt` entfernt |
| `event_postponed` | `postponedAt` gesetzt |
| `event_archived` | `status → archived` |

### Lifecycle-Entscheidungen

| Entscheidung | Bedeutung |
|--------------|-----------|
| `apply_immediately` | Änderung übernehmen + historisieren |
| `review_required` | Review Queue, keine kritischen Felder anwenden |
| `create_conflict` | `event_conflicts` + Review Queue |
| `ignore` | Keine Änderung (No-op) |

### Entscheidungsregeln (`lifecycle-engine-config.ts`)

- Kritische Felder (`startDate`, `cancelledAt`, `status`) auf **published** Events → Review bei Trust < Schwellenwert
- `reviewOnPublished` pro Feld konfigurierbar
- `minTrustScoreForAutoApply` pro Feld (z.B. 85 für `startDate`)

---

## 4. Änderungsmodell

Jede Änderung wird in `event_lifecycle_changes` dokumentiert:

| Feld | Beschreibung |
|------|--------------|
| `field_path` | Geändertes Feld |
| `old_value` / `new_value` | JSON-Werte |
| `severity` | info / warning / critical |
| `provenance_source_id` | Quelle der Änderung |
| `history_id` | Verknüpfung zur Historie |

Jeder Vorgang in `event_lifecycle_history`:

| Feld | Beschreibung |
|------|--------------|
| `lifecycle_event_type` | Art der Änderung |
| `decision` | apply / review / conflict / ignore |
| `source_id`, `import_job_id`, `import_record_id` | Herkunft |
| `confidence_score` | Trust-basiert |
| `lifecycle_status_before/after` | Computed Status |
| `change_count` | Anzahl Feld-Deltas |

---

## 5. History-System

- Vollständige Historie pro Event über `event_lifecycle_history`
- Feld-Deltas über `event_lifecycle_changes`
- Domain Events über `publishLifecycleDomainEvent()` für `event_created`, `event_updated`, `event_cancelled`, `event_postponed`, `lineup_changed`
- Vorbereitung für Timeline-UI (Admin-API: `listEventHistory`, `listEventChanges`)

---

## 6. Konfliktbehandlung

Bei `create_conflict`:
1. `detectConflictingValues()` → `event_conflicts` (bestehende Tabelle)
2. `ImportReviewQueueService.enqueueFromLifecycleEvaluation()`
3. Keine automatische Auflösung — Provenance bleibt erhalten

---

## 7. Event-Serien (Fundament)

Migration legt `event_series` an:

| Feld | Beschreibung |
|------|--------------|
| `series_type` | `recurring`, `annual_festival`, `club_night`, `special_edition` |
| `events.event_series_id` | Optionale Verknüpfung |

Noch keine Serienverwaltung — nur Schema-Fundament für Sprint 19+.

---

## 8. Archivierung

- Soft-Delete via `status: 'archived'` (kein physisches Löschen)
- `event_archived` Lifecycle-Eintrag mit vollständiger Historie
- Abgesagt via `cancelledAt` + `event_cancelled`
- Reaktiviert via `event_reactivated`

---

## 9. Migration

`20260749000000_sprint18_event_lifecycle_engine.sql`:

- `event_series`
- `event_lifecycle_history`
- `event_lifecycle_changes`
- `events.event_series_id`
- RLS (Admin-only)

---

## 10. Neue Dateien

```
src/features/event-lifecycle/
├── domain/
│   ├── lifecycle-engine-types.ts
│   └── lifecycle-engine-config.ts
├── repositories/
│   └── in-memory-lifecycle-repositories.ts
├── services/
│   ├── event-lifecycle-change-detector.ts
│   ├── event-lifecycle-decision-engine.ts
│   ├── event-lifecycle-engine.ts
│   ├── event-lifecycle-orchestrator.ts
│   └── event-lifecycle-admin-service.ts
└── __tests__/
    └── sprint18-event-lifecycle.test.ts
```

### Geänderte Dateien

- `import-update-service.ts` — erweiterte Feld-Erkennung
- `import-event-publish-service.ts` — Lifecycle-Orchestrator
- `import-aggregation-service.ts` — Lifecycle-Archivierung
- `import-review-queue-service.ts` — `enqueueFromLifecycleEvaluation()`
- `registry.ts` — Wiring
- `app/admin/events/[id].tsx` — Lifecycle-Status-Karte

---

## 11. Admin-Vorbereitung

`EventLifecycleAdminService`:

- `getEventStatus(event)` — Status, History-Count, Changes, Last Source
- `listEventHistory(canonicalEventId)`
- `listEventChanges(canonicalEventId)`
- `listRecentHistory()`

Minimal UI auf Event-Detail: Lifecycle Status, History entries, Field changes, Last change, Pending reviews.

---

## 12. Performance

| Anforderung | Umsetzung |
|-------------|-----------|
| Millionen Events | Delta-only — nur geänderte Felder |
| Millionen Änderungen | Index auf `canonical_event_id`, `field_path` |
| Keine Full-Rewrites | `EventLifecycleEngine` patcht nur geänderte Felder |
| Scheduler-Läufe | Lifecycle pro Record beim Publish, nicht Batch-Scan |

In-Memory-Repos für Vitest; Supabase-Repos in Sprint 19.

---

## 13. Tests & Qualität

| Check | Ergebnis |
|-------|----------|
| Tests | **977 passed** |
| Typecheck | **green** |
| Lint | **0 errors** |

Neue Tests:

- `sprint18-event-lifecycle.test.ts`
- `sprint18-event-lifecycle-migration.test.ts`

---

## 14. Erfolgskriterien

| Kriterium | Status |
|-----------|--------|
| Lifecycle Engine vorhanden | ✓ |
| Änderungen versioniert | ✓ `event_lifecycle_changes` |
| Event History vorhanden | ✓ `event_lifecycle_history` |
| Konflikte dokumentiert | ✓ via `event_conflicts` |
| Review Queue integriert | ✓ |
| Provenance erhalten | ✓ |
| Bestehende Pipeline wiederverwendet | ✓ |
| Tests / Typecheck / Lint | ✓ |

---

## 15. Offene Punkte für Sprint 19

1. **Supabase-Repositories** für `event_lifecycle_history`, `event_lifecycle_changes`, `event_series`
2. **Timeline-UI** — vollständige Event-History-Ansicht im Admin
3. **Event-Serien-Verwaltung** — CRUD für `event_series`, automatische Zuordnung
4. **Konfliktauflösung** — Admin-Workflow für `event_conflicts`
5. **Lineup-Lifecycle** — Integration mit `EventLineupService`
6. **Persistente Domain Events** — `RealDataDomainEventBus` → DB
7. **Festival-Edition-Koordination** — Edition-Status ↔ Event-Lifecycle
8. **Backfill** — Lifecycle-Historie für bestehende Events

---

## 16. Zusammenfassung

Sprint 18 implementiert eine **generische Event Lifecycle Engine**, die sämtliche Änderungen eines Events über dessen gesamten Lebenszyklus versioniert, regelbasiert entscheidet (apply / review / conflict / ignore), Konflikte dokumentiert und eine vollständige Historie für spätere Timeline-Ansichten bereitstellt — ohne die bestehende Import-, Matching- oder Publish-Architektur zu verändern.
