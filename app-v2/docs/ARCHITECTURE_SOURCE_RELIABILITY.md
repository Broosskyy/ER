# Source Reliability Architecture (Phase 4.7.0)

## Purpose

Phase 4.6.x solved multi-origin architecture, field trust merge, structured lineup, and quality gates. Remaining failures are **source quality** problems: missing fields, blocked detail pages, parser regressions, and incorrect merge expectations.

The Source Reliability Framework makes every source **declare** what it can provide, measures what it **actually** provides, and feeds that into merge and admin automatically — without provider-specific merge rules or event-specific exceptions.

## Core model

### Source capability declaration

Each `SourceRecord` resolves to a `SourceCapabilityDeclaration` via `resolveSourceCapabilityDeclaration()`:

- **Identity**: `sourceId`, `displayName`, `connectorKey`, `originType`
- **Expected fields**: canonical field list from `SOURCE_CAPABILITY_FIELDS`
- **Field reliability**: per-field `status` + `confidence` (1–5 stars)

Field reliability statuses:

| Status | Meaning |
|--------|---------|
| `supported` | Source is expected to supply this field reliably |
| `unsupported` | Source never supplies this field — absence is normal |
| `blocked` | External blocker (e.g. detail fetch blocked) |
| `partial` | Sometimes available, low confidence |
| `derived` | Computed from other fields, not raw extraction |

Configuration lives in connector capability profiles (`connector-field-coverage.ts`), not hardcoded per event.

### Field coverage

`analyzeFieldCoverage()` computes measured coverage % per field from import record `normalized_payload` snapshots.

### Regression detection

`detectSourceRegressions()` compares current coverage to baseline stored in `source.metadata.reliability`:

- Flags **coverage drops** only for fields the source is expected to supply
- Does **not** treat missing `priceText` as regression when Bootshaus never supplies price
- Distinguishes **blocked** fields from parser failures
- Emits `warning` / `critical` severity

### Import health snapshot

After each import finalize (`SourceOperationalMetricsService.finalizeImportJob`):

1. Load job import records
2. Build `SourceImportHealthSnapshot` (events, coverage, regressions, blockers)
3. Persist to `source.metadata.reliability`

## Merge integration

`buildSourceMergeReliabilityContext()` supplies:

- `sourceQualityScore` — connector quality from capability + health
- `sourceHealthScore` — operational health from import history

`MergeStep` passes these into `priorityBasedMergeStrategy.effectiveFieldPriority()`.

`FieldTrustMergeService` uses `isFieldSupportedBySource()` so empty values from unsupported fields do not trigger quality-gate regressions.

## Admin

Source detail (`/admin/sources/[id]`) shows:

- Health + quality scores
- Top field coverage with configured reliability stars
- Blocked fields
- Active regressions
- Last successful import

No UI redesign — extends existing Multi-Source Status card.

## Operations

`scripts/operations/_phase470-source-reliability-audit.ts` generates:

- `docs/real-data/source_capability_matrix.json`
- `docs/real-data/source_health_report.json`
- `docs/real-data/source_field_coverage.json`
- `docs/real-data/source_regressions.json`
- `docs/real-data/source_blockers.json`

## Future connector onboarding

New connectors declare capabilities in `buildConnectorCapabilityProfile()` only:

1. Add connector profile with `fieldCoverage` ratings
2. Set `detailCapability` and `lostFields`
3. No merge or pipeline changes required

Supported future platforms: Resident Advisor, Shotgun, Dice, Eventbrite, Pretix, Eventix, Universe, Luma, Meetup, social/flyer sources, etc.

## Module map

| Module | Responsibility |
|--------|----------------|
| `source-capability-fields.ts` | Canonical field enum + origin types |
| `source-field-reliability.ts` | Reliability status types |
| `source-capability-declaration.ts` | Resolve declaration from source |
| `source-field-coverage-analyzer.ts` | Measured coverage % |
| `source-regression-detector.ts` | Baseline comparison + warnings |
| `source-reliability-service.ts` | Snapshots, summaries, merge helpers |
| `source-reliability-merge-context.ts` | Merge pipeline scores |
| `connector-field-coverage.ts` | Connector configuration profiles |

## Design constraints

- No OCR
- No provider-specific merge rules
- No event-specific fixes
- No hardcoded production exceptions
- Capabilities are configuration
