# 09 — Moderation Workflow

> Band 4.5 · Admin Queue, Bulk Review, Audit

---

## Übersicht

Moderation ist die **letzte menschliche Kontrolle** vor der Veröffentlichung. Alle importierten, eingereichten oder KI-generierten Events durchlaufen die Moderation Queue — unabhängig vom Confidence Score (MVP: immer Review).

**Kernregel:** Kein Auto-Publish ohne explizite Policy-Freigabe (siehe [05_Event_Confidence.md](./05_Event_Confidence.md)).

---

## Moderation Queue

### Queue-Struktur

| Feld | Beschreibung |
|------|--------------|
| Event-ID | Referenz auf `events` |
| Quelle | source_type, import_source, organizer |
| Confidence Score | 0–100%, Sortierung |
| Duplicate Warning | Flag aus Duplicate Detection |
| Eingangsdatum | FIFO mit Score-Priorität |
| Status | pending_review, needs_review, imported_draft |

### Sortierung (Empfohlen)

1. Duplicate-Warnings zuerst (manuell prüfen)
2. Niedriger Confidence Score
3. Älteste Einträge (SLA)

### Queue-Ansichten (Ziel)

- **Alle ausstehend** — Gesamtqueue
- **Nach Quelle** — Filter: Community, Import, Organizer
- **Duplicate Warnings** — Nur Konflikte
- **High Confidence** — Schnell-Freigabe-Kandidaten (Future)

**Code (Ist):** `app/admin/review/` — Submission Review, Lifecycle-Updates

---

## Bulk Approval

Massenfreigabe für Events mit hohem Vertrauen und ohne Duplicate-Warnings.

| Bedingung | Bulk erlaubt |
|-----------|--------------|
| Confidence ≥ 90 | ✅ (Future, mit Policy) |
| Verifizierter Organizer | ✅ (Future) |
| Duplicate Warning | ❌ Einzelprüfung |
| Unbekannte Quelle | ❌ Einzelprüfung |
| MVP | ❌ Kein Bulk — Einzelreview |

**Prozess (Future):**
1. Admin wählt gefilterte Events
2. System prüft Policy-Regeln
3. Bulk → `lifecycle_status = published`
4. Audit Log pro Event

---

## Bulk Reject

Massenablehnung bei Spam, Duplikaten oder offensichtlich falschen Daten.

| Grund | Aktion |
|-------|--------|
| Spam / Fake | reject + optional Ban |
| Duplicate | merge oder reject |
| Rechtsverletzung | reject + Quelle sperren |
| Unvollständig | zurück zu draft oder reject |

**Audit:** Jede Bulk-Reject-Aktion mit Grund und Admin-ID protokollieren.

---

## Kommentare

Interne Moderations-Kommentare pro Event:

- Begründung für Ablehnung (intern)
- Hinweise für Organizer (optional, future)
- Merge-Notizen bei Duplikaten
- Eskalation an Lead Admin

**Speicherort (Ziel):** `event_moderation_log` oder JSON-Feld in Audit-Tabelle

---

## Audit Log

Jede Moderations-Aktion wird protokolliert:

| Feld | Inhalt |
|------|--------|
| timestamp | UTC |
| admin_id | Wer |
| event_id | Welches Event |
| action | approve, reject, merge, edit, bulk_* |
| previous_status | Lifecycle vorher |
| new_status | Lifecycle nachher |
| reason | Optional |
| confidence_at_action | Score zum Zeitpunkt |

**Compliance:** Audit Log ist unveränderlich (append-only). Aufbewahrung gemäß DSGVO (siehe [11_Security_Legal.md](./11_Security_Legal.md)).

---

## Workflow-Diagramm

```
Import / Submission
  ↓
Queue (pending_review / needs_review)
  ↓
Admin Review (Einzel oder Bulk)
  ├─ Approve → published → Live → Push
  ├─ Reject → rejected
  ├─ Merge → duplicate resolved
  └─ Edit → zurück in Queue oder draft
  ↓
Audit Log
```

---

## Referenzen

- [07_Event_Lifecycle.md](./07_Event_Lifecycle.md)
- [05_Event_Confidence.md](./05_Event_Confidence.md)
- [06_Duplicate_Detection.md](./06_Duplicate_Detection.md)
- [05-product-operations/08_Community_Moderation.md](../05-product-operations/08_Community_Moderation.md)
- [05-product-operations/13_Automation_Operations.md](../05-product-operations/13_Automation_Operations.md)
