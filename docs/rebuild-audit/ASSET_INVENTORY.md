# Asset Inventory — Eternal Rave

**Stand:** 17. Juli 2026  
**Basis:** Analyse von `migration_export.zip` (noch nicht entpackt)

---

## Übersicht

| Kategorie | Anzahl | Status |
|-----------|--------|--------|
| Logos | 2 | Vorhanden |
| App-Icons | 5 | Vorhanden |
| UI-Icons (Bibliothek) | 0 | Nur in Mockups referenziert |
| Bilder / Screens | 92 | 13 PNG + 79 Mockup-JPEGs |
| Fonts | 0 | Nicht im Export |
| Sonstige Medien | 0 | Keine Video/Audio-Dateien |

---

## Logos

| Datei | Pfad | Format | Auflösung | Größe | Verwendung |
|-------|------|--------|-----------|-------|------------|
| Splash Logo | `assets/onboarding/02_Splash_Logo.png` | PNG | 1536×1024 | 138 KB | Splash-Screen, App-Branding |
| Splash Logo (Mockup) | `assets/mockups/.../02_Splash_Logo.png` | JPEG-as-PNG | 1536×1024 | 34 KB | Design-Referenz (niedrigere Qualität) |

**Hinweis:** Kein separates Vektor-Logo (SVG) oder Logo-Ordner mit Varianten. `assets/branding/` ist leer (nur `.gitkeep`).

---

## App-Icons

| Datei | Pfad | Format | Auflösung | Größe | Verwendung |
|-------|------|--------|-----------|-------|------------|
| `icon.png` | `assets/icon.png` | PNG | 1024×1024 | 74 KB | Expo App-Icon |
| `splash-icon.png` | `assets/splash-icon.png` | PNG | 1024×1024 | 63 KB | Splash-Screen Icon |
| `favicon.png` | `assets/favicon.png` | PNG | 48×48 | 842 B | Web-Favicon |
| `android-icon-foreground.png` | `assets/android-icon-foreground.png` | PNG | 1024×1024 | 74 KB | Android Adaptive Icon (Vordergrund) |
| `android-icon-background.png` | `assets/android-icon-background.png` | PNG | 1024×1024 | 5 KB | Android Adaptive Icon (Hintergrund) |
| `android-icon-monochrome.png` | `assets/android-icon-monochrome.png` | PNG | 1024×1024 | 25 KB | Android Monochrome Icon |

**Duplikat:** `icon.png` und `android-icon-foreground.png` sind **byte-identisch**.

---

## Icons (UI-Bibliothek)

Keine extrahierten Icon-Dateien (SVG, PNG-Sprite, Icon-Font) im Export.

| Quelle | Beschreibung |
|--------|--------------|
| Mockup `66_DesignSystem_Iconography.png` | Visuelle Icon-Referenz |
| `docs/02-ui-design/06_Icon_System.md` | Icon-System-Dokumentation |
| Alter Code | `@expo/vector-icons` (Ionicons) — nicht im Export enthalten |

---

## Bilder & Screens

### Onboarding / Screen-PNGs (echte PNGs)

Pfad: `assets/onboarding/`

| Datei | Auflösung | Größe | Screen |
|-------|-----------|-------|--------|
| `02_Splash_Logo.png` | 1536×1024 | 138 KB | Splash |
| `03_Onboarding_01_Welcome.png` | 711×1536 | 447 KB | Onboarding 1 |
| `04_Onboarding_02_Discover_Events.png` | 711×1536 | 615 KB | Onboarding 2 |
| `05_Onboarding_03_Community.png` | 725×1536 | 596 KB | Onboarding 3 |
| `06_Onboarding_04_Tickets.png` | 725×1536 | 534 KB | Onboarding 4 |
| `07_Login.png` | 711×1536 | 384 KB | Login |
| `08_Register.png` | 711×1536 | 466 KB | Register |
| `09_Home.png` | 709×1536 | 788 KB | Home |
| `10_Events.png` | 711×1536 | 695 KB | Events |
| `11_Event_Details.png` | 711×1536 | 703 KB | Event Detail |
| `12_Map.png` | 711×1536 | 946 KB | Map |
| `14_Saved.png` | 711×1536 | 746 KB | Saved |
| `15_Profile.png` | 711×1536 | 533 KB | Profile |

**Verwendung im alten Code:** Als Placeholder-Bilder in `src/constants/placeholderAssets.ts` und Onboarding-Slides in `src/constants/onboarding.ts`. Im Neubau **nicht als UI-Hintergrundbilder** verwenden — nur als visuelle Referenz.

### Mockup-Archive (79 JPEG-as-PNG)

Pfad: `assets/mockups/Eternal_Rave_Screens_Renamed*.zip`

Siehe [MOCKUP_INVENTORY.md](./MOCKUP_INVENTORY.md) für vollständige Liste.

---

## Fonts

**Keine Font-Dateien im Export.**

| Dokumentation | Pfad |
|---------------|------|
| Typography-Spec | `docs/02-ui-design/03_Typography.md` |
| Design-Tokens | `src/constants/theme.ts` → `Typography`-Objekt |
| Mockup-Referenz | `63_DesignSystem_Typography.png` |

Empfehlung: Font-Familie aus Mockup/Docs identifizieren und im Bootstrap neu einbinden (z. B. Inter, SF Pro oder dokumentierte Alternative).

---

## Design-Tokens (keine Bild-Assets, aber relevant)

| Datei | Pfad | Inhalt |
|-------|------|--------|
| `theme.ts` | `src/constants/theme.ts` | Colors, Spacing, BorderRadius, Typography, Shadows |
| `tailwind.config.js` | Root | NativeWind/Tailwind Token-Mapping |
| `global.css` | Root | NativeWind Base-Styles |

### Farbpalette (aus theme.ts)

| Token | Wert | Verwendung |
|-------|------|------------|
| `background` | `#0B0B0F` | App-Hintergrund |
| `surface` | `#15151B` | Karten, Panels |
| `surfaceElevated` | `#1F1F27` | Erhöhte Flächen |
| `primary` | `#7C3AED` | Akzent, Buttons, aktive Nav |
| `primaryHighlight` | `#A855F7` | Hover/Highlight |
| `primaryDeep` | `#4C1D95` | Gradienten |
| `textPrimary` | `#F5F5F5` | Haupttext |
| `textSecondary` | `#9CA3AF` | Sekundärtext |
| `border` | `#2A2A35` | Rahmen |
| `live` | `#EF4444` | Live-Indikator |
| `success` | `#22C55E` | Erfolg |
| `warning` | `#F59E0B` | Warnung |

---

## Leere Asset-Ordner (Platzhalter)

| Ordner | Status | Geplanter Inhalt (laut Struktur) |
|--------|--------|----------------------------------|
| `assets/branding/` | `.gitkeep` only | Logos, Brand-Assets |
| `assets/design-system/` | `.gitkeep` only | Design-System-Assets |
| `assets/illustrations/` | `.gitkeep` only | Illustrationen |
| `assets/motion-library/` | `.gitkeep` only | Motion-Referenzen |
| `assets/ui-components/` | `.gitkeep` only | Komponenten-Assets |

---

## Externe Medien (nicht lokal)

In `src/data/events.ts` werden Event-Bilder über **Unsplash-URLs** referenziert. Diese sind nicht offline verfügbar und gehören nicht zum Asset-Bestand.

---

## Zusammenfassung: Übernahme-Empfehlung

| Asset | Empfehlung |
|-------|------------|
| App-Icons (5 unique) | **KEEP** — direkt übernehmen |
| Onboarding-PNGs (13) | **KEEP** — als Design-Referenz, nicht als App-Bilder |
| Mockup-ZIPs (79 Screens) | **KEEP** — entpacken und normalisieren |
| Design-Tokens (theme.ts) | **KEEP** — als Token-Quelle |
| Fonts | **REVIEW** — aus Docs/Mockups ableiten |
| Branding-Ordner | **REVIEW** — Logos aus Mockups extrahieren |
| Unsplash-URLs in Seed-Daten | **REMOVE_LATER** — durch lokale Placeholders ersetzen |
