# 02 Navigation

Wie die Dokumentation aufgebaut ist und wie zwischen den Bänden navigiert wird.

---

## Einstiegspunkte

1. **[docs/README.md](../README.md)** — Zentraler Docs-Einstieg
2. **[00-master-index/README.md](./README.md)** — Band 0 Master Index
3. **Band-README** in jedem Ordner — Kapitelindex des jeweiligen Bands

---

## Band-Struktur

```
Band 0  →  Übersicht, Navigation, Glossar, Roadmap
Band 1  →  Was wir bauen (Vision, MVP)
Band 2  →  Wie es aussehen soll (Mockups, Design)
Band 3  →  Wie wir entwickeln (Architektur, Sprints)
Band 4  →  Backend (Supabase, API, DB)
Band 4.5 → Event Automation (Import, KI, Moderation)
Band 4.6 → Authentication (Rollen, Login, Verification)
Band 5  →  Operations (Release, QA, Support, Ops)
```

---

## Typische Lesepfade

### Neues Teammitglied
Band 0 → Band 1 → Band 3 → Band 2 (Mockups)

### Backend-Entwicklung
Band 4 → Band 4.6 → Band 4.5 → `supabase/README.md`

### Feature: Organizer Verification
Band 4.6 Kap. 05 → Band 4.5 Kap. 08 → Band 5 Kap. 15

### Event Automation
Band 4.5 (vollständig) → Band 4 → Band 5 Kap. 13

### Release / Ops
Band 5 → Band 0 Kap. 10 (Master Roadmap)

---

## Link-Konventionen

| Typ | Format |
|-----|--------|
| Innerhalb Band | `./01_Datei.md` |
| Anderer Band | `../04-backend/README.md` |
| Analyse | `../analysis/06_architecture_review.md` |
| Code | Backticks `src/hooks/useAuth.tsx` |

---

## Verwandte Ressourcen

| Ressource | Pfad |
|-----------|------|
| Mockups | `/assets/mockups/` |
| Database | `/database/` |
| Supabase Setup\` | `/supabase/migrations/` |
| Projekt-Analyse | `/docs/analysis/` |
