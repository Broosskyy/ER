# Eternal Rave — PROJECT STRUCTURE

> **Validiert:** Sprint 0 · Juni 2026  
> **Regel:** Struktur beschreiben — nicht umbauen

---

## Repository-Root

```
Eternal-Rave/
├── app/                      # Expo Router — Screens (27 Dateien)
├── src/                      # Application Code
│   ├── components/           # UI-Komponenten (36)
│   ├── hooks/                # Context + Custom Hooks (7)
│   ├── services/             # Supabase API Layer (15)
│   ├── types/                # TypeScript Domain + DB Types (4)
│   ├── utils/                # Parser, Mapper, Format (8)
│   ├── data/                 # Demo Seeds (offline mode)
│   ├── constants/            # theme.ts, navigation.ts
│   └── lib/supabase/         # Client, env detection
├── assets/                   # App-Icons + Design-Assets
│   ├── icon.png, splash…     # Expo (Pflicht)
│   ├── mockups/              # 79 Mockup-PNGs (8 ZIPs)
│   ├── branding/             # (Platzhalter)
│   ├── design-system/        # (Platzhalter)
│   ├── ui-components/        # (Platzhalter)
│   ├── motion-library/       # (Platzhalter)
│   └── illustrations/        # (Platzhalter)
├── supabase/                 # Migrationen 001–004, Seeds
├── database/                 # Verweis-Dokumentation → supabase/
├── docs/                     # Band 0–5 + Analysis + ADR + Rules
├── scripts/                  # generate-seed-events.js
├── app.json                  # Expo Config (v1.7.0)
├── package.json
├── tailwind.config.js        # NativeWind Tokens
└── tsconfig.json             # strict: true
```

---

## docs/ — Dokumentationsbaum

```
docs/
├── README.md                 # Einstieg → Band 0
├── PROJECT_READY.md          # Sprint 0 Status
├── PROJECT_STRUCTURE.md      # Diese Datei
├── 00-master-index/          # Band 0 — Navigation, Glossar
├── 01-product-vision/        # Band 1 — MASTER-PROMPT, Vision
├── 02-ui-design/             # Band 2 — Mockups, Design Alignment
├── 03-development/           # Band 3 — Berichte, Tech
├── 04-backend/               # Band 4 — Supabase, Schema
├── 05-product-operations/    # Band 5 — Releases, Ops
├── analysis/                 # Projektanalyse (10 Dokumente)
├── ADR/                      # Architecture Decision Records
└── rules/                    # PROJECT, CODING, DESIGN, ARCHITECTURE, CURSOR
```

---

## app/ — Routing (Expo Router)

```
app/
├── _layout.tsx               # Provider Stack
├── index.tsx                 # → /home
├── (tabs)/
│   ├── _layout.tsx           # BottomNav (5 Tabs)
│   ├── home.tsx
│   ├── search.tsx            # Tab: Events
│   ├── map.tsx
│   ├── favorites.tsx         # Tab: Saved
│   └── profile.tsx
├── login.tsx · register.tsx
├── add-event.tsx · my-submissions.tsx
├── event/[id].tsx
├── organizer.tsx + organizer/*
└── admin.tsx + admin/*
```

**Navigation:** 5 Tabs + Stack für Auth, Detail, Organizer, Admin.

---

## src/ — Code-Schichten

| Schicht | Pfad | Verantwortung |
|---------|------|---------------|
| UI | `components/` | Wiederverwendbare Komponenten |
| Screens | `app/` | Route-gebundene Views |
| State | `hooks/` | React Context (Auth, EventStore, Favorites, Sources) |
| API | `services/` | Supabase Queries, ServiceResult Pattern |
| Domain | `types/` | event, lifecycle, database, eventSource |
| Utils | `utils/` | duplicateDetection, mappers, format |
| Demo | `data/` | Offline Seeds |
| Tokens | `constants/theme.ts` | Design System (Code) |

---

## supabase/ — Backend

```
supabase/
├── migrations/
│   ├── 001_initial_schema.sql
│   ├── 002_event_sources.sql
│   ├── 003_user_submission_rls.sql
│   └── 004_duplicate_warning_events.sql
├── seed_published_events.sql
├── seed_event_sources.sql
└── README.md
```

---

## Validierung Sprint 0

| Prüfpunkt | Ergebnis |
|-----------|----------|
| app/ + src/ Trennung | ✅ Wie Band 3 dokumentiert |
| docs/ Band 0–5 vorhanden | ✅ |
| assets/mockups/ mit ZIPs | ✅ 8 Archive, 79 PNGs |
| database/ als Pointer | ✅ |
| analysis/ vollständig | ✅ 10 Dateien |
| ADR/ + rules/ | ✅ Sprint 0 neu |
| Keine verwaisten Root-Ordner | ✅ |

---

## Abweichungen ( dokumentiert, nicht geändert )

| Thema | Docs sagen | Code ist |
|-------|------------|----------|
| State | Zustand + TanStack Query (Band 3 Stub) | React Context |
| Maps | Mapbox (Band 1 Future) | MapPlaceholder |
| package.json version | — | 1.0.0 vs app.json 1.7.0 |

Siehe [ADR/](./ADR/) für bewusste Entscheidungen.

---

*Struktur frozen für Sprint 0 — Änderungen nur in späteren Sprints mit ADR-Update.*
