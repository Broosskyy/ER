# 13 Automation Operations

> Band 5 · Betrieb der Event Automation im Tagesgeschäft

---

## Übersicht

Automation Operations beschreibt, wie das Team **Import-Pipeline, Moderation Queue und Monitoring** im produktiven Betrieb steuert.

**Technische Referenz:** [Band 4.5 Event Automation](../04.5-event-automation/README.md)

---

## Tägliche Aufgaben

| Aufgabe | Verantwortlich | Frequenz |
|---------|----------------|----------|
| Moderation Queue leeren | Admin / Moderator | Täglich |
| Import-Fehler prüfen | Admin | Täglich |
| Quellen-Health checken | Admin | Wöchentlich |
| Confidence-Outlier reviewen | Moderator | Bei Bedarf |
| Duplicate-Konflikte lösen | Admin | Bei Bedarf |

---

## Import-Betrieb

### Quellen-Management

1. Neue Quelle nur nach [Security & Legal](../04.5-event-automation/11_Security_Legal.md)-Check aktivieren
2. Source Manager: Typ, Schedule, Vertrauenslevel pflegen
3. Test-Import vor Produktiv-Schaltung
4. Deaktivieren bei wiederholten Fehlern

### Cron / Scheduled Jobs (Future)

| Job | Schedule | Alert bei Fehler |
|-----|----------|------------------|
| RSS Sync | alle 6h | Ja |
| API Sync | stündlich | Ja |
| Queue Cleanup | täglich | Nein |
| Confidence Report | wöchentlich | Nein |

---

## Moderation Operations

Siehe [09_Moderation_Workflow](../04.5-event-automation/09_Moderation_Workflow.md)

| SLA | Ziel |
|-----|------|
| Erste Review | < 24h nach Eingang |
| High-Priority (verified organizer) | < 4h |
| Duplicate Warning | < 48h |

**Eskalation:** Queue > 100 → Team-Lead informieren

---

## Monitoring & KPIs

| KPI | Schwelle | Aktion |
|-----|----------|--------|
| Importquote | < 90% | Quelle pausieren, untersuchen |
| Queue-Größe | > 100 | Kapazität erhöhen |
| Fehlerrate | > 10% | Incident |
| Confidence Ø | < 60 | Quellenqualität prüfen |

Dashboard-Referenz: [10_Monitoring](../04.5-event-automation/10_Monitoring.md)

---

## Incident Response

```
Alert → Triage (15min)
  ↓
Quelle pausieren (wenn nötig)
  ↓
Root Cause (Logs, Import Log)
  ↓
Fix / Workaround
  ↓
Post-Mortem (bei P1)
  ↓
Dokumentation aktualisieren
```

---

## Runbooks

| Szenario | Schritte |
|----------|----------|
| RSS Feed down | Quelle pausieren → manuell prüfen → Retry |
| Mass Duplicate | Bulk Review → Merge Policy anwenden |
| KI Qualität sinkt | KI Import pausieren → Prompt/Model prüfen |
| Spam-Welle | Rate Limit → Bulk Reject → Quelle sperren |

---

## Referenzen

- [04.5-event-automation/README.md](../04.5-event-automation/README.md)
- [08_Community_Moderation.md](./08_Community_Moderation.md)
- [12_Operations_Skalierung.md](./12_Operations_Skalierung.md)
- [04-backend/09_Monitoring_Logging.md](../04-backend/09_Monitoring_Logging.md)
