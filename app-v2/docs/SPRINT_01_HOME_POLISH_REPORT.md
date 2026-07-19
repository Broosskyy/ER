# Sprint 1 — Home Mobile Polish Report

**Date:** 2026-07-17  
**Reference:** `reference/mockups/screens/09_Home.jpg`  
**Scope:** Android device-test polish only — no new features

## Behobene Abweichungen (Gerätetest)

| Bereich | Problem | Korrektur |
|---------|---------|-----------|
| Statusleiste | Komplett ausgeblendet | Statusleiste sichtbar, helle Symbole (`StatusBar style="light"`) |
| Systemnavigation | — | Nur untere Navigationsleiste verborgen, Wischgeste via `NavigationBar.setHidden(true)` |
| Leerer Bereich unten | Großer dunkler Bereich vor Tabbar | `flexGrow: 1` entfernt; Tabbar-Padding nur einmal berechnet |
| Bottom-Navigation | Gequetscht / unklar | Höhe 58px, Icon 22/24px aktiv, einheitliche Abstände, kein doppeltes Safe-Area-Padding auf Android |
| Header | Zu hoch / verteilt | Höhe 48px, kompaktere Innenabstände, kleineres Logo |
| Suche & Filter | Zu viel vertikale Fläche | Suchfeld 40px, reduzierte Abstände, Chips 34px + größere Schrift |
| Featured-Slider | Feste 300px Breite | Breite aus Bildschirm (`screen - padding - peek`), Snap-Scrolling, Peek der nächsten Karte |
| Eventliste | Zu flach / kompakt | Thumbnail 108px, min. Zeilenhöhe 96px, mehr Innenabstand |
| Typografie | Teilweise zu klein | Tokens `xs` 12, `sm` 13, Chips/Metadaten leicht erhöht |

## Bewusst verbleibende Unterschiede zu Mockup 09

- **Logo:** Ionicons-Diamant statt Hex-Logo-Asset
- **Top Clubs:** Sektion nicht implementiert (Sprint 2+)
- **Suche:** Nicht editierbar (Platzhalter)
- **Filter-Icon / „Mehr anzeigen“:** Ohne Funktion
- **Preis auf Featured-Karten:** Nicht vorhanden
- **Benachrichtigungs-Dot:** Dekorativ, ohne Funktion

## Technisch bedingte Unterschiede

- Android-Statusleiste bleibt sichtbar (Geräteanforderung nach erstem Test)
- System-Navigationsleiste per Wischgeste nur vorübergehend sichtbar
- Demo-Bilder statt Live-API-Inhalte
- Keine Custom-Font — System-Sans-Serif

## Für späteren Sprint

- Echte Suche und Filterlogik
- Top-Clubs-Sektion
- Logo-Asset aus Designsystem
- Map-, Saved-, Profile-Screens
- Backend-Anbindung
