# 05 — Automation Validation (Sprint 0.5 Audit)

> **Rolle:** Senior Backend Architect · **SSOT:** Band 4.5 · Code read-only

---

## Pipeline-Validierung

### Dokumentierter Ablauf

```
Quelle → Import → Normalisierung → KI → Geocoding → Bilder → Tickets
  → Duplicate Detection → Confidence → Moderation → Freigabe → Live → Push → Analytics
```

| Stage | Doku | Code | Sinnvoll? |
|-------|------|------|-----------|
| Quelle | ✅ Kap. 02 | ✅ Source Manager | ✅ Ja |
| Import | ✅ Kap. 03 | 🟡 Mock URL/Text | ✅ MVP OK |
| Normalisierung | ✅ | 🟡 Partial | ✅ Ja |
| KI Analyse | ✅ Kap. 04 | 🔴 | ✅ Future — richtig platziert |
| Geocoding | ✅ | 🔴 | ✅ Sinnvoll vor Publish |
| Bilder | ✅ | 🟡 URLs | ✅ |
| Ticketlinks | ✅ | 🟡 | ✅ |
| Duplicate Detection | ✅ Kap. 06 | ✅ Client heuristics | 🟡 MVP OK, Scale risk |
| Confidence | ✅ Kap. 05 | 🟡 Basis score | ✅ |
| Moderation | ✅ Kap. 09 | ✅ Admin Review | ✅ **Kernstärke** |
| Freigabe → Live | ✅ | ✅ Manual publish | ✅ |
| Push | ✅ | 🔴 | ✅ Future |
| Analytics | ✅ | 🔴 | ✅ Future |

**Urteil technisch:** Pipeline-Design ist **solide und branchenüblich**.  
**Urteil organisatorisch:** Moderation-Pflicht + Confidence-Sortierung entlastet Admins sinnvoll.  
**Urteil langfristig:** Phase 1→6 Roadmap ist **realistisch**, Phase 5–6 brauchen Legal + Kosten-Review.

---

## Confidence Score — Audit

| Prüfpunkt | Ergebnis |
|-----------|----------|
| Skala 0–100% | ✅ Dokumentiert |
| Quellen-Mapping | ✅ Tabelle plausibel |
| Gewichtungsfaktoren | ✅ Summe 100% |
| MVP: kein Auto-Publish | ✅ Konsistent mit Code-Regel |
| Future Auto-Release ≥95 | 🟡 Risiko — braucht Audit Log + Rollback |
| UI: DuplicateWarningBanner | ✅ Implementiert |

### Finding QG-AUTO-01

Confidence Score wird berechnet, aber **keine zentrale Server-Policy** — rein client-side. Bei Cron/Edge Functions **muss** Score server-side berechnet werden (sonst Manipulation).

---

## Duplicate Detection — Audit

| Methode | Doku | Code |
|---------|------|------|
| Titel | ✅ | ✅ |
| Datum | ✅ | ✅ |
| Ort | ✅ | ✅ |
| GPS | ✅ | 🟡 |
| Organizer | ✅ | 🟡 |
| Ticketlink | ✅ | 🟡 |
| Line-up | ✅ | 🟡 |
| Fuzzy Matching | ✅ | ✅ |
| Bildvergleich | ✅ | 🔴 Future |

### Finding QG-AUTO-ARCH (bestätigt)

Client-only Dedup bei **parallelen Imports** (Future Cron) → Race Condition.  
**Empfehlung:** Unique partial index oder server function ab Sprint 9.

---

## AI Agent — Audit

| Capability | Doku | Realistisch? |
|------------|------|--------------|
| Neue Events erkennen | ✅ | ✅ Phase 5 |
| Änderungen erkennen | ✅ | 🟡 Schwer — braucht Diff-Strategie |
| Absagen erkennen | ✅ | ✅ Wichtig |
| Auto Ticketlinks | ✅ | 🟡 Rechtlich heikel |
| Moderationsvorschläge | ✅ | ✅ Human-in-the-loop |
| Autonomer Agent Phase 6 | ✅ | 🟡 Nur mit Policy + Kill Switch |

**Bessere Lösung:** Phase 6 nicht „autonom" sondern **„human-approved batch"** bis Error Rate <1% — dokumentieren in 4.5 Kap. 04.

---

## Organizer Verification — Audit

| Aspekt | 4.5 (Automation) | 4.6 (Identity) | Code |
|--------|------------------|----------------|------|
| Prozess | ✅ | ✅ | 🔴 |
| verification_status DB | ✅ | ✅ | ✅ |
| Confidence Boost | ✅ +10–20 | — | 🟡 |
| Badge UI | — | ✅ | 🟡 partial |
| Entzug | ✅ | ✅ | 🔴 |

**Organisatorisch sinnvoll:** Verification vor höherem Confidence — **Ja**.  
**Risiko:** Verification UI fehlt → Organizer-Flow nutzlos für Automation-Vorteil.

---

## Moderation — Audit

| Feature | Doku | Code |
|---------|------|------|
| Queue | ✅ | ✅ admin/review |
| Bulk Approval | ✅ Future | ❌ MVP korrekt disabled |
| Bulk Reject | ✅ | 🟡 einzeln |
| Kommentare | ✅ | 🔴 |
| Audit Log | ✅ | 🔴 **Kritisch** |

**Moderationsrisiko QG-MOD-01:** Kein Audit Log = **Compliance- und Trust-Problem** ab erstem echten Admin.

---

## Monitoring — Audit

| KPI | Doku | Implementierung |
|-----|------|-----------------|
| Importquote | ✅ | 🔴 |
| Queue-Größe | ✅ | 🔴 |
| Fehlerrate | ✅ | 🔴 |
| Confidence Ø | ✅ | 🔴 |
| KI Qualität | ✅ | 🔴 Future |

**Urteil:** Monitoring-Doku ist **reif**, Implementierung **null**. Band 5 Kap. 13 Ops definiert SLAs — gut für später.

---

## Roadmap Phase 1–6 — Audit

| Phase | Realistisch | Abhängigkeit | Risiko |
|-------|-------------|--------------|--------|
| 1 Manuell | ✅ Done partial | — | Niedrig |
| 2 Organizer | ✅ | Auth + Verification | Mittel |
| 3 RSS/ICS | ✅ | Cron infra | Mittel |
| 4 APIs | ✅ | Partner Legal | Hoch |
| 5 KI Import | 🟡 | Legal, Kosten | Hoch |
| 6 KI Agent | 🟡 | Phase 5 stable | Sehr hoch |

**Keine Phase übersprungen** — Roadmap ist **sequenziell sinnvoll**.

---

## Automation Score

| Dimension | Score |
|-----------|-------|
| Dokumentation 4.5 | 98% |
| Pipeline-Design | 90% |
| Code-Umsetzung | 55% |
| Organisatorische Reife | 75% |
| Langfristige Skalierbarkeit | 60% |
| Security/Compliance | 65% |
| **Gesamt Event Automation** | **58%** |

Sprint 0 FINAL: 60% — Auditor bestätigt ~58% (Code schwächer als Doku).

---

## Empfehlungen

1. Audit Log vor Bulk-Features (Sprint 8)
2. Server-side Confidence + Dedup vor Cron (Sprint 9)
3. KI Agent Phase 6: „Human-approved" statt „autonom" bis Metriken stabil
4. Moderator-Rolle implementieren oder aus MVP-Scope streichen

---

*Automation Validation — Band 4.5 als SSOT bestätigt.*
