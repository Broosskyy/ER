# Supabase Entity Alias Store

Persistente Umsetzung des `EntityAliasStore`-Vertrags für Organizer-, Venue- und Artist-Resolution.

## Zweck

Identity-Resolver lesen Aliase und manuelle Entscheidungen während `ImportMatchingService.match()`. Der Supabase Store hydratisiert diese Daten beim App-Bootstrap und persistiert Schreibvorgänge kontrolliert.

## Tabellen

| Tabelle | Zweck |
|---------|-------|
| `entity_identity_aliases` | Kanonische ID ↔ normalisierter Alias |
| `entity_resolution_decisions` | Keep-Separate / Manual-Match Entscheidungen |

Migrationen:
- `20260742000000_real_data_entity_resolution_foundation.sql` (Basis)
- `20260743000000_entity_alias_store_persistence.sql` (Spalten, Indizes, RLS)

## Schema-Mapping

| Domain | DB-Spalte |
|--------|-----------|
| `canonicalId` | `canonical_id` |
| `aliasValue` (normalisiert) | `alias_value` |
| `aliasType` | `alias_type` |
| `sourceId` | `source_id` |
| `originalAlias` | `original_alias` |
| `metadata` | `metadata` (jsonb) |
| `decision: manual_override` | `decision: manual_match` |
| `decision: keep_separate` | `decision: keep_separate` |
| `candidateKey` | `candidate_key` |

## Store-Methoden

| Methode | Verhalten |
|---------|-----------|
| `initialize()` | Lädt Aliase + Decisions in Cache |
| `findCanonicalId()` | Sync-Read aus Cache |
| `listAliases()` | Sync-Read aus Cache |
| `getDecision()` | Sync-Read aus Cache |
| `saveAlias()` | Cache + async Persist via `flush()` |
| `saveDecision()` | Cache + async Persist via `flush()` |
| `flush()` | Schreibt pending Queue nach Supabase |
| `isInitialized()` | Bootstrap-Status |

## Prioritätsregeln

1. `getDecision()` / manuelle Overrides vor Fuzzy-Match (Resolver)
2. `keep_separate` blockiert spätere Auto-Matches
3. `manual_override` / `manual_match` hat Vorrang vor automatischer Auflösung
4. Alias-Konflikt (gleicher Alias → andere canonical ID) → `EntityAliasStoreError conflict`

## Registry-Verdrahtung

```typescript
const entityAliasStoreInstance = createEntityAliasStore();
const importMatchingBundle = createImportMatchingService(entityAliasStoreInstance);
```

`createEntityAliasStore()`:
- `useSupabase=true` → `SupabaseEntityAliasStore`
- `useSupabase=false` → `InMemoryEntityAliasStore`

Bootstrap (`app-bootstrap.ts`):
- Supabase-Modus ruft `initializeEntityAliasStore()` nach Event-Repository-Init auf

## Local vs Supabase

| Modus | Store | Initialisierung |
|-------|-------|-----------------|
| Local (`useSupabase=false`) | InMemory | sofort nutzbar |
| Supabase | SupabaseEntityAliasStore | `initialize()` Pflicht |

**Kein stiller Fallback** von Supabase auf InMemory bei DB-Ausfall. Initialisierungsfehler → `EntityAliasStoreError database_unavailable` → Bootstrap schlägt fehl.

## Fehlerverhalten

`EntityAliasStoreError` Codes:
- `database_unavailable`
- `persistence_failed`
- `conflict`
- `invalid_input`
- `unauthorized`
- `not_found`

## RLS

Nur `is_admin()` darf lesen/schreiben. Keine öffentlichen Schreibrechte.

## Bekannte Einschränkungen

- Review Write-back implementiert: `ImportReviewService.editRecord` / `approveRecord` → `entityAliasStore.saveDecision()` / `saveAlias()` bei manuellen Overrides und bestätigten Matches.
- Keine echte Supabase-Test-DB in CI — Persistence via Mock-Datasource getestet
- Schreibvorgänge sind async (`flush`) — Import liest primär aus Hydration

## Nächster Schritt

Erste kontrollierte Quelle in Staging — nur nach dokumentierter Freigabe und deployter Migration.
