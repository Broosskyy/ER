# 06 — Duplicate Detection

> Band 4.5 · Erkennung doppelter Events

---

## Ziel

Doppelte Events vor Veröffentlichung erkennen — über exakte und fuzzy Signale.

---

## Matching-Signale

| Signal | Methode | Gewicht |
|--------|---------|---------|
| Titel | Normalized string, Levenshtein | Hoch |
| Datum | Same day ± tolerance | Hoch |
| Ort / Stadt | String match | Mittel |
| GPS | Haversine < 500m | Hoch |
| Organizer | ID / Name match | Mittel |
| Ticketlink | URL normalize | Hoch |
| Line-up | Artist set overlap | Mittel |
| Fuzzy Matching | Combined score | — |
| Bildvergleich | Perceptual hash (Future) | Mittel |

---

## Ist-Implementierung

**Code:** `src/utils/duplicateDetection.ts` (~400 LOC)

- `detectPossibleDuplicate()` — scoring engine
- Signale: title, date, city, venue, url, organizer
- Output: `confidence_score`, `duplicate_of_event_id`, `duplicate_warning`
- Admin: Mark Duplicate, Publish Anyway, Merge (placeholder)

**DB:** Migration 004 — duplicate_warning columns on `events`

---

## Schwellwerte

| Score | Aktion |
|-------|--------|
| ≥ 85% | Starker Duplicate — Review Pflicht |
| 50–84% | Warnung — Admin entscheidet |
| < 50% | Kein Block |

---

## Workflow

1. Submit/Import → Duplicate Check gegen published + pending
2. Warning in UI (`DuplicateWarningBanner`)
3. Admin: Publish Anyway / Mark Duplicate / Merge (future)
4. `duplicate_of_event_id` persistiert

---

## Future

- Embedding-basierte Titel-Ähnlichkeit
- Bildvergleich (Flyer pHash)
- Auto-Scan bei Cron-Imports vor Queue

---

## Referenzen

- [05_Event_Confidence.md](./05_Event_Confidence.md)
- Band 4 Backend — Migration 004
