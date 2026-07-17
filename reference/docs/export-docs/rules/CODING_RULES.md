# Eternal Rave — CODING RULES

> Sprint 0 · Ergänzt Band 3 Kap. 09 (Stub)

---

## Sprache & Stack

- **TypeScript** strict — `npm run typecheck` muss grün bleiben
- **React Native + Expo SDK 56** — siehe [ADR-002](../ADR/002-expo.md)
- **Kein `any`** — Ausnahmen kommentieren

---

## Datei- & Ordner-Konventionen

| Art | Ort |
|-----|-----|
| Screens | `app/` (Expo Router) |
| UI Components | `src/components/` + Export in `index.ts` |
| Business Logic / API | `src/services/` |
| State | `src/hooks/` |
| Types | `src/types/` |
| Utils | `src/utils/` |
| Constants / Tokens | `src/constants/` |
| Demo Data | `src/data/` (nur offline mode) |

---

## Imports

- Path alias: `@/` → `src/` bzw. Projekt-Root (tsconfig)
- Barrel imports bevorzugt: `@/components`, `@/hooks`
- Keine zirkulären Abhängigkeiten Hooks ↔ Components

---

## Services

- Rückgabe: `ServiceResult<T> = { data, error, offline }`
- Supabase nicht konfiguriert → `{ offline: true }`, kein Throw
- Services in Hooks konsumieren — Screens rufen Services **nicht** direkt auf (Best Practice)

---

## Components

- Functional Components only
- Props als `interface XxxProps`
- Styling: NativeWind `className` + `Colors` aus theme.ts für programmatic styles
- Keine hardcoded Hex-Farben außerhalb theme.ts (Ausnahme: Event-Gradients in data)

---

## Naming

| Element | Konvention | Beispiel |
|---------|------------|----------|
| Components | PascalCase | `EventCard.tsx` |
| Hooks | camelCase, `use` prefix | `useEventStore.tsx` |
| Services | camelCase files | `events.ts` |
| Screens | default export, route file name | `home.tsx` |
| Types | PascalCase | `Event`, `EventLifecycleStatus` |

---

## Git & Commits

- Commit messages: Deutsch oder Englisch, **imperativ**, beschreibend
- Ein logisches Thema pro Commit
- Keine APKs, `.env`, `node_modules` committen

---

## Tests (Ziel — noch nicht implementiert)

- Utils zuerst: `duplicateDetection`, `format`, `eventMappers`
- `npm run typecheck` vor jedem Push
- Tests folgen in Sprint 14 (Roadmap)

---

## Verboten ohne ADR + Review

- Framework-Wechsel
- State-Library-Wechsel (Zustand/Redux)
- Schema-Breaking Migrations
- Löschen bestehender Screens/Routes

---

## Referenzen

- [PROJECT_RULES.md](./PROJECT_RULES.md)
- [ARCHITECTURE_RULES.md](./ARCHITECTURE_RULES.md)
- Band 3: [09_Coding_Standards.md](../03-development/09_Coding_Standards.md)
