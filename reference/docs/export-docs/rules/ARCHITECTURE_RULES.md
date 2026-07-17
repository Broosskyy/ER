# Eternal Rave — ARCHITECTURE RULES

> Sprint 0 · ADRs + analysis/06

---

## Schichten-Modell (frozen Sprint 0)

```
app/ (Screens)
  ↓
hooks/ (Context State)
  ↓
services/ (Supabase API)
  ↓
lib/supabase/ + supabase/ (DB)
```

**Demo-Pfad:** services offline → `src/data/` seeds

---

## Entscheidungen (Accepted ADRs)

| Thema | ADR | Kurz |
|-------|-----|------|
| Mobile | [001](../ADR/001-react-native.md) | React Native |
| Platform | [002](../ADR/002-expo.md) | Expo SDK 56 |
| Backend | [003](../ADR/003-supabase.md) | Supabase + RLS |
| Nav | [004](../ADR/004-navigation.md) | 5 Bottom Tabs |
| Routing | [005](../ADR/005-routing.md) | Expo Router |
| State | [006](../ADR/006-state-management.md) | React Context |

**Proposed (nicht implementieren ohne Sprint):** Maps, Payments, Analytics — ADR 007–009

---

## Dual-Mode Runtime

| Modus | Bedingung | Verhalten |
|-------|-----------|-----------|
| Demo | Keine Supabase Env | `src/data/` Seeds, Admin offen |
| Live | Env gesetzt | Supabase queries |
| Fallback | Live + 0 published | Dummy events + Banner ⚠️ |

**Regel:** Fallback-Verhalten in Production explizit prüfen vor V1.

---

## Event Lifecycle

```
Draft → Pending Review → … → Published
                              ↘ Rejected / Duplicate
```

- **Public Feed:** nur `published`
- **Imports:** nie auto-publish
- **Duplicate:** Admin entscheidet (mark duplicate / merge future)

---

## Security

- RLS auf allen user-facing Tabellen
- Rollen: `user`, `organizer`, `admin` in `profiles`
- Anon key only im Client
- Admin Route Guards — geplant, nicht Sprint 0

---

## Performance-Regeln

- Keine unnötigen Context-Subscriptions in List Items
- FlatList/FlashList bei > ~50 Listeneinträgen (Sprint 4)
- Keine neuen heavy Dependencies ohne ADR
- Tab lazy loading evaluieren (Sprint 4)
- Bilder via expo-image

---

## Skalierbarkeit (CTO-Test)

Vor größeren Features fragen: *Hält das 100k Events / 1M Users?*

- Pagination vor full-table loads
- Index auf `lifecycle_status`, `event_date`
- Import Queue (Future) statt sync scrape

---

## Änderungen an Architektur

1. ADR schreiben oder updaten
2. Band 3 / analysis aktualisieren
3. Kein stilles Refactoring

---

## Bekannte Schulden (Sprint 0 — nicht anfassen)

- TD-01: God Store (`useEventStore`)
- TD-02: Legacy `event_submissions`
- TD-07: ScrollView statt Virtualisierung

Vollständig: [analysis/09_technical_debt.md](../analysis/09_technical_debt.md)

---

## Referenzen

- [analysis/06_architecture_review.md](../analysis/06_architecture_review.md)
- [PROJECT_STRUCTURE.md](../PROJECT_STRUCTURE.md)
