# Scheduling Architecture

Sprint 15 implements the production scheduler on top of the Phase 2 contract.

## Components

| Layer | Service | Responsibility |
|-------|---------|----------------|
| Tick | `ImportSchedulerEngine` | Due sources, locks, enqueue only |
| Queue | `ImportJobQueueService` | `import_job_queue` persistence |
| Process | `ImportJobQueueProcessor` | Calls `ImportAggregationService.executeExistingJob` |
| Schedule | `DefaultImportScheduleService` | Intervals, backoff, skip rules |
| State | `SourceBackedImportScheduleRepository` | `sources.schedule_*` + locks |
| Monitor | `ImportSchedulerMonitoringService` | Run history, queue depth |
| Admin | `ImportSchedulerAdminService` | Preset, maintenance, manual tick |

## Rule

The scheduler never runs imports directly. It creates `import_jobs` + queue entries; the processor runs the existing aggregation + publish pipeline.

## Deployment

Wire an external cron or Supabase scheduled function to:

```ts
import { importSchedulerEngine } from '@/data/repositories/registry';
await importSchedulerEngine.tick();
```
