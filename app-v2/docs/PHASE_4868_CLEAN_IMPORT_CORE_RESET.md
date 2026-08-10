# Phase 4.8.6.8 — Clean Import Core Reset

## Ergebnis und Laufgrenzen

Dieser Lauf friert den experimentellen Phase-4867-Pfad als Referenz ein und bereitet einen
isolierten Neustart vom letzten gemeldeten stabilen Remote-Stand vor. Es wurde keine
Importimplementierung portiert oder neu erstellt.

- Basis-Commit: `85667f77fe996ab0af14b3de3d06a0a0b15e9aea`
- Basis-Commit-Betreff: `docs(import): record canary provenance freshness repair`
- Verifizierter lokaler Basis-Ref: `feature/phase-4866-generic-rollout`
- Verifizierter Remote-Tracking-Ref: `origin/feature/phase-4866-generic-rollout`
- Beide Basis-Refs zeigen exakt auf `85667f77fe996ab0af14b3de3d06a0a0b15e9aea`.
- Neuer Branch: `feature/phase-4868-clean-import-core`
- Neuer Worktree: `C:\Users\manue\.cursor\projects\c-ER\wt-4868-clean-import-core`
- Neuer HEAD bei Erstellung: `85667f77fe996ab0af14b3de3d06a0a0b15e9aea`
- Inventarisierter 4867-Branch: `feature/phase-4867-bulk-canonical-rebuild`
- Inventarisierter 4867-HEAD: `d7f48556a1c2c4799f7957d7c9d67962f17cf8dc`
- 4867 gegenüber Basis: 13 Commits, 50 committed Dateien, 13.091 hinzugefügte Zeilen
- Zusätzlich im 4867-Worktree: 18 untracked Dateien
- DB-Reads: 0
- DB-Writes: 0
- Live-Fetches: 0
- Produktionmutationen: 0
- Rollout aktiviert: nein

Hinweis zur Isolation: Die Erstellung eines Git-Worktrees registriert technisch den neuen
Worktree und Branch in den gemeinsamen Git-Metadaten des Repositories. Im Checkout
`C:\ER` wurden keine Arbeitsdateien geändert. Der bestehende Worktree
`wt-4867-bulk-rebuild` wurde ausschließlich read-only über Git inventarisiert.

## Salvage-Regeln

`KEEP` bedeutet in diesem Dokument: im nächsten Lauf gezielt als Ausgangsmaterial prüfen und
in den kleinsten vertikalen Pfad portieren. Es bedeutet ausdrücklich nicht, die Datei oder
den ursprünglichen 4867-Commit unverändert zu übernehmen.

- `KEEP_PRODUCT`: eigenständiges, nutzerrelevantes Schutzverhalten.
- `KEEP_TEST`: kleiner generischer Regressionstest ohne Event-ID-/Phasen-Kopplung.
- `KEEP_CONNECTOR`: quellenfamilienübergreifend wiederverwendbare Parser-/Fetch-Verbesserung.
- `DISCARD_OPS`: Runner, Cutover, Rollback, Forensik, Manifest, Audit oder Laufartefakt.
- `DISCARD_ARCHITECTURE`: parallele oder doppelte Importarchitektur, Whole-Row-Rebuild oder
  nur im 4867-System nutzbare Abstraktion.
- `REVIEW`: brauchbares Verhalten ist erkennbar, aber die Datei ist nicht sauber genug
  entkoppelt, um sie unverändert zu übernehmen.

## Commit-Salvage-Matrix

### KEEP-Commits

Keine. Kein Phase-4867-Commit ist als Ganzes sicher cherry-pickbar.

### REVIEW-Commits

- `094bbdf8d245c19636a0c2f7f2df4616ad3ee1bb` —
  `feat(import): prepare evidence-based bulk canonical cutover`
  - Grund: Der Commit enthält die sechs unten genannten KEEP-Dateien, zugleich aber Runner,
    Bulk-Rebuild, Cutover, Whole-Row-Assembly, Event-Fixtures und weitere zu verwerfende
    Architektur. Nur selektive, verhaltensbasierte Übernahme ist zulässig.

### DISCARD-Commits

Alle folgenden Commits sind `DISCARD_OPS`; sie korrigieren ausschließlich den eingeschränkten
Bulk-Apply-/Readback-/Rollback-Pfad oder dessen Laufartefakte:

- `5acc18f9fe6537c3bd6936deecd7eff6b2bf36b8` —
  `docs(import): prepare first restricted bulk canonical apply`
- `0e9fdccbd0374014e98c23ffcd12d3e53fee3a1d` —
  `fix(import): bootstrap ops env before restricted bulk apply`
- `0299df034a0a459a862c8b9773f7cd30d07dd02a` —
  `fix(import): allow writer ticketPhases drift in restricted preflight`
- `4586a72da85b6b12c91a14c9e15088a6cd121030` —
  `fix(import): ignore ticketPhases in restricted writer gate`
- `aa636a7d8c287b9b69bb381e644dcd701231bb51` —
  `fix(import): provenance writer and batch rollback snapshots`
- `719e1da2fe4a046e77bcc7a0c3b28f08ffbba667` —
  `fix(import): repair partial restricted apply before preflight`
- `5f7f7360355248c9023c65216c57219c080fe1ac` —
  `fix(import): source reference touch without updated_at column`
- `1cafb1a20468de3ed9ffb46e86005c6dcadd2c02` —
  `fix(import): consumer readback resilience and readback-only mode`
- `f4025002a142daa2859548ca20ee57e9102b96aa` —
  `fix(import): syntax error in restricted apply script`
- `4992ecc32af9331561ab8ea1072f47d2010353f9` —
  `fix(import): consumer projection and readback fidelity for restricted bulk apply`
- `a46c99e8894149bb3ee1c01c3ea399a5420ad57d` —
  `fix(import): make restricted bulk readback and rollback atomic`
- `d7f48556a1c2c4799f7957d7c9d67962f17cf8dc` —
  `docs: record restricted bulk certification commit sha`

Commit-Zählung:

- KEEP: 0
- DISCARD: 12
- REVIEW: 1

## Datei-Salvage-Matrix

Die Matrix umfasst alle 50 committed und alle 18 untracked Phase-4867-Dateien.

### KEEP_PRODUCT

- `app-v2/src/features/import/bulk-canonical-rebuild/detail-url-collector.ts`
  - Bewahrt getrennte Event-, Ticket-, Source-, Checkout-, Public-CTA- und Official-URLs.
  - Im nächsten Lauf nur die URL-Rollen und Deduplizierung übernehmen; die Abhängigkeit von
    4867-`SourceEvidenceContribution` und freien `sourceMetadata`-Schlüsseln entfernen.

### KEEP_TEST

Keine vollständige 4867-Testdatei erfüllt die Bedingung. Die vorhandenen Tests mischen
generische Assertions mit Phase-Nummern, Event-Fixtures, konkreten Event-IDs oder
Bulk-Rebuild-Komponenten. Einzelne Assertions dürfen später als neue, kleine Tests neu
formuliert werden; die Dateien selbst werden nicht übernommen.

### KEEP_CONNECTOR

- `app-v2/src/features/import/bulk-canonical-rebuild/detail-evidence-parser.ts`
  - Wiederverwendbares Verhalten: vorhandene TicketKings- und ticket.io-Parser nutzen,
    Challenge-Seiten nicht als Event-Identität behandeln und Official-HTML nur evidenzbasiert
    auswerten.
- `app-v2/src/features/import/bulk-canonical-rebuild/detail-evidence-types.ts`
  - Kleine Source-/URL-/`observedAt`-/`verifiedAt`-Antwortform als Ausgangspunkt für
    `EventEvidence`.
- `app-v2/src/features/import/bulk-canonical-rebuild/detail-fetch-cache.ts`
  - Kleine URL-normalisierte Deduplizierung für wiederholte Detail-URLs.
- `app-v2/src/features/import/bulk-canonical-rebuild/detail-fetch-http.ts`
  - Nutzt den bestehenden sicheren Import-Fetch-Service und dessen URL-Prüfung; keine eigene
    Netzwerkimplementierung in den neuen Core übernehmen.
- `app-v2/src/features/import/bulk-canonical-rebuild/detail-evidence-service.ts`
  - Wiederverwendbares Verhalten: eingebettetes HTML vor HTTP, URL-Deduplizierung, begrenzte
    Parallelität, klarer Fetch-Status und kein Throw bei einzelnen Quellenfehlern.

Diese fünf Dateien bilden keinen eigenständigen neuen Subsystem-Block. Sie sind nur
Salvage-Quellen für `SourceAdapter` und `EventEvidence`; vorhandene produktive Connectoren
bleiben die eigentlichen Parser.

### REVIEW

- `app-v2/src/features/import/bulk-canonical-rebuild/bulk-evidence-bundle.ts`
  - Grund: enthält nützliche TicketKings-/ticket.io-Metadatengewinnung, setzt aber
    `verifiedAt` teilweise aus Laufzeit statt aus belastbarer Evidenz und dupliziert die
    bestehende Generic-Truth-Evidence-Konvertierung.
- `app-v2/src/features/import/bulk-canonical-rebuild/contribution-collision.ts`
  - Grund: nützliche Kontaminations- und Title-Core-Schutzregeln, aber direkt an
    `SourceEvidenceContribution`, bestehende Admin-Zeilen und 4867-Mapping-Semantik gekoppelt.
- `app-v2/src/features/import/bulk-canonical-rebuild/detail-evidence-integrator.ts`
  - Grund: nützliche Feldabbildungen, aber Evidenz wird über freie `sourceMetadata`-Schlüssel
    in Kandidaten zurückgeschrieben und parallel in zwei Modelle integriert.
- `app-v2/src/features/import/bulk-canonical-rebuild/disposition.ts`
  - Grund: enthält den brauchbaren Gedanken „sicherer Publish-Core plus optionale Felder“,
    verwendet aber 4867-spezifische Zustände, Whole-Row-Änderungssätze und Laufzeitlogik.
- `app-v2/src/features/import/bulk-canonical-rebuild/identity-graph.ts`
  - Grund: nutzt bestehende Matching-Bausteine, vermischt jedoch Import-Record-Mappings,
    Clusterbildung, Katalogkollisionen und Duplicate-Proposals in einer 4867-spezifischen
    Graph-Schicht.

### DISCARD_OPS — committed

- `app-v2/docs/PHASE_4867_BULK_CANONICAL_REBUILD.md`
- `app-v2/docs/real-data/_phase48674_restricted_bulk_plan.json`
- `app-v2/docs/real-data/_phase48674_restricted_bulk_preview.json`
- `app-v2/docs/real-data/_phase48674_restricted_bulk_readiness.json`
- `app-v2/docs/real-data/_phase48674_restricted_bulk_rollback.json`
- `app-v2/docs/real-data/_phase48675_restricted_bulk_apply_result.json`
- `app-v2/scripts/operations/_phase4867-bulk-rebuild-preview.ts`
- `app-v2/scripts/operations/_phase48673-bulk-cutover-prep.ts`
- `app-v2/scripts/operations/_phase48673-live-reference-validation.ts`
- `app-v2/scripts/operations/_phase48674-restricted-bulk-verification.ts`
- `app-v2/scripts/operations/_phase48675-restricted-bulk-apply.ts`
- `app-v2/scripts/operations/phase48675-env-bootstrap.ts`
- `app-v2/src/features/import/bulk-canonical-rebuild/acceptance-fixture-catalog.ts`
- `app-v2/src/features/import/bulk-canonical-rebuild/acceptance-fixtures.ts`
- `app-v2/src/features/import/bulk-canonical-rebuild/acceptance-runner.ts`
- `app-v2/src/features/import/bulk-canonical-rebuild/bulk-rebuild-preview-runner.ts`
- `app-v2/src/features/import/bulk-canonical-rebuild/clean-rebuild-audit.ts`
- `app-v2/src/features/import/bulk-canonical-rebuild/cutover-manifest.ts`
- `app-v2/src/features/import/bulk-canonical-rebuild/cutover-plan.ts`
- `app-v2/src/features/import/bulk-canonical-rebuild/fixture-rebuild-runner.ts`
- `app-v2/src/features/import/bulk-canonical-rebuild/horizon.ts`
- `app-v2/src/features/import/bulk-canonical-rebuild/live-reference-validation.ts`
- `app-v2/src/features/import/bulk-canonical-rebuild/phase-c-reference-matrix.ts`
- `app-v2/src/features/import/bulk-canonical-rebuild/restricted-bulk-apply-security.ts`
- `app-v2/src/features/import/bulk-canonical-rebuild/restricted-bulk-apply.ts`
- `app-v2/src/features/import/bulk-canonical-rebuild/restricted-bulk-forensic.ts`
- `app-v2/src/features/import/bulk-canonical-rebuild/restricted-bulk-revalidation.ts`

### DISCARD_OPS — untracked

- `app-v2/docs/real-data/_phase48673_bulk_cutover_plan.json`
- `app-v2/docs/real-data/_phase48673_bulk_cutover_preview.json`
- `app-v2/docs/real-data/_phase48673_bulk_cutover_readiness.json`
- `app-v2/docs/real-data/_phase48673_bulk_cutover_rollback.json`
- `app-v2/docs/real-data/_phase48673_live_fetch_metrics.json`
- `app-v2/docs/real-data/_phase48673_live_reference_validation.json`
- `app-v2/docs/real-data/_phase48674_candidate_forensic_audit.json`
- `app-v2/docs/real-data/_phase48674_live_reference_matrix.json`
- `app-v2/docs/real-data/_phase48675a_consistency_repair_result.json`
- `app-v2/docs/real-data/_phase4867_bulk_rebuild_acceptance.json`
- `app-v2/docs/real-data/_phase4867_bulk_rebuild_cutover_plan.json`
- `app-v2/docs/real-data/_phase4867_bulk_rebuild_events.json`
- `app-v2/docs/real-data/_phase4867_bulk_rebuild_readiness.json`
- `app-v2/docs/real-data/_phase4867_bulk_rebuild_rollback_plan.json`
- `app-v2/docs/real-data/_phase4867_bulk_rebuild_run.log`
- `app-v2/docs/real-data/_phase4867_bulk_rebuild_source_coverage.json`
- `app-v2/docs/real-data/_phase4867_bulk_rebuild_summary.json`
- `app-v2/scripts/operations/_phase48675a-consistency-repair.ts`

### DISCARD_ARCHITECTURE

- `app-v2/src/features/import/bulk-canonical-rebuild/__tests__/bulk-rebuild-preview.test.ts`
  - Testet den zu verwerfenden Preview-/Whole-Row-Pfad.
- `app-v2/src/features/import/bulk-canonical-rebuild/__tests__/detail-evidence-collision.test.ts`
  - Mischt generische Fetch-Assertions mit Event-IDs, Event-Fixtures, Collision-Triage und
    vollständiger Rebuild-Assembly.
- `app-v2/src/features/import/bulk-canonical-rebuild/__tests__/detail-fetch-live.test.ts`
  - Mischt generische Fetch-Assertions mit 4867-Acceptance, Event-Fixtures und Rebuild-Assembly.
- `app-v2/src/features/import/bulk-canonical-rebuild/__tests__/restricted-bulk-apply.test.ts`
  - Testet ausschließlich den eingeschränkten Bulk-Apply-/Readback-/Rollback-Pfad.
- `app-v2/src/features/import/bulk-canonical-rebuild/__tests__/restricted-bulk-forensic.test.ts`
  - Testet ausschließlich Phase-spezifische Forensik.
- `app-v2/src/features/import/bulk-canonical-rebuild/collision-triage.ts`
  - Phase-spezifische Triage-Schicht über dem Identity-/Rebuild-System.
- `app-v2/src/features/import/bulk-canonical-rebuild/consumer-quality-audit.ts`
  - Consumer-Projektion gehört nicht in den Import-Core.
- `app-v2/src/features/import/bulk-canonical-rebuild/evidence-field-extractor.ts`
  - Doppelte Evidence-/Merge-Implementierung mit Whole-Row- und Consumer-Projektion.
- `app-v2/src/features/import/bulk-canonical-rebuild/index.ts`
  - Exportiert die gesamte parallele 4867-Pipeline als Subsystem.
- `app-v2/src/features/import/bulk-canonical-rebuild/rebuild-assembler.ts`
  - Whole-Row-Rebuild-System mit gekoppelten Identity-, Content-, Line-up- und Ticket-Writes.
- `app-v2/src/features/import/bulk-canonical-rebuild/source-ingest.ts`
  - Parallele Bulk-Ingest-Orchestrierung um die bereits bestehende Aggregation-Pipeline.
- `app-v2/src/features/import/bulk-canonical-rebuild/types.ts`
  - Großes 4867-spezifisches Whole-Row-, Metrics-, Cutover- und Disposition-Datenmodell.

Datei-Zählung:

- KEEP: 6
  - KEEP_PRODUCT: 1
  - KEEP_TEST: 0
  - KEEP_CONNECTOR: 5
- DISCARD: 57
  - DISCARD_OPS: 45
  - DISCARD_ARCHITECTURE: 12
- REVIEW: 5
- Gesamt: 68

## Begrenzung des neuen Import-Cores

Der neue Core besitzt maximal sechs Verantwortlichkeiten. Keine zusätzliche
Pipeline-Schicht darf zwischen diesen Verantwortlichkeiten entstehen.

### 1. SourceAdapter

- Lädt eine konfigurierte Quelle über die bestehenden sicheren Fetch- und Connector-Wege.
- Ruft vorhandene produktive Connectoren/Parser auf; keine Parser-Neuschreibung im Core.
- Liefert normalisierte Source-Contributions, ohne DB- oder Publish-Entscheidung.
- Ein Quellenfehler bleibt auf diese Quelle begrenzt.

### 2. EventEvidence

- Repräsentiert jedes öffentlich belegte Feld zusammen mit Source-URL und `verifiedAt`.
- Trennt Official-/Event-/Ticket-/Checkout-URL-Rollen.
- Fehlende Evidenz bleibt fehlend; sie wird nicht aus der aktuellen kanonischen Zeile
  zurückerzeugt.
- Challenge-, Fehler- und unbrauchbare Seiten erzeugen keine Event-Identität.

### 3. IdentityResolver

- Ordnet Contributions nur bei belegbarer Titel-/Datum-/Venue-/Source-Kompatibilität demselben
  Event zu.
- Liefert stabile Identität, sicheren Match, `duplicate_candidate` oder `review`.
- Führt keine Whole-Row-Merges, DB-Writes oder automatische Duplicate-Merges aus.

### 4. CanonicalEventBuilder

- Führt ausschließlich belegte Felder mit klarer Quellenpriorität zusammen.
- Behält optionale Felder leer, wenn sie nicht sicher belegt sind.
- Widersprüchliche Werte werden nicht durch Reihenfolge oder Last-Write-Wins entschieden.
- Erzeugt einen kanonischen Entwurf, keinen Produktionswrite.

### 5. ReviewDecision

- Prüft Pflichtfelder, Widersprüche, Identity-Sicherheit und Duplicate-Hinweise.
- Erzeugt genau einen der fünf verbindlichen Endzustände.
- Isoliert unsichere Fälle, ohne sichere Events zu blockieren.

### 6. ImportRunner

- Orchestriert `SourceAdapter` → `EventEvidence` → `IdentityResolver` →
  `CanonicalEventBuilder` → `ReviewDecision`.
- Sammelt deterministische Ergebnisse und Fehler pro Source/Event.
- Enthält keine Canary-, Cutover-, Rollback-, Reparatur-, Manifest- oder Consumer-Logik.

## Explizit nicht Teil des Import-Cores

- Canary
- Cutover
- Rollback
- Provenance-Reparatur
- Ops-Manifeste
- Consumer-UI und Consumer-Projektion
- produktionsspezifische Einzeleventkorrekturen
- Bulk-/Cohort-/Forensic-Runner
- DB-Writer und produktiver Rollout

Solche Funktionen dürfen später als getrennte Ops-Funktionen auf dem stabilen Core aufbauen,
aber keine Abhängigkeit des Cores werden.

## Verbindliche Definition of Done für einen späteren Import

### Sichere Kerndaten

Ein Event darf nur veröffentlicht werden, wenn alle folgenden Kerndaten sicher und
widerspruchsfrei belegt sind:

- Titel
- Startdatum
- Venue oder eindeutig belegter Location-Text
- Source-/Official-URL
- stabile Event-Identität

### Optionale Felder

Folgende Felder dürfen fehlen:

- Beschreibung
- Genres
- Line-up
- Mindestalter
- Ticketpreis
- Ticketphasen
- Endzeit

Fehlende optionale Felder sind erlaubt. Falsche, erfundene oder widersprüchliche Werte sind
nicht erlaubt. Ein optionales Feld wird nur gesetzt, wenn seine Evidenz die gleiche sichere
Event-Identität trägt.

### Exakt ein Endzustand

Jedes verarbeitete Event endet in genau einem Zustand:

- `publish`: Kerndaten sicher; alle für diesen Lauf erwarteten optionalen Felder sicher.
- `publish_partial`: Kerndaten sicher; mindestens ein optionales Feld fehlt.
- `review`: Identität oder ein relevantes Feld ist unsicher/widersprüchlich; kein Publish.
- `duplicate_candidate`: belastbarer Duplicate-Hinweis; keine automatische Zusammenführung.
- `reject`: keine ausreichende Event-Identität oder Quelle liefert kein publizierbares Event.

`review`, `duplicate_candidate` und `reject` eines Events blockieren keine anderen sicheren
Events desselben Laufs.

## Empfohlene Reihenfolge für den nächsten kurzen Implementierungslauf

1. Einen bestehenden, stabilen Connector als einzigen `SourceAdapter` auswählen; keine neue
   Quellenfamilie und kein Live-/Bulk-Runner.
2. Das minimale `EventEvidence`-Modell mit Feld, Wert, Source-URL und `verifiedAt` definieren.
3. Einen sicheren Happy Path für genau eine Contribution und eine stabile Identität bauen.
4. `CanonicalEventBuilder` nur für Titel, Startdatum, Location und Official-/Source-URL
   implementieren.
5. `ReviewDecision` mit den fünf Endzuständen und den Pflichtfeldregeln hinzufügen.
6. Kleine generische Regressionstests neu schreiben: Challenge-Titel nicht als Identität,
   eingebettetes HTML vor Fetch, URL-Deduplizierung, fehlendes Optionalfeld ergibt
   `publish_partial`, Identity-Konflikt isoliert nur das betroffene Event.
7. Erst danach einen zweiten bestehenden Connector ergänzen und Identity-Zuordnung zwischen
   zwei Contributions prüfen.

Nicht im nächsten Lauf: Port des gesamten Verzeichnisses
`bulk-canonical-rebuild`, Cherry-Pick von `094bbdf8`, DB-Zugriff, Canary, Cutover, Rollback,
Produktionswrite oder Rollout.

## Phase 4.8.6.8.1 — Minimaler vertikaler Pfad

Der nächste Lauf wurde als strikt lokaler, DB-freier vertikaler Pfad umgesetzt:

`ConnectorOutput` → `EventEvidence[]` → `IdentityResolver` →
`CanonicalEventBuilder` → `ReviewDecision` → `CleanImportResult`

Gezielt vereinfachte KEEP-Bausteine:

- `detail-evidence-parser.ts`
- `event-evidence.ts`
- `detail-evidence-service.ts`
- `detail-fetch.ts`
- `url-roles.ts`
- `detail-fetch-cache.ts`

Neue Core-Verantwortlichkeiten:

- `source-adapter.ts`
- `identity-resolver.ts`
- `canonical-event-builder.ts`
- `review-decision.ts`
- `import-runner.ts`

Verbindliche Grenzen der Implementierung:

- Kein DB-Modell und kein bestehender kanonischer Datensatz ist Eingabe des Cores.
- Ohne `verifiedAt` werden keine Connector-Felder zu `EventEvidence`.
- Official-, Public-Ticket- und Checkout-URLs bleiben getrennte Rollen.
- Ticketquellen können `websiteUrl` nicht setzen oder überschreiben.
- Ticket.io-PoW ohne verwertbaren Inhalt erzeugt keine Identität.
- Admission-Preise werden nur aus als Admission klassifizierten Produkten gebildet.
- Unterschiedliches Datum, Venue oder Titelkern wird nicht zusammengeführt.
- Eine falsche Contribution wird isoliert; eine passende Contribution desselben Events bleibt
  nutzbar.
- TBA ist ein belegter leerer Line-up-Zustand und erzeugt keine Artists.

Offline-Verifikation:

- 14 fokussierte Vitest-Fälle
- sieben Referenz-Fixtures ohne DB-IDs oder Live-HTTP
- keine Ops-, Manifest-, Rollback-, Cutover- oder Writer-Dateien
