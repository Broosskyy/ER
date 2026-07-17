# 05 — Event Confidence Score

> Band 4.5 · Bewertungssystem 0–100%

---

## Prinzip

Jeder importierte oder eingereichte Event-Datensatz erhält einen **Confidence Score** (0–100%). Der Score bestimmt Routing: Auto-Queue vs. Pflicht-Review vs. Auto-Reject (nur bei sehr niedrig + Spam).

**MVP-Regel:** Kein Auto-Publish — Score dient Admin-UI und Sortierung.

---

## Score nach Quelle (Beispiele)

| Quelle | Typischer Score | Auto-Freigabe (Future) |
|--------|-----------------|------------------------|
| Verifizierter Organizer | 90–100 | Möglich bei ≥95 + Policy |
| Offizielle API | 85–98 | Möglich bei ≥90 + Partner |
| RSS / ICS | 70–88 | Immer Review (MVP) |
| Partner Feed | 80–95 | Review bis Policy |
| KI Import (Web/Social) | 40–75 | Immer Review |
| Community | 35–65 | Immer Review |
| Unbekannte Quelle | 0–40 | Review + ggf. Reject |

---

## Score-Faktoren (Gewichtung — Ziel)

| Faktor | Gewicht |
|--------|---------|
| Quellen-Vertrauen | 30% |
| Vollständigkeit Felder | 20% |
| Duplicate-Check | 20% |
| Geocoding Match | 10% |
| Bild/Ticket valid | 10% |
| Organizer verified | 10% |

**Code (Ist):** `duplicateDetection.ts` — confidence_score auf Events, Import Preview UI

---

## Freigabe-Regeln

### Automatische Freigabe (nur Future, explizit freischalten)

- Score ≥ **95** UND verifizierter Organizer ODER offizielle Partner-API
- Kein Duplicate-Warning
- Pflichtfelder vollständig
- Audit-Log Eintrag

### Zwingend Admin-Prüfung (MVP — immer)

- Alle Community-Imports
- Score < 85
- Duplicate-Warning ≥ 50%
- Unbekannte Quelle
- Erste Events einer neuen Source

### Auto-Reject (nur Spam/Offensichtlich)

- Score < 20 + Spam-Signale
- Duplikat ≥ 95% + bereits live

---

## UI

- `DuplicateWarningBanner` — Confidence %
- `ImportPreviewCard` — Confidence Farben (grün/gelb/rot)
- Admin Review Sortierung nach Score

---

## Referenzen

- [06_Duplicate_Detection.md](./06_Duplicate_Detection.md)
- [09_Moderation_Workflow.md](./09_Moderation_Workflow.md)
