# Rebuild Recommendation — Eternal Rave

**Stand:** 17. Juli 2026  
**Ziel:** Kontrollierter technischer Neustart auf Basis des Audits

---

## Ausgangslage

Das Repository enthält einen **ungepackten Export** des alten Eternal-Rave-Projekts. Der Export umfasst:
- ✅ Umfangreiche Dokumentation und Blueprint
- ✅ 79 UI-Mockups + Design-Tokens
- ✅ App-Icons und Teil-Assets
- ✅ Datenmodell, DB-Schema, Domain-Logik (Referenz)
- ❌ Keinen UI-Code (Screens, Komponenten, Hooks)
- ❌ Keine installierten Abhängigkeiten

---

## Empfohlene neue Projektstruktur

```
eternal-rave/
├── app/                          # Expo Router — Screens
│   ├── (auth)/                   # Login, Register
│   ├── (onboarding)/             # Onboarding-Flow
│   ├── (tabs)/                   # Home, Events, Map, Saved, Profile
│   ├── event/[id].tsx            # Event Detail
│   ├── organizer/                # Organizer-Flow
│   └── admin/                    # Admin-Flow
├── src/
│   ├── components/               # UI-Komponenten (Atomic Design)
│   │   ├── ui/                   # Buttons, Inputs, Cards, Chips
│   │   ├── layout/               # Screen, Header, TabBar
│   │   └── features/             # EventCard, SearchBar, etc.
│   ├── constants/
│   │   └── theme.ts              # Design-Tokens (aus Export übernehmen)
│   ├── hooks/                    # useAuth, useEvents, useFavorites
│   ├── services/                 # API-Layer (neu schreiben)
│   ├── domain/                   # Geschäftslogik (Referenz aus Export)
│   ├── types/                    # TypeScript-Types (Referenz aus Export)
│   ├── lib/
│   │   └── supabase/             # Supabase-Client
│   └── utils/                    # Formatierung, Filter
├── assets/
│   ├── icons/                    # App-Icons (aus Export)
│   ├── mockups/                  # Entpackte Mockup-Referenzen
│   └── fonts/                    # Neu einbinden
├── supabase/
│   └── migrations/               # Schema aus Export (angepasst)
├── docs/
│   ├── rebuild-audit/            # Dieser Audit
│   └── ...                       # Übernommene Dokumentation
├── Blueprint/                    # Business-Docs (Referenz)
├── tokens/                       # Design-Token Single Source of Truth
│   └── design-tokens.json
├── package.json                  # NEU — nicht aus Export kopieren
├── app.json
├── tailwind.config.js
└── tsconfig.json
```

---

## Was übernehmen?

### Direkt übernehmen (KEEP)

| Inhalt | Quelle | Ziel |
|--------|--------|------|
| Design-Tokens | `theme.ts`, `tailwind.config.js` | `src/constants/theme.ts`, `tokens/` |
| App-Icons | `assets/icon.png`, `splash-icon.png`, Android-Icons | `assets/icons/` |
| DB-Schema | `supabase/migrations/` | `supabase/migrations/` (reviewen) |
| Mockups | 8 ZIP-Archive | `assets/mockups/` (entpacken, normalisieren) |
| Kern-Dokumentation | `docs/00-master-index/`, `docs/01-product-vision/`, `docs/02-ui-design/` | `docs/` |
| Entwicklungsregeln | `docs/rules/` | `docs/rules/` |
| Env-Template | `.env.example` | `.env.example` |

### Als Referenz nutzen (OLD_CODE_REFERENCE)

| Inhalt | Nutzen |
|--------|--------|
| `src/types/` | Datenmodell-Definitionen |
| `src/domain/event/` | Lifecycle-Status-Maschine |
| `src/validation/` | Validierungsregeln |
| `src/services/` | API-Patterns, nicht Code |
| `src/data/` | Seed-Daten-Struktur |
| `docs/04-backend/` | API-Design |
| Sprint-Reports | Entscheidungskontext |

### Nicht übernehmen

| Inhalt | Grund |
|--------|-------|
| Alte `package.json` | Veraltete Versionen, fehlende Tools |
| `placeholderAssets.ts` | Mockups als App-Bilder |
| `onboarding.ts` (alt) | Bindet Mockup-PNGs ein |
| Service-Layer (Code) | An alte Architektur gebunden |
| Sprint-Reports | Historisch |
| CI-Workflow (alt) | Projektspezifisch |

---

## Empfohlener technischer Stack

| Layer | Technologie | Begründung |
|-------|-------------|------------|
| Framework | **Expo SDK 52+** (aktuellste stabile) | Dokumentiert, bewährt im alten Projekt |
| Sprache | **TypeScript** | Durchgängig im Export |
| Navigation | **Expo Router v4** | File-based, dokumentiert |
| Styling | **NativeWind v4** | Tailwind-Tokens bereits definiert |
| State (Client) | **Zustand** | In Docs dokumentiert, leichtgewichtig |
| State (Server) | **TanStack Query v5** | In Docs dokumentiert, Caching |
| Backend | **Supabase** | Schema vorhanden, Auth + Postgres |
| Storage | **AsyncStorage** | Offline-Fallback |
| Animationen | **Reanimated v3** | Motion-Mockups als Referenz |
| Icons | **@expo/vector-icons** (Ionicons) | Im alten Stack, Mockup-kompatibel |
| Maps | **Mapbox** (später) | In Roadmap dokumentiert |
| Testing | **Jest + React Native Testing Library** | In Docs erwähnt |
| Linting | **ESLint + Prettier** | Coding Standards dokumentiert |

**Abweichung vom alten Stack:** Frische Expo-Installation statt SDK-56-Upgrade. Zustand und TanStack Query von Anfang an einbinden (im alten Code dokumentiert, aber nicht in package.json).

---

## Empfohlene Reihenfolge für den Neubau

### Phase 0 — Bootstrap (nächster Schritt)

1. `migration_export.zip` entpacken nach `reference/` oder direkt in Workspace-Struktur
2. Mockup-ZIPs entpacken nach `assets/mockups/`
3. JPEG-as-PNG-Dateien zu `.jpg` umbenennen
4. Frisches Expo-Projekt initialisieren (`npx create-expo-app`)
5. NativeWind, TypeScript, Expo Router konfigurieren
6. Design-Tokens aus `theme.ts` übernehmen
7. Supabase-Projekt anlegen, Migrationen ausführen
8. `.env` konfigurieren
9. Basis-Ordnerstruktur anlegen
10. README und Docs aktualisieren

### Phase 1 — Design System & Foundation

1. Token-System (`tokens/design-tokens.json` → theme.ts + tailwind)
2. Basis-Komponenten: Button, Input, Card, Chip, Badge
3. Layout: Screen, Header, TabBar, SafeArea
4. Typography- und Farb-System aus Mockups 62–69
5. Icon-System (Ionicons + Custom wo nötig)
6. Storybook oder Komponenten-Galerie (optional)

### Phase 2 — Auth & Onboarding

1. Splash Screen (Mockup 01–02)
2. Onboarding-Flow (Mockup 03–06)
3. Login / Register (Mockup 07–08)
4. Supabase Auth Integration
5. First-Launch-Logik

### Phase 3 — Core Tabs (MVP)

1. **Home** (Mockup 09) — **Erster Screen**
2. Events-Liste (Mockup 10)
3. Event Detail (Mockup 11)
4. Saved / Favorites (Mockup 14)
5. Profile (Mockup 15)
6. Bottom Navigation (Mockup 56)

### Phase 4 — Erweiterte Features

1. Map (Mockup 12) — Mapbox-Integration
2. Search & Filter (Mockup 13)
3. Notifications (Mockup 18)
4. Settings (Mockup 19)
5. Tickets (Mockup 16–17)

### Phase 5 — Organizer & Admin

1. Organizer Dashboard (Mockup 20)
2. Create/Edit Event (Mockup 21, 26–30)
3. Admin Dashboard (Mockup 41)
4. Review Queue (Mockup 42–43)
5. Source Manager (Mockup 44)

### Phase 6 — Polish & Release

1. Motion & Animationen (Mockup 70–79)
2. Accessibility (Mockup 79)
3. Performance-Optimierung
4. EAS Build Setup
5. Store-Submission

---

## Erster Screen: Home (Mockup 09)

**Begründung:**
- Zentraler Einstiegspunkt der App (Tab-Navigation)
- Deckt die meisten UI-Patterns ab: Header, Search, Filter-Chips, Cards, Sections
- In `MOCKUP-SCREENS.md` als höchste Priorität dokumentiert
- Validierung des gesamten Design-Systems in einem Screen
- Unabhängig von Auth (kann mit Demo-Daten starten)

**Home-Screen enthält:**
- Location-Header mit Notification-Bell
- Search-Bar
- Quick-Filter-Chips (Heute, Wochenende, Techno, House)
- Featured-Event-Hero-Card
- „Raves in deiner Nähe"-Sektion
- „Heute Abend"-Horizontal-Scroll
- Bottom Tab Navigation

**Voraussetzungen vor Home:**
- Design-Tokens ✅
- Basis-Komponenten (Button, Card, Chip, SearchBar) ✅
- Tab-Navigation-Layout ✅
- Event-Daten (Seed oder Supabase) ✅

---

## Mögliche Risiken

| Risiko | Schwere | Mitigation |
|--------|---------|------------|
| **Unvollständiger Export** — kein UI-Code | Hoch | Mockups + Docs als einzige UI-Referenz; kein Copy-Paste |
| **Mockup-Format** — JPEG mit .png-Endung | Mittel | Beim Entpacken konvertieren/umbenennen |
| **Onboarding-Duplikate** — 2 Versionen pro Screen | Niedrig | High-Res PNGs als kanonisch definieren |
| **Veraltete Docs** — Sprint-Reports, Alignment | Mittel | `MOCKUP-SCREENS.md` und `MASTER-PROMPT` als North Star |
| **Schema-Drift** — alte Migrationen vs. neue Anforderungen | Mittel | Migrationen reviewen, ggf. konsolidieren |
| **Fehlende Fonts** — nicht im Export | Mittel | Aus Mockup 63 ableiten, z. B. Inter oder SF Pro |
| **Externe Bild-URLs** in Seed-Daten | Niedrig | Lokale Placeholders im Neubau |
| **Scope Creep** — 79 Mockups, viele Future-Features | Hoch | Strikt MVP-First (Phase 0–3), Rest in Roadmap |
| **ZIP-in-ZIP** — Export noch gepackt | Hoch | **Erster Bootstrap-Schritt: Entpacken** |

---

## Checkliste: Bereit für Bootstrap?

| Kriterium | Status |
|-----------|--------|
| Assets inventarisiert | ✅ |
| Mockups gezählt und kategorisiert | ✅ (79) |
| Design-Tokens identifiziert | ✅ |
| Datenmodell dokumentiert | ✅ |
| Alter Code klassifiziert | ✅ |
| Duplikate identifiziert | ✅ |
| Empfohlene Struktur definiert | ✅ |
| Stack empfohlen | ✅ |
| Erster Screen definiert | ✅ (Home) |
| Export entpackt | ❌ — **nächster Schritt** |
| Frisches Expo-Projekt | ❌ — nach Entpacken |

---

## Exakt nächster Schritt

```
1. migration_export.zip kontrolliert entpacken
2. Mockup-ZIPs nach assets/mockups/ entpacken
3. JPEG-as-PNG-Dateien normalisieren (.jpg)
4. npx create-expo-app@latest mit TypeScript + Expo Router
5. NativeWind + Design-Tokens einrichten
6. Supabase-Projekt + Migrationen
7. Ersten Screen (Home) gemäß Mockup 09 implementieren
```

**Nicht in diesem Schritt:** Screens entwickeln, Abhängigkeiten des alten Projekts installieren, Dateien löschen.
