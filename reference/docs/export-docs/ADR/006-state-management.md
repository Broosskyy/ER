# ADR-006: State Management

**Status:** Accepted  
**Datum:** Juni 2026 · Sprint 0

## Kontext

Band 3 Stub nennt Zustand + TanStack Query. **Ist-Implementierung** (Sprint 0): React Context.

## Entscheidung

**React Context + useState** in dedizierten Hooks — kein Wechsel in Sprint 0.

### Provider-Hierarchie

```
AuthProvider
  EventStoreProvider      (~1050 LOC — Feed, Admin, Submissions)
    EventSourceProvider
      FavoritesProvider
```

### Hooks

| Hook | Rolle |
|------|-------|
| `useAuth` | Session, Profile, Rollen |
| `useEventStore` | Zentraler App-State |
| `useEventSources` | Source Manager |
| `useFavorites` | Favoriten |
| `usePublicEventFeed` | Feed-Facade |

## Begründung (warum so implementiert)

- MVP-Geschwindigkeit ohne extra Dependencies
- Dual-Mode (Demo/Supabase) in einem Store handhabbar
- Funktioniert für aktuelle Event-Anzahl

## Bekannte Limitationen (dokumentiert, Sprint 0 nicht fixen)

- God Store → breite Re-Renders
- Kein Server-Cache / Stale-While-Revalidate
- Band 3 Zustand/Query = **Future**, nicht Ist

## Future (neues ADR nötig)

Migration zu TanStack Query für Server-State + kleinerer UI-State — siehe analysis/10_migration_roadmap Sprint 10.

## Referenzen

- `src/hooks/`, analysis/06_architecture_review.md, TD-01
