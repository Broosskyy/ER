# Eternal Rave — Projektvision & Langfristige Architektur

**Stand:** 20. Juli 2026  
**Typ:** Zielarchitektur und Produktvision (kein Implementierungsplan)  
**Gültigkeit:** Langfristig; konkrete Umsetzung über `BACKLOG.md` und Einzeltickets

**Verwandte Dokumente (Ist-Stand):** `docs/PROJECT_STATE.md`, `AI_CONTEXT.md`, `BACKLOG.md`, `app-v2/docs/ARCHITECTURE.md`, `app-v2/docs/PLATFORM_ARCHITECTURE_FOUNDATION.md` (ER-005.4 Ist vs. Ziel)

---

## Projektvision

Eternal Rave entwickelt sich langfristig von einer **Event-Discovery-Plattform** zu einer **Community-Plattform für die elektronische Musikszene**.

Kurzfristig liegt der Fokus auf vertrauenswürdigen Event-Daten, Discovery und Beitrag von Community-Inhalten (Einreichung, Venues, Moderation). Langfristig ergänzen öffentliche Profile, soziale Interaktionen und kurzlebige sowie audiovisuelle Formate das Event-Kernmodell — ohne dass Events ihre zentrale Rolle verlieren.

**Leitidee:** Events bleiben der Anker; Community, Medien und soziale Graphen bauen darauf auf.

---

## Ausgangslage (Ist-Stand, Juli 2026)

Die aktive App (`app-v2/`, Version `0.2.0`) ist eine Expo/React-Native-Plattform mit Supabase-Backend, Repository-Schicht und Feature-Modulen. Bereits umgesetzt oder in Arbeit (Phase 1):

| Bereich | Status (vereinfacht) |
|---------|----------------------|
| Auth | Consumer-Login, Registrierung, E-Mail-Bestätigung, Passwort-Reset |
| Events | Pipeline, Anzeige, Detail, Collections, Contributor-Einreichung |
| Moderation | Admin-Review, Import-Review; Contributor-Publish-Workflow über Admin-Moderation (ER-006) |
| Venues | Strukturiertes Venue-Modell (Referenz + Freitext-Vorschlag) |
| Karten | Tab vorhanden, Karten-UI noch Platzhalter |
| Suche | Filter, Explore, Textsuche auf Events |
| Community (Phase 2+) | **Nicht implementiert** |
| Stories / Reels (Phase 3+) | **Nicht implementiert** |

Dieses Dokument beschreibt ausschließlich die **Zielrichtung**. Es ersetzt keine Backlog-Priorisierung und begründet keine sofortigen Schema- oder Code-Änderungen.

---

## Entwicklungsphasen

### Phase 1 — Event-Plattform (Fundament)

**Ziel:** Verlässliche Event-Discovery und kuratierbare Inhalte mit klarer Moderation und Veröffentlichung.

| Bereich | Langfristige Rolle in Phase 1 |
|---------|-------------------------------|
| **Auth** | Einheitliche Identität für Consumer und Admin; Session über Supabase Auth; Rollen über JWT/RLS |
| **Events** | Kernobjekt: Discovery, Detail, Collections, Contributor-Flow (Draft → Review → Published) |
| **Moderation** | Admin- und Review-Workflows; klare Statusmaschine; keine Auto-Publish-Pflicht |
| **Veröffentlichung** | Kontrollierter Übergang von Entwurf zu öffentlichem Event |
| **Venues** | Strukturierte Orte als Referenz für Events und spätere Profile/Karten |
| **Karten** | Räumliche Discovery (Events, Venues, ggf. Umkreis) |
| **Suche** | Volltext- und Facetten-Suche über Events; später erweiterbar auf Community-Inhalte |

**Phase-1-Architekturprinzip:** Bestehendes Repository-Pattern, Feature-Module und RLS beibehalten. Keine parallelen Datenpfade für Events.

---

### Phase 2 — Community & soziale Interaktion

**Ziel:** Nutzer und Orte werden sichtbar; Inhalte jenseits statischer Event-Listings entstehen.

| Fähigkeit | Beschreibung |
|-----------|--------------|
| **Öffentliche Profile** | Identität über reine Auth hinaus (Anzeigename, Bio, Szene-Bezug) |
| **Profilseiten** | Öffentliche Darstellung von Personen, Venues, Artists, Organizern |
| **Community-Beiträge** | Text- und Medienbeiträge im Szene-Kontext |
| **Bilder** | Bild-Uploads als Teil des einheitlichen Content-Modells |
| **Likes** | Einheitliche Reaktion auf berechtigte Content-Typen |
| **Kommentare & Antworten** | Threaded Discussion an Content gebunden |
| **Teilen** | Deep Links und In-App-Weitergabe |
| **Folgen** | Sozialer Graph (Nutzer ↔ Nutzer, Nutzer ↔ Venue/Artist/Event) |
| **Activity Feed** | Personalisierter Strom aus Events, Follows, Interaktionen |

**Abhängigkeit:** Phase 2 setzt stabiles Auth, Event-Modell und Moderationsgrundlagen aus Phase 1 voraus.

---

### Phase 3 — Medien, Stories & Creator

**Ziel:** Kurzlebige und bewegte Inhalte ergänzen den Feed; Creator werden zur eigenen Entität.

| Fähigkeit | Beschreibung |
|-----------|--------------|
| **Stories** | Zeitlich begrenzte, leicht konsumierbare Inhalte |
| **Kurzvideos / Reels** | Vertikaler, schneller Medienkonsum |
| **Event-Clips** | Event-nahe Highlights (Aftermovie, Floor-Momente, Ankündigungen) |
| **Creator-Profile** | Erweiterte Profile für regelmäßig Produzierende |
| **Swipe-Feed** | Vollbild-, gestenbasierter Konsum (insb. mobil) |
| **Medien-Moderation** | Erweiterte Prüfprozesse für UGC und Video |

**Abhängigkeit:** Phase 3 setzt einheitliche Content-, Engagement- und Notification-Schicht aus Phase 2 voraus.

---

## Architekturprinzipien (langfristig)

### 1. Einheitliches Content-Modell

Alle zukünftigen Community-Inhalte sollen auf einer **gemeinsamen, erweiterbaren Content-Architektur** aufbauen.

**Keine voneinander getrennten Systeme** für:

- Beiträge (Posts)
- Bilder
- Stories
- Reels / Kurzvideos
- längere Videos / Event-Clips

Stattdessen: ein **polymorphes Content-Fundament** mit Typ-spezifischen Erweiterungen (Metadaten, Darstellung, TTL bei Stories), gemeinsamer Identität (`author_id`), Sichtbarkeit, Status (Entwurf, eingereicht, veröffentlicht, archiviert, abgelehnt) und Verknüpfung zu Events, Venues oder Profilen.

### 2. Gemeinsame Engagement-Schicht

**Likes, Kommentare, Antworten und Teilen** werden nicht pro Content-Typ neu erfunden, sondern an ein gemeinsames Engagement-Modell gebunden (Ziel-Referenz: Content-ID + Typ).

Vorteile: einheitliche UI-Patterns, eine Moderationsqueue, konsistente Benachrichtigungen, weniger Duplikation in RLS und APIs.

### 3. Gemeinsame Benachrichtigungs- und Activity-Schicht

Das heutige lokale Activity-/Notification-Center ist ein **Prototyp** für Phase 2. Langfristig:

- Ereignisse (Like, Kommentar, Follow, Event-Update, Moderation) als **Notification Events**
- Zustellung: In-App zuerst; Push optional später
- Activity Feed als Projektion über Notification-/Event-Stream (nicht als separates Paralleluniversum)

### 4. Gemeinsame Moderation

Moderation ist **querschnittlich**:

| Stufe | Geltungsbereich |
|-------|-----------------|
| **Automatisch** | Spam-Heuristiken, Medien-Scanning (später), Rate Limits |
| **Community-Reports** | Nutzer-Meldungen an beliebige Content-Typen |
| **Admin/Reviewer** | Bestehende Admin-Shell erweitern, nicht ersetzen |
| **Medien-Moderation (Phase 3)** | Video-/Bild-Queues, ggf. Hold-before-publish für neue Creator |

Events behalten den etablierten Review-Workflow; Community-Content übernimmt analoge Status, ohne Events zu überfrachten.

### 5. Bestehende Architektur respektieren

- UI → Features → Repositories → Datasources (kein direkter Supabase-Zugriff aus Screens)
- RLS als autoritative Zugriffskontrolle
- Additive Migrationen; keine Big-Bang-Rewrites
- `reference/` dient nur als historische Quelle, nicht als Import-Quelle für `app-v2/`

---

## Zukünftige Medientypen (Zielkatalog)

Alle Typen sollen im **einheitlichen Content-Modell** abbildbar sein:

| Typ | Phase | Merkmale |
|-----|-------|----------|
| Text-Post | 2 | Rich Text light, Event-/Venue-Bezug |
| Bild-Post | 2 | Einzel- und Galerie; Storage-Objekt + Metadaten |
| Story | 3 | TTL, Vollbild, ephemeral |
| Reel / Kurzvideo | 3 | Vertikal, Dauerlimit, Thumbnail, Transcoding |
| Event-Clip | 3 | Event-Verknüpfung, ggf. Highlight-Markierung |
| Link-Share | 2 | Open-Graph-Vorschau, externe URLs mit Policy |
| Event-Repost | 2 | Event als shareable Entity im Feed |

**Nicht-Ziel:** Getrennte Datenbanken oder Microservices pro Medientyp im MVP der Community-Phase.

---

## Langfristige Moderation

```
Einreichung → (optional Auto-Check) → Review-Queue → veröffentlicht / abgelehnt
                     ↓
              Nutzer-Report → Eskalation → Admin-Aktion
```

- **Einheitliche Moderationsoberfläche** im Admin-Web (Erweiterung von `/admin`, nicht parallele Tools)
- **Audit-Log** für Admin-Aktionen (Import-Audit existiert bereits als Vorbild)
- **Stufenmodell:** vertrauenswürdige Contributor mit reduziertem Review-Aufwand (später, policy-basiert)
- **Medien:** Pre-Moderation für neue Accounts; Post-Moderation + Report für etablierte Nutzer (Phase 3)

---

## Datenschutz (Privacy by Design)

| Thema | Langfristige Richtung |
|-------|----------------------|
| **Standort** | Nur nach Opt-in; keine Hintergrundortung; klare Trennung Header-Anzeige vs. Discovery (bereits im Code angelegt) |
| **Profile** | Granulare Sichtbarkeit (öffentlich / Follower / privat) — Phase 2 |
| **UGC** | Lösch- und Export-Rechte; klare Retention für Stories (automatisches Verfallen) |
| **Analytics** | Consent-basiert (PWA/Analytics-Grundlage vorhanden); keine Koordinaten in Analytics |
| **Minimierung** | Nur speichern, was für Feature und Moderation nötig ist |
| **RLS** | Jede neue Tabelle mit Row Level Security von Anfang an |

DSGVO- und Store-Anforderungen werden in `app-v2/docs/security-privacy.md` und Go-Live-Checklisten konkretisiert; dieses Dokument definiert nur die **architektonische Richtung**.

---

## Skalierung

| Ebene | Strategie |
|-------|-----------|
| **Datenbank** | PostgreSQL (Supabase); normalisierte Kern-Tabellen; Indizes für Feed und Suche; später Read-Replicas / Connection Pooling über Supabase |
| **Medien** | Object Storage (Supabase Storage → ggf. CDN); keine Binärdaten in PostgreSQL |
| **Feed** | Zuerst pull-basiert (paginierte Queries); bei Bedarf Fan-out-on-read oder kuratierte Materialized Views — **erst bei nachgewiesenem Bedarf** |
| **Video** | Asynchrone Verarbeitung (siehe Videoverarbeitung); keine blockierenden Uploads in der App |
| **API** | Repository-Grenzen beibehalten; später Edge Functions oder Worker nur für klar abgegrenzte Jobs (Transcoding, Notifications) |
| **Clients** | Mobile First; Web/PWA als gleichwertiger Consumer; statischer Export für Web bleibt kompatibel mit Zielarchitektur |

Horizontale Skalierung der App-Schicht ist durch stateless Clients und zentrale Auth/DB gegeben; Engpässe werden zuerst bei Medien und Feed erwartet, nicht bei Event-CRUD.

---

## Storage (langfristig)

| Bucket / Bereich | Inhalt | Zugriff |
|------------------|--------|---------|
| `events` | Flyer, Event-Bilder (bestehend) | Öffentlich lesbar, eingeschränkt schreibbar |
| `avatars` | Profilbilder (Phase 2) | Öffentlich / authentifiziert je Policy |
| `content` | Community-Medien (Phase 2+) | RLS + signierte URLs wo nötig |
| `video` | Roh- und transcodierte Videos (Phase 3) | Privat bis veröffentlicht; CDN-Auslieferung |

**Prinzipien:**

- Einheitliche Namenskonvention und Pfadstruktur (`{owner_id}/{content_id}/…`)
- Bildvarianten (Thumbnail, Display) — serverseitig oder Worker
- Keine unbegrenzte Speicherung von Stories nach TTL (Lifecycle-Regeln)
- Contributor-Uploads (Events) als Referenzimplementierung für spätere UGC-Uploads

---

## Performance

| Bereich | Maßnahmen (Zielrichtung) |
|---------|--------------------------|
| **Listen & Feeds** | Cursor-Pagination, skelettierte UI, Bild-Placeholder |
| **Bilder** | Progressive Loading, feste Aspect Ratios, CDN-Caching |
| **Karten** | Clustering, Bounding-Box-Queries, kein Laden aller Events global |
| **Suche** | PostgreSQL Full-Text → bei Bedarf dedizierter Index (z. B. Typesense/Meilisearch) — Entscheidung datengetrieben |
| **Video** | Adaptive Bitrate nach Transcoding; Prefetch nur im Swipe-Feed kontrolliert |
| **Offline** | Lesecaches für gespeicherte Events/Favoriten (bereits lokal); kein Offline-Upload-Zwang in Phase 2 |

Mobile Netzwerke und Akku haben Vorrang vor Feature-Reichtum bei Medien.

---

## Videoverarbeitung (Phase 3)

Vorgesehen als **asynchroner Pipeline**, nicht im Request-Pfad der App:

```
Upload (signierte URL) → Queue/Job → Transcode (mehrere Auflösungen)
    → Thumbnail/Poster → Moderation (optional Hold) → Veröffentlichung → CDN
```

- **Formate:** Kurzvideo (Reels) mit Dauer- und Größenlimits; Event-Clips können länger sein
- **Worker:** Supabase Edge Functions, externer Worker oder dedizierter Service — **Entscheidung offen**, abhängig von Volumen und Kosten
- **Fehler:** Retry, Nutzer-Feedback „Verarbeitung läuft“, kein stilles Scheitern
- **Keine Implementierung** in Phase 1/2; nur Architekturplatz reservieren im Content-Modell (`processing_status`)

---

## Suchfunktionen (langfristig)

| Phase | Suchumfang |
|-------|------------|
| **1** | Events (Titel, Venue, Stadt, Genre, Datum) — **weitgehend vorhanden** |
| **1+** | Standortbasierte Suche / Umkreis (Anbindung an Nutzerstandort vorbereitet, noch nicht gekoppelt) |
| **2** | Profile, Venues, Artists, Hashtags, Community-Posts |
| **2+** | Unified Search: eine Suchoberfläche, mehrere Entitäts-Typen, gewichtete Ergebnisse |
| **3** | Video-/Story-Metadaten, Creator |

**Prinzip:** Eine Such-API-Schicht im Repository-Bereich; Entitäts-spezifische Indizes dahinter; keine Suchlogik in UI-Komponenten.

---

## Benachrichtigungssystem (langfristig)

| Stufe | Beschreibung |
|-------|--------------|
| **Heute** | Lokales Notification Center, generiert aus Event-/App-Zustand; kein Push |
| **Phase 2** | Persistente Notification-Tabelle; Typen: social, event, moderation, system |
| **Phase 2+** | Push (FCM/APNs/Web Push) mit Opt-in und Granularität |
| **Phase 3** | Medien-bezogene Alerts (Verarbeitung fertig, Moderation-Ergebnis) |

**Einheitliches Event-Schema (konzeptionell):**

- `recipient_id`, `actor_id`, `target_type`, `target_id`, `kind`, `read_at`, `created_at`
- Activity Feed = gefilterte, gruppierte Ansicht auf dieselben Ereignisse

Kein separates „Social Notifications“- und „Event Notifications“-System.

---

## Was dieses Dokument ausdrücklich nicht ist

- Kein Sprint-Backlog und keine Ticket-Liste (siehe `BACKLOG.md`)
- Keine SQL-Migrationen, Tabellendefinitionen oder API-Spezifikationen
- Keine Verpflichtung zu externen Diensten (Video-Worker, Suchmaschine, Push-Provider)
- Keine Änderung am laufenden Code oder an der aktuellen Release-Planung

---

## Abgrenzung: Nicht Teil der Vision-Umsetzung (Stand Juli 2026)

Folgendes ist **nicht implementiert** und wird durch dieses Dokument **nicht aktiviert**:

- Öffentliche Profile und Profilseiten
- Community-Posts, Likes, Kommentare, Antworten, Teilen, Follow-Graph
- Persistenter Social Activity Feed (über lokales Notification Center hinaus)
- Stories, Reels, Kurzvideos, Swipe-Feed
- Creator-Profile und Medien-Moderation für Video
- Einheitliches Content-Datenmodell in der Datenbank
- Push-Benachrichtigungen
- Video-Transcoding-Pipeline
- Dedizierte Suchmaschine außerhalb PostgreSQL
- Separate Microservices für Social vs. Events

---

## Pflege

Dieses Dokument wird bei **strategischen Architekturentscheidungen** aktualisiert (neue Phase, neues Querschnittsmodell). Operative Änderungen gehören in `PROJECT_STATE.md` und `BACKLOG.md`.

**Verantwortliche Quelle für Produktvision (ausführlich):** `docs/master/Master_Handbook.md`  
**Verantwortliche Quelle für technischen Ist-Stand:** `app-v2/docs/ARCHITECTURE.md`, `AI_CONTEXT.md`
