# Phase 4.8.6.6 — Generic Truth Pipeline Rollout

## Ziel

Generische Identity-, Ticket-, Content-, Genre-, Line-up-, Venue- und Consumer-Regeln laufen über den **echten Importpfad** (`ImportAggregationService` → `ImportEventPublishService` → `import-event-field-mapper`). Die sieben Regression-Events sind nur Fixtures — keine Event-ID-Sonderlogik in Produktionscode.

## Produktiver Datenfluss

```
run-scheduler-tick / run-queue-worker
  → ImportSchedulerEngine / ImportJobQueueProcessor
  → ImportAggregationService.executeExistingJob()
  → AggregationPipeline (fetch → normalize → validate → merge → review)
  → import_records upsert
  → ImportPublishOrchestratorService
  → PublishDecisionService
  → ImportEventPublishService.publishRecord()
      → buildImportPublishFieldPatch / writeCanonicalTicketFields
      → evaluateGenericTruthPublish (wenn Flag aktiv)
  → AdminEventRepository.save
  → Consumer: toEventDisplayModel / event-detail-view-model
```

**Orchestrierungspunkt:** `ImportAggregationService.executeExistingJob()` in `src/features/aggregation/services/import-aggregation-service.ts`.

**Publish-Merge:** `src/features/import/services/import-event-field-mapper.ts` (Ticket Writer, Description/Genre Resolver, Truth Dry-run).

## Vorherige Unterbrechung

- Phase 4.8.6 `unified-website-controlled-publish` existierte, war nicht im Haupt-Publish-Pfad verdrahtet.
- `genericSourceFieldTrustMerge` war optional, ohne zentrale Evidence-Bundle-Schicht.
- Shadow-Läufe liefen über Ops-Skripte, nicht über denselben Entry-Point wie reguläre Imports.

## Source-Evidence-Vertrag

`src/features/import/generic-truth-pipeline/source-evidence-contract.ts`

Connectors liefern `SourceEvidenceBundle` (identity, tickets, content, provenance, contamination). Entscheidungen über Merge, Consumer-Texte und Publish bleiben zentral in `publish-evaluation.ts`.

## Phase 4.8.6.6.2 — Live Connector Shadow

Read-only live acquisition via `GenericTruthLiveShadowRunner` + `AggregationPipeline` (kein `import_records`-Replay).

- Ops: `npx tsx scripts/operations/_phase48662-live-shadow-audit.ts`
- Artefakte: `docs/real-data/_phase48662_live_shadow_*.json`, `_phase48662_canary_plan.json`, `_phase48662_readiness.json`
- Feldgruppen-Eligibility: `field-group-eligibility.ts` + `publish-evaluation.ts`
- Canonical-Collision (Ticket-URL divergent): `canonical-identity-collision.ts`
- Typecheck: `src/types/expo-app-ambient.d.ts` (committed `/// <reference types="expo/types" />` — kein gitignored `expo-env.d.ts` nötig)

## Phase 4.8.6.6.3 — Restricted Canary Preview

- Quelle: `source-bootshaus-ticket-io`
- Canary: deterministisch 10 %, max. 3 Events, nur `tickets` + `cta_checkout`
- Ops: `npx tsx scripts/operations/_phase48663-canary-preview.ts`
- Artefakte: `_phase48663_canary_*.json`
- MDMA: `manual_collision_review_required` für All-Source-Rollout; blockiert Bootshaus-Ticket.io-Canary nicht


| Flag | Default |
|------|---------|
| `EXPO_PUBLIC_GENERIC_TRUTH_PIPELINE_ENABLED` | `false` |
| `EXPO_PUBLIC_GENERIC_TRUTH_PIPELINE_MODE` | `shadow` |
| `EXPO_PUBLIC_GENERIC_TRUTH_AUTO_PUBLISH_ENABLED` | `false` |

Steuerung über Source-Allowlist, Capabilities, Max-Events, Canary-Prozent, Feldgruppen — **keine Event-ID-Allowlists**.

## Geänderte Produktionsdateien (10)

1. `src/features/import/generic-truth-pipeline/source-evidence-contract.ts`
2. `src/features/import/generic-truth-pipeline/evidence-from-canonical.ts`
3. `src/features/import/generic-truth-pipeline/publish-evaluation.ts`
4. `src/features/import/generic-truth-pipeline/rollout.ts`
5. `src/features/import/generic-truth-pipeline/index.ts`
6. `src/features/import/generic-truth-pipeline/adapters/example-events-test-adapter.ts`
7. `src/core/config/env.ts`
8. `src/core/config/feature-flags.ts`
9. `src/features/import/services/import-event-field-mapper.ts`
10. `src/features/import/services/import-event-publish-service.ts`

## Shadow-Lauf

```bash
npx tsx scripts/operations/_phase4866-generic-shadow-audit.ts
```

Artefakte: `docs/real-data/_phase4866_shadow_*.json`, `_phase4866_rollout_readiness.json`.

## Rollout-Plan

1. **Canary 10%** — eine Quelle in Allowlist, `mode=controlled`, `CANARY_PERCENT=10`
2. **Cohort 50%** — erweiterte Allowlist, Conformance + Shadow ohne Fehler
3. **Alle Quellen** — `mode=automatic` nur für `exact`/`corroborated` Feldgruppen

## Migration Assessment

Keine Schema-Migration erforderlich. Provenance und Ticket-Felder nutzen bestehende Spalten. Persistenz von Checkout-Evidenz weiterhin über Assessment in Phase 48653 — kein Blocker für Code-Integration.

## Status

- `productionMutationsInThisRun: 0`
- `rolloutActivated: false`
- Flags default off — Legacy-Publish unverändert bis explizite Aktivierung
