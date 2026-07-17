# 10 — Monitoring

> Band 4.5 · KPIs, Fehler, Qualität der Event Automation

---

## Übersicht

Monitoring stellt sicher, dass die Event Automation **zuverlässig, schnell und qualitativ hochwertig** läuft. Metriken decken Import, Queue, KI und Systemgesundheit ab.

---

## Kern-KPIs

| KPI | Beschreibung | Ziel (Richtwert) |
|-----|--------------|------------------|
| **Importquote** | Erfolgreiche Imports / Gesamtversuche | ≥ 95% |
| **Queue-Größe** | Events in pending_review | < 100 (MVP), SLA-basiert |
| **Fehlerrate** | Fehlgeschlagene Imports / Gesamt | < 5% |
| **Importdauer** | Zeit Quelle → Queue (p95) | < 60s (Sync), < 5min (Batch) |
| **Confidence Durchschnitt** | Mittelwert neuer Events | ≥ 70 (wachsend mit Quellen) |
| **KI-Qualität** | Korrekte Extraktion vs. manuelle Korrektur | ≥ 85% (Phase 5+) |

---

## Importquote

```
Importquote = (erfolgreiche_imports / import_versuche) × 100
```

**Segmentierung:**
- Nach Quellentyp (RSS, API, URL, Community)
- Nach Tageszeit / Cron-Lauf
- Nach Fehlerkategorie (Parse, Network, Auth, Rate Limit)

**Alert:** Importquote < 90% über 1h → Ops-Benachrichtigung

---

## Queue-Größe

| Schwelle | Aktion |
|----------|--------|
| < 50 | Normal |
| 50–100 | Moderator informieren |
| > 100 | Eskalation, Bulk-Review prüfen |
| > 500 | Incident — Kapazität erhöhen |

**Metriken:** Queue-Alter (ältestes Event), Durchsatz (Events/h freigegeben)

---

## Fehler

### Fehlerkategorien

| Kategorie | Beispiel | Handling |
|-----------|----------|----------|
| Parse | HTML unlesbar, Schema geändert | Retry + Alert |
| Network | Timeout, 5xx | Exponential Backoff |
| Auth | API-Key abgelaufen | Sofort Alert |
| Rate Limit | 429 von Quelle | Pause + Retry |
| Geocoding | Adresse nicht gefunden | needs_review |
| Duplicate | Konflikt erkannt | Duplicate Queue |

**Logging:** Strukturierte Logs mit `source_id`, `event_id`, `error_code`, `stack` (intern)

---

## Importdauer

End-to-End von Quelle bis Moderation Queue:

```
Quelle → Import → Normalisierung → KI → Geocoding → … → Queue
```

**SLA-Ziele:**

| Phase | p50 | p95 |
|-------|-----|-----|
| URL/Text Import (MVP) | 2s | 10s |
| RSS Cron | 30s | 2min |
| API Sync | 10s | 60s |
| KI Pipeline (Future) | 30s | 3min |

---

## Confidence Durchschnitt

Tracking über Zeit und Quelle:

- Sinkender Durchschnitt → Quellenqualität prüfen
- Steigender Durchschnitt → Verifizierung / bessere Quellen wirken
- Outlier (Score < 30) → Spam-Filter prüfen

**Dashboard (Ziel):** Histogramm Score-Verteilung pro Woche

---

## KI-Qualität

Ab Phase 5 (KI Import) und Phase 6 (KI Agent):

| Metrik | Messung |
|--------|---------|
| Feld-Genauigkeit | % Felder ohne Admin-Korrektur |
| False Positives | Falsch erkannte Events |
| False Negatives | Verpasste Events (manuell nachgetragen) |
| Änderungserkennung | Korrekte Updates vs. verpasste |
| Moderationsvorschläge | Admin-Akzeptanzrate |

**Feedback Loop:** Admin-Korrekturen → Training / Prompt-Tuning (Future)

---

## Alerting & Dashboards

| Alert | Trigger |
|-------|---------|
| Import Down | 0 Imports in 24h bei aktiver Quelle |
| Queue Backlog | Queue > Schwelle |
| Error Spike | Fehlerrate > 10% in 15min |
| KI Degradation | Qualität < 80% über 7 Tage |

**Tools (Ziel):** Supabase Logs, optional Datadog/Sentry — siehe [Band 4 Monitoring](../04-backend/09_Monitoring_Logging.md)

---

## Referenzen

- [03_Import_Pipeline.md](./03_Import_Pipeline.md)
- [09_Moderation_Workflow.md](./09_Moderation_Workflow.md)
- [05-product-operations/13_Automation_Operations.md](../05-product-operations/13_Automation_Operations.md)
- [04-backend/09_Monitoring_Logging.md](../04-backend/09_Monitoring_Logging.md)
