# Sprint 4 Report — Organizer Platform & Event Management

**Projekt:** Eternal Rave · **Branch:** `cursor/sprint-4-organizer-a932` · **Datum:** 28. Juni 2026

---

## 1. Was wurde umgesetzt?

### Organizer Platform
- Organizer Dashboard mit Tabs: All, Drafts, Pending, Published, Archived
- Stat Cards (Events, Drafts, Pending, Published)
- Empty, Loading, Error States
- `useOrganizerEvents` Hook — Supabase wenn konfiguriert, Demo-Fallback via `useEventStore`

### Event Management
- Create Event Wizard mit Schritt-Validierung und Feld-Fehlermeldungen
- Edit Event — Save Draft, Submit for Review, Delete Draft
- Preview Event mit Status Badge und Timeline
- Form Mapping `OrganizerEventFormData` ↔ `EventDraftInput` / `EventEntity`
- Anbindung an `eventDraftService`, `eventRepository`, `submitDraftForReview`

### Admin Foundation
- Review Queue über `useReviewQueue` (Supabase)
- Neuer Screen `app/admin/review/[id].tsx` — Approve, Reject, Request Changes, Publish
- Audit Log Anzeige (vorbereitet)
- Demo-Modus ohne Supabase unverändert nutzbar

### UI Components
- `OrganizerEventCard`, `EventStatusTimeline`
- `FormField` mit `error` Prop
- `StatusBadge` unterstützt DB-Lifecycle-Status (`draft`, `pending_review`, …)

### Form Validation
- Titel, Datum, Uhrzeit, Location, Genre, Ticket URL
- `validateOrganizerStep` (Wizard) + `validateOrganizerForm` (Submit)

### Nicht umgesetzt (bewusst)
Discovery, Home Feed, Suche, Filter, Maps, KI, RSS, OAuth, Push, Payments, Chat — siehe NEXT_STEPS.md

---

## 2. Geänderte Dateien

See [CHANGED_FILES.md](./CHANGED_FILES.md)

---

## 3. Architekturentscheidungen

See [DECISIONS.md](./DECISIONS.md)

---

## 4. Risiken

| ID | Risiko | P |
|----|--------|---|
| S4-R01 | Migration 006 muss auf Supabase laufen | P0 |
| S4-R02 | Demo-Modus und Backend-Modus parallel (useEventStore Fallback) | P1 |
| S4-R03 | Kein ESLint / automatisierte Tests | P1 |
| S4-R04 | Event-Statistiken (Views/Followers) nur Platzhalter | P2 |

---

## 5. App stabil?

**Ja** — `npm run typecheck` ✅, Auth unverändert, keine Breaking Changes, Demo-Modus funktioniert weiter.

---

## 6. Sprint 5 bereit?

**Ja** — Organizer- und Admin-Foundation steht; Discovery/Home Feed kann angebunden werden.

---

## 7. Sprint 5 Aufgaben

See [NEXT_STEPS.md](./NEXT_STEPS.md)

---

## 8. Bewusst verschoben

Discovery, Home Feed, Suche, Filter, Maps, KI, RSS, OAuth, Push, Payments, Chat, vollständige Admin-Plattform, ESLint-Setup, Unit-Test-Pyramid.

---

*Sprint 4 — Organizer Platform & Event Management complete.*
