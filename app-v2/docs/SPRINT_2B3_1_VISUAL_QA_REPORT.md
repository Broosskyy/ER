# Sprint 2B.3.1 — Visual QA Report

**Datum:** 2026-07-26  
**Stand:** Sprint 2B.3.1 (Expo Dev Server, kein Code geändert)

---

## Capture-Umgebung

| Parameter | Wert |
|-----------|------|
| **Web-URL** | `http://localhost:8081` |
| **Server** | `npx expo start --web --port 8081` (Metro Bundler) |
| **Browser** | Chromium 136.0.7103.25 (Playwright headless) |
| **Mobile Viewport** | 390 × 844 px, `deviceScaleFactor: 3` |
| **Desktop Viewport** | 1440 × 1000 px, `deviceScaleFactor: 1` |
| **Light/Dark** | `prefers-color-scheme` Emulation (`colorScheme: light/dark`) |
| **Suchbegriff (Events)** | `techno` |
| **Mockup-Referenz** | `.mockup-inventory-temp/_all/09_Home.png` |
| **APK** | `C:\ER\releases\Eternal-Rave-v0.2.0-preview-2b3.1.apk` |
| **Android** | **NOT TESTED** — kein Emulator, kein Gerät (`adb devices` leer) |

---

## Erzeugte Screenshots

### Mobile Web — `docs/visual-qa/sprint-2b3-1/mobile-web/`

| Datei | Light | Dark | Inhalt |
|-------|-------|------|--------|
| `01-home-top.png` | ✓ | ✓ | Header, Location, Featured-Anfang |
| `02-home-featured.png` | ✓ | ✓ | Featured-Sektion |
| `03-home-tonight.png` | ✓ | ✓ | Heute-Abend-Sektion |
| `04-home-clubs.png` | ✓ | ✓ | Top-Clubs-Sektion |
| `05-home-bottom-nav.png` | ✓ | ✓ | Unterer Home-Bereich + Bottom Nav |
| `06-events-search-empty.png` | ✓ | ✓ | Events-Tab, leere Suche |
| `07-events-search-active.png` | ✓ | ✓ | Events-Tab, Suche `techno` |
| `08-home-full-page.png` | ✓ | ✓ | Home nach Scroll (Viewport-Capture, kein echtes Stitching) |

### Desktop Web — `docs/visual-qa/sprint-2b3-1/desktop-web/`

| Datei | Light | Dark | Inhalt |
|-------|-------|------|--------|
| `01-home-full.png` | ✓ | ✓ | Gesamtansicht (Viewport) |
| `02-home-header-first-section.png` | ✓ | ✓ | Header + erste Sektion |
| `03-home-featured.png` | ✓ | ✓ | Featured-Bereich |
| `04-home-tonight.png` | ✓ | ✓ | Heute-Abend-Bereich |
| `05-home-clubs.png` | ✓ | ✓ | Top-Clubs-Bereich |
| `06-events-search-active.png` | ✓ | ✓ | Events mit Suche `techno` |

### Android App — `docs/visual-qa/sprint-2b3-1/android-app/`

**NOT TESTED** — keine Screenshots erzeugt. Siehe `android-app/NOT_TESTED.md`.

### Vergleichsbilder — `docs/visual-qa/sprint-2b3-1/`

| Datei | Inhalt |
|-------|--------|
| `comparison-mobile-light.png` | Mockup 09 vs. Mobile Web Light (01-home-top) |
| `comparison-mobile-dark.png` | Mockup 09 vs. Mobile Web Dark (01-home-top) |
| `comparison-desktop.png` | Mockup 09 vs. Desktop Web Light (01-home-full) |

---

## Bekannte Einschränkungen

1. **Android fehlt** — App-Screenshots konnten nicht erstellt werden.
2. **RN-Web-Scroll** — Sektions-Scroll per `scrollIntoView`; einige Mobile-Screenshots (02/03) zeigen ähnliche Viewport-Ausschnitte.
3. **Desktop 02–04 (Light/Dark)** — identische Dateigröße; Scroll-Container auf Desktop hat Header/Featured teils unverändert im Viewport gelassen. `05-home-clubs.png` zeigt korrekt tiefere Sektionen.
4. **Full-Page Home** — `08-home-full-page.png` ist ein Viewport-Screenshot nach Scroll, kein echtes Full-Page-Stitching (RN-Web `overflow: hidden` auf `body`).
5. **Mockup-Vergleich Light vs. Dark** — Referenz-Mockup ist Dark; Light-Mode-Vergleich ist thematisch unterschiedlich.
6. **Dev-Server** — Screenshots aus laufendem Metro (`localhost:8081`), nicht aus statischem `dist/`-Export.

---

## Sichtbare Unterschiede

### Mobile Web vs. Mockup 09

| Bereich | Abweichung |
|---------|------------|
| Logo | Mockup: Icon + Wordmark; App: nur Text-Wordmark „ETERNAL RΛVE“ |
| Location | Mockup: „Berlin, Germany“; App: „Standort auswählen“ |
| Suche/Filter | Mockup: Suchleiste + Chip-Reihe; App: nur Lupe im Header + Filter-Icon an Location |
| Featured | Mockup: 2-up-Karten; App: eine große Karte sichtbar (Rail nicht vollständig im Viewport) |
| Tonight | Struktur ähnlich; Mockup dichter, feinere Trennlinien |
| Clubs | Mockup: kompakte Venue-Karten; App: große Portrait-Karten (Sprint 2B.3 Design) |
| Theme | Mockup Dark; Mobile-Light-Screenshots naturgemäß heller |

### Mobile Web vs. Desktop Web

| Bereich | Abweichung |
|---------|------------|
| Navigation | Mobile: Bottom Tab Bar; Desktop: Top-Nav-Bar (Home/Events/Saved/Profile) |
| Content-Breite | Desktop: schmale zentrierte Spalte, große seitliche Leerflächen |
| Featured | Desktop: einzelne Karte statt horizontaler 2-up-Rail |
| Clubs | Desktop: zwei große Portrait-Karten nebeneinander, sehr dominant |

### Mobile Web vs. Android App

**NOT TESTED** — kein Vergleich möglich.

### Events-Suche (Mobile Web)

- Placeholder und Quick-Filter weiterhin **Englisch** („Search events…“, „Today“, „This Weekend“, „Filters“)
- Home-Texte sind Deutsch, Events-Tab nicht vollständig lokalisiert

### Querschnitt (alle getesteten Web-Ansichten)

- **Roter Fehler-Toast** auf Home sichtbar: `'<button> cannot contain a nested...'` (React/HTML-Nesting-Warnung)

---

## Bewertung nach Bereich

| Bereich | Mobile Web | Desktop Web | Android App | vs. Mockup |
|---------|------------|-------------|-------------|------------|
| **1. Header** | MINOR DEVIATION | MINOR DEVIATION | NOT TESTED | MAJOR DEVIATION |
| **2. Featured** | MINOR DEVIATION | MAJOR DEVIATION | NOT TESTED | MAJOR DEVIATION |
| **3. Heute Abend** | PASS | PASS | NOT TESTED | MINOR DEVIATION |
| **4. Top Clubs** | MINOR DEVIATION | MINOR DEVIATION | NOT TESTED | MINOR DEVIATION |
| **5. Typografie** | PASS | PASS | NOT TESTED | MINOR DEVIATION |
| **6. Weißraum** | PASS | MINOR DEVIATION | NOT TESTED | MINOR DEVIATION |
| **7. Bottom Navigation** | PASS | NOT TESTED (Top-Nav) | NOT TESTED | MINOR DEVIATION |
| **8. Responsive Verhalten** | PASS | MINOR DEVIATION | NOT TESTED | MINOR DEVIATION |

**Legende:** PASS = visuell akzeptabel für Golden Screen · MINOR = sichtbar, nicht blockierend · MAJOR = deutliche Abweichung · NOT TESTED = nicht erfasst

---

## Freigabe-Frage

**Kann der Home-Screen auf Mobile Web, Android App und Desktop Web als Golden Screen freigegeben werden?**

**NEIN**

### Blocker (max. 5)

1. **Android App nicht getestet** — kein Emulator/Gerät; APK-Parität unbekannt.
2. **Sichtbarer Runtime-Fehler** — Nested-`<button>`-Toast auf allen Home-Web-Screenshots.
3. **Mockup-Header-Abweichung** — kein Logo-Icon, keine Mockup-Suchleiste/Chips, Location zeigt „Standort auswählen“ statt Stadt.
4. **Featured-Layout** — 2-up-Rail aus Mockup nicht erkennbar; Desktop zeigt einzelne Karte mit großer Leerfläche.
5. **Events-Tab EN/DE-Mix** — Quick-Filter und Placeholder weiterhin Englisch trotz DE-Home.

---

## Artefakt-Pfad

Alle Screenshots: `app-v2/docs/visual-qa/sprint-2b3-1/`
