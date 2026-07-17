# 01 — Automation Overview

> Band 4.5 Event Automation Bible

---

## Vision

Eternal Rave soll die **weltweit vertrauenswürdigste Quelle** für Electronic-Music-Events werden — mit minimal manuellem Aufwand und maximaler Datenqualität. Event Automation ist das technische und organisatorische Rückgrat für Skalierung über manuelle Admin-Arbeit hinaus.

---

## Mission

Events aus allen relevanten Quellen **automatisch erfassen**, **normalisieren**, **bewerten** und **sicher veröffentlichen** — unter Einhaltung von Qualitäts-, Rechts- und Vertrauensstandards.

**Kernregel (unverhandelbar):** Niemals blind auto-publish. Jeder Import durchläuft Confidence + Moderation, bis Freigabeschwellen explizit definiert und freigegeben sind.

---

## Ziele

| Ziel | Beschreibung |
|------|--------------|
| Vollständigkeit | Keine relevanten Events in Kernmärkten verpassen |
| Qualität | Korrekte Titel, Datum, Ort, Flyer, Ticketlinks |
| Geschwindigkeit | Neue Events innerhalb definierter SLAs in Moderation |
| Vertrauen | Quellen- und Organizer-Verifizierung transparent |
| Skalierbarkeit | 100k+ Events ohne linearen Admin-Aufwand |
| Compliance | DSGVO, Urheberrecht, robots.txt / API-TOS |

---

## MVP (Phase 1–2 — dokumentiert, teilweise implementiert)

- Manuelle Admin-Imports (URL/Text Paste)
- Source Manager (konfigurierbare Quellen)
- User & Organizer Submissions → Moderation Queue
- Duplicate Detection (Heuristik)
- Confidence Score (Basis)
- Lifecycle: nur `published` im Public Feed
- **Kein** autonomer KI-Agent · **Kein** Auto-Publish

**Code-Referenz:** Sprint 2.x — `admin/import`, `duplicateDetection.ts`, `event_sources`

---

## Langfristige Vision (Phase 3–6)

```
Multi-Source Ingestion
  → KI-Extraktion & Anreicherung
  → Confidence-basierte Routing (Auto vs. Review)
  → Autonomer KI-Agent (Änderungen, Absagen, Updates)
  → Push + Analytics Feedback Loop
```

Siehe [12_Roadmap.md](./12_Roadmap.md) und [04_AI_Agent.md](./04_AI_Agent.md).

---

## Bezug zu anderen Bänden

| Band | Thema |
|------|-------|
| Band 1 | Product Vision — V2 Auto Discovery |
| Band 4 | Supabase Backend, RLS, Services |
| Band 4.6 | Auth, Rollen, Organizer Verification |
| Band 5 | Automation Operations |

---

## Referenzen

- [AUTOMATION_ARCHITECTURE.md](./AUTOMATION_ARCHITECTURE.md)
- [03_Import_Pipeline.md](./03_Import_Pipeline.md)
- [MASTER-PROMPT-v3.0.md](../01-product-vision/MASTER-PROMPT-v3.0.md)
