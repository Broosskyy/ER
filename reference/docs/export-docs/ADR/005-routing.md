# ADR-005: Routing (Expo Router)

**Status:** Accepted  
**Datum:** Juni 2026 · Sprint 0

## Kontext

File-based Routing für 27+ Screens, Stack für Modals und Admin/Organizer Flows.

## Entscheidung

**Expo Router ~56** — file-based routing unter `app/`.

## Struktur

- **Root Stack** (`app/_layout.tsx`): Providers + Stack Screens
- **Tab Group** (`app/(tabs)/`): 5 Haupttabs
- **Dynamic Routes**: `event/[id]`, `organizer/edit/[id]`, `admin/sources/[id]/…`

## Transitions

Definiert in `src/constants/navigation.ts`:

| Preset | Verwendung |
|--------|------------|
| `none` | Tabs, Index redirect |
| `modal` | login, register |
| `push` | Detail, Admin, Organizer |

## Begründung

- Konvention over configuration
- Deep Links via expo-linking
- Skaliert für Admin-Unterbäume

## Konsequenzen

- Neue Screens = neue Datei unter `app/`
- Route Guards (Admin) — geplant, noch nicht überall (siehe analysis)
- `admin/review/edit/[id]` existiert, fehlt in expliziter Stack.Screen-Liste (funktioniert via file discovery)

## Referenzen

- `app/_layout.tsx`, `docs/analysis/05_screen_inventory.md`
