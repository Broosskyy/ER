# Sprint 16 — Trust & Quality Engine Abschlussbericht

## 1. Analyse der bestehenden Architektur

### Bereits vorhanden (wiederverwendet, nicht neu gebaut)

| Komponente | Datei | Rolle in Trust & Quality |
|------------|-------|--------------------------|
| `PublishDecisionService` | `publish-decision-service.ts` | **Erweitert** — delegiert an Trust Engine, Legacy-Fallback bleibt |
| `ImportPublishOrchestratorService` | `import-publish-orchestrator-service.ts` | **Erweitert** — Review Queue + Reputation nach Entscheidung |
| `ImportEventPublishService` | `import-event-publish-service.ts` | Unverändert — eigentliche Veröffentlichung |
| `SourceQualityResolver` | `source-quality-resolver.ts` | Vollständigkeits-Score für Event Quality |
| `buildSourceTrustMetrics` | `source-trust-metrics.ts` | Basis-Metriken für Trust Score |
| `EventQualityResolver` | `event-quality-resolver.ts` | Bestehende Event-Qualitätslogik (parallel, nicht dupliziert) |
| `PublishReadinessResolver` | `publish-readiness-resolver.ts` | Publish-Readiness (unverändert) |
| `resolvePublishPolicy` | `publish-mode.ts` | Publish-Modi manual/auto/conditional |
| `matchingConfig` | `matching-config.ts` | Duplicate-Threshold |
| `ImportAggregationService` | `import-aggregation-service.ts` | Pipeline unverändert |
| `ImportSchedulerEngine` | Sprint 15 | Scheduler unverändert |
| `SourceRecord` / Mapper | `records.ts`, `source-mapper.ts` | `computedTrustScore`, `trustScoreUpdatedAt` |

### Vor Sprint 16 fehlend

- Keine regelbasierte Trust-Engine zwischen Import und Publish
- Keine generische Review Queue (nur `needs_review` Status auf Records)
- Kein persistierter Source-Reputation-Verlauf
- Keine konfigurierbaren Qualitätsregeln in der DB
- Publish-Entscheidungen nur über `publish_mode` + Legacy-Heuristiken

---

## 2. Neue Architektur

```
ImportPublishOrchestratorService.processJobRecords()
        │
        ▼
PublishDecisionService.evaluate() / decide()
        │
        ├── TrustPublishDecisionEngine
        │     ├── ImportRecordQualityEvaluator (Regeln + SourceQualityResolver)
        │     └── SourceTrustEngine (buildSourceTrustMetrics + Reputation)
        │
        └── Legacy decideLegacy() (Fallback ohne Trust-Wiring)
        │
        ▼
Entscheidung: publish | queue_for_review | skip
        │
        ├── auto_publish  → ImportEventPublishService.publishRecord()
        ├── review_required / hold → ImportReviewQueueService + status needs_review
        └── reject          → status rejected + skip
        │
        ▼
SourceReputationService.recordPublishDecision()
  → source_reputation_events + sources.computed_trust_score
```

### Designprinzipien

1. **Ergänzung, kein Ersatz** — Import-, Match- und Publish-Pipeline bleiben unverändert
2. **Regelbasiert** — keine KI, keine quellenspezifischen Sonderfälle
3. **Konfigurierbar** — Regeln und Schwellen in DB / Config, nicht als Magic Numbers im Code
4. **Entscheidungsmodell** — vier Trust-Entscheidungen, drei Publish-Aktionen (Mapping in `PublishDecisionService`)
5. **Skalierbar** — indexierte Tabellen, In-Memory-Repos für Tests, Worker-ready Queue

---

## 3. Trust-System

### `SourceTrustEngine`

Berechnet den **effektiven Trust Score** (0–100) aus:

- `computedTrustScore` oder manueller `trustScore` der Source
- `buildSourceTrustMetrics` (Fehlerrate, Duplikate, Import-Historie)
- Dynamische Faktoren: `high_error_rate`, `high_duplicate_rate`, `consecutive_failures`, `stable_import_history`

### Source Reputation

`SourceReputationService` wendet nach jeder Publish-Entscheidung Deltas an:

| Event | Delta (Default) |
|-------|-----------------|
| `publish_success` | +0.25 |
| `publish_queued` | −0.25 |
| `publish_rejected` | −1.0 |
| `import_success` | +0.5 |
| `import_failure` | −2.0 |
| `manual_correction` | −1.5 |
| `quality_improvement` | +0.75 |
| `quality_regression` | −0.75 |

Anpassungen in `trust-quality-config.ts` (`DEFAULT_TRUST_SCORE_ADJUSTMENTS`), nicht hardcoded in Services.

### DB-Erweiterung

- `sources.computed_trust_score`
- `sources.trust_score_updated_at`
- `source_reputation_events` (Audit-Trail)

---

## 4. Qualitätsmodell

### `ImportRecordQualityEvaluator`

Bewertet jedes `ImportRecord` anhand aktivierter `trust_quality_rules`:

| Regel | Kategorie | Impact |
|-------|-----------|--------|
| `required_title` | field_required | reject |
| `required_start_date` | field_required | reject |
| `invalid_start_date` | plausibility | reject |
| `missing_venue` | field_required | review_required |
| `missing_city` | field_required | review_required |
| `missing_organizer` | field_required | hold |
| `missing_image` | field_required | hold |
| `invalid_ticket_url` | url | review_required |
| `duplicate_threshold` | duplicate | review_required |
| `low_extraction_confidence` | trust | hold |
| `validation_errors` | plausibility | reject |

**Quality Score** = `SourceQualityResolver`-Vollständigkeit minus Regel-Penalties (blocking −25, warning −10, info −4).

**Tier**: A ≥85, B ≥70, C ≥50, D <50.

### Schwellen (`trust-quality-config.ts`)

| Schwellenwert | Default |
|---------------|---------|
| `minTrustScore` | 70 |
| `minQualityScoreForAutoPublish` | 65 |
| `rejectTrustScore` | 25 |
| `holdTrustScore` | 45 |
| `minExtractionConfidence` | 0.6 |
| `duplicateThreshold` | 0.85 |

---

## 5. Publish-Entscheidungen

### Trust-Entscheidungen (`TrustQualityDecision`)

| Entscheidung | Bedeutung |
|--------------|-----------|
| `auto_publish` | Automatische Veröffentlichung |
| `review_required` | Manuelle Prüfung erforderlich |
| `hold` | Zurückstellen (Review Queue, Status `on_hold`) |
| `reject` | Ablehnen |

### Mapping auf Publish Pipeline

| Trust | Publish (`PublishDecisionService`) |
|-------|-----------------------------------|
| `auto_publish` | `publish` |
| `review_required` | `queue_for_review` |
| `hold` | `queue_for_review` |
| `reject` | `skip` |

`TrustPublishDecisionEngine` priorisiert: `reject` > `hold` > `review_required` > `auto_publish`.

Zusätzliche Gates:

- Trust unter `rejectTrustScore` → reject
- Trust unter `holdTrustScore` → hold
- Trust unter `minTrustScore` → review_required
- Quality unter `minQualityScoreForAutoPublish` → review_required
- `publish_mode: manual_review` → review_required

**Legacy-Fallback**: Wenn Trust Engine nicht verdrahtet ist, greift `decideLegacy()` (Sprint 13/14 Verhalten).

---

## 6. Review-Prozess (Backend)

### `import_review_queue`

Jeder Eintrag enthält:

- `reasons` — Entscheidungsgründe
- `quality_score`, `trust_score`
- `affected_fields`, `rule_ids`
- `source_id`, `external_event_id`, `import_job_id`
- `decision`, `status` (`pending` | `on_hold`)
- `metadata` (Quality-Tier, Source-Name)

`ImportReviewQueueService.enqueueFromEvaluation()` wird vom Orchestrator bei `review_required` / `hold` / `reject` aufgerufen.

**Kein UI** in Sprint 16 — nur Backend + minimaler Admin-Status auf Source-Detail.

---

## 7. Migration

`20260747000000_sprint16_trust_quality_engine.sql`:

- `trust_quality_rules` (12 Default-Regeln)
- `import_review_queue`
- `source_reputation_events`
- `sources.computed_trust_score`, `trust_score_updated_at`
- RLS (Admin-only) auf allen neuen Tabellen

---

## 8. Neue Dateien

```
src/features/trust-quality/
├── domain/
│   ├── trust-quality-types.ts
│   └── trust-quality-config.ts
├── repositories/
│   └── in-memory-trust-quality-repositories.ts
├── services/
│   ├── import-record-quality-evaluator.ts
│   ├── source-trust-engine.ts
│   ├── trust-publish-decision-engine.ts
│   ├── import-review-queue-service.ts
│   ├── source-reputation-service.ts
│   └── trust-quality-admin-service.ts
└── __tests__/
    └── sprint16-trust-quality.test.ts
```

### Geänderte Dateien

- `publish-decision-service.ts` — async, Trust-Delegation
- `import-publish-orchestrator-service.ts` — DI für `PublishDecisionService`, Review + Reputation
- `registry.ts` — Wiring aller Trust-Services
- `records.ts`, `source-mapper.ts` — Trust-Felder
- `app/admin/sources/[id].tsx` — Trust & Quality Status-Karte

---

## 9. Admin-Vorbereitung

`TrustQualityAdminService`:

- `getSourceStatus(sourceId)` — Trust, pending/on_hold Reviews, Reputation-Events
- `listRules()` — alle Qualitätsregeln
- `listPendingReviews()` — globale Review-Queue
- `listReputationHistory(sourceId)` — Verlauf

Minimal UI auf Source-Detail: Effective Trust, Pending/On-Hold Counts, Reputation-Events.

---

## 10. Skalierbarkeit

| Anforderung | Umsetzung |
|-------------|-----------|
| 10.000+ Quellen | Trust pro Source in `sources.computed_trust_score`, indexiert |
| Millionen Events | Bewertung pro Import-Record zur Publish-Zeit, keine Batch-Scans |
| Mehrere Länder/Sprachen | Regeln feldbasiert, keine Locale-Hardcodes |
| Verschiedene Connectoren | Generische `ImportRecord`-Bewertung, kein Connector-Switch |
| Worker-Ready | Review Queue + Reputation als persistierbare Tabellen |

In-Memory-Repositories für Vitest; Supabase-Repos können in Sprint 17 ergänzt werden ohne API-Änderung.

---

## 11. Tests & Qualität

| Check | Ergebnis |
|-------|----------|
| Tests | **959 passed** |
| Typecheck | **green** |
| Lint | **0 errors** |

Neue Tests:

- `sprint16-trust-quality.test.ts` — Evaluator, Decision Engine, Review Queue, Reputation
- `sprint16-trust-quality-migration.test.ts` — SQL-Struktur

Angepasst: `sprint13-production-integration.test.ts`, `sprint15-production-scheduler.test.ts` (Orchestrator DI).

---

## 12. Erfolgskriterien

| Kriterium | Status |
|-----------|--------|
| Generische Trust Engine | ✓ `SourceTrustEngine` + Reputation |
| Event Quality Bewertung | ✓ `ImportRecordQualityEvaluator` |
| Source Reputation vorbereitet | ✓ `SourceReputationService` + DB |
| Publish Decisions regelbasiert | ✓ `TrustPublishDecisionEngine` |
| Review Queue vorbereitet | ✓ `ImportReviewQueueService` + DB |
| Bestehende Pipeline wiederverwendet | ✓ Orchestrator erweitert, Publish unverändert |
| Keine doppelte Architektur | ✓ Erweiterung von `PublishDecisionService` |
| Tests / Typecheck / Lint | ✓ |

---

## 13. Offene Punkte für Sprint 17

1. **Supabase-Repositories** für `trust_quality_rules`, `import_review_queue`, `source_reputation_events`
2. **Review Queue Admin-UI** — Liste, Filter, Approve/Reject-Aktionen
3. **Regel-Editor** — Admin kann Regeln aktivieren/deaktivieren und Schwellen anpassen
4. **Reputation nach Import** — `recordImportOutcome()` im Aggregation-Pfad verdrahten
5. **Statistik-Dashboard** — Trust-Verlauf, Quality-Verteilung, Entscheidungsquoten
6. **Duplicate-Integration** — engere Anbindung an Multi-Source Duplicate Decisions (ohne Matching Engine)
7. **Conflict-Regeln** — `conflict`-Kategorie in Rules nutzen wenn Provenance-Konflikte vorliegen

---

## 14. Zusammenfassung

Sprint 16 fügt eine **generische Trust & Quality Engine** als intelligente Entscheidungsschicht zwischen automatischem Import und produktiver Veröffentlichung ein. Die Engine bewertet Events regelbasiert, berechnet dynamische Source-Trust-Scores, trifft Publish-Entscheidungen (`auto_publish` / `review_required` / `hold` / `reject`) und bereitet eine Review Queue für manuelle Prüfung vor — ohne die bestehende Import-, Scheduler- oder Publish-Pipeline zu ersetzen.
