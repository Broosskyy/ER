# Sprint 17 — Multi-Source Matching & Deduplication Engine Abschlussbericht

## 1. Analyse der bestehenden Architektur

### Bereits vorhanden (wiederverwendet, nicht neu gebaut)

| Komponente | Datei | Rolle in Sprint 17 |
|------------|-------|-------------------|
| `DuplicateDetectionService` | `duplicate-detection-service.ts` | Basis-Scoring (Titel, Datum, Venue, Koordinaten) — **wiederverwendet im Scorer** |
| `BlockingKeyDuplicateCandidateGenerator` | `duplicate-candidate-generator.ts` | Blocking-Keys — **jetzt verdrahtet** |
| `buildEventIdentityFingerprint` | `event-identity.ts` | Fingerprints für Identity + Blocking |
| `EventCanonicalIdentityService` | `event-canonical-identity-service.ts` | Fingerprint- + Source-Ref-Lookup |
| `event_source_references` | Migration `20260741000000` | Cross-Source-Zuordnung |
| `duplicate_decisions` | `duplicate-decision-service.ts` | Entscheidungsprotokoll `kept_separate` |
| `event_conflicts` + `detectConflictingValues` | `event-conflict.ts` | Konfliktdokumentation |
| `MergeProvenanceService` | `merge-provenance-service.ts` | Unverändert — Merge-Vorbereitung, kein Auto-Merge |
| `ImportMatchingService` | `import-matching-service.ts` | Import-Matching unverändert |
| `ImportReviewQueueService` | Sprint 16 | **Erweitert** — Match-Reviews |
| `ImportAggregationService` | `import-aggregation-service.ts` | **Erweitert** — Match-Orchestrierung nach Record-Erstellung |
| `ImportPublishOrchestratorService` | Sprint 16 | **Erweitert** — Blocking-Key-Indexierung nach Publish |

### Vor Sprint 17 fehlend

- Keine generische Multi-Source Matching Engine über Quellengrenzen hinweg
- `BlockingKeyDuplicateCandidateGenerator` war implementiert, aber nicht verdrahtet
- Kein Confidence-Tier-Modell (certain / probable / uncertain)
- Keine Match-Historie oder Merge-Kandidaten-Persistenz
- Fingerprint-Lookup nur beim Publish, nicht beim Import-Matching
- Vollständiger Katalog-Scan statt Blocking-Key-Vorfilter

---

## 2. Neue Architektur

```
ImportAggregationService.executeExistingJob()
        │
        ├── ImportMatchingService (bestehend)
        ├── createMany(import_records)
        │
        ▼
MultiSourceMatchOrchestrator.processRecord()
        │
        ├── MultiSourceMatchEngine.evaluate()
        │     ├── EventSourceReferenceRepository (bestehend)
        │     ├── EventCanonicalIdentityService (bestehend)
        │     ├── EventBlockingKeyRepository (neu, indexiert)
        │     ├── BlockingKeyDuplicateCandidateGenerator (bestehend)
        │     └── MultiSourceMatchScorer (regelbasiert)
        │
        ├── event_match_evaluations (Historie)
        ├── event_merge_candidates (Merge-Vorbereitung)
        ├── event_conflicts (Dokumentation, kein Auto-Fix)
        ├── import_review_queue (bei review_required)
        └── duplicate_decisions (bei keep_separate)
        │
        ▼
ImportPublishOrchestratorService (unveränderte Publish-Logik)
        │
        └── indexPublishedEvent() → event_blocking_keys
```

### Designprinzipien

1. **Ergänzung, kein Ersatz** — Import-, Trust- und Publish-Pipeline bleiben erhalten
2. **Regelbasiert** — keine KI, keine quellenspezifischen Sonderfälle
3. **Canonical Assignment only** — Engine weist Quellen kanonischen Events zu, merged keine Felddaten automatisch
4. **Keine stillen Zusammenführungen** — unsichere Matches → Review Queue
5. **Performance** — Blocking-Key-Index statt O(n²) über gesamten Bestand

---

## 3. Matching-Algorithmus

### Kandidatenfindung (Vorfilter)

1. **Source Reference** — `(source_id, external_event_id)` → `canonical_event_id`
2. **Fingerprint** — `EventCanonicalIdentityService.resolveByFingerprint()`
3. **Blocking Keys** — `event_blocking_keys` Index (O(1) pro Key)
4. **Catalog-Subset** — nur Events mit gemeinsamen Blocking Keys (nicht voller Scan)
5. **Import-Duplicate-Hint** — `duplicateEventId` aus Sprint 12C Matching

### Blocking Keys (aus `duplicate-candidate-generator.ts`)

- `url:{originalLink}`
- `external:{sourceId}:{externalId}`
- `day-city:{date}:{location}`
- `day-venue:{date}:{venue}`
- `title-city:{title}:{location}`

### Scoring-Signale (`MultiSourceMatchScorer`)

| Signal | Gewicht | Beschreibung |
|--------|---------|--------------|
| `source_reference` | 1.0 | Bestehende Source-Referenz |
| `fingerprint` | 0.95 | Canonical Fingerprint Match |
| `external_id` | 1.0 | Gleiche externe ID |
| `title_similarity` | 0.85 | Token-Ähnlichkeit |
| `start_date` | 0.8 | Gleicher Kalendertag |
| `venue` | 0.9 | Venue-ID oder Name-Ähnlichkeit |
| `coordinates` | 0.85 | Haversine-Distanz ≤ Radius |
| `ticket_url` / `event_url` | 0.85–0.9 | URL-Gleichheit |
| `artist_overlap` | 0.75 | Artist-Token-Ähnlichkeit |
| `blocking_key` | 0.6 | Gemeinsame Blocking Keys |

Score = gewichteter Durchschnitt aller aktiven Signale (0–100).

Wiederverwendet `DuplicateDetectionService` als zusätzliches Signal.

---

## 4. Confidence-Modell

Konfigurierbar in `matching-config.ts`:

| Schwellenwert | Default | Tier |
|---------------|---------|------|
| `certainMinScore` | 90 | `certain` |
| `probableMinScore` | 70 | `probable` |
| `autoLinkMinScore` | 90 | → `auto_link` |
| `reviewRequiredMinScore` | 70 | → `review_required` |
| darunter | — | → `keep_separate` |

### Entscheidungs-Mapping

| Confidence | Entscheidung | Aktion |
|------------|--------------|--------|
| ≥ 90 (certain) | `auto_link` | Canonical-Zuordnung, Merge-Kandidat `approved` |
| 70–89 (probable) | `review_required` | Review Queue |
| < 70 (uncertain) | `keep_separate` | `duplicate_decisions.kept_separate` |

**Sicherheits-Gate:** Bei Feld-Differenzen wird `auto_link` auf `review_required` downgraded — keine stillen Zusammenführungen bei widersprüchlichen Daten.

---

## 5. Konfliktmodell

`MatchConflictDetector` vergleicht eingehende mit kanonischen Feldern:

- `title`, `startDate`, `endDate` (critical/warning)
- `description`, `venueName`, `ticketUrl`, `imageUrl`, `organizerName`

Konflikte werden über bestehendes `detectConflictingValues()` in `event_conflicts` persistiert.

**Keine automatische Auflösung** — nur Dokumentation für Admin-Review (Sprint 18).

---

## 6. Merge-Vorbereitung

| Tabelle | Zweck |
|---------|-------|
| `event_match_evaluations` | Vollständige Match-Historie mit Signals, Reasons, Differences |
| `event_merge_candidates` | Merge-Kandidaten (`pending` / `approved` / `rejected` / `deferred`) |
| `duplicate_decisions` | Bestehend — `kept_separate` bei unsicheren Matches |
| `import_records.match_evaluation_id` | Verknüpfung Record ↔ Evaluation |

`MergeProvenanceService` bleibt für manuelle Admin-Merges — nicht automatisch aufgerufen.

---

## 7. Review Queue Integration

`ImportReviewQueueService.enqueueFromMatchEvaluation()` erweitert Sprint-16-Queue:

- `metadata.reviewType: 'multi_source_match'`
- Confidence Score + Tier
- Beteiligte Quellen (`involvedSourceIds`)
- Feld-Differenzen (`fieldDifferences`)
- Match-Signale (`matchSignals`)

---

## 8. Performance-Strategie

| Problem | Lösung |
|---------|--------|
| O(n²) Vergleich | Blocking-Key-Index `event_blocking_keys` |
| Voller Katalog-Scan | Nur Blocking-Key-gefilterte Catalog-Events |
| Kontinuierliche Imports | Indexierung nach jedem Publish |
| Millionen Events | Keys pro Event ≈ 5, Lookup O(k) mit kleinem k |
| Skalierung DB | Indizes auf `blocking_key`, `source_id`, `canonical_event_id` |

Nach Publish werden Blocking Keys für das kanonische Event indexiert (`MultiSourceMatchOrchestrator.indexPublishedEvent()`).

---

## 9. Migration

`20260748000000_sprint17_multi_source_matching.sql`:

- `event_blocking_keys`
- `event_match_evaluations`
- `event_merge_candidates`
- `import_records.match_evaluation_id`
- RLS (Admin-only)

---

## 10. Neue Dateien

```
src/features/multi-source-matching/
├── domain/
│   ├── matching-types.ts
│   └── matching-config.ts
├── repositories/
│   └── in-memory-matching-repositories.ts
├── services/
│   ├── multi-source-match-scorer.ts
│   ├── match-conflict-detector.ts
│   ├── multi-source-match-engine.ts
│   ├── multi-source-match-orchestrator.ts
│   └── multi-source-match-admin-service.ts
└── __tests__/
    └── sprint17-multi-source-matching.test.ts
```

### Geänderte Dateien

- `import-aggregation-service.ts` — Match-Orchestrierung nach `createMany`
- `import-publish-orchestrator-service.ts` — Blocking-Key-Indexierung nach Publish
- `import-review-queue-service.ts` — `enqueueFromMatchEvaluation()`
- `import/models/types.ts` — `matchEvaluationId`
- `registry.ts` — Wiring aller Match-Services
- `trust-quality-config.ts` — `duplicateThreshold` auf 0–100 Skala (70) vereinheitlicht
- `app/admin/sources/[id].tsx` — Multi-Source Matching Status-Karte

---

## 11. Admin-Vorbereitung

`MultiSourceMatchAdminService`:

- `getSourceStatus(sourceId)` — Evaluations, Auto-Links, Reviews, Merge-Kandidaten
- `listRecentEvaluations()`
- `listPendingMergeCandidates()`
- `listEvaluationsForEvent(canonicalEventId)`

Minimal UI auf Source-Detail: Recent Evaluations, Auto-Linked, Review Required, Pending Merge Candidates.

---

## 12. Skalierbarkeit

| Anforderung | Umsetzung |
|-------------|-----------|
| Millionen Events | Blocking-Key-Index, kein Full-Scan |
| Zehntausende Quellen | Per-Source Evaluations, Source-Ref-Lookup O(1) |
| Internationale Plattform | Normalisierte Fingerprints (NFKD, Locale-agnostisch) |
| Mehrere Zeitzonen | Kalendertag-Vergleich via `sameCalendarDay` |
| Kontinuierliche Scheduler-Läufe | Index-Update nach jedem Publish |
| Keine Neuarchitektur | Erweiterung bestehender Multi-Source-Tabellen |

In-Memory-Repositories für Vitest; Supabase-Repos können in Sprint 18 ergänzt werden.

---

## 13. Tests & Qualität

| Check | Ergebnis |
|-------|----------|
| Tests | **968 passed** |
| Typecheck | **green** |
| Lint | **0 errors** |

Neue Tests:

- `sprint17-multi-source-matching.test.ts` — Scorer, Engine, Orchestrator, Conflicts
- `sprint17-multi-source-matching-migration.test.ts` — SQL-Struktur

---

## 14. Erfolgskriterien

| Kriterium | Status |
|-----------|--------|
| Matching Engine vorhanden | ✓ `MultiSourceMatchEngine` |
| Confidence Score implementiert | ✓ Tier + regelbasierte Schwellen |
| Multi-Source Zuordnung möglich | ✓ Source Ref + Fingerprint + Blocking Keys |
| Konflikte dokumentiert | ✓ `MatchConflictDetector` + `event_conflicts` |
| Review Queue integriert | ✓ `enqueueFromMatchEvaluation()` |
| Bestehende Pipeline wiederverwendet | ✓ Aggregation + Publish unverändert |
| Keine doppelte Architektur | ✓ Erweiterung bestehender Services |
| Tests / Typecheck / Lint | ✓ |

---

## 15. Offene Punkte für Sprint 18

1. **Supabase-Repositories** für `event_blocking_keys`, `event_match_evaluations`, `event_merge_candidates`
2. **Review Queue Admin-UI** — Match-Review mit Approve/Reject/Keep-Separate
3. **Merge-UI** — Manuelle Ausführung via bestehendem `MergeProvenanceService`
4. **Auto-Link → Publish** — `resolveExistingEventId` explizit mit Match-Evaluation verknüpfen
5. **Batch-Reindex** — Blocking Keys für bestehende Events backfillen
6. **Festival/Edition-Matching** — Sprint 14 `festival_edition_id` als Signal
7. **Statistik-Dashboard** — Match-Rate, Conflict-Rate, Confidence-Verteilung
8. **Konfliktauflösung** — Admin-Workflow für `event_conflicts` (bewusst nicht in Sprint 17)

---

## 16. Zusammenfassung

Sprint 17 schafft das Fundament für ein **einziges kanonisches Eventmodell** aus beliebig vielen Quellen. Die generische Matching & Deduplication Engine erkennt regelbasiert, wenn mehrere Quellen dieselbe Veranstaltung beschreiben, bewertet Matches mit Confidence Scores, dokumentiert Konflikte ohne sie aufzulösen, und leitet unsichere Fälle in die bestehende Review Queue — alles ohne die Import- oder Publish-Pipeline zu ersetzen.
