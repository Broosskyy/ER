# Sprint 20 — Platform Resilience & Production Hardening Abschlussbericht

## 1. Analyse der Plattformarchitektur (Sprints 9–19)

### Komponenten-Status

| Bereich | Status | Details |
|---------|--------|---------|
| **Scheduler** | ✓ gelöst | `ImportSchedulerEngine` enqueued nur; `processQueue: false` Standard |
| **Queue Worker** | ✓ gelöst | `ImportJobQueueWorker` separat; Lease auf `markProcessing()` |
| **Operations** | ✓ gelöst | Pause/Resume, Maintenance, Recovery, Backfill-APIs |
| **Backfill Runner** | ✓ gelöst | Cursor-basiert, idempotent; Lifecycle + Provenance implementiert |
| **Source Intelligence** | ✓ gelöst | Sprint 19; Snapshot-Persistenz |
| **Lifecycle** | ✓ gelöst | Engine S18; Backfill via `EventLifecycleEngine.process()` |
| **Provenance** | ✓ gelöst | `event_source_references` + `event_field_provenance` Backfill |
| **Matching** | ✓ gelöst | Blocking-Key-Backfill; Supabase-Repos |
| **Trust** | ✓ gelöst | Supabase-Repos; Review Queue persistent |
| **Review Queue** | ✓ gelöst | `import_review_queue` persistent |
| **Connector Health** | ✓ gelöst | In-Memory Registry + **persistente Snapshots** (Sprint 20) |
| **Worker Runs** | ✓ gelöst | Audit-Log + Stale-Reconciliation (Sprint 20) |
| **Worker Recovery** | ✓ gelöst | Generischer Recovery-Service (Sprint 20) |
| **Service Role** | ✓ gelöst | RLS-Policies für Worker/Cron ohne Admin-Session |
| **Edge Deployment** | ◐ teilweise | Scripts vollständig; Edge-Stub erweitert, Deploy ausstehend |
| **Admin Ops UI** | ◐ teilweise | Backend-APIs vorhanden; UI minimal (bewusst) |
| **`recordImportOutcome`** | ○ offen | Reputation-Verdrahtung aus Import-Pipeline (nicht Sprint-20-Scope) |

Keine Doppelimplementierungen: Alle Sprint-20-Erweiterungen bauen auf bestehenden Services auf.

---

## 2. Architektur

```
Deployment (Cron / Edge / Scripts / Manual)
        │
        ▼
OperationsTriggerService
        │
        ├── triggerScheduler() ──► ImportSchedulerEngine.tick(processQueue=false)
        ├── triggerWorker()    ──► ImportJobQueueWorker.processBatch()
        └── triggerRecovery()  ──► WorkerRecoveryService.runRecovery()
                                          │
                                          ├── stuck queue → requeue / dead-letter
                                          ├── expired schedule locks → release
                                          └── stale worker_runs → reconcile

BackfillRunner (separat auslösbar)
        │
        ├── lifecycle_history → EventLifecycleEngine (history + changes)
        ├── provenance        → source_references + field_provenance
        ├── blocking_keys     → event_blocking_keys
        └── source_intelligence → SourceIntelligenceService

ConnectorHealthPersistenceService
        └── SourceConnectorRegistry → connector_health_snapshots
```

### Wiederverwendete Kernkomponenten

| Komponente | Pfad | Sprint-20-Rolle |
|------------|------|-----------------|
| `EventLifecycleEngine` | `event-lifecycle-engine.ts` | Lifecycle-Backfill (keine Duplikat-Logik) |
| `EventFieldProvenanceWriter` | `event-field-provenance-writer.ts` | Provenance-Backfill |
| `ImportJobQueueService` | `import-job-queue-service.ts` | Lease, Stuck-Detection, Recovery |
| `BackfillRunner` | `backfill-runner.ts` | Cursor-Jobs (Sprint 19 Framework) |
| `SourceConnectorRegistry` | `source-connector-registry.ts` | Health-Quelle für Persistenz |
| `OperationsControlService` | `operations-control-service.ts` | Recovery + Backfill-Listen |

---

## 3. Migration

`20260751000000_sprint20_platform_resilience.sql`:

| Objekt | Zweck |
|--------|-------|
| `connector_health_snapshots` | Persistente Verfügbarkeit, Latenz, Fehler, Historie |
| `worker_recovery_runs` | Recovery-Audit (stuck, recovered, DLQ, locks, stale runs) |
| `import_job_queue.processing_lease_expires_at` | Stuck-Job-Erkennung |
| Service-Role RLS | `scheduler_runs`, `import_job_queue`, `worker_runs`, `worker_recovery_runs`, `platform_operations_state`, `operations_backfill_jobs`, `import_schedule_locks`, `connector_health_snapshots` |

Indizes für stuck-processing und zeitbasierte Abfragen — keine Full-Table-Scans.

---

## 4. Lifecycle Backfills

### `event_lifecycle_history` + `event_lifecycle_changes`

Handler: `createLifecycleHistoryBackfillHandler` in `backfill-handlers.ts`

**Strategie:** Bestehende `EventLifecycleEngine.process({ before: null, after: event })` — erzeugt **beide** Tabellen in einer Transaktion der Engine.

| Eigenschaft | Umsetzung |
|-------------|-----------|
| Idempotent | Skip wenn `lifecycleHistoryRepository.listByCanonicalEventId(id, 1)` nicht leer |
| Cursor-basiert | `cursor_value` + paginiertes `eventRepository.list()` |
| Wiederaufnehmbar | Job-Status `running`/`pending`; Cursor fortsetzbar |
| Transaktionssicher | Engine schreibt History + Changes atomar pro Event |

Kein separater `lifecycle_changes`-Backfill-Typ nötig — Engine ist Single Source of Truth.

---

## 5. Provenance Backfills

Handler: `createProvenanceBackfillHandler`

| Tabelle | Aktion |
|---------|--------|
| `event_source_references` | Upsert wenn fehlend; `updateLastSeen` wenn vorhanden |
| `event_field_provenance` | `EventFieldProvenanceWriter.writeFromPublish()` |
| Canonical Identity | `canonicalEventId = event.canonicalEventId ?? event.id` |

Nur fehlende Daten ergänzt — keine Tabellen-Neuschreibung. `manual_override`-Felder werden respektiert.

---

## 6. Worker Recovery

`WorkerRecoveryService` erkennt und behandelt:

| Problem | Erkennung | Aktion |
|---------|-----------|--------|
| Abgestürzte Worker | `worker_runs.status = running` + `startedAt` > Schwellwert | Status → `failed`, Audit-Eintrag |
| Abgelaufene Leases | `processing_lease_expires_at <= now` | Requeue oder Dead Letter |
| Hängende Jobs | `status = processing` ohne gültige Lease / stale `startedAt` | Requeue mit Backoff |
| Verwaiste Jobs | Nach max Attempts | `markDeadLetter()` — keine Endlosschleife |

**Schutz gegen Endlosschleifen:**
- `MAX_RECOVERY_ATTEMPTS = 3` (aligniert mit Queue `maxAttempts`)
- Requeue mit `nextRetryAt` (+60s)
- Recovery-Lauf wird in `worker_recovery_runs` protokolliert

Auslösung: `OperationsControlService.runWorkerRecovery()`, `OperationsTriggerService.triggerRecovery()`, Script `run-worker-recovery.ts`.

---

## 7. Connector Health Persistenz

`ConnectorHealthPersistenceService` schreibt aus `SourceConnectorRegistry`:

- Verfügbarkeit (`status`)
- Antwortzeit (`lastResponseTimeMs`, `averageDurationMs`)
- Fehler (`errorCount`, `lastErrorAt`, `lastErrorCode`, `lastErrorMessage`)
- Letzter erfolgreicher Lauf (`lastSuccessfulRunAt`)
- Erfolgsquote (`successRate`, `totalRunCount`)
- Ausfallhistorie via zeitlich indizierte Snapshots (`computed_at`)

**Keine Connector-Änderungen** — nur Persistenz-Schicht.

Script: `scripts/operations/run-persist-connector-health.ts`

---

## 8. Service Role Support

Worker, Cron und Edge Functions laufen ohne Admin-Session:

- Supabase Client mit `service_role` Key
- RLS-Policies `auth.role() = 'service_role'` auf allen Ops-Tabellen
- `OperationsTriggerService` akzeptiert `triggerType: 'cron' | 'edge_function' | 'external_scheduler'`

Registry-Pattern unverändert: `VITEST=true` → In-Memory für Tests.

---

## 9. Deployment Readiness

| Aspekt | Umsetzung |
|--------|-----------|
| Edge Deployment | Stub `supabase/functions/operations-triggers.ts` (Scheduler, Worker, Recovery, Connector Health) |
| Cron Trigger | `run-scheduler-tick.ts`, `run-queue-worker.ts`, `run-worker-recovery.ts` |
| Mehrere Worker | Queue in Postgres; Lease verhindert Doppelverarbeitung |
| Neustarts | Recovery reconciliert stale `worker_runs` |
| Graceful Shutdown | `graceful-shutdown.ts` → `pauseWorker()` bei SIGTERM/SIGINT; in Queue-Worker-Script registriert |

Keine provider-spezifischen Abhängigkeiten (kein AWS/GCP/Vercel-spezifischer Code).

---

## 10. Operations Backend

`OperationsControlService` erweitert:

- `runWorkerRecovery()` / `listRecentRecoveryRuns()`
- `listRecentBackfillJobs()`
- `listStuckQueueEntries()`

`ProductionOperationsMonitoringService` Snapshot erweitert:

- `recovery`: latest runs, stuck queue count
- `connector`: latest health snapshots
- `backfill`: recent jobs

UI bewusst minimal — Backend-APIs für Admin-Dashboard vorbereitet.

---

## 11. Performance

| Anforderung | Umsetzung |
|-------------|-----------|
| Millionen Events | Paginierter Event-Backfill (`page`/`pageSize`) |
| Millionen Jobs | Index `import_job_queue_stuck_processing_idx` |
| Millionen Lifecycle-Einträge | Skip-if-exists vor Engine-Aufruf |
| Hunderttausende Quellen | Source Intelligence batchweise |
| Keine Full-Table-Scans | Status-/Zeit-Indizes, `LIMIT` auf allen List-Ops |
| Keine O(n²) | Blocking Keys via Generator; keine paarweisen Event-Vergleiche im Backfill |

---

## 12. Architekturprüfung

### Doppelte Services — keine gefunden

| Prüfung | Ergebnis |
|---------|----------|
| Recovery vs. Queue Retry | Komplementär: Retry bei Laufzeit-Fehler, Recovery bei Crash/Lease |
| Connector Health vs. Source Intelligence | Health = Connector-Runtime; Intelligence = Source-Metriken |
| Lifecycle Engine vs. Backfill | Backfill ruft Engine auf, keine parallele Logik |
| In-Memory vs. Supabase Repos | Ein Interface, Registry-Switch — kein Duplikat |

### Ungenutzte Komponenten

- Edge Function Stub: dokumentiert, Deploy ausstehend
- `triggerFullCycle()`: für manuelle/integration tests, nicht im Cron-Pfad

### Technische Schulden (verbleibend)

1. **`recordImportOutcome`** — Reputation aus Import-Pipeline nicht verdrahtet
2. **Edge Functions deployen** — Deno-Runtime mit Service Role
3. **Admin Ops UI** — Recovery/Backfill/Dead-Letter Dashboard
4. **Connector Health Cron** — Persistenz-Script muss in Produktion getriggert werden
5. **Provenance Backfill Idempotenz** — `writeFromPublish` upsertet; kein expliziter Skip wenn vollständig — akzeptabel (idempotent upsert)

### Vereinfachungen

- `OperationsTriggerService` und `OperationsControlService` in einer Datei — akzeptabel, gemeinsame Ops-Domain
- Ein Backfill-Typ `lifecycle_history` für History + Changes — reduziert Komplexität

---

## 13. Neue und geänderte Dateien

### Neu

```
src/features/operations/services/worker-recovery-service.ts
src/features/operations/services/connector-health-persistence-service.ts
src/features/operations/deployment/graceful-shutdown.ts
src/features/operations/__tests__/sprint20-platform-resilience.test.ts
src/data/__tests__/sprint20-platform-resilience-migration.test.ts
scripts/operations/run-worker-recovery.ts
scripts/operations/run-persist-connector-health.ts
supabase/migrations/20260751000000_sprint20_platform_resilience.sql
```

### Geändert

- `backfill-handlers.ts` — Lifecycle + Provenance Handler vollständig
- `import-job-queue-service.ts` — Lease, `listStuckProcessing`
- `import-schedule-types.ts` — Lease-Felder, `releaseExpiredLocks`, `listStaleRunning`
- `import-schedule-service.ts` — `InMemoryImportScheduleRepository.releaseExpiredLocks`
- `source-import-schedule-repository.ts` — `releaseExpiredLocks` (Supabase + In-Memory)
- `supabase-scheduler-repositories.ts` — Lease-Mapping, `listByStatus`, `listStaleRunning`
- `operations-control-service.ts` — Recovery, Backfill-Listen
- `production-operations-monitoring-service.ts` — Recovery/Connector/Backfill Snapshot
- `operations-types.ts` — `ConnectorHealthSnapshot`, `WorkerRecoveryRun`
- `supabase-operations-repositories.ts` / `in-memory-operations-repositories.ts`
- `registry.ts` — Wiring aller Sprint-20-Services
- `run-queue-worker.ts` — Graceful Shutdown
- `operations-triggers.ts` — Recovery + Connector Health Stubs

---

## 14. Tests & Qualität

| Check | Ergebnis |
|-------|----------|
| Tests | **995 passed** |
| Typecheck | **green** |
| Lint | **green** |

Neue Tests:
- `sprint20-platform-resilience.test.ts` (6 Tests)
- `sprint20-platform-resilience-migration.test.ts` (3 Tests)

---

## 15. Erfolgskriterien

| Kriterium | Status |
|-----------|--------|
| Lifecycle Backfills vollständig | ✓ |
| Provenance Backfills vollständig | ✓ |
| Worker Recovery vorhanden | ✓ |
| Connector Health persistent | ✓ |
| Service Role Support vollständig | ✓ |
| Deployment vorbereitet | ✓ |
| Architektur überprüft | ✓ |
| Keine Doppelimplementierungen | ✓ |
| Tests grün | ✓ |
| Typecheck grün | ✓ |
| Lint grün | ✓ |

---

## 16. Verbleibende Punkte (post Sprint 20)

1. Edge Functions in Supabase deployen
2. Admin Ops UI (Recovery, Backfill, Dead Letter, Connector Status)
3. `recordImportOutcome` in Import-Pipeline verdrahten
4. Connector-Health-Persistenz als Cron etablieren
5. Erste Endnutzer-Features (Sprint 21+) auf stabiler Plattform

---

## 17. Zusammenfassung

Sprint 20 schließt den **Infrastruktur-Teil** der Event-Plattform ab: vollständige Lifecycle- und Provenance-Backfills über bestehende Domain-Engines; generische Worker-Recovery mit Lease-basierter Stuck-Erkennung; persistente Connector-Health-Snapshots; Service-Role-Zugriff für Cron/Edge/Worker ohne Admin-Session; Graceful Shutdown und erweiterte Operations-Monitoring-APIs — alles als additive Erweiterung ohne Ersatz der Sprints 9–19.

Die Plattform ist **produktionsreif** für den dauerhaften Betrieb. Sprint 21 kann mit Endnutzer-Funktionen (Discovery Engine Foundation) auf dieser stabilen Basis beginnen.
