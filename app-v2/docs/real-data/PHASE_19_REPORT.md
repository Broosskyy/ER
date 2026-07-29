# Sprint 19 — Production Operations & Source Intelligence Abschlussbericht

## 1. Analyse der bestehenden Architektur

### Vorhandene Komponenten (wiederverwendet)

| Komponente | Pfad | Sprint 19 Rolle |
|------------|------|-----------------|
| `ImportSchedulerEngine` | `import-scheduler-engine.ts` | Scheduler — nur Enqueue (getrennt vom Worker) |
| `ImportJobQueueProcessor` | `import-job-queue-processor.ts` | Worker-Verarbeitung + Retry/DLQ |
| `SupabaseImportJobQueueRepository` | `supabase-scheduler-repositories.ts` | Queue-Persistenz (erweitert) |
| `ImportSchedulerMonitoringService` | `import-scheduler-monitoring.ts` | Basis-Monitoring |
| `ImportSchedulerAdminService` | `import-scheduler-admin-service.ts` | Admin-Ops (bestehend) |
| `resolveImportRetry` | `import-retry-policy.ts` | Queue-Retry-Logik (jetzt verdrahtet) |
| `source-health-resolver` | `source-health-resolver.ts` | Basis für Source Intelligence |
| Trust/Matching/Lifecycle DB-Schema | S16–S18 Migrationen | Persistenz-Ziel |

### Vor Sprint 19 fehlend

- In-Memory-Repos in Produktion (S16–S18)
- Scheduler/Worker-Kopplung in `tick()`
- Keine Deployment-Trigger (Cron/Edge/Scripts)
- Keine Source Intelligence Persistenz
- Kein Backfill-Framework
- Keine Operations Controls (Pause/Resume/Maintenance global)
- Kein Dead-Letter-Vorbereitung

---

## 2. Architektur

```
Deployment Triggers (Cron / Edge / Scripts / Manual)
        │
        ▼
OperationsTriggerService
        │
        ├── triggerScheduler() → ImportSchedulerEngine.tick(processQueue=false)
        │     └── import_job_queue (enqueue only)
        │
        └── triggerWorker() → ImportJobQueueWorker.processBatch()
              └── ImportJobQueueProcessor → ImportAggregationService
```

### Worker-Trennung

- **Scheduler:** scannt fällige Sources, enqueued Jobs — verarbeitet **nicht** mehr automatisch
- **Worker:** unabhängiger `ImportJobQueueWorker` mit eigenem Audit-Log (`worker_runs`)
- **Rückwärtskompatibel:** `tick({ processQueue: true })` für Tests/Legacy

### Operations Controls

`OperationsControlService`:
- `pauseWorker()` / `resumeWorker()`
- `pauseScheduler()` / `resumeScheduler()`
- `setGlobalMaintenanceMode()`
- `retryQueueEntry()` / `listDeadLetterEntries()`

Zustand in `platform_operations_state` (Singleton).

---

## 3. Persistente Repositories

Alle Sprint 16–18 In-Memory-Repos durch Supabase-Implementierungen ersetzt (Prod), Vitest nutzt weiterhin In-Memory:

| Repository | Supabase-Datei | Tabelle |
|------------|----------------|---------|
| TrustQualityRule | `supabase-trust-quality-repositories.ts` | `trust_quality_rules` |
| ImportReviewQueue | `supabase-trust-quality-repositories.ts` | `import_review_queue` |
| SourceReputation | `supabase-trust-quality-repositories.ts` | `source_reputation_events` |
| EventBlockingKey | `supabase-matching-repositories.ts` | `event_blocking_keys` |
| EventMatchEvaluation | `supabase-matching-repositories.ts` | `event_match_evaluations` |
| EventMergeCandidate | `supabase-matching-repositories.ts` | `event_merge_candidates` |
| EventLifecycleHistory | `supabase-lifecycle-repositories.ts` | `event_lifecycle_history` |
| EventLifecycleChange | `supabase-lifecycle-repositories.ts` | `event_lifecycle_changes` |

Registry-Pattern: `useInMemoryPersistence = process.env.VITEST === 'true'`

Gemeinsame Query-Utilities: `src/data/supabase/supabase-query-client.ts`

---

## 4. Migration

`20260750000000_sprint19_production_operations.sql`:

| Tabelle | Zweck |
|---------|-------|
| `platform_operations_state` | Worker/Scheduler Pause, Global Maintenance |
| `operations_backfill_jobs` | Idempotente Backfill-Verfolgung |
| `source_intelligence_snapshots` | Objektive Source-Metriken |
| `worker_runs` | Worker-Audit-Log |

Queue-Erweiterungen auf `import_job_queue`:
- `attempt_count`, `max_attempts`, `next_retry_at`, `dead_lettered_at`

---

## 5. Source Intelligence

`SourceIntelligenceService` berechnet pro Source:

| Metrik | Quelle |
|--------|--------|
| Verfügbarkeit | enabled, maintenance, backoff, consecutive failures |
| Erfolgsquote | `totalImportCount`, `errorRate` |
| Durchschnittliche Importdauer | `averageDurationMs` |
| Fehlerquote | `errorRate` |
| Letzte erfolgreiche Sync | Schedule-State / Source |
| Letzte Fehler | `lastSchedulerError` / `lastError` |
| Queue-Auslastung | `import_job_queue` (queued count) |
| Scheduler-Load | Queue-Depth-basiert |
| Review/Match/Lifecycle Counts | Review Queue, Match Evaluations, Lifecycle History |

Snapshots in `source_intelligence_snapshots` persistiert.

---

## 6. Monitoring

`ProductionOperationsMonitoringService` aggregiert:

- **Scheduler:** Runs, Queue Depth, Due Sources, Backoff, Paused
- **Worker:** Latest Runs, Dead Letter Count, Paused
- **Platform:** Global Maintenance Mode
- **Review:** Pending Count
- **Matching:** Pending Merge Candidates
- **Lifecycle:** Recent History Count

Erweitert `ImportSchedulerMonitoringService` ohne Ersatz.

---

## 7. Backfill-System

`BackfillRunner` + Handler-Registry:

| Typ | Handler | Status |
|-----|---------|--------|
| `blocking_keys` | Reindex via `blockingKeyDuplicateCandidateGenerator` | Implementiert |
| `source_intelligence` | Batch-Compute aller Sources | Implementiert |
| `lifecycle_history` | Framework bereit | Domain-Logik Sprint 20 |
| `provenance` | Framework bereit | Domain-Logik Sprint 20 |

Eigenschaften:
- Idempotent: kein zweiter aktiver Job pro Typ
- Cursor-basiert: `cursor_value` + `batch_size`
- Mehrfach ausführbar ohne Duplikate (Upsert-Pattern)

---

## 8. Queue Retry & Dead Letter

`ImportJobQueueProcessor` erweitert:
- Bei Fehler: `resolveImportRetry()` → Requeue mit `next_retry_at`
- Nach max Attempts: `markDeadLetter()` → `dead_lettered_at` gesetzt
- `OperationsControlService.retryQueueEntry()` für manuelles Replay

---

## 9. Deployment Trigger

| Trigger | Einstieg |
|---------|----------|
| Cron | `scripts/operations/run-scheduler-tick.ts` |
| Cron (Worker) | `scripts/operations/run-queue-worker.ts` |
| Edge Functions | Stub: `supabase/functions/operations-triggers.ts` |
| Manuell | `operationsTriggerService.triggerScheduler/Worker/FullCycle()` |

Keine provider-spezifischen Abhängigkeiten.

---

## 10. Neue Dateien

```
src/features/operations/
├── domain/operations-types.ts
├── repositories/
│   ├── supabase-operations-repositories.ts
│   └── in-memory-operations-repositories.ts
├── services/
│   ├── import-job-queue-worker.ts
│   ├── operations-control-service.ts
│   ├── source-intelligence-service.ts
│   └── production-operations-monitoring-service.ts
├── backfill/
│   ├── backfill-runner.ts
│   └── backfill-handlers.ts
└── __tests__/sprint19-production-operations.test.ts

src/data/supabase/supabase-query-client.ts
scripts/operations/run-scheduler-tick.ts
scripts/operations/run-queue-worker.ts
```

### Geänderte Dateien

- `registry.ts` — Supabase-Repos, Operations-Wiring
- `import-scheduler-engine.ts` — `processQueue` Option
- `import-schedule-types.ts` — Retry-Felder, WorkerRun
- `import-job-queue-processor.ts` — Retry/DLQ
- `import-job-queue-service.ts` — Requeue/Retry-APIs
- `supabase-scheduler-repositories.ts` — Retry/DLQ/WorkerRun

---

## 11. Performance & Skalierung

| Anforderung | Umsetzung |
|-------------|-----------|
| 100k+ Sources | Cursor-basierte Backfills, paginierte Intelligence |
| Millionen Events | Blocking-Key-Backfill batchweise |
| Mehrere Worker | Worker unabhängig vom Scheduler, `worker_runs` Audit |
| Horizontale Skalierung | Queue in Postgres, Worker via separater Trigger |
| Keine O(n²) | Delta/Index-basierte Queries, Limits auf allen List-Ops |

---

## 12. Tests & Qualität

| Check | Ergebnis |
|-------|----------|
| Tests | **986 passed** |
| Typecheck | **green** |
| Lint | **green** |

Neue Tests:
- `sprint19-production-operations.test.ts` (6 Tests)
- `sprint19-production-operations-migration.test.ts` (3 Tests)

---

## 13. Erfolgskriterien

| Kriterium | Status |
|-----------|--------|
| Persistente Repositories integriert | ✓ S16–S18 |
| Queue Worker getrennt | ✓ |
| Produktive Trigger vorbereitet | ✓ Scripts + Edge Stub |
| Source Intelligence vorhanden | ✓ |
| Monitoring erweitert | ✓ |
| Backfill-System vorbereitet | ✓ |
| Bestehende Architektur wiederverwendet | ✓ |
| Tests / Typecheck / Lint | ✓ |

---

## 14. Offene Punkte für Sprint 20

1. **Lifecycle/Provenance Backfill** — Domain-spezifische Batch-Logik
2. **Edge Functions deployen** — Deno-Runtime mit Service Role
3. **Stuck-Job Recovery** — `processing`-Einträge mit Lease-Timeout
4. **Admin Ops UI** — Pause/Resume, Dead Letter, Monitoring Dashboard
5. **Connector Health Persistenz** — Registry-Metriken in DB
6. **Global Scheduler Dashboard** — Cross-Source Ops-View
7. **Service Role RLS Policies** — Worker-Zugriff ohne Admin-Session
8. **`recordImportOutcome` verdrahten** — Reputation aus Import-Pipeline

---

## 15. Zusammenfassung

Sprint 19 macht die Event-Plattform **produktionsreif betreibbar**: persistente Repositories für Trust, Matching und Lifecycle; vollständige Trennung von Scheduler und Worker; objektive Source Intelligence; erweitertes Monitoring; idempotentes Backfill-Framework; Operations Controls und Deployment-Trigger — alles als Ergänzung zur bestehenden Import-, Publish-, Matching- und Lifecycle-Architektur.
