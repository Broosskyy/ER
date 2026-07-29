# Sprint 12 — First Real Public Source Abschlussbericht

## Zusammenfassung

Sprint 12 bindet **genau eine** reale öffentliche Quelle an: **Bootshaus Köln** (`https://bootshaus.tv/events/`). Die bestehende Architektur aus Sprint 9–11 wurde vollständig wiederverwendet; es wurde kein Custom Adapter und keine parallele Pipeline erstellt.

## Geprüfte Kandidaten

| Quelle | Ergebnis |
|--------|----------|
| Bootshaus (`bootshaus.tv`) | ✅ Ausgewählt |
| Affenkäfig | ❌ Keine Eventliste (Redirect) |
| Berghain / about:blank | ❌ Fetch fehlgeschlagen |
| O-Ton | ❌ robots.txt `Disallow: /` |
| Grelle Forelle, Gebäude 9, Ritter Butzke | ❌ 404 / keine Events |
| Odonien | ❌ Keine Event-URLs auf Homepage |
| tanzin.koeln | ❌ Kein klarer EM-Club-Kalender |

## Ausgewählte Quelle

**Bootshaus Köln** — offizieller Club-Eventkalender, Techno/House/EDM, statisches HTML, ~37 Events, keine Headless-Browser-Anforderung.

## Implementierte Komponenten

### Neu

| Komponente | Pfad |
|------------|------|
| SourceRecord Factory | `bootshaus-source.ts` |
| Offline Fixtures | `bootshaus-fixture.ts`, `bootshaus-fixture-snippets.json` |
| E2E Tests | `bootshaus-source.test.ts` |
| HTML Utils Test | `bootshaus-html-utils.test.ts` |
| Live Smoke Test | `scripts/dev/bootshaus-live-smoke-test.ts` |
| Date Compose Helper | `connectors/website/date-compose.ts` |

### Erweitert (generisch)

| Komponente | Änderung |
|------------|----------|
| `html-utils.ts` | Exakte CSS-Klassen-Tokens, Container-Blocks, Meta-Tags |
| `html-strategies.ts` | Container-Extraktion, Monats-/Zeit-Felder, Detail-Meta |
| `config.ts` | `monthSelector`, `linkIncludePattern` |
| `club-website-connector.ts` | Live vs. Fixture-URL-Logik |
| `website-framework.test.ts` | Regression (unverändert grün) |

## Strategie

**`html_selector`** (Priorität 3) — kein JSON-LD auf der Listenseite, kein Custom Adapter nötig.

## Live-Ergebnisse (Smoke Test)

| Metrik | Wert |
|--------|------|
| Event-Container erkannt | 37 |
| Extrahiert (Limit) | 10 |
| Strategie | `html_selector` |
| Fetch-Dauer | ~66 ms |
| JS-Rendering | nein |
| Blocker | keine |

## Pipeline-Ergebnisse (Fixture E2E)

- `AggregationPipeline.runFromSourceRecord()` → `needs_review`
- Resolver/Merge/Review getestet (manueller Publish-Test im Teststack)
- Provenance über `fieldEvidence` + `sourceMetadata`
- Import History via `SourceManagementService.runTestImport()`

## Tests

| Suite | Anzahl |
|-------|--------|
| Gesamt | **922** (+14) |
| Bootshaus-spezifisch | 14 |

Abdeckung: Konfiguration, Detection, Extraktion, Datum, Bilder, URLs, Pipeline, Review, Source Management, Health/Diagnostics/Metrics-Pfad, Rückwärtskompatibilität.

## Migrationen

Keine Datenbank-Migration. SourceRecord rein code-basiert (`createBootshausKoelnSourceRecord`).

## Verifikation

| Check | Ergebnis |
|-------|----------|
| Typecheck | grün |
| Tests | 922 bestanden |
| Lint | 0 Errors |
| Parallele Architektur | keine |
| SSRF | aktiv |
| Custom Adapter | nicht verwendet |

## Bekannte Einschränkungen

- Listenseite liefert keine Beschreibung, Genres, Ticketlinks — nur Detailseiten (optional `event_detail_page`)
- Kein JSON-LD — rein HTML-Selektoren
- Externe Events (z. B. Mallorca) haben Venue im Titel, nicht „Bootshaus“
- `maxEventsPerRun` begrenzt Smoke-/Testläufe
- Import History weiterhin In-Memory
- Kein Scheduler / Auto-Import

## Technische Schulden

- Detailseiten-Anreicherung für Beschreibung/Genres/Tickets optional in Sprint 13
- Pagination auf Bootshaus derzeit nicht konfiguriert (alle Events auf einer Seite)
- `parserType: html` löst ohne `reference.connectorKey` `organizer_website` auf — Bootshaus setzt `club_website` explizit

## Vorbereitung Sprint 13

| Baustein | Status |
|----------|--------|
| Erste reale Quelle (Bootshaus) | ✅ |
| Generische HTML-List-Extraktion | ✅ |
| Live Smoke Test | ✅ |
| Detailseiten-Anreicherung | ⏳ optional |
| Zweite Quelle | ⏳ Sprint 13+ |
| Scheduler | ⏳ später |

## Dokumentation

- [FIRST_REAL_SOURCE.md](./FIRST_REAL_SOURCE.md)
- [FIRST_REAL_SOURCE_CONFIGURATION.md](./FIRST_REAL_SOURCE_CONFIGURATION.md)
- [FIRST_REAL_SOURCE_SMOKE_TEST.md](./FIRST_REAL_SOURCE_SMOKE_TEST.md)
