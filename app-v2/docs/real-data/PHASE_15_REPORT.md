# Sprint 15 — Production Scheduler & Automation Engine Abschlussbericht

## 1. Analyse der bestehenden Architektur

### Bereits vorhanden (wiederverwendet, nicht neu gebaut)

| Komponente | Datei | Rolle im Scheduler |
|------------|-------|-------------------|
| `DefaultImportScheduleService` | `import-schedule-service.ts` | Due-Source-Erkennung, Backoff, Next-Run-Berechnung |
| `ImportScheduleRepository` (Contract) | `import-schedule-types.ts` | State + Lock-Interface |
| `import_schedule_locks` (DB) | Migration `20260742000000` | Cross-Worker-Locks |
| `sources.schedule_*` (DB) | Migration `20260742000000` | Per-Source Scheduling |
| `ImportAggregationService` | `import-aggregation-service.ts` | Pipeline-Ausführung |
| `ImportPublishOrchestratorService` | `import-publish-orchestrator-service.ts` | Auto-Publish nach Import |
| `ImportEventPublishService` | `import-event-publish-service.ts` | Event Upsert + Provenance |
| `ImportOperationsService.startManualImport` | `import-operations-service.ts` | Manuelles Starten (unverändert) |
| `getActiveJobForSource` | `import-admin-repository.ts` | Ein aktiver Job pro Source |
| `resolveImportRetry` | `import-retry-policy.ts` | Job-Retry-Policy (bestehend, nicht dupliziert) |
| Connector Retry | `aggregation/connectors/framework/retry.ts` | Fetch-Retry (unverändert) |
| `ImportLoggingService` | `import-logging-service.ts` | Scheduler- + Job-Logs |
| `SourceConnectorRegistry` + Health/Metrics | `source-connector-registry.ts` | Connector-Diagnostics (unverändert) |
| `SourceRecord` / `AdminSourceRepository` | `records.ts`, `repositories.ts` | Source-Konfiguration |

### Vor Sprint 15 fehlend

- Kein Scheduler-Runner / Tick-Orchestrator
- Keine Job-Queue (Scheduler startete Imports direkt — jetzt: enqueue first)
- `schedule_*` Felder nicht im `SourceRecord`-Mapper
- Kein Supabase-Repository für Queue/Runs
- Keine Scheduler-Run-Historie
- `triggerType: 'scheduled'` ungenutzt
- Admin-UI ohne Scheduler-Status

---

## 2. Neue Architektur

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ImportSchedulerEngine.tick()                      │
│  (Cron / Edge Function / Admin-Trigger — nur Orchestrierung)          │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌───────────────┐     ┌─────────────────┐     ┌──────────────────┐
│ Schedule      │     │ Import Locks    │     │ scheduler_runs     │
│ Service       │     │ (per source)    │     │ (Audit Log)        │
│ listDueSources│     │ tryAcquireLock  │     │                    │
└───────┬───────┘     └─────────────────┘     └──────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────┐
│ ENQUEUE PHASE (Scheduler startet NIEMALS direkt einen Import)         │
│  ImportAggregationService.enqueueJob(triggerType: 'scheduled')        │
│  ImportJobQueueService.enqueueScheduledImport()                       │
│  → import_jobs (status: pending) + import_job_queue (status: queued)│
└───────────────────────────────┬─────────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│ PROCESS PHASE (bestehende Pipeline — unveränderte Geschäftslogik)   │
│  ImportJobQueueProcessor.processReadyJobs()                         │
│    → ImportAggregationService.executeExistingJob()                  │
│      → AggregationPipeline → Matching → PublishOrchestrator         │
│    → ImportScheduleService.recordSuccess / recordFailure            │
└─────────────────────────────────────────────────────────────────────┘
```

### Designprinzipien

1. **Scheduler = Orchestrierung only** — keine Fetch-, Parse-, Match- oder Publish-Logik
2. **Queue-first** — Jobs werden erzeugt, dann von Processor ausgeführt (Worker-ready)
3. **Bestehende Pipeline 1:1** — `executeExistingJob` nutzt dieselbe Logik wie `runFromSourceRecord`
4. **Locks auf zwei Ebenen** — Scheduler-Lock (`import_schedule_locks`) + Job-Guard (`getActiveJobForSource`)
5. **Backoff wiederverwendet** — `DefaultImportScheduleService.recordFailure` (15→240 min), keine neue Retry-Logik

---

## 3. Scheduler-Ablauf (Detail)

1. `ImportSchedulerEngine.tick(now)` erstellt `scheduler_runs`-Eintrag
2. `listDueSources(now)` — alle Sources mit `nextScheduledAt <= now`, nicht in Backoff/Pause
3. Pro due Source:
   - Skip wenn Maintenance Mode, aktiver Job, oder Lock nicht erhältlich
   - `tryAcquireLock(sourceId, leaseId, expiresAt)`
   - `aggregationService.enqueueJob(source, 'scheduled')` → `import_jobs.pending`
   - `queueService.enqueueScheduledImport()` → `import_job_queue.queued`
   - `releaseLock`
4. `ImportJobQueueProcessor.processReadyJobs(batchSize)`:
   - Sortiert nach Priorität + `scheduledFor`
   - `executeExistingJob` → vollständige Aggregation + Publish
   - `recordSuccess` / `recordFailure` auf Schedule State
5. Scheduler-Run abschließen mit Metriken

---

## 4. Queue-Ablauf

| Status | Bedeutung |
|--------|-----------|
| `queued` | Job erzeugt, wartet auf Processor |
| `processing` | Processor führt `executeExistingJob` aus |
| `completed` | Pipeline erfolgreich |
| `failed` | Fehler, Backoff auf Source angewendet |
| `cancelled` | Reserviert für zukünftige Admin-Aktionen |

**Skalierung:** Queue-Tabelle + Priorität + `scheduled_for` ermöglichen später:
- Horizontale Worker (`SELECT ... FOR UPDATE SKIP LOCKED`)
- Cloud Queue (SQS, Pub/Sub) als Adapter vor `ImportJobQueueRepository`
- Batch-Größen pro Tick konfigurierbar

---

## 5. Datenbank-Migration `20260746000000_sprint15_production_scheduler.sql`

| Änderung | Zweck |
|----------|-------|
| `sources.schedule_interval_preset` | DB-konfigurierbare Intervalle |
| `sources.scheduler_maintenance_mode` | Wartungsmodus pro Source |
| `scheduler_runs` | Globale Tick-Historie |
| `import_job_queue` | Job-Queue mit Priorität |
| RLS auf Scheduler-Tabellen | Admin-only |
| Index `sources_schedule_due_idx` | Skalierbare Due-Source-Abfragen |

### Interval-Presets (DB, nicht Code)

| Preset | Intervall | Policy |
|--------|-----------|--------|
| `disabled` | — | `paused` |
| `manual` | — | `manual_only` |
| `every_15_minutes` | 15 min | `interval` |
| `every_30_minutes` | 30 min | `interval` |
| `hourly` | 60 min | `interval` |
| `every_6_hours` | 360 min | `interval` |
| `daily` | 1440 min | `interval` |
| `custom` | `polling_interval_minutes` | `interval` |

---

## 6. Neue Dateien

| Datei | Zweck |
|-------|-------|
| `schedule-interval-preset.ts` | Preset → Policy/Minuten Mapping |
| `source-schedule-mapper.ts` | `SourceRecord` ↔ `ImportScheduleState` |
| `source-import-schedule-repository.ts` | Source-backed Schedule + Lock Repository |
| `import-job-queue-service.ts` | Queue-Operationen |
| `import-job-queue-processor.ts` | Queue → Pipeline Bridge |
| `import-scheduler-engine.ts` | Tick-Orchestrator |
| `import-scheduler-monitoring.ts` | Monitoring-Snapshot + Source-Status |
| `import-scheduler-admin-service.ts` | Admin-API (Preset, Maintenance, Tick) |
| `supabase-scheduler-repositories.ts` | Supabase Queue + Runs |
| `in-memory-scheduler-repositories.ts` | Test-Infrastruktur |
| `scheduler-source-utils.ts` | Aggregation-Eligibility Check |

### Geänderte Dateien

- `import-aggregation-service.ts` — `enqueueJob()` + `executeExistingJob()` Split
- `import-schedule-types.ts` — Queue, Runs, erweiterte State-Felder
- `import-schedule-service.ts` — Maintenance Mode, Preset-Anwendung
- `records.ts` + `source-mapper.ts` — Schedule-Felder Round-Trip
- `registry.ts` — Vollständiges Scheduler-Wiring
- `app/admin/sources/[id].tsx` — Scheduler-Status (minimal)

---

## 7. Monitoring (Backend, kein Dashboard)

`ImportSchedulerMonitoringService` liefert:

- `getSourceStatus(sourceId)` — next/last run, errors, running, queued
- `getSnapshot()` — latest runs, queue depth, due count, backoff count

`scheduler_runs` speichert pro Tick:
- sources scanned/due, jobs enqueued/processed/succeeded/failed, duration

---

## 8. Skalierbarkeit

| Anforderung | Bewertung |
|-------------|-----------|
| 10.000+ Sources | ✅ Due-Index, paginierte `listStates`, Queue mit Priorität |
| 100.000+ Sources | ⚠️ `listStates` braucht später Cursor/Pagination + Shard-Keys |
| Multi-Timezone | ✅ `schedule_timezone` pro Source (vorhanden) |
| Cloud Worker | ✅ Queue-Tabelle als Worker-Input; Processor isoliert |
| Horizontale Skalierung | ✅ Locks + `getActiveJobForSource` verhindern Doppelverarbeitung |
| Kein Architekturbruch | ✅ Pipeline unverändert, nur enqueue/execute Split |

---

## 9. Risiken & verbleibende Punkte (Sprint 16)

| Punkt | Priorität |
|-------|-----------|
| **Deployment-Trigger** — Supabase Edge Function / Cron für `tick()` | Hoch |
| **Cron-Preset** — `schedule_policy: 'cron'` noch ohne Parser | Mittel |
| **Job-Level Retry Wiring** — `resolveImportRetry` in Queue-Processor | Mittel |
| **Queue Worker** — separater Prozess statt synchronem Processor | Mittel |
| **`listStates` Pagination** — bei >10k Sources | Mittel |
| **Admin UI** — Preset-Auswahl, Maintenance-Toggle, manueller Tick-Button | Niedrig |
| **Metriken-Dashboard** — Grafana/Datadog auf `scheduler_runs` | Niedrig |
| **Dual-Policy-Vereinheitlichung** — `pollingStrategy` vs `schedulePolicy` | Niedrig |

---

## 10. Erfolgskriterien

| Kriterium | Status |
|-----------|--------|
| Scheduler vollständig integriert | ✅ |
| Importpipeline wiederverwendet | ✅ |
| Keine doppelte Logik | ✅ |
| Scheduling pro Source (DB) | ✅ |
| Queue vorbereitet | ✅ |
| Import Locks | ✅ |
| Vollständiges Logging | ✅ |
| Monitoring vorbereitet | ✅ |
| Tests / Typecheck / Lint | ✅ (948 tests, 0 errors) |

---

## 11. Verifikation

```
Tests:     948 passed (+7)
Typecheck: grün
Lint:      0 errors
```

Neue Tests:
- `sprint15-production-scheduler.test.ts`
- `sprint15-production-scheduler-migration.test.ts`
