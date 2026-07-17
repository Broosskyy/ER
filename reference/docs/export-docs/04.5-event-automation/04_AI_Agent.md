# 04 — AI Agent

> Band 4.5 · Zukünftiger autonomer KI-Agent (Phase 6 — **nicht implementiert**)

---

## Vision

Ein **Event Intelligence Agent** überwacht alle konfigurierten Quellen kontinuierlich, erkennt Änderungen, reichert Metadaten an und erstellt Moderationsvorschläge — ohne Events blind zu veröffentlichen.

---

## Fähigkeiten (Ziel)

| Fähigkeit | Beschreibung |
|-----------|--------------|
| Neue Events erkennen | Signale aus RSS, APIs, Web, Social |
| Eventänderungen erkennen | Diff gegen bestehende DB-Events |
| Line-up Änderungen | Artist Add/Remove |
| Zeitänderungen | Start/End, Doors |
| Venue Änderungen | Location, Adresse |
| Ticketlinks aktualisieren | URL-Validierung, Redirects |
| Bilder ergänzen | Flyer fetch, OCR optional |
| Geokoordinaten ergänzen | Geocoding API |
| Abgesagte Events erkennen | Status → cancelled/archived |
| Dubletten erkennen | Erweitertes Matching + Embeddings |
| Confidence Score berechnen | Pro Feld + Gesamt |
| Moderationsvorschläge | Approve / Review / Reject mit Begründung |

---

## Architektur (Konzept)

```
Scheduler (Cron / Edge Function)
  → Source Fetchers
  → Normalizer
  → AI Extraction Layer (LLM + Rules)
  → Confidence Engine
  → Duplicate Engine
  → Moderation Queue (Human-in-the-Loop)
  → Optional: Auto-approve wenn Score ≥ Schwellwert + verifizierte Quelle
```

---

## Human-in-the-Loop (Pflicht)

Der Agent **schlägt vor**, Admin **entscheidet** — bis explizite Freigabeschwellen in [05_Event_Confidence.md](./05_Event_Confidence.md) definiert und genehmigt sind.

---

## Abhängigkeiten

- Band 4.5 Import Pipeline vollständig
- Band 4.6 Organizer Verification
- Monitoring ([10_Monitoring.md](./10_Monitoring.md))
- Legal Review ([11_Security_Legal.md](./11_Security_Legal.md))

---

## Roadmap

Phase 6 in [12_Roadmap.md](./12_Roadmap.md)
