# Home Final Sync + Discovery Foundation

**Datum:** 2026-07-26

## Geänderte Dateien

- `app/(tabs)/index.tsx`
- `app/(tabs)/search.tsx`
- `app/design-preview.tsx`
- `src/features/home/__tests__/home-location-header.test.ts`
- `src/features/i18n/locales/de.ts`
- `src/features/i18n/locales/en.ts`
- `src/features/search/components/ExploreFeed.tsx`
- `src/features/search/components/SearchEmptyState.tsx`
- `src/features/search/components/SearchResultsMeta.tsx`
- `src/features/search/components/index.ts`
- `scripts/capture-rc2-screenshots.mjs`
- `docs/CONSUMER_RC2_2_HEADER_NAVIGATION_REPORT.md`

## Neu angelegte Dateien

- `docs/CONSUMER_HOME_FINAL_SYNC_DISCOVERY_FOUNDATION_REPORT.md`
- `docs/visual-qa/home-final-sync-discovery-foundation/*`

## Finale Home-Regeln

- Der finale Home-Header bleibt: mittiges Eternal-Rave-Logo, nicht-interaktives Activity-Placeholder rechts, keine Suche, kein Filter.
- Featured, Heute Abend und Top Clubs haben keine Action im Section-Header.
- Vertikale Home-Listen verwenden ausschließlich `Alle →`.
- Es bleiben die bestehenden Varianten `featuredHome`, `compactPremium` und `VenueSpotlightCard` aktiv.
- Section-Abstände, Außenabstände, Kartenabstände, Safe Areas und Scroll-Container wurden nicht verändert.
- Die veraltete visuelle Home-Master-Preview wurde aus der Design-Vorschau entfernt, damit sie keinen nicht mehr gültigen Header mit Suche/Filter oder alte Card-Varianten dokumentiert.

## Stand Events / Discovery

- Der Tab heißt weiterhin **Events**.
- Der Einstieg enthält eine klare Überschrift, globale Suche, Quick-Filter, Filter-Sheet, Explore-Inhalte, Ergebnisliste und Empty State.
- Trending bleibt die größere Discovery-Fläche; weitere Explore-Sektionen verwenden die bestehende kompakte Event-Card.
- Ergebniszähler und Empty State sind lokalisiert.
- `NoResultsState`, `SearchLoadingState` und `SearchErrorState` sind über das Search-Feature als vorhandene Präsentationszustände erreichbar.
- Das synchrone lokale Repository liefert derzeit unmittelbar Daten. Es wurde keine künstliche Lade- oder Fehlerlogik eingeführt; echte Zustandswechsel werden mit einer späteren asynchronen Datenquelle verbunden.

## Navigationstest

- Home-Eventkarten → Event Detail: bestehender `EventDiscoveryCard`-Pfad unverändert.
- Section-Actions vertikaler Listen → Collection: unverändert.
- Bottom Navigation → Home, Events, Saved, Profile: unverändert.
- Activity-Icon: absichtlicher, beschrifteter, nicht-interaktiver Placeholder ohne toten Button.
- Club-Karten führen weiterhin zur bestehenden Events-Discovery; kein Club-Detail existiert im Scope.

## Testergebnis

- `npm run typecheck` ✓
- `npm test -- src/features/home src/features/search src/features/i18n` — **49/49** ✓
- IDE-Linter auf geänderten Dateien ✓

## Verbleibende visuelle Abweichungen

1. Loading- und Error-Zustände können ohne asynchrone Quelle nicht produktiv ausgelöst werden.
2. Explore-Poster-Karten bleiben für Trending größer als die kompakten Discovery-Listen; das ist die beabsichtigte Hierarchie.
3. Club-Details und eine vorbefüllte Venue-Discovery sind noch nicht vorhanden.

## Screenshot-Empfehlungen

Aktueller Web-QA-Stand:

- `docs/visual-qa/home-final-sync-discovery-foundation/home-mobile-light.png`
- `docs/visual-qa/home-final-sync-discovery-foundation/home-mobile-dark.png`
- `docs/visual-qa/home-final-sync-discovery-foundation/home-desktop-light.png`
- `docs/visual-qa/home-final-sync-discovery-foundation/events-mobile-discovery.png`
- `docs/visual-qa/home-final-sync-discovery-foundation/events-desktop-discovery.png`

Für den nächsten Sprint zusätzlich Android Portrait auf kleinem und großem Gerät für Events-Detail, Ticket-Placeholder und Zurück-Navigation aufnehmen.

## Empfehlung für den nächsten Sprint

**EVENTS DISCOVERY + EVENT DETAIL FINAL**
