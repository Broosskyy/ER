# PHASE 26 REPORT — Source Platform Consolidation

## 1. Executive Summary

Sprint 26 konsolidiert die Eternal-Rave-Source-Plattform in zwei Teilen:

- **Teil 1:** Generische Title Transforms, RSS/Atom/CSV-Connectoren, strikte Connector-Auflösung, Legacy-Import-Konsolidierung, kanonische Registry.
- **Teil 2:** Reputation-Feedback aus der Aggregation Pipeline, echter Discovery-Trust, gemeinsame Website-Connector-Basis, E2E-Validierung Bootshaus/Affenkäfig.

Affenkäfig und Bootshaus bleiben Referenzquellen ohne Framework-Hardcodings. Die produktive Pipeline ist unverändert:

`Source → Scheduler → Queue → Worker → Connector → Aggregation → Matching → Trust → Lifecycle → Publish → Discovery → UI`

---

## 2. Ziel des Sprints

- Keine quellenspezifische Sonderlogik im generischen Framework
- Alle Standard-Quellentypen über die Aggregation Pipeline
- Eine kanonische produktive Connector-Registry
- Echter Source Trust in Discovery und Reputation
- Nahezu vollständige Konfigurierbarkeit neuer Webseiten

---

## 3. Geänderte Dateien (Auswahl)

### Teil 1
| Bereich | Dateien |
|---------|---------|
| Title Transforms | `website/title-transforms.ts`, `website/config.ts`, `website/mapper.ts` |
| RSS/Atom/CSV | `feed-source-connector.ts`, `csv-import-connector.ts`, `import/parsers/*` |
| Auflösung | `source-connector-resolution.ts`, `scheduler-source-utils.ts` |
| Registry | `source-connector-registry.ts`, `canonical-registry.ts` |
| Migration | `20260753000000_sprint26_source_platform_consolidation.sql` |

### Teil 2
| Bereich | Dateien |
|---------|---------|
| Reputation | `import-run-reputation.ts`, `source-reputation-service.ts`, `import-aggregation-service.ts` |
| Discovery Trust | `discovery/trust/discovery-source-trust.ts`, `discovery-engine.ts`, `registry.ts` |
| Website Basis | `website/website-source-connector-base.ts`, `club/organizer-website-connector.ts` |
| Queue | `import-job-queue-processor.ts` |

---

## 4. Entfernte Hardcodierungen

| Fundstelle | Status |
|------------|--------|
| `Bootshaus Club` Regex in `html-strategies.ts` | ✅ Entfernt |
| Discovery `demo → 40`, `else → 75` | ✅ Ersetzt durch echten Source Trust |
| Stiller `club_website`-Fallback in Connector-Auflösung | ✅ Entfernt |

---

## 5. Neues Transform-System

`source_config.website.transforms` unterstützt:

- `remove_suffix`, `remove_prefix`, `regex_replace`, `trim`
- Validierung via `validateWebsiteTitleTransforms()`
- Anwendung zentral in `mapRawWebsiteEvents()`

Bootshaus-Bereinigung nur noch in Config + Migration `20260753000000`.

---

## 6. Neue RSS-/Atom-/CSV-Connectoren

| Key | Parser-Basis |
|-----|--------------|
| `rss_feed` | `import/parsers/feed-parser.ts` |
| `atom_feed` | `import/parsers/feed-parser.ts` |
| `csv_import` | `import/parsers/csv-source-parser.ts` |

Legacy-Adapter (`feed-adapter.ts`, `csv-adapter.ts`) nutzen dieselben Parser.

---

## 7. Scheduler Routing

- `shouldUseAggregationForSource()` prüft auflösbaren Connector
- `resolveSourceConnectorKeyFromRecord()` — strikt, keine stillen Fallbacks
- Queue validiert Connector vor Import; Dead Letter bei Fehlern

---

## 8. Status Legacy Import

| Komponente | Status |
|------------|--------|
| `ImportAggregationService` | ✅ Produktiv |
| `ImportOrchestrator` | ⚠️ `@deprecated`, nur Tests/Kompatibilität |
| `ImportOperationsService` | ✅ Nutzt Aggregation wenn verfügbar |
| ER-013 Connectors | ⚠️ Admin-only |

---

## 9. Connector Registry

Kanonische Runtime-Registry: `source-connector-registry.ts`  
Export: `canonical-registry.ts`  
Dokumentation: `SOURCE_CONNECTOR_REGISTRY.md`

8 produktive Connectoren registriert.

---

## 10. Reputation Integration

`SourceReputationService.recordImportRunOutcome()`:

- Einmal pro `importJobId` (Idempotenz)
- Klassifizierung: Plattform vs. Source-Fehler
- Plattformfehler ändern Trust **nicht**
- Metadaten: fetched/parsed/invalid/duplicate/published/queued/rejected
- Queue: Reputation erst bei terminalem Job (kein Retry-Penalty)
- Manuelle Imports: Reputation in `ImportAggregationService` (default an)

---

## 11. Discovery Trust

**Regel (Multi-Source):** Höchster effektiver Trust unter allen bekannten Source-IDs des Events (`event.source` = `source_id`).

**Fallback:** `50` wenn keine Source bekannt.

**Implementierung:**

- `DiscoverySourceTrustProvider` lädt Trust-Scores batchweise
- Cache pro Query-Event-Set in Provider
- `DiscoveryEngine` nutzt `resolveEventDiscoveryTrust()` statt Hardcoding

---

## 12. Bootshaus Validierung

| Schritt | Status |
|---------|--------|
| Connector `club_website` (explizit) | ✅ |
| HTML-Strategie `html_selector` | ✅ |
| Title Transforms (Config) | ✅ |
| Fixture + Live-URL in DB | ✅ Live-fähig |
| Aggregation → Publish | ✅ (Tests grün) |
| Discovery Trust aus `trust_score` | ✅ |

**Modus:** Live Source (`bootshaus.tv`), Fixture für Tests/CI.

---

## 13. Affenkäfig Validierung

| Schritt | Status |
|---------|--------|
| Connector `organizer_website` (explizit) | ✅ |
| JSON-LD Strategie | ✅ |
| Reference HTML in `source_config` | ✅ |
| Live-Fetch | ❌ Noch Fixture/Reference-Modus |
| Aggregation → Publish | ✅ (Tests grün) |

**Keine stille Umstellung auf Live** — Domain weiterhin unconfigured.

---

## 14. Testergebnisse

| Suite | Ergebnis |
|-------|----------|
| Sprint 26 Teil 1 | 18 Tests |
| Sprint 26 Teil 2 | 13 Tests (Reputation, Discovery Trust, E2E) |
| Gesamtsuite | **1058 Tests bestanden** |

Neue Testdateien:

- `sprint26-source-platform-consolidation.test.ts`
- `sprint26-part2.test.ts`
- `import-run-reputation.test.ts`
- `discovery-source-trust.test.ts`

---

## 15. Typecheck

✅ `npm run typecheck` — erfolgreich

---

## 16. Lint

✅ `npm run lint` — erfolgreich (0 Errors)

---

## 17. Offene Punkte

| Punkt | Priorität |
|-------|-----------|
| Affenkäfig Live-Fetch wenn Domain verfügbar | Mittel |
| Open-Data-API Auto-Pagination | Mittel |
| Discovery Multi-Source via `event_source_references` (zusätzliche Contributor-IDs) | Niedrig |
| `recordImportOutcome` boolean-API deprecated zugunsten `recordImportRunOutcome` | Niedrig |
| Instagram / GraphQL / Headless Browser | Sprint 27+ |

---

## 18. Empfehlungen für Sprint 27

1. Affenkäfig Live-Integration wenn Domain steht
2. Admin-UI für Website-Config (Selektoren, Transforms)
3. Open-Data-API Pagination
4. Persistente Connector-Health in Supabase (Ops-Automatisierung)
5. Horizontale Queue-Worker-Skalierung
6. Discovery: Contributor-Source-IDs aus Provenance-Tabelle für Multi-Source-Trust

---

## Nicht Teil dieses Sprints (dokumentiert)

- Instagram / Meta OAuth
- GraphQL Connector
- Headless Browser
- Worker Sharding
- Neue Admin UI
- Festival Detail / UI Redesigns
- Neue Discovery Features

---

*Bericht erstellt: Sprint 26 Abschluss. Kein Git-Commit erstellt.*
