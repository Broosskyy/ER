# 05 — Project Structure Final (Sprint 0 FINAL)

> **Validiert:** Juni 2026 · **Regel:** Struktur beschreiben — nicht umbauen

---

## Repository-Root (Final)

```
Eternal-Rave/
├── app/                          # Expo Router — 27 Screens
│   ├── (tabs)/                   # 5 Tab Screens
│   ├── admin/                    # 10+ Admin Screens
│   ├── organizer/                # 4 Organizer Screens
│   ├── event/                    # Event Detail
│   ├── login.tsx, register.tsx
│   └── _layout.tsx
├── src/
│   ├── components/               # 36 UI-Komponenten + index.ts
│   ├── hooks/                    # 7 Hooks (3 Context Providers)
│   │   └── useEventStore.tsx     # ~1050 LOC (TD-01)
│   ├── services/                 # 15 Service-Module
│   ├── types/                    # event.ts, lifecycle.ts, database.ts, …
│   ├── utils/                    # duplicateDetection, mappers, format, …
│   ├── data/                     # Demo Seeds (offline mode)
│   ├── constants/                # theme.ts, navigation.ts
│   └── lib/supabase/             # client.ts, env.ts
├── assets/
│   ├── icon.png, splash-icon.png # Expo Pflicht-Assets
│   ├── mockups/                  # 8 ZIPs (79 Mockup-PNGs)
│   ├── branding/                 # (leer — Platzhalter)
│   ├── design-system/            # (leer — Platzhalter)
│   ├── ui-components/            # (leer — Platzhalter)
│   ├── motion-library/           # (leer — Platzhalter)
│   ├── illustrations/            # (leer — Platzhalter)
│   └── README.md
├── supabase/
│   ├── migrations/               # 001–004
│   ├── seed_published_events.sql
│   ├── seed_event_sources.sql
│   └── README.md
├── database/                     # Verweis → supabase/
│   └── README.md
├── docs/                         # SSOT Dokumentation
│   ├── 00-master-index/          # Band 0
│   ├── 01-product-vision/        # Band 1
│   ├── 02-ui-design/             # Band 2
│   ├── 03-development/           # Band 3
│   ├── 04-backend/               # Band 4
│   ├── 04.5-event-automation/    # Band 4.5
│   ├── 04.6-authentication-identity/  # Band 4.6
│   ├── 05-product-operations/    # Band 5
│   ├── analysis/                 # Analyse 01–10
│   ├── ADR/                      # 9 ADRs
│   ├── rules/                    # 5 Rule-Dateien
│   ├── sprint-0-final/           # Sprint 0 FINAL Reports
│   ├── PROJECT_READY.md
│   └── PROJECT_STRUCTURE.md
├── scripts/                      # generate-seed-events.js
├── app.json                      # v1.7.0
├── package.json                  # ⚠️ version 1.0.0 (Sync Sprint 1)
├── tailwind.config.js
└── tsconfig.json                 # strict: true
```

---

## docs/ Struktur — Final

| Ordner | Dateien (ca.) | README |
|--------|---------------|--------|
| 00-master-index | 15+ | ✅ |
| 01-product-vision | 15+ | ✅ |
| 02-ui-design | 15+ | ✅ |
| 03-development | 15+ | ✅ |
| 04-backend | 15+ | ✅ |
| 04.5-event-automation | 14 | ✅ |
| 04.6-authentication-identity | 10 | ✅ |
| 05-product-operations | 18+ | ✅ |
| analysis | 11 | ❌ Sprint 1 |
| ADR | 10 | ✅ |
| rules | 6 | ✅ |
| sprint-0-final | 7 | ✅ |

**Gesamt docs/:** ~129 Markdown-Dateien

---

## app/ Screen-Inventar (27)

| Bereich | Anzahl | Routen-Prefix |
|---------|--------|---------------|
| Tabs | 5 | `/(tabs)/` |
| Auth | 2 | `/login`, `/register` |
| Consumer | 4 | `/event`, `/add-event`, `/my-submissions`, … |
| Organizer | 4 | `/organizer/` |
| Admin | 12+ | `/admin/` |

Detail: [analysis/05_screen_inventory.md](../analysis/05_screen_inventory.md)

---

## src/ Modul-Inventar

| Modul | Anzahl | Anmerkung |
|-------|--------|----------|
| components/ | 36 | Barrel export index.ts |
| hooks/ | 7 | 3 Provider |
| services/ | 15 | inkl. ungenutzte Facades (TD-03) |
| types/ | 4 | database.ts drift (TD-05) |
| utils/ | 8 | duplicateDetection.ts ✅ |

Detail: [analysis/04_component_inventory.md](../analysis/04_component_inventory.md)

---

## assets/ — Validierung

| Pfad | Inhalt | Status |
|------|--------|--------|
| mockups/*.zip | 8 Archive, 79 Screens | ✅ SSOT visuell |
| icon.png, splash | Expo | ✅ |
| branding/ | leer | 🟡 Platzhalter OK |
| design-system/ | leer | 🟡 Tokens in theme.ts |
| motion-library/ | leer | 🟡 Spec in Band 2 |
| ui-components/ | leer | 🟡 Code in src/components |

**Urteil:** Asset-Ordnerstruktur korrekt; Inhalt in Code + Band 2 dokumentiert.

---

## supabase/ — Validierung

| Migration | Inhalt | Status |
|-----------|--------|--------|
| 001_initial_schema | Core Schema, RLS, Auth | ✅ |
| 002_event_sources | Source Manager | ✅ |
| 003_user_submission_rls | Submissions | ✅ |
| 004_duplicate_warning | Duplicate Flags | ✅ |

---

## Ordner-Logik — Bewertung

| Kriterium | Score | Anmerkung |
|-----------|-------|-----------|
| Trennung app/src | 95 | Expo Router Konvention |
| docs/ Band-Struktur | 95 | 4.5/4.6 eingefügt |
| assets/ vs src/ | 85 | Leere Subfolders |
| supabase/ isoliert | 100 | Standard |
| Keine toten Root-Ordner | 90 | APKs im Root (untracked) |

**Gesamt Projektstruktur: 85/100**

---

## Abweichungen vom Zielbild (Band 3)

| Geplant (Band 3) | Ist | Akzeptiert |
|------------------|-----|------------|
| `src/stores/` (Zustand) | — | 🔴 Future |
| `src/api/` | services/ | ✅ Umbenennung OK |
| Tests Ordner | — | 🔴 Sprint 14 |

**Keine strukturellen Änderungen empfohlen vor Sprint 10.**

---

## Sprint 1 Structure-Tasks

1. `docs/analysis/README.md` — Index der Analyse-Dateien
2. `package.json` version → 1.7.0
3. Optional: `assets/mockups/README.md` — ZIP-Index Verweis

---

*Siehe auch [PROJECT_STRUCTURE.md](../PROJECT_STRUCTURE.md)*
