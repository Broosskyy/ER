# 03 — Import Pipeline

> Band 4.5 · Kompletter Ablauf von Quelle bis Analytics

---

## Pipeline (Zielbild)

```
Quelle
  ↓
Import (Fetch / Parse / Upload)
  ↓
Normalisierung (Schema, Felder, Zeitzonen)
  ↓
KI Analyse (Extraktion, Anreicherung)          [Phase 5+]
  ↓
Geocoding (Adresse → Lat/Lng)                [Phase 3+]
  ↓
Bilder (Flyer Download, Storage, Fallback)   [Phase 3+]
  ↓
Ticketlinks (Validierung, Affiliate)         [Phase 2+]
  ↓
Duplicate Detection
  ↓
Confidence Score
  ↓
Moderation (Admin Queue)
  ↓
Freigabe (Publish)
  ↓
Live (Public Feed)
  ↓
Push (Benachrichtigungen)                    [V1+]
  ↓
Analytics (Import-KPIs, Engagement)          [V1+]
```

---

## Phase-Implementierung

| Stufe | Pipeline-Schritte | Ist-Stand |
|-------|-------------------|-----------|
| **MVP** | Import → Normalisierung (basic) → Duplicate → Confidence → Moderation → Live | 🟡 Mock Import |
| **V2** | + Geocoding, Bilder, echtes URL-Fetch | 🔴 |
| **V3** | + RSS/ICS/API Feeds | 🔴 |
| **V5** | + KI Analyse | 🔴 |
| **V6** | + Autonomer Agent | 🔴 |

---

## Import (Ist)

| Methode | Code | Status |
|---------|------|--------|
| URL Paste | `urlImporterMock.ts` | Mock |
| Text Paste | `parseEventText.ts` | ✅ Regex |
| Source Mock | `sourceImport.ts` | Mock |
| User Submit | `add-event.tsx` | ✅ |
| Organizer | `organizer/create-event` | 🟡 |

---

## Normalisierung

- Einheitliches Event-Schema (`events` Tabelle)
- Datetime → UTC + Display Timezone
- Genres → Enum/Tags (max 3 in UI)
- Venue + City + Country
- `source_type`, `source_url`, `event_source_id`

---

## Moderation → Live

**Regel:** `lifecycle_status = published` erst nach expliziter Admin-Freigabe.  
Siehe [07_Event_Lifecycle.md](./07_Event_Lifecycle.md) und [09_Moderation_Workflow.md](./09_Moderation_Workflow.md).

---

## Fehlerbehandlung

- Import-Fehler → `import_status = failed`, Retry-Queue
- Parse-Fehler → Admin Review mit Rohdaten
- Duplicate → Warnung, kein Auto-Reject

---

## Referenzen

- [05_Event_Confidence.md](./05_Event_Confidence.md)
- [06_Duplicate_Detection.md](./06_Duplicate_Detection.md)
- [AUTOMATION_ARCHITECTURE.md](./AUTOMATION_ARCHITECTURE.md)
