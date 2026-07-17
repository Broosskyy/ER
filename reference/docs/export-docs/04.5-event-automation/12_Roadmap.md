# 12 — Roadmap

> Band 4.5 · Phasenplan Event Automation

---

## Übersicht

Die Event Automation wird **inkrementell** ausgebaut — von manueller Eingabe bis zum autonomen KI-Agenten. Jede Phase baut auf der vorherigen auf; keine Phase überspringen ohne dokumentierte Abhängigkeiten.

---

## Phase 1 — Manuell

**Status:** ✅ Teilweise implementiert (Sprint 2.x)

| Deliverable | Beschreibung |
|-------------|--------------|
| Admin URL/Text Import | Paste → Parse → Review |
| Lifecycle | draft → review → published |
| Duplicate Detection | Heuristik |
| Kein Cron | Alles manuell ausgelöst |

**Code:** `app/admin/import/`, `duplicateDetection.ts`

---

## Phase 2 — Organizer

**Status:** 🟡 Foundation (Submissions, Roles)

| Deliverable | Beschreibung |
|-------------|--------------|
| Organizer Registration | Role + Profile |
| Event Submission | User/Organizer → Queue |
| Verification Antrag | pending → verified |
| Badge | UI + Confidence Boost |

**Abhängigkeit:** [Band 4.6 Authentication](../04.6-authentication-identity/README.md), Organizer Verification

---

## Phase 3 — RSS / ICS

**Status:** 🔴 Geplant

| Deliverable | Beschreibung |
|-------------|--------------|
| RSS Parser | Feed → Events |
| ICS Kalender | iCal Import |
| Cron Jobs | Supabase Edge / External Worker |
| Source Manager | RSS/ICS als source_type |

**Abhängigkeit:** Phase 2 (Organizer als vertrauenswürdige Quelle etabliert)

---

## Phase 4 — APIs

**Status:** 🔴 Geplant

| Deliverable | Beschreibung |
|-------------|--------------|
| Ticketplattform-APIs | Partner-Integration |
| Offizielle Venue APIs | Wo verfügbar |
| Webhook Ingestion | Push von Partnern |
| API Keys Management | Secure storage |

---

## Phase 5 — KI Import

**Status:** 🔴 Geplant

| Deliverable | Beschreibung |
|-------------|--------------|
| KI-Extraktion | Web/Social → strukturierte Events |
| Normalisierung | Einheitliches Schema |
| Confidence Score | KI-basierte Bewertung |
| Geocoding + Bilder | Anreicherung |
| Immer Review | Kein Auto-Publish |

**Abhängigkeit:** Phase 3–4 (Quellen-Infrastruktur), Legal Review

---

## Phase 6 — Autonomer KI Agent

**Status:** 🔴 Langfrist

| Deliverable | Beschreibung |
|-------------|--------------|
| Event-Erkennung | Neue Events automatisch |
| Änderungserkennung | Lineup, Zeit, Venue, Absage |
| Ticketlink-Updates | Automatische Pflege |
| Moderationsvorschläge | Admin bestätigt |
| Selektives Auto-Publish | Nur ≥95 + verified + Policy |

Siehe [04_AI_Agent.md](./04_AI_Agent.md)

---

## Phasen-Abhängigkeiten

```
Phase 1 Manuell
  ↓
Phase 2 Organizer (+ Auth/Verification)
  ↓
Phase 3 RSS/ICS
  ↓
Phase 4 APIs
  ↓
Phase 5 KI Import
  ↓
Phase 6 KI Agent
```

---

## Meilensteine (Projekt-Roadmap)

Siehe [Migration Roadmap](../analysis/10_migration_roadmap.md):

```
Authentication → Organizer Verification → Event Automation → AI Automation → Monitoring
```

---

## Referenzen

- [01_Automation_Overview.md](./01_Automation_Overview.md)
- [04_AI_Agent.md](./04_AI_Agent.md)
- [04.6-authentication-identity/09_Roadmap.md](../04.6-authentication-identity/09_Roadmap.md)
- [analysis/10_migration_roadmap.md](../analysis/10_migration_roadmap.md)
