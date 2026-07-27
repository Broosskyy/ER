# Source Registry Model

## Purpose

Central metadata for hundreds to thousands of acquisition sources with stable identity, sync metrics, and connector configuration (no plaintext credentials).

## Core type

`SourceRegistryEntry` in `src/features/sources/domain/source-registry.ts`

## Key fields

| Field | Description |
|-------|-------------|
| `stableKey` | Unique human-stable identifier |
| `sourceType` / `connectorType` | Classification for merge authority |
| `lifecycle status` | `draft` … `blocked` |
| `priority` / `trustLevel` / `qualityTier` | Merge and discovery inputs |
| `syncStrategy` / `syncIntervalMinutes` | Prepared scheduling |
| `lastSuccessfulSyncAt` / `consecutiveFailureCount` | Health inputs |
| `duplicateRate` / `errorRate` / `updateRate` | Quality and health metrics |
| `connectorConfig` / `authenticationConfig` | Structured config only |

## Persistence

Migration `20260740000000_source_management_scale_foundation.sql` extends `public.sources` and adds `source_groups`, `source_relations`, `source_status_history`.

## Mapping

`mapSourceRecordToRegistryEntry()` maps existing `SourceRecord` rows without breaking IDs.
