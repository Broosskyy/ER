# File Classification — Eternal Rave Rebuild

**Stand:** 17. Juli 2026  
**Legende:**
- **KEEP** — Direkt als Referenz oder Asset im Neubau verwendbar
- **REVIEW** — Vor Übernahme prüfen
- **OLD_CODE_REFERENCE** — Alter Quellcode, nur als Funktions-/Inhaltsreferenz
- **REMOVE_LATER** — Vermutlich unnötig, in diesem Schritt nicht löschen
- **DUPLICATE** — Doppelte oder nahezu doppelte Datei
- **UNKNOWN** — Zweck nicht sicher bestimmbar

---

## Repository-Root

| Pfad | Kategorie | Begründung |
|------|-----------|------------|
| `README.md` | REVIEW | Platzhalter (`# ER`), muss für Neubau ersetzt werden |
| `migration_export.zip` | KEEP | Gesamter Projekt-Export, Quelle aller Referenzmaterialien |

---

## Assets

| Pfad | Kategorie | Begründung |
|------|-----------|------------|
| `assets/icon.png` | KEEP | Expo App-Icon |
| `assets/splash-icon.png` | KEEP | Splash-Icon |
| `assets/favicon.png` | KEEP | Web-Favicon |
| `assets/android-icon-foreground.png` | DUPLICATE | Identisch mit `icon.png` |
| `assets/android-icon-background.png` | KEEP | Android Adaptive Icon BG |
| `assets/android-icon-monochrome.png` | KEEP | Android Monochrome Icon |
| `assets/onboarding/*.png` (13 Dateien) | KEEP | High-Res Screen-Referenzen |
| `assets/mockups/Eternal_Rave_Screens_Renamed*.zip` (8) | KEEP | Vollständiges Mockup-Set (79 Screens) |
| `assets/mockups/.gitkeep` | REMOVE_LATER | Überflüssig nach Entpacken |
| `assets/branding/.gitkeep` | REVIEW | Leerer Platzhalter — Logos fehlen |
| `assets/design-system/.gitkeep` | REMOVE_LATER | Leer |
| `assets/illustrations/.gitkeep` | REMOVE_LATER | Leer |
| `assets/motion-library/.gitkeep` | REMOVE_LATER | Leer |
| `assets/ui-components/.gitkeep` | REMOVE_LATER | Leer |
| `assets/README.md` | KEEP | Asset-Dokumentation |

---

## Blueprint (Business-Dokumentation)

| Pfad | Kategorie | Begründung |
|------|-----------|------------|
| `Blueprint/00_READ_ME_FIRST.md` | KEEP | Einstiegspunkt |
| `Blueprint/01_VISION/*.md` (4) | KEEP | Vision, Mission, Principles, Values |
| `Blueprint/02_PRODUCT/*.md` (5) | KEEP | Produktdefinition, Features, Roadmap |
| `Blueprint/03_BUSINESS/*.md` (9) | KEEP | Business Model, Monetization, Pricing |
| `Blueprint/04_COMMUNITY/*.md` (6) | KEEP | Community-Features |
| `Blueprint/05_MARKETING/*.md` (6) | KEEP | Brand, Growth, Launch |
| `Blueprint/06_TECH/*.md` (6) | REVIEW | Tech-Architektur — gegen Neustart-Stack prüfen |
| `Blueprint/07_DESIGN/*.md` (5) | KEEP | Design System, Branding, UX |
| `Blueprint/08_OPERATIONS/*.md` (5) | KEEP | GDPR, Legal, Moderation |
| `Blueprint/09_ROADMAP/*.md` (6) | REVIEW | Jahres-Roadmaps — Aktualität prüfen |
| `Blueprint/10_FINANCE/*.md` (4) | REVIEW | Finanzplanung — Sensibilität beachten |
| `Blueprint/11_INVESTORS/*.md` (4) | REVIEW | Investor-Material |
| `Blueprint/12_APPENDIX/*.md` (4) | KEEP | Glossar, Entscheidungen, Ressourcen |
| `Blueprint/99_ARCHIVE/README.md` | REMOVE_LATER | Archiv-Platzhalter |
| `Blueprint/reports/*.md` (5) | REMOVE_LATER | Setup-Reports, nicht implementierungsrelevant |

---

## Dokumentation (`docs/`)

### Master Index & Product Vision

| Pfad | Kategorie | Begründung |
|------|-----------|------------|
| `docs/00-master-index/*.md` (15) | KEEP | Navigations- und Strukturübersicht |
| `docs/01-product-vision/*.md` (16) | KEEP | Produktvision, Personas, User Journey |
| `docs/01-product-vision/MASTER-PROMPT-v3.0.md` | KEEP | Zentrale Implementierungs-Anweisung |

### UI Design

| Pfad | Kategorie | Begründung |
|------|-----------|------------|
| `docs/02-ui-design/*.md` (17) | KEEP | Design System, Farben, Typography, Mockup-Referenz |
| `docs/02-ui-design/MOCKUP-SCREENS.md` | KEEP | **Primäre Screen-Referenz** |
| `docs/02-ui-design/MOCKUP-ALIGNMENT.md` | REVIEW | Ist/Soll — bezieht sich auf alten Code |

### Development & Backend

| Pfad | Kategorie | Begründung |
|------|-----------|------------|
| `docs/03-development/*.md` (16) | KEEP | Architektur, Projektstruktur, Coding Standards |
| `docs/04-backend/*.md` (15) | KEEP | API, Datenmodell, Supabase |
| `docs/04.5-event-automation/*.md` (15) | REVIEW | Automation — Zukunftsfeature |
| `docs/04.6-authentication-identity/*.md` (11) | KEEP | Auth-Konzept |
| `docs/05-product-operations/*.md` (19) | REVIEW | Operations — teilweise veraltet |

### Rules & Project

| Pfad | Kategorie | Begründung |
|------|-----------|------------|
| `docs/rules/*.md` (7) | KEEP | Architektur-, Coding-, Design-Regeln |
| `docs/project/*.md` (3) | KEEP | Definition of Done, Versioning |
| `docs/ADR/*.md` (11) | KEEP | Architecture Decision Records |
| `docs/analysis/*.md` (12) | REVIEW | Analysen — Kontext prüfen |
| `docs/sprint-0.5/*.md` (11) | REMOVE_LATER | Sprint-Validierung, historisch |
| `docs/sprint-0-final/*.md` (9) | REMOVE_LATER | Sprint-0-Abschluss, historisch |
| `docs/PROJECT_READY.md` | REVIEW | Projekt-Readiness — veraltet |
| `docs/PROJECT_STRUCTURE.md` | REVIEW | Struktur — nach Neustart aktualisieren |
| `docs/README.md` | KEEP | Docs-Einstieg |

### Sprint Reports (`docs/reports/`)

| Pfad | Kategorie | Begründung |
|------|-----------|------------|
| `docs/reports/sprint-2/` bis `sprint-5.8.1/` (~80 Dateien) | OLD_CODE_REFERENCE | Sprint-Historie, Debugging-Kontext |
| `docs/reports/crash-analysis/` (2 Ordner) | OLD_CODE_REFERENCE | Crash-Analysen alter App |
| `docs/reports/apk-build/` (8) | OLD_CODE_REFERENCE | APK-Build-Protokoll |
| `docs/reports/sprint-5/` (leer?) | REMOVE_LATER | Leerer Ordner |

---

## Quellcode (`src/`)

| Pfad | Kategorie | Begründung |
|------|-----------|------------|
| `src/constants/theme.ts` | KEEP | Design-Tokens — direkt übernehmen |
| `src/constants/navigation.ts` | OLD_CODE_REFERENCE | Tab-Routen-Referenz |
| `src/constants/onboarding.ts` | OLD_CODE_REFERENCE | Onboarding-Config (bindet Mockup-Bilder) |
| `src/constants/placeholderAssets.ts` | OLD_CODE_REFERENCE | Anti-Pattern: Mockups als App-Bilder |
| `src/types/*.ts` (5) | OLD_CODE_REFERENCE | Datenmodell-Referenz |
| `src/domain/event/*.ts` (4) | OLD_CODE_REFERENCE | Lifecycle-Logik-Referenz |
| `src/validation/eventValidation.ts` | OLD_CODE_REFERENCE | Validierungsregeln |
| `src/repositories/eventRepository.ts` | OLD_CODE_REFERENCE | Repository-Pattern-Referenz |
| `src/lib/supabase/*.ts` (2) | OLD_CODE_REFERENCE | Supabase-Client-Setup |
| `src/services/*.ts` (22) | OLD_CODE_REFERENCE | Service-Layer — nicht kopieren |
| `src/data/*.ts` (3) | REVIEW | Seed-Daten — Struktur nutzen, URLs ersetzen |

---

## Supabase

| Pfad | Kategorie | Begründung |
|------|-----------|------------|
| `supabase/migrations/*.sql` (6) | KEEP | DB-Schema als Ausgangspunkt |
| `supabase/seed.sql` | KEEP | Basis-Seed |
| `supabase/seed_event_sources.sql` | KEEP | Quellen-Seed |
| `supabase/seed_published_events.sql` | KEEP | Event-Seed |
| `supabase/README.md` | KEEP | Setup-Anleitung |

---

## Konfiguration

| Pfad | Kategorie | Begründung |
|------|-----------|------------|
| `package.json` | OLD_CODE_REFERENCE | **Nicht als Bootstrap-Basis** |
| `app.json` | OLD_CODE_REFERENCE | Expo-Config-Referenz |
| `eas.json` | REVIEW | EAS Build — bei Bedarf anpassen |
| `babel.config.js` | OLD_CODE_REFERENCE | Babel-Setup |
| `metro.config.js` | OLD_CODE_REFERENCE | Metro-Setup |
| `tailwind.config.js` | KEEP | Design-Tokens — übernehmen |
| `tsconfig.json` | OLD_CODE_REFERENCE | TS-Config-Referenz |
| `global.css` | KEEP | NativeWind Base |
| `global.d.ts` | OLD_CODE_REFERENCE | Type-Deklarationen |
| `nativewind-env.d.ts` | OLD_CODE_REFERENCE | NativeWind Types |
| `.env.example` | KEEP | Env-Template |
| `.gitignore` | REVIEW | Anpassen für Neubau |
| `.npmrc` | REVIEW | NPM-Konfiguration |
| `.github/workflows/auto-close-obsolete-prs.yml` | REMOVE_LATER | Altes CI — nicht übernehmen |

---

## Scripts & Sonstiges

| Pfad | Kategorie | Begründung |
|------|-----------|------------|
| `scripts/generate-seed-events.js` | OLD_CODE_REFERENCE | Seed-Generator-Logik |
| `database/.gitkeep` | REMOVE_LATER | Leer |
| `database/README.md` | REVIEW | DB-Dokumentation |
| `PRE_SPRINT_REPORT.md` | REMOVE_LATER | Historisch |
| `REPORT.md` | REMOVE_LATER | Historisch |
| `SPRINT_1_REPORT.md` | REMOVE_LATER | Historisch |
| `README.md` (Export) | KEEP | Projekt-README als Referenz |

---

## Zusammenfassung nach Kategorie

| Kategorie | Anzahl (ca.) | Anteil |
|-----------|--------------|--------|
| **KEEP** | ~120 | 28% |
| **REVIEW** | ~50 | 12% |
| **OLD_CODE_REFERENCE** | ~60 | 14% |
| **REMOVE_LATER** | ~110 | 25% |
| **DUPLICATE** | 1 | <1% |
| **UNKNOWN** | 0 | 0% |
| Nicht klassifiziert (Verzeichnisse, etc.) | ~94 | 21% |

---

## Prioritäten für Bootstrap

1. **Sofort nutzbar (KEEP):** Design-Tokens, Mockups, App-Icons, Kern-Dokumentation, DB-Schema
2. **Referenz lesen (OLD_CODE_REFERENCE):** Types, Domain, Services, Validierung
3. **Prüfen vor Übernahme (REVIEW):** Blueprint Tech/Finance, Sprint-Alignment-Docs, Seed-Daten
4. **Später bereinigen (REMOVE_LATER):** Sprint-Reports, leere .gitkeep, historische Reports
