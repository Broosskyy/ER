# Build Status — Eternal Rave (app-v2)

**Stand:** 17. Juli 2026  
**Phase:** Sprint 1 — Home Foundation — abgeschlossen

---

## Was wurde erstellt

### Referenzmaterial (`reference/`)

- [x] `migration_export.zip` entpackt und in `reference/` strukturiert
- [x] Mockups entpackt nach `reference/mockups/screens/` (79 Dateien)
- [x] JPEG-Endungskorrektur (.png → .jpg) für alle 79 Mockups
- [x] Original-ZIP-Archive beibehalten in `reference/mockups/archives/`
- [x] Assets, Docs, Old Code, Migration-Archiv organisiert

### Expo-Projekt (`app-v2/`)

- [x] Frisches Expo SDK 57 Projekt mit TypeScript + Expo Router
- [x] App-Name: Eternal Rave, Slug: eternal-rave
- [x] Android Package: `com.eternalrave.app`
- [x] iOS Bundle Identifier: `com.eternalrave.app`
- [x] Projektstruktur (`app/`, `src/components/`, `src/design/`, `src/features/`)
- [x] Design-Tokens (colors, spacing, typography, radii, shadows, layout)
- [x] 10 Basis-Komponenten + FavoriteButton
- [x] Eternal Rave App-Icons übernommen
- [x] TypeScript strict + `noUncheckedIndexedAccess`
- [x] ESLint + Prettier konfiguriert
- [x] `.env.example` angelegt
- [x] Dokumentation (ARCHITECTURE, DESIGN_SYSTEM, BUILD_STATUS, MOCKUP_MAPPING)
- [x] Vorläufiges V1-Designsystem aus Mockups abgeleitet (`DESIGN_GUIDELINES.md`)
- [x] Design-Tokens erweitert: semantische Farbrollen, Textrollen, Spacing, Komponentenmaße

### Sprint 1 — Home (neu)

- [x] Tab-Navigation (5 Tabs) mit Expo Router
- [x] Home Screen nach Mockup 09
- [x] 10 Home-Feature-Komponenten
- [x] 5 Demo-Events mit lokalen Bildern
- [x] Lokaler Favoriten-State (Session)
- [x] Event-Detail-Platzhalter (`/event/[id]`)
- [x] Platzhalter-Tabs: Search, Map, Saved, Profile
- [x] `SPRINT_01_HOME_REPORT.md`

---

## Prüfungen

| Prüfung | Ergebnis |
|---------|----------|
| `npm install` | ✅ Erfolgreich |
| `npx expo-doctor` | ✅ 20/20 checks passed |
| `npm run lint` | ✅ 0 errors |
| `npx tsc --noEmit` | ✅ Keine Fehler |
| `npx expo start --web` | ✅ Home lädt, Tabs funktionieren |

---

## Bekannte offene Punkte

| Punkt | Priorität | Anmerkung |
|-------|-----------|-----------|
| Top Clubs Sektion fehlt auf Home | Mittel | Im Mockup 09 sichtbar, Sprint 2+ |
| Font-Familie nicht definiert | Mittel | Review erforderlich — siehe DESIGN_GUIDELINES.md §10 |
| Suchfeld nicht interaktiv | Niedrig | Sprint 2 mit Search Screen |
| Favoriten ohne Persistenz | Erwartet | Sprint später |
| `migration_export.zip` im Root | Niedrig | Duplikat zu `reference/migration/` |

---

## Designsystem-Validierung (Sprint 1)

Durch Home-Umsetzung bestätigt:

- `headerContentHeight`: 56px
- `chipHeight`: 32px
- `featuredHeroAspectRatio`: 16/9
- `bottomNavHeight`: 64px
- `searchFieldHeight`: 44px

Siehe `DESIGN_GUIDELINES.md` und `SPRINT_01_HOME_REPORT.md`.

---

## Bewusst nicht implementiert

- Backend / Supabase / API
- Auth / Push
- Echte Map
- Vollständige weiteren Screens
- Top Clubs auf Home
- NativeWind / Tailwind

---

## Nächster Schritt

**Sprint 2 — Events/Search Screen (Mockup 10)**

1. `app/(tabs)/search.tsx` vollständig umsetzen
2. Ergebniszähler und Listen-Layout
3. Filter-Logik erweitern
4. Optional: Top Clubs auf Home ergänzen

Siehe `SPRINT_01_HOME_REPORT.md` für Details.
