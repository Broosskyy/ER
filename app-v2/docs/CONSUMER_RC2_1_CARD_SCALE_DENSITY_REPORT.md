# Consumer RC2.1 — Card Scale & Density Correction

**Datum:** 2026-07-26

## Scope

Nur Größen-, Dichte- und Varianten-Zuordnung der Consumer-Cards. Featured, Daten, Navigation, Theme, Favoriten- und Suchlogik wurden nicht verändert.

## Vorher/Nachher

| Zone | Vorher | Nachher | Sichtbarkeit bei 390px | Verbleibende Abweichung |
|---|---:|---:|---:|---|
| Featured | 279px breit, Hero unverändert | 279px breit, Hero unverändert | 1 volle + Peek | Bewusst größte Card-Familie |
| Heute Abend | ca. 104px hoch, 80px Thumbnail | unverändert | ca. 5–6 Rows im nutzbaren Viewport | Keine |
| Top Clubs (Mobile) | 279px breit × ca. 496px hoch (9:16) | 143px breit × ca. 179px hoch (4:5) | **ca. 2,49 Cards** | Textoverlay bleibt bildstark, ist aber nicht mehr posterartig |
| Top Clubs (Desktop) | bis zu 723px breit × ca. 1.285px hoch | max. 160px breit × 200px hoch | 5 volle Cards bei 960px Content-Breite | Keine |
| Dieses Wochenende / Demnächst | 358px Bildbreite × ca. 447px Bildhöhe plus Meta | ca. 104px Row-Höhe, 80px Thumbnail | ca. 5–6 Rows im nutzbaren Viewport | Datum ist als Zeitwert rechts statt im Thumbnail |
| Home-Genrelisten | Full-width `verticalPremium` | `compactPremium` | ca. 5–6 Rows im nutzbaren Viewport | Weniger editorial als zuvor, absichtlich zugunsten Scanbarkeit |
| Events-Suchergebnisse / Collections | Full-width `verticalPremium` | `compactPremium` mit 16px horizontalem Einzug | ca. 5–6 Rows im nutzbaren Viewport | Keine |
| Events Explore | alle Sektionen Poster-Grid | nur Trending Poster-Grid, übrige Sektionen kompakte Rows | Trending 2 Spalten, weitere Sektionen Rows | Explore-Rows zeigen ohne expliziten Toggle kein Favorit-Overlay |

## Umgesetzt

- Top-Clubs-Rail von Featured-Hero-Breite entkoppelt; mobile Breite nutzt 40% des Content-Bereichs und Desktop ist auf 160px gedeckelt.
- Top-Clubs-Bildratio von 9:16 auf 4:5 reduziert.
- Home: Wochenende, Demnächst und Genrelisten verwenden dieselbe `compactPremium`-Familie wie Heute Abend.
- Events: gefilterte Ergebnisse und Collection-Listen verwenden `compactPremium` und denselben horizontalen Einzug.
- Explore: Trending bleibt als einzige Poster-Sektion; alle weiteren Explore-Sektionen nutzen kompakte Cards.

## Screenshots

Vorher: `docs/visual-qa/sprint-rc2/`

Nachher: `docs/visual-qa/sprint-rc2-1/`

- `mobile-featured.png`
- `mobile-tonight.png`
- `mobile-top-clubs.png`
- `mobile-weekend.png`
- `mobile-upcoming.png`
- `desktop-home.png`
- `desktop-top-clubs.png`
- `desktop-weekend.png`

## Verifikation

- `npm run typecheck` ✓
- `npm test -- src/features/home src/features/search` — 33/33 ✓

## Ist der Größenrhythmus des Home-Screens jetzt konsistent?

**JA**
