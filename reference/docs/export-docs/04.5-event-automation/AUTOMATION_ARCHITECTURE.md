# Automation Architecture

> Band 4.5 · Architekturübersicht Event Automation

---

## Systemkontext

Event Automation ist ein **Querschnittssystem** zwischen externen Quellen, Backend (Supabase), KI-Services und der Eternal Rave App.

```
┌─────────────────────────────────────────────────────────────────┐
│                     EXTERNE QUELLEN                              │
│  Organizer · Community · RSS · ICS · APIs · Partner · Admin     │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     INGESTION LAYER                              │
│  Source Manager · URL Import · Cron · Webhooks · File Upload    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     PROCESSING PIPELINE                          │
│  Normalisierung → KI → Geocoding → Bilder → Tickets → Dedup     │
│  → Confidence Score                                              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     MODERATION LAYER                             │
│  Queue · Bulk Review · Audit Log · Admin UI                     │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     PUBLICATION LAYER                            │
│  lifecycle_status=published → Public Feed → Push → Analytics    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Komponenten

| Komponente | Verantwortung | Status |
|------------|---------------|--------|
| Source Manager | Quellen CRUD, Typ, Schedule | ✅ Sprint 2.3 |
| URL/Text Import | Admin Paste Import | 🟡 Mock Parser |
| Import Pipeline | Normalisierung, Enrichment | 🟡 Teilweise |
| Duplicate Detection | Fuzzy + Heuristik | ✅ |
| Confidence Score | Bewertung 0–100 | 🟡 Basis |
| Moderation Queue | Admin Review UI | ✅ |
| KI Agent | Autonome Erkennung | 🔴 Future |
| Cron/Workers | Scheduled Imports | 🔴 Future |
| Push Notifications | Neue Events | 🔴 Future |

---

## Datenfluss

Siehe [03_Import_Pipeline.md](./03_Import_Pipeline.md):

```
Quelle → Import → Normalisierung → KI Analyse → Geocoding → Bilder
  → Ticketlinks → Duplicate Detection → Confidence Score → Moderation
  → Freigabe → Live → Push → Analytics
```

---

## Integrationen

| System | Zweck | Band |
|--------|-------|------|
| Supabase Auth | Admin, Organizer, User | [4.6](../04.6-authentication-identity/README.md) |
| Supabase DB | events, event_sources, organizers | [4](../04-backend/README.md) |
| Geocoding API | Koordinaten | 4 |
| KI Provider | Extraktion, Agent | 4.5 Phase 5–6 |
| CDN / Storage | Flyer-Bilder | 4 |
| Push (FCM/APNs) | Benachrichtigungen | 5 |

---

## Rollen & Zugriff

| Rolle | Automation-Rechte |
|-------|-------------------|
| Gast | Lesen (published) |
| User | Submissions |
| Organizer | Events + Verification |
| Moderator | Queue Review (Future) |
| Admin | Import, Sources, Bulk, Config |

Details: [Band 4.6 User Roles](../04.6-authentication-identity/02_User_Roles.md)

---

## Event Lifecycle (Architektur)

```
draft → imported_draft → pending_review → needs_review
  → approved → published → updated → archived → deleted
```

Siehe [07_Event_Lifecycle.md](./07_Event_Lifecycle.md)

---

## Sicherheitsgrenzen

- Ingestion nur über authentifizierte Admin/Organizer-Pfade (Live)
- RLS auf Supabase für alle Event-Tabellen
- Kein Client-seitiger Auto-Publish
- Quellenbewertung vor Aktivierung — [11_Security_Legal.md](./11_Security_Legal.md)

---

## Skalierung

| Stufe | Events | Architektur |
|-------|--------|-------------|
| MVP | < 1k | Sync Import, Single DB |
| Growth | 1k–50k | Cron + Queue Workers |
| Scale | 50k–500k | Dedizierte Ingestion Service, CDN |
| Enterprise | 500k+ | Multi-Region, Event Sourcing |

---

## Referenzen

- [README.md](./README.md) — Kapitelindex
- [03_Import_Pipeline.md](./03_Import_Pipeline.md)
- [04-backend/01_Architektur_Uebersicht.md](../04-backend/01_Architektur_Uebersicht.md)
- [analysis/06_architecture_review.md](../analysis/06_architecture_review.md)
