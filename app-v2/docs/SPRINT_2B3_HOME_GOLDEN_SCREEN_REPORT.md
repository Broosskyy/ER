# Sprint 2B.3 — Home Golden Screen (Visual Alignment)

**Datum:** Juli 2026  
**Scope:** Nur Home-Screen · keine Features · keine Saved-Migration  
**Referenz:** Mockup 09 Home (Dark), Sprint 2A.5 Mobile Master, ER_CONSUMER_VISUAL_POLISH

---

## Durchgeführte visuelle Anpassungen (dieser Sprint)

| Bereich | Änderung |
|---------|----------|
| Header | Linksbündiges Accent-Wordmark, kompaktere Höhe (48px), Actions rechts ohne Phantom-Spacer |
| Featured | Bildverhältnis 5:6, borderlose Karte, Overlay-Datumsbadge, kompaktere Meta/Chips, Location sekundär |
| Tonight | `density="relaxed"`: 72px Thumbnail, mehr Row-Padding, Status-Badges entfernt, Overlay-Datum |
| Clubs | Volle Kartenbreite, 9:16 Portrait, Scrim-Overlay, Magazin-Typo auf Bild |
| Weißraum | `homeGoldenSpacing`: 24px Sektionsabstände, 20px erster Block, 16px Tonight-Gaps |
| Tokens | `homeTonightThumbnailSize`, angepasste `featuredHomeAspectRatio`, `venueSpotlightAspectRatio` |

---

## Zonenanalyse

### 1. Header

| | |
|---|---|
| **Aktuelle Schwäche (vorher)** | Zentriertes Wordmark mit leeren 88px-Seitenflächen wirkte wie Platzhalter-Layout, nicht wie Editorial-Header. Zu hoch (56px), zu wenig Markenpräsenz. |
| **Warum schwächer als Referenz** | Mockup: Logo + Wordmark links, Notification rechts — klare horizontale Achse, keine tote Mitte. |
| **Konkrete Änderung** | Wordmark links in `accent`, `minHeight: 48`, Actions-Cluster rechts, Phantom-`sideSlot` entfernt. |
| **Sichtbare Verbesserung** | Header wirkt leichter, Markenfarbe trägt Identität, weniger „Admin-Toolbar“. |
| **Verbleibende Abweichung** | Mockup zeigt Hex-Logo links — im Produkt fehlt das Logo-Asset. Notification nur wenn eingeloggt. |

---

### 2. Home Search Trigger (Lupe)

| | |
|---|---|
| **Aktuelle Schwäche** | Kleine Lupe im Header ist funktional korrekt (2B.2), visuell aber dezenter als Mockup-Suchleiste. |
| **Warum schwächer** | Referenz Mockup 09: große Suchleiste unter Location erzeugt „Discovery-Einstieg“. 2B.2 hat bewusst Header-Lupe statt Fake-Bar gewählt. |
| **Konkrete Änderung** | Keine Änderung in 2B.3 (Scope: keine Feature-/Nav-Änderung). |
| **Sichtbare Verbesserung** | — |
| **Verbleibende Abweichung** | Visuell weniger dominant als Mockup-Suchfeld; bewusster Produktkompromiss aus 2B.2. |

---

### 3. Standort (Location)

| | |
|---|---|
| **Aktuelle Schwäche** | Location-Pill allein, ohne Filter-Icon rechts auf derselben Zeile — wirkt unvollständig gegenüber Mockup. |
| **Warum schwächer** | Mockup: Location + Filter-Icon in einer Zeile, volle Breite genutzt. |
| **Konkrete Änderung** | `marginBottom` auf 12px erhöht für Atem vor erster Sektion. |
| **Sichtbare Verbesserung** | Mehr Luft zwischen Location und Content. |
| **Verbleibende Abweichung** | Kein Filter-Icon neben Location (keine neue Navigation in diesem Sprint). |

---

### 4. Featured Section („Events near you“)

| | |
|---|---|
| **Aktuelle Schwäche** | Karten wirkten technisch: sichtbarer Card-Rand, Bild nicht dominant genug (11:10), helles Datumsbadge auf Bild, zu viel Textgewicht. |
| **Warum schwächer** | Mockup: Bild ~60% der Karte, dunkles Datum auf Bild, borderlose dunkle Fläche, Preis klar akzentuiert, Chips klein. |
| **Konkrete Änderung** | Aspect 5:6, `borderWidth: 0`, Gap Bild/Text 0, Overlay-Datumsbadge, Location `textSecondary`, kleinere Genre-Chips, Preis semibold accent. |
| **Sichtbare Verbesserung** | Bild dominiert, Karte wirkt flyer-nah, weniger „UI-Kasten“. |
| **Verbleibende Abweichung** | Auf sehr kleinen Geräten (<360px) Textblock noch relativ dicht; echte Flyer-Crops variieren je nach Asset. |

---

### 5. Tonight („Heute Abend“)

| | |
|---|---|
| **Aktuelle Schwäche** | 64px-Thumbnails, Status-Badges, enge Rows — wirkten wie Admin-/Review-Liste. |
| **Warum schwächer** | Mockup: größere Thumbnails, nur Titel/Location/Chips/Zeit/Herz — keine Status-Chrome. |
| **Konkrete Änderung** | `density="relaxed"`: 72px Thumb, 16px Row-Padding, Status entfernt, Overlay-Datum, Zeit muted. |
| **Sichtbare Verbesserung** | Rows atmen, Fokus auf Event + Bild, weniger Dashboard. |
| **Verbleibende Abweichung** | Keine dezenten Row-Trennlinien wie im Mockup; EN-Titel „Tonight“ statt „Heute Abend“. |

---

### 6. Top Clubs

| | |
|---|---|
| **Aktuelle Schwäche** | Karten zu klein (92% Breite), 3:4 zu quadratisch, flaches Overlay — wirkten wie Mini-Karten, nicht Magazin. |
| **Warum schwächer** | Mockup: hohe Portrait-Karten, fast nur Bild, Name/City im unteren Scrim. |
| **Konkrete Änderung** | Volle Pair-Breite (~173px), Aspect 9:16, Gradient-Scrim oben/unten, größeres Bottom-Padding. |
| **Sichtbare Verbesserung** | Clubs wirken bildstark und lifestyle-nah. |
| **Verbleibende Abweichung** | Fixture-Daten, keine echten Venue-Hero-Bilder; Tap führt zu Search statt Club-Detail. |

---

### 7. Weißraum

| | |
|---|---|
| **Aktuelle Schwäche** | 16px Sektionsabstände wirkten gedrängt — Content stapelte sich. |
| **Warum schwächer** | Mockup / 2A.5: großzügigere vertikale Rhythmik zwischen Hero-Bereichen. |
| **Konkrete Änderung** | `homeGoldenSpacing`: firstSection 20px, sections 24px, tonight rows 16px, clubs top 24px. |
| **Sichtbare Verbesserung** | Screen atmet, Sektionen sind klar getrennt ohne Extra-Borders. |
| **Verbleibende Abweichung** | Untere Sektionen (Weekend/House) noch mit gleichem Rhythmus — nicht separat feinjustiert. |

---

### 8. Typografie-Hierarchie

| | |
|---|---|
| **Aktuelle Schwäche** | Titel, Location und Meta konkurrierten auf gleicher visueller Stufe. |
| **Warum schwächer** | Mockup: Titel dominant, Location/Chips/Zeit deutlich leiser. |
| **Konkrete Änderung** | Location + Zeit auf `textSecondary`; Genre bleibt accent aber klein; Section-Titles unverändert `titleSmall`. |
| **Sichtbare Verbesserung** | Titel springt hervor, Meta tritt zurück. |
| **Verbleibende Abweichung** | Section-Titles noch EN; Mockup DE. |

---

### 9. Karten-Chrome

| | |
|---|---|
| **Aktuelle Schwäche** | Sichtbare Borders und graue Flächen um Bilder. |
| **Warum schwächer** | Mockup: Bild bis an Kartenrand, dunkle Fläche ohne harte Linie. |
| **Konkrete Änderung** | Featured borderless; List ohne Card-Wrapper; Clubs nur Bild+Scrim. |
| **Sichtbare Verbesserung** | Weniger „Komponenten-Look“, mehr Editorial. |
| **Verbleibende Abweichung** | Compact-Cards in Weekend/House-Sektionen noch mit Standard-Chrome. |

---

### 10. Bilder

| | |
|---|---|
| **Aktuelle Schwäche** | Bildanteil zu gering bei Featured; Clubs zu niedrig. |
| **Warum schwächer** | Eternal Rave = „Flyer in der Tasche“ — Bild muss emotional führen. |
| **Konkrete Änderung** | Höhere Aspect Ratios, Full-bleed Top in Featured, Club-Portrait verlängert. |
| **Sichtbare Verbesserung** | Poster/Flyer-Wirkung deutlich stärker. |
| **Verbleibende Abweichung** | Demo-Poster nicht 1:1 Mockup-Crops; echte Venue-Bilder fehlen. |

---

### 11. Bottom Navigation

| | |
|---|---|
| **Aktuelle Schwäche** | Nicht in diesem Sprint geändert. |
| **Warum schwächer** | Mockup: 5 Tabs inkl. Map sichtbar; Produkt hat Map ausgeblendet (`href: null`). |
| **Konkrete Änderung** | Keine (keine Nav-Änderung erlaubt). |
| **Sichtbare Verbesserung** | — |
| **Verbleibende Abweichung** | 4 sichtbare Tabs statt 5; Icon-Set leicht anders (calendar vs. events). |

---

## Geänderte Dateien

- `app/(tabs)/index.tsx`
- `src/design/layout.ts`
- `src/components/discovery/EventCard.tsx`
- `src/components/discovery/EventListItem.tsx`
- `src/components/discovery/VenueSpotlightCard.tsx`
- `src/features/home/components/HomeHeader.tsx`
- `src/features/home/home-golden-spacing.ts` (neu)
- `src/features/home/data/home-club-fixtures.ts`
- `src/features/events/components/EventDiscoveryListItem.tsx`
- Tests: `home-location-header.test.ts`, `search-interaction-layout.test.ts`

## Qualität

- TypeScript ✅
- Tests: **639 passed**

---

## Ehrliche Gesamteinschätzung

**Kann dieser Home-Screen jetzt als Golden Screen für alle weiteren Consumer-Screens verwendet werden?**

## NEIN

### Verbleibende konkrete Punkte (max. 5)

1. **Marken-Header unvollständig** — Hex-Logo und DE-Wordmark-Behandlung wie Mockup 09 fehlen; Header-Lupe ersetzt visuell nicht die Mockup-Suchleiste.
2. **Location-Zeile** — Filter-Icon / volle Breiten-Komposition aus Mockup nicht umgesetzt.
3. **Sprache & Labels** — EN-Section-Titles („Tonight“, „See all“) statt DE-Mockup („Heute Abend“, „Mehr anzeigen“).
4. **Top Clubs** — Fixture-Bilder und fehlende Venue-Detail-Navigation; noch nicht produktionsnah.
5. **Geräte-Verifikation ausstehend** — Golden-Screen-Status erfordert visuelles Sign-off auf realem Android (390px, Light + Dark) gegen Mockup 09; Code-Anpassungen allein reichen nicht.

Erst nach Behebung dieser Punkte und visueller Freigabe auf Gerät kann die Saved-Migration beginnen.
