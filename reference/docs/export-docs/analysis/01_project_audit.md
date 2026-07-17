# 01 — Project Audit: Eternal Rave

**Stand:** Juni 2026 · **App-Version:** 1.7.0 (`app.json`) · **Analyse-Typ:** Read-only  
**Zielbild:** `/docs` Band 0–5 + `/assets/mockups` (79 Mockups, 8 ZIPs)  
**Regel:** Keine Codeänderungen — reine Bestandsaufnahme

---

## Executive Summary

Eternal Rave ist eine **funktionsfähige React-Native/Expo-App (SDK 56)** mit **27 Screens**, **36 UI-Komponenten**, **7 Hooks**, **15 Service-Modulen** und **4 Supabase-Migrationen**. Der öffentliche Feed folgt korrekt dem Lifecycle-Prinzip: **nur `published` Events sind sichtbar**.

Die Codebase ist ein **reifes MVP (V0.2–V0.3)** mit starkem Admin-/Import-Fundament, aber **deutlichen Lücken** gegenüber den 79 offiziellen Mockups (Onboarding, Tickets, Analytics, Reports, Design-System-Bibliotheken) und gegenüber Band 2–5 (GPS, Mapbox, i18n DE, echtes URL-Scraping, Ops-Runbooks).

**Kernurteil:** Nicht neu bauen — **inkrementell annähern**. Größte technische Schulden: monolithischer `useEventStore` (~1050 Zeilen), Legacy-Doppelmodell `event_submissions` vs. `events`, fehlende Listen-Virtualisierung, minimale Accessibility.

---

## 1. Ordnerstruktur (Ist)

```
/workspace
├── app/                    # 27 Expo-Router-Screens
├── src/
│   ├── components/         # 36 Komponenten + index.ts
│   ├── hooks/              # 7 Hooks (3 Context-Provider)
│   ├── services/           # 15 Module (inkl. ungenutzte Facades)
│   ├── types/              # 4 Type-Dateien
│   ├── utils/              # 8 Utility-Module
│   ├── data/               # Demo-Seeds (events, submissions, sources)
│   ├── constants/          # theme.ts, navigation.ts
│   └── lib/supabase/       # client.ts, env.ts
├── assets/                 # App-Icons + Design-Unterordner (mockups/*.zip)
├── supabase/               # Migrationen 001–004, Seeds
├── database/               # Verweis auf supabase/
└── docs/                   # Band 0–5 + analysis/ (dieses Paket)
```

**Abweichung vom Zielbild (Band 3):** Docs nennen Zustand + TanStack Query — **nicht implementiert**. State läuft über React Context.

---

## 2. Projektarchitektur

| Schicht | Implementierung | Align Band 3/4 |
|---------|-----------------|----------------|
| UI | Expo Router + NativeWind | ✅ |
| State | React Context (`useEventStore`, `useAuth`, …) | 🟡 Abweichung (Zustand geplant) |
| API | `src/services/*` → Supabase JS | ✅ |
| DB | PostgreSQL via Supabase, RLS | ✅ |
| Demo-Modus | `isSupabaseConfigured()` + `src/data/*` | ✅ (Band 4 Hybrid-Runtime) |

**Provider-Kette:** `AuthProvider` → `EventStoreProvider`...` → `EventSourceProvider` → `FavoritesProvider`.

**Dual-Mode:** Ohne Env-Vars läuft die App vollständig mit lokalen Seeds. Mit Supabase: Live-Daten, Fallback auf Dummy wenn 0 published Events.

---

## 3. Navigation & Routing

- **5 Tabs:** Home, Events (`search`), Map, Saved (`favorites`), Profile
- **Stack:** Auth (modal), Event Detail, Add Event, Submissions, Organizer (4), Admin (10+)
- **Fehlend in `_layout.tsx`:** `admin/review/edit/[id]` (Datei existiert, kein explizites `Stack.Screen`)
- **Keine Route Guards** auf den meisten Admin-Routen (Demo: Admin ohne Login erreichbar)

---

## 4. Screens (27 implementiert)

Siehe `05_screen_inventory.md` für vollständige Tabelle.

**Mockup-Abdeckung (79 Referenzen):** ~25 Screens teilweise/vollständig, ~54 fehlen oder nur als Konzept in Mockups.

---

## 5. Komponenten (36)

Barrel-Export in `src/components/index.ts`. Wiederverwendbare Basis: Buttons, Cards, Forms, Badges, Skeletons, Admin-Widgets.

Siehe `04_component_inventory.md`.

---

## 6. Design System & Tokens

**Implementiert in** `src/constants/theme.ts` + `tailwind.config.js` — Farben 1:1 mit Master Prompt.

**Fehlend laut Mockups 62–69:** Typography-Skala, Spacing-Grid-Dokumentation, Elevation-Stufen, Icon-Set-Spec, Theme-Regeln als Code-Tokens.

---

## 7. Assets

| Bereich | Status |
|---------|--------|
| Expo App-Icons | ✅ `assets/icon.png`, splash, android adaptive |
| Mockups | ✅ 8 ZIPs, 79 PNGs unter `assets/mockups/` |
| branding/, design-system/, … | 🔴 Nur `.gitkeep` — leer |
| Custom Fonts | 🔴 System-Default (kein expo-font) |

---

## 8. State Management

| Hook | Zeilen | Rolle |
|------|--------|-------|
| `useEventStore` | ~1050 | God-Store: Feed, Submissions, Imports, Organizer, Admin |
| `useEventSources` | ~242 | Source Manager |
| `useAuth` | ~107 | Session, Rollen |
| `useFavorites` | ~77 | Favoriten lokal + Supabase |
| `usePublicEventFeed` | ~30 | Feed-Facade |
| `useDuplicateCheck` | ~98 | Duplikat-Heuristik |

---

## 9. Supabase & Auth

- Migrationen 001–004 vorhanden
- Auth: Email/Password, Profile-Rollen (`user`, `organizer`, `admin`)
- RLS auf Kern-Tabellen
- **Gap:** `database.ts` fehlt `event_sources`-Tabelle; untyped Supabase-Client

---

## 10. Code-Qualität (Kurz)

| Kriterium | Bewertung |
|-----------|-----------|
| TypeScript strict | ✅ `tsc --noEmit` grün |
| Tests | 🔴 Keine |
| Dokumentation vs. Code | 🟡 MOCKUP-SCREENS teilweise veraltet |
| Sicherheit Admin-Routen | 🟡 Demo-Modus offen |
| Performance Listen | 🟡 ScrollView statt FlatList |

---

## 11. Vergleich Band 0–5 (Kurzmatrix)

| Band | Substanz in Docs | Code-Align |
|------|------------------|------------|
| 0 Master Index | README + Stubs | Struktur ✅ |
| 1 Product Vision | MASTER-PROMPT v3 ✅ | MVP-Kern ✅, V2+ 🔴 |
| 2 UI Design | MOCKUP-SCREENS ✅ | ~60% Consumer UI |
| 3 Development | BERICHT + Stubs | Architektur 🟡 |
| 4 Backend | README ✅ | Supabase-Fundament ✅ |
| 5 Operations | README + APK ✅ | Ops-Prozesse 🔴 |

---

## 12. Empfohlene Lesereihenfolge (Analyse-Paket)

1. `02_mockup_index.md` — visuelle Referenz
2. `03_gap_analysis.md` — Ist/Soll
3. `04_component_inventory.md` + `05_screen_inventory.md`
4. `06_architecture_review.md` + `09_technical_debt.md`
5. `07_design_review.md` + `08_performance_review.md`
6. `10_migration_roadmap.md` — Sprint-Plan

---

*Erstellt ohne Codeänderungen. Basis: vollständiger Repository-Scan + Mockup-ZIP-Inventar.*
