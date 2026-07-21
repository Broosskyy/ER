# Platform Architecture Foundation — ER-005.4

**Stand:** 20. Juli 2026  
**Typ:** Architektur-Review, Zielbild und Migrationsstrategie  
**Scope:** Dokumentation + minimale Code-Vorbereitung (keine neuen DB-Tabellen in ER-005.4)

**Verwandt:** `docs/ARCHITECTURE_ROADMAP.md` (Langfristvision), `app-v2/docs/ARCHITECTURE.md` (Ist-Stack), `AI_CONTEXT.md`, `docs/PROJECT_STATE.md`

---

## 1. Executive Summary

Eternal Rave hat eine **solide Phase-1-Grundlage**: Events, Venues, Auth, Import, Contributor-Einreichung, RLS und Repository-Schicht. Für die langfristige Plattformvision (Community, Medien, Native Ticketing, Monetization) bestehen **architektonische Lücken** vor allem an der **DB-Grenze**: reiche Pipeline-Domain (Line-up, Organizer, Preis) vs. normalisierte Supabase-Tabelle mit Single-FK-Modell.

ER-005.4 dokumentiert diese Lücken, definiert Zielarchitektur und Migrationspfade, und implementiert **nur sichere Vorbereitungen** ohne Breaking Migrations.

---

## 2. Current State (Ist-Architektur)

### 2.1 Schichtenmodell

```
app/ (Expo Router)
  → src/features/ (Domain-UI, Services)
  → src/data/repositories/
  → src/data/datasources/ (local | supabase)
  → PostgreSQL + Storage (Supabase)
```

- UI spricht **nicht** direkt mit Supabase
- `featureFlags.useSupabase` schaltet Datenquelle
- RLS ist autoritative Zugriffskontrolle

### 2.2 Datenbank (12 Migrationen)

| Domäne | Tabellen | Reife |
|--------|----------|-------|
| Events | `events` | Produktiv, Contributor-RLS |
| Referenz | `genres`, `cities`, `venues`, `artists`, `collections`, `sources` | Produktiv |
| Import | `import_jobs`, `import_records`, `import_logs`, `import_audit_logs` | Produktiv |
| Community | — | **Nicht vorhanden** |
| Ticketing | — (nur `events.ticket_url`) | External link only |
| Organizer | — | **Nicht vorhanden** |
| Profiles | — (`created_by` uuid only) | **Geplant** |

### 2.3 Event-Modell (drei Ebenen)

| Ebene | Ort | Merkmale |
|-------|-----|----------|
| Pipeline `Event` | `features/events/types/event.ts` | `lineup[]`, `organizer`, `priceText`, Multi-Genre |
| Admin `AdminEventRecord` | `data/types/records.ts` | FK-basiert, ER-005 Spalten |
| DB `events` | PostgreSQL | Single `genre_id`, `artist_id`, `venue_id` |

### 2.4 Event-Status (heute)

Einheitlich: `draft | review | published | rejected | archived`

- **Editorial/Moderation:** abgedeckt durch `status`
- **Operational** (cancelled, postponed): **nicht modelliert**
- **Ticket** (sold out, on sale): **nicht modelliert** (implizit über `ticket_url`)

Planungstypen: `src/features/events/domain/event-status-dimensions.ts`

### 2.5 Auth & Rollen (heute)

| Typ | Quelle | Werte |
|-----|--------|-------|
| Platform Admin | JWT `app_metadata.role` | viewer, editor, reviewer, source_manager, admin, owner |
| Consumer | Supabase Auth | `authenticated` + `created_by` auf Events |
| Organizer Team | — | **Nicht vorhanden** |
| Venue Manager | — | **Nicht vorhanden** |

`has_admin_role()` existiert in SQL, wird in RLS-Policies **nicht** verwendet (nur `is_admin()`).

### 2.6 Venue-Modell (heute)

| Modus | Speicherung | UI |
|-------|-------------|-----|
| Strukturiert | `venue_id` → `venues` | Venue-Picker |
| Vorschlag | `venue_name`, `venue_city` | Contributor-Freitext |
| Legacy | `subtitle` (read-only) | Fallback |

**ER-005.4 Fix:** `mapEventRowToDomain` nutzt jetzt Venue-Vorschläge für Consumer-Anzeige (`resolveDomainVenueLabel`).

### 2.7 Ticketing (heute)

- `events.ticket_url` — externer Link
- Event-Detail CTA, Notifications (`ticket_available`)
- Keine Produkte, Orders, QR, Inventory

Planungstypen: `src/features/events/domain/ticketing-foundation.ts`

### 2.8 Promotion (heute)

- `collections` + `collection_id` auf Events = kuratierte Sektionen (Highlights, Tonight, …)
- Kein Sponsoring, Boosting oder Paid Placement

### 2.9 Analytics (heute)

- Web GA4, consent-gated (`src/platform/analytics/`)
- Katalog in `analytics-events.ts` + `docs/analytics.md`
- Kein Server-Side Tracking, kein Contributor-Funnel

### 2.10 Community (heute)

- Lokales Activity/Notification Center (kein Push)
- **Kein** unified Content-Modell in DB
- Vision in `docs/ARCHITECTURE_ROADMAP.md` Phase 2–3

---

## 3. Target Architecture (Zielbild)

### 3.1 Domain-Übersicht

```
Platform Core
├── Identity (Auth, Profiles, Platform Roles)
├── Events (Editorial, Operational, Media attachments)
├── Venues (Canonical + Snapshots + Hidden locations)
├── Organizers (Entity, Membership, Verification)
├── Ticketing (Products → Orders → Issued Tickets → QR)
├── Community (Unified Content + Engagement)
├── Promotion (Collections + Sponsored placements)
├── Notifications (Event stream → In-App → Push)
├── Moderation (Cross-content queues)
├── Analytics (Consent-based event catalog)
└── Monetization (Premium organizer features — future)
```

### 3.2 Unified Content Architecture (Phase 2+)

Ein polymorphes `content`-Fundament für Posts, Bilder, Stories, Reels, Videos — gemeinsame Engagement-Schicht (Likes, Comments, Reports). **Nicht in ER-005.4 implementiert.** Siehe `docs/ARCHITECTURE_ROADMAP.md`.

### 3.3 Rollen-Trennung (Ziel)

| Schicht | Beispiel | Speicherort (geplant) |
|---------|----------|----------------------|
| **Platform Roles** | admin, reviewer | JWT `app_metadata` (heute) |
| **Organizer Roles** | owner, editor, promoter | `organizer_memberships` (geplant) |
| **Venue Roles** | venue_manager | `venue_memberships` (geplant) |

Planungstypen: `src/features/events/domain/organizer-foundation.ts`

### 3.4 Event-Status-Dimensionen (Ziel)

| Dimension | Spalte/Modell (geplant) | Heute |
|-----------|-------------------------|-------|
| Editorial | `status` | ✅ `events.status` |
| Operational | `operational_status` oder Event-Extension | ❌ |
| Ticket summary | `ticket_status` oder Relation | ❌ (`ticket_url` only) |

**Prinzip:** Neue Dimensionen als **additive** Spalten/Tabellen — `status` nicht überladen.

### 3.5 Ticketing-Migrationspfad

```
Phase 0 (heute)     ticket_url (external)
Phase 1 (geplant)   ticket_products + provider_id
Phase 2             inventory, orders, payments integration
Phase 3             issued_tickets + QR validation
```

Checkout und Zahlungsabwicklung sind **bewusst außerhalb** des aktuellen Scopes.

### 3.6 Venue-Zielmodell

| Anforderung | Strategie |
|-------------|-----------|
| Wiederverwendbare Venues | `venues` Tabelle (✅) |
| Temporäre Orte | `venue_name`/`venue_city` Vorschlag (✅) → später `venue_snapshots` |
| Versteckte Locations | `visibility` auf Venue oder Event-Extension |
| Historische Snapshots | `event_venue_snapshots` bei Publish (denormalisiert, unveränderlich) |

### 3.7 Promotion-Integration (Ziel)

- Sponsored Events als **Metadata-Flag** + separates Billing — nicht in `collections` vermischen
- Premium Organizer Features über `organizer_subscriptions` (später)
- Editorial Collections (`collection_id`) bleiben redaktionell

### 3.8 Analytics-Strategie (Ziel)

| Kategorie | Beispiele | PII |
|-----------|-----------|-----|
| Navigation | screen_view, search_completed | Keine |
| Engagement | event_opened, event_favorited | event_id only |
| Contributor | draft_saved, event_submitted | user_id hashed/server |
| Commerce (später) | ticket_cta_clicked, checkout_started | Keine Koordinaten |

Erweiterung des bestehenden `ANALYTICS_EVENT_CATALOG` — dokumentiert in `docs/analytics.md`, nicht in ER-005.4 verdrahtet.

---

## 4. Identified Risks

| Risiko | Impact | Mitigation |
|--------|--------|------------|
| Single-FK vs Multi-Artist/Genre | Line-up nicht persistierbar | Junction-Tabellen `event_artists`, `event_genres` (additive Migration) |
| Organizer nur als String | Keine Ownership/Teams | `organizers` + `organizer_memberships` vor Organizer-Registration |
| Pipeline vs DB Status-Semantik | Verwirrung bei Import | Docs sync; Pipeline auto-publish nur lokal |
| Venue-Vorschlag nicht in Consumer-UI | Falsche Anzeige | **Behoben in ER-005.4** (Mapper) |
| `has_admin_role` ungenutzt | Grobe Admin-RLS | Später policies differenzieren; Frontend hat Permissions |
| Doc Drift (`database.md`, `EVENT_DATA_ARCHITECTURE.md`) | Fehlentscheidungen | ER-005.4 Doc-Update; Verweis auf dieses Dokument |
| Community als Parallel-Systeme | Technische Schuld | Unified Content Architecture vor Phase 2 Start |
| `ticket_url` → Native Ticketing | Breaking Change | `ticketing_mode` Spalte + Migrationstabelle (Phase 1) |

---

## 5. Structural Improvements (ER-005.4)

| Änderung | Typ | Begründung |
|----------|-----|------------|
| `resolveDomainVenueLabel` + Mapper-Fix | Code | Venue-Vorschläge in Consumer-Pfad |
| `event-status-dimensions.ts` | Planning types | Status-Dimensionen dokumentieren ohne DB-Change |
| `ticketing-foundation.ts` | Planning types | Migrationspfad external → native |
| `organizer-foundation.ts` | Planning types | Organizer-Domain vorbereiten |
| Dieses Dokument | Docs | Zentrale Foundation-Referenz |
| Tests für Venue + Domain foundation | Tests | Regression-Schutz |

**Nicht implementiert:** neue Tabellen, Checkout, Community, Push, Video-Pipeline.

---

## 6. Migration Strategy (Additive Only)

### Prinzipien

1. **Additive Migrationen** — keine DROP/Rename ohne Deprecation-Phase
2. **Dual-Write-Phasen** wo nötig (z. B. `ticket_url` + `ticket_products`)
3. **RLS pro neue Tabelle** von Anfang an
4. **Repository-Erweiterung** — keine parallelen APIs
5. **Feature Flags** für inkrementelle Aktivierung

### Empfohlene Migrations-Reihenfolge

| Epic | Migration (konzeptionell) |
|------|---------------------------|
| ER-006 | Admin Publish-Workflow, Contributor-Queue (kein Schema nötig) |
| ER-008 | Venue Admin CMS (bestehende `venues`) |
| ER-009 | `event_artists`, `event_genres` Junctions |
| ER-010 | `organizers`, `organizer_memberships` |
| ER-011 | `profiles` (auth-username-plan) |
| ER-012+ | `ticket_products`, `orders`, `issued_tickets` |
| Phase 2 | `content`, `content_engagement`, `follows` |

---

## 7. Future Epics (Vorschlag)

| Epic | Titel | Fokus |
|------|-------|-------|
| **ER-006** | Admin Moderation & Publishing | Contributor `review` → `published`; Admin-Queue |
| ER-007 | CMS Artists + Multi-Artist Line-up | Junction + Admin UI |
| ER-008 | CMS Venues + Venue Snapshots | Admin + hidden locations |
| ER-009 | Organizer Foundation | Entity, Membership, Registration |
| ER-010 | Profiles & Public Identity | `profiles` Tabelle |
| ER-011 | Native Ticketing Phase 1 | `ticket_products`, external coexistence |
| ER-012 | Unified Content Phase 2 | Community-Grundlage |
| ER-013 | Promotion & Monetization | Sponsored placements |

---

## 8. ER-006 — Admin Moderation & Contributor Publishing

**Status:** Done (Juli 2026), inkl. Platform Hardening (`20260732000000_er006_platform_hardening.sql`)

Contributor-Flow (`draft` → `review`) und Admin-Moderation (`review` → `published` / `rejected`) sind implementiert. Platform Hardening schließt RLS-/App-Permission-Lücken (Publish nur `admin`/`owner` in DB, Contributor-Review-Schutz, CMS-Editorial-Transitions).

**Scope (abgeschlossen):**
- Admin-UI für Contributor-Events in `review` (`/admin/events/review`)
- Publish / Reject mit Audit (in-memory)
- RLS-Trigger und Repository-Validierung für Statusübergänge

**Out of Scope:** ER-006.1 CMS-Erweiterungen (Bulk, Bild-Upload); persistenter Moderation-Audit; Contributor-Benachrichtigungen.

---

## 9. Documentation Index

| Dokument | Inhalt |
|----------|--------|
| `docs/ARCHITECTURE_ROADMAP.md` | Langfristvision Phasen 1–3 |
| `app-v2/docs/PLATFORM_ARCHITECTURE_FOUNDATION.md` | Dieses Dokument (Ist vs. Ziel) |
| `app-v2/docs/ARCHITECTURE.md` | Stack & Ordnerstruktur |
| `app-v2/EVENT_DATA_ARCHITECTURE.md` | Pipeline (teilweise veraltet — siehe §4 Risks) |
| `app-v2/docs/analytics.md` | Analytics-Katalog |
| `app-v2/docs/auth-username-plan.md` | Profiles-Vorbereitung |
| `BACKLOG.md` | Operative Epics |

---

## 10. Maintenance

Bei jeder **additiven Schema-Änderung**: dieses Dokument, `PROJECT_STATE.md` und `AI_CONTEXT.md` aktualisieren. Bei strategischen Entscheidungen: `ARCHITECTURE_ROADMAP.md` prüfen.
