# Repository Audit — Eternal Rave Neustart

**Datum:** 17. Juli 2026  
**Repository:** `Broosskyy/ER`  
**Branch zum Zeitpunkt des Audits:** `main`  
**Audit-Branch:** `cursor/rebuild-audit-6b06`

---

## Zusammenfassung

Das Repository befindet sich im **Vor-Bootstrap-Zustand**. Am Root liegen nur zwei sichtbare Dateien; der gesamte Export aus dem bisherigen Eternal-Rave-Projekt ist in einer einzelnen ZIP-Datei gebündelt und **noch nicht entpackt**.

| Metrik | Wert |
|--------|------|
| Dateien im Repository-Root | 2 (`README.md`, `migration_export.zip`) |
| Dateien im Export-Archiv | 433 |
| Verzeichnisse im Export-Archiv | 68 |
| **Gesamt analysierte Dateien** | **435** |
| Komprimierte Größe (ZIP) | ~23,8 MB |
| Unkomprimierte Größe (Export-Inhalt) | ~24,2 MB |
| Gesamtgröße Workspace | ~27 MB |

---

## Aktuelle Ordnerstruktur (Repository-Root)

```
/workspace/
├── .git
├── README.md                  # Platzhalter: "# ER"
├── migration_export.zip       # Vollständiger Projekt-Export (noch gepackt)
└── docs/
    └── rebuild-audit/         # Dieser Audit (neu erstellt)
```

---

## Struktur innerhalb von `migration_export.zip`

```
migration_export/
├── .env.example
├── .gitignore
├── .github/workflows/
├── .npmrc
├── Blueprint/                 # Business-/Produkt-Blueprint (87 Dateien)
├── PRE_SPRINT_REPORT.md
├── README.md
├── REPORT.md
├── SPRINT_1_REPORT.md
├── app.json
├── assets/                    # Bilder, Mockup-Archive, Platzhalter-Ordner
├── babel.config.js
├── database/
├── docs/                      # Technische & Produkt-Dokumentation (281 Dateien)
├── eas.json
├── global.css
├── global.d.ts
├── metro.config.js
├── nativewind-env.d.ts
├── package.json               # Alter Stack — NICHT als neue Grundlage
├── scripts/
├── src/                       # Teil-Export Backend-Logik (kein UI-Code)
├── supabase/                  # SQL-Migrationen & Seeds
├── tailwind.config.js
└── tsconfig.json
```

### Wichtige Unterbereiche

| Bereich | Inhalt | Dateien (ca.) |
|---------|--------|---------------|
| `Blueprint/` | Vision, Business, Marketing, Design, Roadmap | 87 |
| `docs/` | Master-Index, Product Vision, UI Design, Dev, Backend, Reports | 281 |
| `assets/` | App-Icons, Onboarding-PNGs, 8 Mockup-ZIP-Archive | 32 |
| `src/` | Services, Types, Domain, Data, Constants | 44 TS-Dateien |
| `supabase/` | 6 Migrationen + 4 Seed-Dateien | 11 |
| Root-Konfiguration | Expo, NativeWind, Babel, Metro, EAS | 12 |

---

## Dateitypen (Export-Inhalt)

| Typ | Anzahl | Beschreibung |
|-----|--------|--------------|
| `.md` | 333 | Dokumentation, Blueprint, Sprint-Reports |
| `.ts` | 44 | TypeScript (Services, Types, Domain) |
| `.png` | 19 | App-Icons + Onboarding-Screens (echte PNGs) |
| `.zip` | 8 | Mockup-Archive (79 Screens, JPEG mit `.png`-Endung) |
| `.sql` | 9 | Supabase-Schema, Seeds |
| `.js` | 4 | Babel, Metro, Tailwind, Seed-Script |
| `.json` | 4 | package.json, app.json, eas.json, tsconfig |
| `.gitkeep` | 7 | Leere Platzhalter-Ordner |
| Sonstige | 5 | `.css`, `.yml`, `.example`, `.npmrc`, `.gitignore` |

**Nicht gefunden:** `.tsx`, `.jsx`, Fonts (`.ttf`/`.otf`/`.woff`), SVG-Icons, `node_modules/`, `android/`, `ios/`, Build-Artefakte.

---

## Erkennbare wichtige Inhalte

### 1. Mockups (79 Screens)
- In 8 verschachtelten ZIP-Archiven unter `assets/mockups/`
- Nummeriert `01_Splash_Screen_Loading.png` bis `79_Performance_Accessibility.png`
- Mobile-first, überwiegend Portrait (~711×1536 px)
- Enthält App-Screens, UI-Bibliotheken, Design-System- und Motion-Referenzen

### 2. Design-Tokens
- `src/constants/theme.ts` — vollständige Farb-, Spacing-, Typography-Definition
- `tailwind.config.js` — spiegelnde NativeWind-Konfiguration
- Dokumentiert in `docs/02-ui-design/` und `MOCKUP-SCREENS.md`

### 3. Umfangreiche Dokumentation
- Produktvision, UX-Prinzipien, Architektur, Backend, Auth, Event-Automation
- Sprint-Reports (0.5 bis 5.8.1), Crash-Analysen, APK-Build-Reports
- Entwicklungsregeln (`docs/rules/`)

### 4. Datenmodell & API-Grundlage
- TypeScript-Types (`src/types/`)
- Supabase-Migrationen mit Event-Lifecycle, RLS, Rollen
- Service-Layer für Auth, Events, Favorites, Admin, Import

### 5. Beispieldaten
- `src/data/events.ts` — Dummy-Events (Hamburg/Berlin)
- `supabase/seed*.sql` — DB-Seeds
- `scripts/generate-seed-events.js` — Generator

### 6. App-Assets
- Expo-Icons (1024×1024), Favicon (48×48)
- 13 Onboarding-PNGs (höhere Auflösung als Mockup-ZIP-Varianten)

---

## Erkennbare Altlasten

| Altlast | Details |
|---------|---------|
| **Unvollständiger Code-Export** | Kein `app/`, `components/`, `hooks/`, `utils/` — UI-Code fehlt komplett |
| **Verschachtelte Mockup-ZIPs** | 8 Archive statt flacher Asset-Struktur; JPEG-Dateien mit `.png`-Endung |
| **Doppelte Screen-Assets** | 13 Onboarding-PNGs vs. gleichnamige Mockups in ZIPs (unterschiedlicher Inhalt) |
| **Leere Asset-Ordner** | `branding/`, `design-system/`, `illustrations/`, `motion-library/`, `ui-components/` nur `.gitkeep` |
| **Historische Sprint-Reports** | ~100 Dateien unter `docs/reports/` — Referenz, nicht aktiv nutzbar |
| **Alte package.json** | Expo SDK 56, React 19 — dokumentiert, aber nicht als Bootstrap-Basis |
| **Externe Bild-URLs in Seed-Daten** | Unsplash-Links in `events.ts` — nicht offline nutzbar |
| **README-Platzhalter** | Root-`README.md` enthält nur `# ER` |

---

## Kritische Lücken im Export

Folgende im alten README dokumentierte Bereiche **fehlen im Export**:

- `app/` — Expo Router Screens
- `src/components/` — UI-Komponenten
- `src/hooks/` — Auth, EventStore, Favorites
- `src/utils/` — Formatierung, Filter

Der Export enthält primär **Backend-Logik, Dokumentation und Design-Referenzen**, nicht die UI-Implementierung.

---

## Sicherheits-Hinweise

- `.env.example` vorhanden (keine echten Secrets im Export)
- Keine `node_modules/`, keine kompilierten Binaries
- Keine APK-Dateien im Repository (nur Build-Reports mit Download-Links)

---

## Audit-Methodik

- Vollständige Inventarisierung via `unzip -l` ohne Entpacken des Hauptarchivs
- Mockup-Inventar via gezieltes Entpacken der 8 verschachtelten ZIP-Archive (79 Dateien)
- MD5-Vergleich für Duplikaterkennung
- Bildanalyse (Format, Dimensionen) via Python/struct
- Keine Builds, keine Installationen, keine Dateiänderungen am Export
