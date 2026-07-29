# Source Trust — Phase 2D Preparation

Data model and service layer for per-source trust and health metrics. **No automatic scoring** in this phase.

## Metrics (`SourceTrustMetrics`)

| Field | Source | Notes |
|-------|--------|-------|
| `trustScore` | `sources.trust_score` | Existing column |
| `healthScore` | optional / future | Prepared on type |
| `importSuccessRate` | computed | `totalValidEventCount / totalImportCount` |
| `duplicateRate` | `sources.duplicate_rate` | Mapped in source-mapper |
| `mergeRate` | `updateRate` fallback | Prepared; dedicated column TBD |
| `lastSuccessAt` | `sources.last_successful_sync_at` | Mapped |
| `lastFailureAt` | connector run logs (future) | Optional on type |
| `consecutiveFailures` | `sources.consecutive_failures` | Mapped |
| `averageEventQuality` | future aggregation | Optional |
| `averagePublishRate` | future aggregation | Optional |
| `totalImportCount` | source stats | Existing |
| `totalValidEventCount` | source stats | Existing |
| `errorRate` / `updateRate` | source stats | Existing |

## Service

`buildSourceTrustMetrics(input)` in `src/features/sources/domain/source-trust-metrics.ts` normalizes raw source record fields into `SourceTrustMetrics`. Does not mutate scores.

## Registry

`SourceRepository` / `source-mapper.ts` map DB columns to `SourceRecord`. Admin UI can consume `buildSourceTrustMetrics(sourceRecord)` when dashboards are extended.

## Out of Scope (Phase 2D)

- Automatic trust adjustment
- Scheduler-driven health checks
- Productive source onboarding
- Alerting on consecutive failures

## Tests

`phase-2d-domain-integration.test.ts` — `prepares source trust metrics without auto scoring`
