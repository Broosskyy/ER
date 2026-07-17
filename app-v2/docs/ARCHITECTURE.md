# Architecture — Eternal Rave (app-v2)

**Stand:** 17. Juli 2026  
**Phase:** Technical Bootstrap

---

## Gewählter Stack

| Layer | Technologie |
|-------|-------------|
| Framework | React Native + Expo SDK 57 |
| Sprache | TypeScript (strict) |
| Navigation | Expo Router v4 |
| Styling | React Native StyleSheet + zentrale Design-Tokens |
| Icons | @expo/vector-icons (Ionicons) |
| Safe Area | react-native-safe-area-context |

### Explizit nicht verwendet

- NativeWind / Tailwind
- WebView-basierte UI
- Vite, Capacitor, Flutter
- Alter Quellcode als Bootstrap-Basis

---

## Ordnerstruktur

```
app-v2/
├── app/                    # Expo Router — Screens & Layouts
│   ├── _layout.tsx         # Root Stack
│   ├── index.tsx           # Technischer Startscreen
│   └── +not-found.tsx
├── src/
│   ├── components/         # Wiederverwendbare UI-Bausteine
│   │   ├── layout/         # AppScreen, ScreenContent, SafeArea, AppText
│   │   ├── buttons/        # Primary, Secondary, Icon
│   │   ├── cards/          # SurfaceCard
│   │   └── feedback/       # EmptyState, ImagePlaceholder
│   ├── design/             # Design-Tokens (Single Source of Truth)
│   ├── features/           # Feature-Module (Platzhalter)
│   ├── assets/             # App-interne Assets (Platzhalter)
│   ├── data/               # Seed-/Mock-Daten (Platzhalter)
│   ├── hooks/              # Custom Hooks (Platzhalter)
│   ├── services/           # API-Layer (Platzhalter)
│   ├── types/              # TypeScript-Types (Platzhalter)
│   └── utils/              # Hilfsfunktionen (Platzhalter)
├── assets/images/          # Expo App-Icons
└── docs/                   # App-Dokumentation
```

---

## Trennung: Referenz vs. neue App

| Bereich | Pfad | Zweck |
|---------|------|-------|
| Referenzmaterial | `/reference/` | Mockups, alte Docs, Assets, Old Code |
| Neue App | `/app-v2/` | Aktive Entwicklung |
| Repo-Docs | `/docs/rebuild/` | Bootstrap-Berichte |
| Audit | `/docs/rebuild-audit/` | Repository-Audit (separater Branch) |

**Regel:** Code in `app-v2/` importiert **niemals** direkt aus `reference/`.

---

## Regeln für Screen- und Feature-Aufbau

### Screens (`app/`)

- Screens sind dünn — Layout und Komposition, keine Geschäftslogik
- Verwenden `AppScreen` → `SafeAreaContainer` → `ScreenContent`
- Styling ausschließlich über Design-Tokens und StyleSheet
- **Keine Mockup-Bilder als Hintergrund**

### Features (`src/features/`)

- Ein Ordner pro Feature-Domain (home, events, map, etc.)
- Enthält Feature-spezifische Komponenten, Hooks und Logik
- Importiert aus `src/components/` und `src/design/`

### Komponenten (`src/components/`)

- Generisch und wiederverwendbar
- Vollständig typisiert
- Keine Feature-Abhängigkeiten

### Design-Tokens (`src/design/`)

- Alle visuellen Konstanten zentral
- Keine hardcodierten Farben/Abstände in Komponenten
- Tokens aus `reference/old-code/src/constants/theme.ts` abgeleitet

---

## Import-Aliases

```typescript
import { colors } from '@/design/colors';
import { AppScreen } from '@/components';
```

`@/*` → `./src/*` (konfiguriert in `tsconfig.json`)

---

## Geplante Erweiterungen (nicht in Bootstrap)

- Supabase Backend (`src/services/`, `src/lib/supabase/`)
- Zustand / TanStack Query für State Management
- Bottom Tab Navigation
- Mapbox Integration
- Auth-Flow
