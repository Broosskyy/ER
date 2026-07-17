# 02 — Event Sources

> Band 4.5 · Alle möglichen Event-Quellen mit Priorität und Vertrauenslevel

---

## Übersicht

| Quelle | Priorität | Vertrauen | Status Code |
|--------|-----------|-----------|-------------|
| Verifizierte Organizer | P0 | 95–100% | 🟡 Teilweise |
| Offizielle APIs | P0 | 90–98% | 🔴 Geplant |
| Partner (Clubs, Festivals) | P1 | 85–95% | 🔴 Geplant |
| RSS Feeds | P1 | 75–90% | 🔴 Geplant |
| ICS Kalender | P1 | 75–90% | 🔴 Geplant |
| Ticketplattformen | P1 | 80–95% | 🟡 Enum vorhanden |
| Admin (manuell) | P0 | 100% | ✅ |
| Community / User | P2 | 40–70% | ✅ |
| Import-Dateien (CSV/JSON) | P2 | 60–80% | 🟡 Geplant |
| Social Media Hinweise | P3 | 30–60% | 🔴 Geplant |
| Webseiten (Scraping) | P3 | 40–75% | 🔴 Nur wenn rechtlich OK |

---

## Verifizierte Organizer

**Beschreibung:** Events von Organizern mit abgeschlossener Verifizierung (Band 4.6).  
**Priorität:** P0 · **Vertrauen:** 95–100%  
**Vorteile:** Hohe Datenqualität, direkte Verantwortung, schnellere Freigabe möglich  
**Nachteile:** Onboarding-Aufwand, Verifizierungsprozess nötig  
**Referenz:** [08_Organizer_Verification.md](./08_Organizer_Verification.md), [Band 4.6](../04.6-authentication-identity/05_Organizer_Verification.md)

---

## Community (User Submissions)

**Beschreibung:** Öffentliche Event-Einreichungen via Add Event.  
**Priorität:** P2 · **Vertrauen:** 40–70%  
**Vorteile:** Crowdsourcing, lokale Abdeckung  
**Nachteile:** Duplikate, Spam, unvollständige Daten  
**Code:** `source_type = user_submission`

---

## RSS Feeds

**Beschreibung:** Strukturierte Event-Feeds von Venues, Promotern, Aggregatoren.  
**Priorität:** P1 · **Vertrauen:** 75–90%  
**Vorteile:** Standardformat, gut automatisierbar  
**Nachteile:** Uneinheitliche Felder, verzögerte Updates

---

## ICS Kalender

**Beschreibung:** iCalendar-Dateien (.ics) von Clubs/Festivals.  
**Priorität:** P1 · **Vertrauen:** 75–90%  
**Vorteile:** Datum/Zeit/Ort oft korrekt  
**Nachteile:** Fehlende Beschreibungen, Flyer, Line-up

---

## Offizielle APIs

**Beschreibung:** Resident Advisor, Eventbrite, Shotgun, Eventim, Ticketmaster, etc.  
**Priorität:** P0 · **Vertrauen:** 90–98%  
**Vorteile:** Strukturierte Daten, hohe Qualität  
**Nachteile:** API-Kosten, Rate Limits, TOS, Keys  
**Code:** `event_sources` Enum — konfigurierbar ✅

---

## Ticketplattformen

**Beschreibung:** Event-Daten via Ticket-Partner-APIs oder strukturierte Feeds.  
**Priorität:** P1 · **Vertrauen:** 80–95%  
**Vorteile:** Ticketlinks verifiziert  
**Nachteile:** Nicht alle Events haben Tickets

---

## Partner

**Beschreibung:** Direkte B2B-Integration mit Venues, Festivals, Collectives.  
**Priorität:** P1 · **Vertrauen:** 85–95%  
**Vorteile:** Exklusive Daten, Brand-Trust  
**Nachteile:** Individuelle Verträge, Wartung

---

## Import-Dateien

**Beschreibung:** CSV, JSON, Excel-Uploads durch Admin oder Partner.  
**Priorität:** P2 · **Vertrauen:** 60–80%  
**Vorteile:** Bulk-Import, Migration  
**Nachteile:** Mapping-Aufwand, Validierung

---

## Social Media Hinweise

**Beschreibung:** Instagram/Facebook Event-Hinweise (kein vollständiges Scraping ohne Rechte).  
**Priorität:** P3 · **Vertrauen:** 30–60%  
**Vorteile:** Frühe Event-Signale  
**Nachteile:** Rechtlich heikel, unstrukturiert, hoher KI-Bedarf

---

## Webseiten (Scraping)

**Beschreibung:** Club-/Festival-Webseiten — **nur** wenn technisch und rechtlich zulässig (robots.txt, TOS, DSGVO).  
**Priorität:** P3 · **Vertrauen:** 40–75%  
**Vorteile:** Breite Abdeckung  
**Nachteile:** Fragile Parser, rechtliche Risiken  
**Regel:** Immer Source-Bewertung + Moderation

---

## Admin (Manuell)

**Beschreibung:** URL/Text Paste durch Admin, manuelle Korrektur.  
**Priorität:** P0 · **Vertrauen:** 100%  
**Vorteile:** Volle Kontrolle  
**Nachteile:** Nicht skalierbar  
**Code:** ✅ `admin/import`

---

## Quellen-Mapping Code

| Vision-Quelle | DB / Code |
|---------------|-----------|
| User | `user_submission` |
| Organizer | `organizer` |
| RA, Eventbrite, … | `event_sources.type` |
| Import | `import_sources` |

Siehe [Band 4 README](../04-backend/README.md).
