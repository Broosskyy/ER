# Safe Repair Apply Schema Design

This document describes the read-only repair foundation delivered in Sprint 4.3.4+ and the additive schema required before any production apply path can be enabled.

## Current State (Read-Only)

The official entry point is `scripts/operations/repair-events.ts`.

Supported modes:

| Mode | Flag | Behavior |
|------|------|----------|
| Preflight | default | Read-only dataset scan, active-job check, totals report |
| Plan | `--plan` | Build signed repair plan artifact when changes exist |
| Validate | `--validate-plan <path>` | Verify checksum, environment, schema watermark, freshness |
| Post-audit | `--post-audit` | Legacy JSON audit report writer |

Hard rejections:

- `--apply`
- `--confirm-production`

Apply is compile-time absent from `src/features/operations/repair/*`.

## Repair Plan Artifact

Artifacts are written to:

```text
docs/real-data/repair-plans/<planId>.json
```

Properties:

- immutable (`wx` write — no overwrite)
- `planId` — unique identifier derived from deterministic change hash
- `changeChecksum` — hash of sorted change set
- `checksum` — hash of full deterministic plan body
- `environment` / `projectId` — Supabase project identity
- `schemaWatermark` — latest migration filename
- `connectorVersions` / `parserVersions` — code version snapshot
- `recordSnapshots[]` — per-event fingerprint + import freshness
- `changes[]` — proposed, blocked, and review-required entries
- `summary` — `proposedCount`, `blockedCount`, `reviewRequiredCount`

### Safety Classification

Each change carries one of:

- `safe_read_only_plan`
- `review_required`
- `blocked_manual_lock`
- `blocked_missing_provenance`
- `blocked_schema_gap`
- `unsupported`

Manual-lock and missing-provenance states block future apply for the affected field.

## Safety Matrix

`repair-safety-matrix.ts` defines machine-readable policy for all modeled canonical fields:

- title, description, schedule, venue, organizer, lineup, ticket, price, image, geography, cache

Rules per field:

- `provenanceRequired`
- `manualLockBlocksRepair`
- `allowWithoutProvenanceWhenEmpty`

## Validator Result Model

`RepairPlanValidationResult`:

```ts
{
  valid: boolean;
  planId: string;
  environment: string;
  projectId: string;
  checkedAt: string;
  issues: Array<{
    code:
      | 'checksum_invalid'
      | 'environment_mismatch'
      | 'schema_watermark_stale'
      | 'record_fingerprint_stale'
      | 'import_record_stale'
      | 'active_import_jobs'
      | 'manual_lock_blocked'
      | 'missing_provenance_blocked'
      | 'unsupported_safety_state';
    message: string;
    entityId?: string;
    fieldOrRelationship?: string;
  }>;
}
```

## Legacy Script Policy

The following scripts are inventoried as legacy-unsafe:

- `_sprint434-historical-production-repair.ts`
- `_sprint431-ticket-io-production-repair.ts`
- `_sprint431-apply-production-fixes.ts`
- `_sprint36-republish-queued.ts`
- `_bootshaus-trust-reevaluation-repair.ts`
- `_bootshaus-canonical-entity-repair-apply.ts`
- `_bootshaus-production-closure-apply.ts`

Each now calls `assertLegacyRepairScriptAllowed()` and requires either:

- `LEGACY_REPAIR_SCRIPT_ACK=1`, or
- `--i-understand-legacy-risk`

## Future Apply Schema (Not Implemented)

Before apply can be enabled, add:

### `repair_runs`

- `id`, `plan_id`, `plan_checksum`, `status`, `lease_owner`, `lease_expires_at`
- `started_at`, `finished_at`, `actor`, `environment`, `project_id`

### `repair_run_changes`

- `run_id`, `entity_type`, `entity_id`, `field_or_relationship`
- `before_fingerprint`, `after_fingerprint`, `safety`, `applied`, `blocked_reason`

### `repair_manual_locks`

- `canonical_event_id`, `field_path`, `locked_by`, `locked_at`, `reason`

### `repair_change_ledger`

- append-only mutation log with reversible metadata

### Apply Gate Requirements

1. Validated plan artifact less than freshness TTL
2. Exclusive repair-run lease
3. No active import jobs on affected sources
4. Zero `blocked_*` changes in plan
5. Explicit `--apply --confirm-production`
6. Post-apply audit and cache invalidation record

## Remaining Blockers

- No `repair_runs` / lease tables
- No durable change ledger
- No apply executor module
- No post-apply cache invalidation hook in repair orchestrator
- Manual-lock schema not yet enforced at DB layer for repair apply

Until these exist, production mutation remains structurally impossible through the official repair path.
