# ADR-004: Navigation (Bottom Tabs)

**Status:** Accepted  
**Datum:** Juni 2026 · Sprint 0

## Kontext

Band 1 MASTER-PROMPT: **Bottom Navigation ONLY** — Home, Events, Map, Saved, Profile. Organizer und Admin sind interne Flows.

## Entscheidung

Custom **BottomNav** mit 5 Tabs in `app/(tabs)/_layout.tsx`.

| Tab | Route | Label |
|-----|-------|-------|
| Home | `home` | Home |
| Events | `search` | Events |
| Map | `map` | Map |
| Saved | `favorites` | Saved |
| Profile | `profile` | Profile |

## Begründung

- 1:1 Mockup / MASTER-PROMPT
- Kein Drawer, kein Top-Tabs für Hauptnavigation
- Admin/Organizer über Profile-Links und Stack

## Konsequenzen

- `BOTTOM_NAV_HEIGHT = 64` in theme.ts
- Tab Screens brauchen bottom padding für Nav-Overlap
- Mockup 56 (UI Navigation Library) als visuelle Referenz

## Referenzen

- `src/constants/theme.ts` TabRoutes
- `src/components/BottomNav.tsx`
- Mockup 09–15, 56
