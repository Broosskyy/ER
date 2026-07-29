# Sprint 8 Phase 2 — Real Data Integration Report

**Branch:** `feature/er-012-source-acquisition-foundation`  
**Status:** Phase 2 abgeschlossen (keine externe Quelle aktiviert)  
**Datum:** 2026-07-27

---

## 1. Analysierter Bestand (Phase 2.1)

Vollständige Mapping-Matrix: [`REAL_DATA_DOMAIN_MAP.md`](./REAL_DATA_DOMAIN_MAP.md)

**Kernbefunde:**

- Dualer Import-Pfad bestehend (Aggregation + Orchestrator) — nicht erweitert
- Events, Source Registry, Admin Review, Search: produktiv
- Organizer/Venue/Artist: DB + Admin produktiv, Consumer denormalisiert
- Discovery-Services existierten nur in Tests → jetzt produktiv verdrahtet
- Saved/Follow/Notifications: lokal/Demo, keine Supabase-Persistenz
- Kein Scheduler-Runner (nur Schema + Vertrag)

---

## 2. Implementierte Änderungen

### 2.2 Kanonisches Domain-Modell

Beziehungen dokumentiert und per Migration vorbereitet (`canonical_event_id`, `duplicate_group_id`, Entity-Aliases). Keine produktiven Tabellen ersetzt.

### 2.3 Entity Resolution

| Resolver | Pfad |
|----------|------|
| `OrganizerIdentityResolver` | `src/features/entity-resolution/organizer-identity-resolver.ts` |
| `VenueIdentityResolver` | `src/features/entity-resolution/venue-identity-resolver.ts` |
| `ArtistIdentityResolver` | `src/features/entity-resolution/artist-identity-resolver.ts` |
| `InMemoryEntityAliasStore` | `src/features/entity-resolution/entity-alias-store.ts` |

Regeln: Confidence Score, Review bei Unsicherheit, Keep-Separate/Manual-Override respektiert.

### 2.4 Event Lifecycle + Clock

| Komponente | Pfad |
|------------|------|
| `Clock` / `SystemClock` / `FixedClock` | `src/core/clock/` |
| `EventLifecycleResolver` | `src/features/events/lifecycle/` |

Deterministische Statusableitung, 4h Default-Dauer, 90d Archiv-Schwelle.

### 2.5 Import Update

| Erweiterung | Pfad |
|-------------|------|
| `detectStartDateConflict`, `protectManualOverrides` | `import-update-service.ts` |
| `ImportSourcePresenceService` | `import-source-presence-service.ts` |

Missing-Threshold: 3 aufeinanderfolgende Fehlimporte, kein sofortiges Löschen.

### 2.6–2.8 Consumer-Verdrahtung

| Bereich | Änderung |
|---------|----------|
| Discovery | `discovery-feed-service.ts` — Eligibility + Ranking + Diversity + Lifecycle |
| Search | `buildEventSearchIndex` inkl. Organizer |
| Collections | `getDiscoverablePublishedEvents` statt roher Published-Liste |
| Saved Events | `FavoritesContext` speichert canonical IDs |
| Domain Events | `InMemoryRealDataDomainEventBus` (ohne Push) |

### 2.9 Scheduling-Vertrag

| Komponente | Pfad |
|------------|------|
| `ImportScheduleService` Interface | `import-schedule-types.ts` |
| `DefaultImportScheduleService` | `import-schedule-service.ts` |
| `InMemoryImportScheduleRepository` | Lock/Lease für Tests |

### 2.10 Quellenauswahl

[`FIRST_PRODUCTIVE_SOURCE_REQUIREMENTS.md`](./FIRST_PRODUCTIVE_SOURCE_REQUIREMENTS.md)

---

## 3. Bewusst nicht implementiert

| Bereich | Grund |
|---------|-------|
| Externe Produktivquelle | Stop-Punkt — Rechte/Zugang ungeklärt |
| Scheduler Edge Function / Runner | Datenfluss zuerst; nur Vertrag |
| Supabase `saved_events` / Follow-Tabellen | Bestehend lokal; Phase 3+ |
| Identity Resolver in Import-Pipeline verdrahtet | Resolver implementiert; Integration beim ersten echten Import |
| UI-Neugestaltung | Explizit ausgeschlossen |
| Profil-Screens über FK-IDs | Consumer nutzt weiterhin denormalisierte Strings; DB-FKs vorbereitet |

---

## 4. Migrationsänderungen

**Neu:** `supabase/migrations/20260742000000_real_data_entity_resolution_foundation.sql`

- `entity_identity_aliases`
- `entity_resolution_decisions`
- Lifecycle-Timestamps auf `events`
- `consecutive_missing_count` auf `event_source_references`
- Scheduling-Felder auf `sources`
- `import_schedule_locks`

Additiv, keine ID-Rewrites.

---

## 5. Neue Tests (+43)

| Suite | Tests |
|-------|-------|
| `clock.test.ts` | 2 |
| `event-lifecycle-resolver.test.ts` | 9 |
| `entity-identity-resolvers.test.ts` | 6 |
| `import-schedule-service.test.ts` | 6 |
| `import-source-presence-service.test.ts` | 5 |
| `import-update-service-phase2.test.ts` | 6 |
| `discovery-feed-service.test.ts` | 2 |
| `search-relationship-index.test.ts` | 4 |
| `real-data-entity-resolution-migration.test.ts` | 3 |

---

## 6. Verifikation

| Check | Ergebnis |
|-------|----------|
| **Typecheck** | ✅ grün |
| **Tests** | ✅ **810 / 810** bestanden |
| **Lint Errors** | ✅ **0** |
| **Lint Warnings** | 982 (bestehendes Niveau, keine neuen Errors) |
| **Migrationen** | ✅ `validate:migrations` grün |

---

## 7. Abnahmekriterien

| Kriterium | Status |
|-----------|--------|
| Eventmodell nicht isoliert | ✅ Beziehungen definiert + dokumentiert |
| Kanonische Beziehungen | ✅ Migration + Resolver |
| Zentrale Zeitlogik | ✅ Clock + LifecycleResolver |
| Saved Events Merge | ✅ Canonical-ID in FavoritesContext |
| Discovery Eligibility/Ranking/Diversity | ✅ `discovery-feed-service` |
| Search über Beziehungen | ✅ Organizer im Index |
| Manuelle Overrides geschützt | ✅ `protectManualOverrides` |
| Missing Source nicht sofort löschen | ✅ Presence Service |
| Scheduler-Vertrag | ✅ Service + Repository + Tests |
| Keine 4. Importarchitektur | ✅ |
| Dokumentation | ✅ `docs/real-data/*` |
| Keine externe Quelle aktiviert | ✅ |

---

## 8. Verbleibende Blocker

1. **Rechtliche Freigabe** für erste echte Quelle fehlt
2. **API-Zugangsdaten** nicht in Staging konfiguriert
3. ~~**Identity Resolver** noch nicht in Import-Pipeline~~ → **erledigt** (Phase 2 + Resolver-Integration)
4. **Saved/Follow** ohne Supabase — Merge-Schutz nur clientseitig
5. **Lifecycle-Timestamps** in DB noch nicht vom Import befüllt (Spalten existieren)
6. **Review Write-back** für Entity-Aliase/Decisions fehlt

---

## 9. Nächste erforderliche Entscheidung

**Welche vertraglich freigegebene Partner-Quelle wird als erste Produktivquelle aktiviert?**

Empfehlung: Einzelner Veranstalter oder Venue-Netzwerk mit JSON/API-Feed und schriftlicher Nutzungsfreigabe.

Erforderlich vor Phase 3:

- [ ] Quelle + Ansprechpartner benennen
- [ ] Nutzungsbedingungen dokumentieren
- [ ] Staging-Credentials bereitstellen
- [ ] Resolver in Import-Pipeline integrieren
- [ ] Admin-Review mit realem Datensatz durchführen

---

## 10. Dokumentation

| Datei | Inhalt |
|-------|--------|
| `REAL_DATA_DOMAIN_MAP.md` | Mapping-Matrix |
| `EVENT_LIFECYCLE.md` | Zeitlogik |
| `ENTITY_RESOLUTION.md` | Resolver-Regeln |
| `IMPORT_UPDATE_RULES.md` | Update + Missing |
| `SCHEDULING_ARCHITECTURE.md` | Scheduler-Vertrag |
| `FIRST_PRODUCTIVE_SOURCE_REQUIREMENTS.md` | Quellenanforderungen |
| `PHASE_2_REPORT.md` | Dieser Bericht |

**Phase 3 wird nicht automatisch gestartet.**

---

## Phase 2B — Supabase Entity Alias Store (2026-07-27)

### Implementierte Persistenz

| Komponente | Pfad |
|------------|------|
| `SupabaseEntityAliasStore` | `src/features/entity-resolution/supabase-entity-alias-store.ts` |
| `SupabaseEntityAliasDatasource` | `src/data/datasources/supabase/supabase-entity-alias-datasource.ts` |
| `createEntityAliasStore()` | `src/features/entity-resolution/create-entity-alias-store.ts` |
| `initializeEntityAliasStore()` | `src/features/entity-resolution/entity-alias-store-bootstrap.ts` |

### Migration

`20260743000000_entity_alias_store_persistence.sql` — metadata, updated_at, erweiterte decision types, Indizes, Admin-RLS.

### Registry

- `useSupabase=true` → `SupabaseEntityAliasStore` (hydrate in bootstrap)
- `useSupabase=false` → `InMemoryEntityAliasStore`
- Eine shared `entityAliasStore`-Instanz für alle Resolver + ImportMatchingService

### Tests (+10)

- `entity-alias-store.test.ts`
- `supabase-entity-alias-store.test.ts` (mocked datasource)
- `create-entity-alias-store.test.ts`
- `entity-alias-store-persistence-migration.test.ts`

### Verbleibende Blocker (Phase 2B)

1. Review Write-back noch nicht implementiert
2. Keine echte Supabase-Integrationstest-DB in CI
3. Produktivquelle weiterhin nicht aktiviert

### Nächster Schritt

Review Write-back für manuelle Overrides → `entityAliasStore.saveDecision()` / `saveAlias()`.
