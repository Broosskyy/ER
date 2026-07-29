# Resolver Import Integration

Integration der Entity-Identity-Resolver in die **bestehende** Import-Pipeline — ohne parallele Architektur.

## Architekturprinzip

Alle Import-Pfade laufen über einen einzigen Choke-Point:

```
ImportOrchestrator ──┐
ImportAggregationService ──┼──► ImportMatchingService.match()
ImportReviewService.approveRecord ──┘
                              │
                              ▼
              OrganizerIdentityResolver
              VenueIdentityResolver
              ArtistIdentityResolver
                              │
                              ▼
              (delegiert an bestehende *MatchingService)
```

Kein neuer Pipeline-Step. Kein vierter Import-Pfad.

## Integrierte Resolver

| Resolver | Aufgabe | Delegiert an |
|----------|---------|--------------|
| `OrganizerIdentityResolver` | external ID, URL, Domain, Name, Social, Aliase | `organizerMatchingService` |
| `VenueIdentityResolver` | external ID, Name, Adresse, Stadt, Domain | `venueMatchingService` |
| `ArtistIdentityResolver` | external ID, Aliase, Profile-URL pro Line-up-Eintrag | `artistMatchingService` |

City-, Genre- und Duplicate-Matching bleiben unverändert in `ImportMatchingService`.

## Neue / geänderte Dateien

| Datei | Rolle |
|-------|-------|
| `import-matching-service.ts` | Resolver-Pfad + Legacy-Fallback |
| `entity-resolution-match-bridge.ts` | Outcome → MatchResult, Logs, Metadata |
| `create-import-matching-service.ts` | Factory mit shared `EntityAliasStore` |
| `registry.ts` | Shared `importMatchingService` + `entityAliasStore` |
| `import-aggregation-service.ts` | `matchingService` per Constructor injizierbar |
| `import-review-service.ts` | `matchingService` per Constructor injizierbar |

## Registry-Verdrahtung

```typescript
const importMatchingBundle = createImportMatchingService();
export const importMatchingService = importMatchingBundle.matchingService;
export const entityAliasStore = importMatchingBundle.aliasStore;

// Alle drei Import-Pfade nutzen dieselbe Instanz:
importOrchestrator(..., importMatchingService)
importAggregationService(..., importMatchingService)
importReviewService(..., importMatchingService)
```

## Metadata-Konvention (NormalizedEventCandidate.sourceMetadata)

Optional, für Quellen mit stabilen externen IDs:

| Key | Verwendung |
|-----|------------|
| `externalOrganizerId` / `organizerExternalId` | Organizer-Alias |
| `organizerUrl` / `organizerWebsite` | Domain/URL-Match |
| `organizerSocialHandle` | Social-Match |
| `externalVenueId` / `venueExternalId` | Venue-Alias |
| `venueWebsite` / `venueUrl` | Venue-Domain |
| `externalArtistId` / `artistExternalId` | Artist-Alias |
| `artistProfileUrl` / `artistUrl` | Artist-Profil |

## Entscheidungs-Mapping

| Outcome | matchedVenueId / matchedOrganizerId / matchedArtistIds | Warning |
|---------|--------------------------------------------------------|---------|
| `matched` | gesetzt | — |
| `manual_override` | gesetzt | — |
| `review_required` | gesetzt (wenn canonicalId) | ja |
| `keep_separate` | nicht gesetzt | ja |
| `unmatched` | nicht gesetzt | ja |

## Tests

| Suite | Tests | Abdeckung |
|-------|-------|-----------|
| `import-matching-entity-resolution.test.ts` | 4 | Factory, external ID, keep-separate, Legacy-Fallback |
| `entity-identity-resolvers.test.ts` | 6 | Resolver-Einzelverhalten |
| `registry-multi-source.test.ts` | +1 | Shared Wiring in Registry |
| `import-matching.test.ts` | 13 | Legacy-Pfad unverändert |
| `import-aggregation-service.test.ts` | 3 | Aggregation mit Default-Matching |
| `import-review.test.ts` | 17 | Review-Flow |

**Gesamt:** 815 Tests grün (Stand Integration).

## Verbleibende Blocker

| Blocker | Beschreibung |
|---------|--------------|
| **Persistenter AliasStore** | `InMemoryEntityAliasStore` — Entscheidungen gehen bei App-Neustart verloren. DB-Tabellen existieren (`entity_identity_aliases`, `entity_resolution_decisions`), Supabase-Implementierung fehlt noch. |
| **Review Write-back** | Manuelle `reviewerEdits` werden noch nicht als `saveDecision`/`saveAlias` persistiert. |
| **Produktivquelle** | Bewusst nicht aktiviert — Rechte/Zugang offen. |
| **Connector-Metadata** | Connectors müssen `sourceMetadata`-Felder befüllen, sobald echte Quelle angebunden wird. |

## Nächster Schritt (nach Freigabe)

1. `SupabaseEntityAliasStore` implementieren (Migration 202607420)
2. `ImportReviewService.editRecord` → Alias/Decision Write-back bei manuellen Overrides
3. Erste kontrollierte Quelle in Staging — nur nach dokumentierter Freigabe

**Keine produktive Quelle aktivieren, bis Alias-Persistenz und Staging-Review abgeschlossen sind.**
