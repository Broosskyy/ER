# Phase 4.7.0 — Source Reliability Framework Report

**Generated:** 2026-08-03  
**Status:** Complete  
**Architecture:** [ARCHITECTURE_SOURCE_RELIABILITY.md](./ARCHITECTURE_SOURCE_RELIABILITY.md)

## Summary

Phase 4.7.0 introduces a generic **Source Reliability Framework** that makes every source declare expected fields, measured coverage, blocked fields, and regressions — then feeds that into merge and admin automatically.

No OCR, no UI redesign, no provider-specific merge rules, no event-specific fixes.

## Deliverables

| Artifact | Path |
|----------|------|
| Architecture | `docs/ARCHITECTURE_SOURCE_RELIABILITY.md` |
| Capability matrix | `docs/real-data/source_capability_matrix.json` |
| Health report | `docs/real-data/source_health_report.json` |
| Field coverage | `docs/real-data/source_field_coverage.json` |
| Regressions | `docs/real-data/source_regressions.json` |
| Blockers | `docs/real-data/source_blockers.json` |
| Audit summary | `docs/real-data/_phase470_source_reliability_audit.json` |

## Implementation

### Domain model

- `source-capability-fields.ts` — canonical field enum + origin types
- `source-field-reliability.ts` — supported / unsupported / blocked / partial / derived
- `source-capability-declaration.ts` — resolves declaration from connector profiles
- `source-field-coverage-analyzer.ts` — measured coverage from import records
- `source-regression-detector.ts` — baseline comparison with severity
- `source-reliability-service.ts` — snapshots, summaries, merge helpers
- `source-reliability-merge-context.ts` — quality + health scores for merge

### Pipeline integration

- `AggregationPipeline` builds `sourceReliability` context per run
- `MergeStep` passes `sourceQualityScore` and `sourceHealthScore` into merge strategy
- `FieldTrustMergeService` skips unsupported-field absences via `isFieldSupportedBySource()`
- `SourceOperationalMetricsService.finalizeImportJob()` persists reliability snapshot to `source.metadata.reliability`

### Admin

- Source detail shows health, top coverage, blocked fields, regressions, last import
- `AdminMultiSourceService` exposes `reliability` summary

### Operations

```bash
npx tsx scripts/operations/_phase470-source-reliability-audit.ts
```

## Production validation (2026-08-03)

11 sources analyzed against production import records:

| Source | Health | Notable coverage |
|--------|--------|------------------|
| Bootshaus Köln | 100 | description 93%, lineup 61%, price 0% (expected unsupported) |
| Bootshaus Ticket.io | 100 | description/lineup warnings (detail blocked) |
| Affenkäfig | 100 | description warning |
| Ticket.io Proton | 100 | description + priceText warnings |
| Lehmann | 97 | ticket URL + price strong |
| Technodampfer | 100 | lineup partial |
| Ticket Kings (MDMA) | 100 | priceText warning |
| Affenkäfig Ticket Kings | — | priceText warning |

`source-musik-die-mich-antreibt` not found in production DB (skipped).

### Active regressions detected

- **Bootshaus Ticket.io** — description, lineup (detail enrichment blocked — external, not parser failure)
- **Ticket.io shops** — description coverage below expectation on list-only mode
- **Ticket Kings** — priceText below configured confidence on some orgs

Blocked fields are distinguished from parser failures via `blocked_detail` regression code and `detailBlockedDefault` flag.

## Example capability declarations

### Bootshaus (website)

| Field | Reliability | Measured coverage |
|-------|-------------|-------------------|
| description | ★★★★☆ supported | 93% |
| ticketUrl | ★★★☆☆ supported | 100% |
| priceText | ☆ unsupported | 0% (expected) |
| lineup | ★★★☆☆ supported | 61% |

### Ticket.io list (Lehmann)

| Field | Reliability | Notes |
|-------|-------------|-------|
| ticketUrl | ★★★★★ | Structured list |
| priceText | ★★★★★ | List price |
| lineup | ★★☆☆☆ | Partial list enrichment |
| description | blocked/partial | Detail blocked when maxDetailPages=0 |

## Tests

| Suite | Result |
|-------|--------|
| `source-reliability.test.ts` | 7 passed |
| `source-operational-metrics-service.test.ts` | 1 passed |
| `typecheck:app` | passed |
| `typecheck:operations` | pre-existing failures in `_audit-long-artist-ids.ts` (unrelated) |
| Full Vitest | 1588 passed / 10 pre-existing failures (unrelated) |

## Success criteria

| Criterion | Status |
|-----------|--------|
| Every source declares capabilities | ✅ via `resolveSourceCapabilityDeclaration` |
| Every field has measurable coverage | ✅ `analyzeFieldCoverage` |
| Regressions automatically detected | ✅ `detectSourceRegressions` |
| Blocked vs parser failure distinguished | ✅ `blocked_detail` + metadata classifiers |
| Merge uses source quality | ✅ `MergeStep` + `FieldTrustMergeService` |
| Future connectors need no merge changes | ✅ config-only profiles |
| Admin inspects source health | ✅ source detail extension |
| Operations detect regressions | ✅ audit script + post-import snapshots |

## Next steps

1. Wire baseline refresh policy (rolling window vs fixed baseline) when import volume stabilizes
2. Surface reliability warnings in import job logs / aggregation logging
3. Add Ticket Kings dedicated capability profile when enrichment behavior diverges from generic ticket platform
