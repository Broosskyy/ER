# Duplicates and Cleanup — Eternal Rave

**Stand:** 17. Juli 2026  
**Hinweis:** In diesem Audit-Schritt wurde **nichts gelöscht, verschoben oder umbenannt**.

---

## Exakte Duplikate (MD5-identisch)

### 1. App-Icon-Duplikat

| Datei A | Datei B | MD5 |
|---------|---------|-----|
| `assets/icon.png` | `assets/android-icon-foreground.png` | `c48272689e8917a122f214b55b83440a` |

**Empfehlung:** Eine Datei behalten, andere durch Symlink oder Referenz ersetzen.  
**Aktion:** REMOVE_LATER (eine der beiden nach Bootstrap)

### 2. Leere .gitkeep-Dateien (7× identisch leer)

| Dateien |
|---------|
| `database/.gitkeep` |
| `assets/branding/.gitkeep` |
| `assets/design-system/.gitkeep` |
| `assets/illustrations/.gitkeep` |
| `assets/motion-library/.gitkeep` |
| `assets/ui-components/.gitkeep` |
| `assets/mockups/.gitkeep` |

**MD5:** `d41d8cd98f00b204e9800998ecf8427e` (leere Datei)  
**Empfehlung:** Nach Befüllen der Ordner oder nach Entpacken der Mockups entfernen.

---

## Inhaltliche Duplikate (gleicher Name, unterschiedlicher Inhalt)

### Onboarding-PNGs vs. Mockup-ZIP-Screens

13 Dateien existieren sowohl als **echte PNG** in `assets/onboarding/` als auch als **JPEG-as-PNG** in den Mockup-ZIP-Archiven:

| Dateiname | Onboarding (PNG) | Mockup-ZIP (JPEG) | Identisch? |
|-----------|------------------|-------------------|------------|
| `02_Splash_Logo.png` | 138 KB, 1536×1024 | 34 KB, 1536×1024 | ❌ |
| `03_Onboarding_01_Welcome.png` | 447 KB | 79 KB | ❌ |
| `04_Onboarding_02_Discover_Events.png` | 615 KB | 113 KB | ❌ |
| `05_Onboarding_03_Community.png` | 596 KB | 106 KB | ❌ |
| `06_Onboarding_04_Tickets.png` | 534 KB | 99 KB | ❌ |
| `07_Login.png` | 384 KB | 82 KB | ❌ |
| `08_Register.png` | 466 KB | 104 KB | ❌ |
| `09_Home.png` | 788 KB | 164 KB | ❌ |
| `10_Events.png` | 695 KB | 149 KB | ❌ |
| `11_Event_Details.png` | 703 KB | 147 KB | ❌ |
| `12_Map.png` | 946 KB | 185 KB | ❌ |
| `14_Saved.png` | 746 KB | 160 KB | ❌ |
| `15_Profile.png` | 533 KB | 123 KB | ❌ |

**Empfehlung:**
- **Onboarding-PNGs behalten** als kanonische High-Res-Referenz
- **Mockup-ZIP-Varianten** nach Entpacken: Low-Res-Duplikate dieser 13 Screens entfernen (66 unique Screens bleiben)
- Nicht beide Versionen parallel im Asset-Baum führen

---

## Strukturelle Redundanzen

### 1. Doppelte Dokumentation (Blueprint vs. docs/)

| Thema | Blueprint | docs/ |
|-------|-----------|-------|
| Vision | `01_VISION/` | `01-product-vision/` |
| Design | `07_DESIGN/` | `02-ui-design/` |
| Tech | `06_TECH/` | `03-development/`, `04-backend/` |
| Business | `03_BUSINESS/` | Teilweise in `05-product-operations/` |

**Empfehlung:** `docs/` als **technische Hauptquelle**, `Blueprint/` als **Business-Kontext**. Nicht mergen, aber beim Neubau eine einzige Navigationsquelle definieren.

### 2. Design-Tokens in zwei Dateien

| Datei | Inhalt |
|-------|--------|
| `src/constants/theme.ts` | JS-Export (Colors, Spacing, Typography) |
| `tailwind.config.js` | Tailwind/NativeWind (identische Werte) |

**Empfehlung:** Im Neubau eine **Single Source of Truth** (z. B. `tokens.json` → generiert theme.ts + tailwind.config.js).

### 3. Service-Duplikate (alte Architektur)

Mehrere Dateien mit überlappender Funktionalität:

| Paar | Anmerkung |
|------|-----------|
| `events.ts` / `eventService.ts` | Parallele Event-Abfragen |
| `favorites.ts` / `favoriteService.ts` | Parallele Favoriten-Logik |
| `submissions.ts` / `submissionService.ts` / `eventSubmissionService.ts` | Drei Submission-Varianten |
| `imports.ts` / `importService.ts` | Parallele Import-Logik |

**Empfehlung:** Im Neubau nicht übernehmen — ein Service pro Domain.

---

## Build-Artefakte

**Keine Build-Artefakte im Export gefunden.**

| Gesucht | Gefunden |
|---------|----------|
| `node_modules/` | ❌ |
| `android/` | ❌ |
| `ios/` | ❌ |
| `.expo/` | ❌ |
| `dist/` / `build/` | ❌ |
| `*.apk` / `*.aab` | ❌ |
| `coverage/` | ❌ |

Nur **Build-Reports** (Markdown) unter `docs/reports/apk-build/`.

---

## Temporäre / Historische Dateien

| Pfad | Typ | Löschvorschlag |
|------|-----|----------------|
| `PRE_SPRINT_REPORT.md` | Sprint-Report | Nach Bootstrap |
| `REPORT.md` | Generischer Report | Nach Bootstrap |
| `SPRINT_1_REPORT.md` | Sprint-Report | Nach Bootstrap |
| `docs/reports/sprint-*` (~80 Dateien) | Sprint-Historie | Archivieren oder entfernen |
| `docs/reports/crash-analysis*` | Debug-Reports | Archivieren |
| `docs/reports/apk-build/` | Build-Protokoll | Archivieren |
| `Blueprint/99_ARCHIVE/` | Archiv-Platzhalter | Prüfen |
| `Blueprint/reports/` | Setup-Reports | Nach Bootstrap |

---

## ZIP-in-ZIP-Struktur

```
migration_export.zip (23,8 MB)
└── assets/mockups/
    ├── Eternal_Rave_Screens_Renamed.zip (976 KB)
    ├── Eternal_Rave_Screens_Renamed_Part2.zip (1,5 MB)
    ├── ... (6 weitere)
    └── Eternal_Rave_Screens_Renamed_Part8.zip (3,5 MB)
        └── 79 JPEG-as-PNG Mockup-Dateien
```

**Problem:** Drei Ebenen der Verschachtelung erschweren Asset-Zugriff.  
**Löschvorschlag (nach Entpacken):** Alle 8 inneren ZIP-Archive entfernen, sobald Mockups in flacher Struktur liegen.

---

## Konkrete Löschvorschläge (für späteren Cleanup-Schritt)

### Phase 1 — Nach Export-Entpacken

| Aktion | Dateien | Geschätzte Einsparung |
|--------|---------|----------------------|
| Mockup-ZIPs entfernen (nach Entpacken) | 8 ZIP-Dateien | ~17 MB |
| Duplikat-Icon entfernen | `icon.png` ODER `android-icon-foreground.png` | 74 KB |
| Leere .gitkeep entfernen | 7 Dateien | <1 KB |

### Phase 2 — Nach Bootstrap

| Aktion | Dateien | Anmerkung |
|--------|---------|-----------|
| Sprint-Reports archivieren | ~100 MD-Dateien | In `archive/` verschieben |
| Alte Root-Reports entfernen | 3 MD-Dateien | PRE_SPRINT, REPORT, SPRINT_1 |
| CI-Workflow entfernen | 1 YML | `auto-close-obsolete-prs.yml` |
| Onboarding-Duplikate in Mockups | 13 JPEG-Dateien | Nach Konsolidierung |

### Phase 3 — Optional

| Aktion | Dateien | Anmerkung |
|--------|---------|-----------|
| `migration_export.zip` entfernen | 1 Datei | Erst nach vollständigem Entpacken und Verifizierung |
| Blueprint-Duplikate konsolidieren | ~20 MD | Nur wenn Single-Doc-Strategie gewählt |

---

## Geschätztes Bereinigungspotenzial

| Kategorie | Dateien | Größe (ca.) |
|-----------|---------|-------------|
| Mockup-ZIPs (nach Entpacken) | 8 | ~17 MB |
| Sprint-Reports | ~100 | ~2 MB |
| Duplikate & Leerdateien | ~20 | ~1 MB |
| **Gesamt** | **~128** | **~20 MB** |

---

## Risiken beim Cleanup

| Risiko | Mitigation |
|--------|------------|
| Mockup-ZIPs löschen vor Entpacken | Erst entpacken, verifizieren, dann löschen |
| `migration_export.zip` zu früh löschen | Erst wenn alle Assets extrahiert und geprüft |
| Sprint-Reports mit nützlichen Entscheidungen | ADRs und `docs/rules/` separat behalten |
| Onboarding-Duplikate — falsche Version löschen | Onboarding-PNGs (High-Res) behalten |
