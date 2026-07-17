# 15 Organizer Verification Operations

> Band 5 · Betrieb des Organizer-Verifizierungsprozesses

---

## Übersicht

Organizer Verification Operations steuert den **Antrags-, Prüfungs- und Entzugsprozess** für Veranstalter.

**Technische Referenz:**
- [Band 4.6 Kap. 05](../04.6-authentication-identity/05_Organizer_Verification.md)
- [Band 4.5 Kap. 08](../04.5-event-automation/08_Organizer_Verification.md)

---

## Prozess-Übersicht

```
Antrag eingegangen
  ↓
Automatische Vorprüfung (Pflichtfelder)
  ↓
Admin Queue
  ↓
Nachweise prüfen
  ↓
Approve | Reject | More Info
  ↓
Badge + Rechte | Entzug bei Missbrauch
  ↓
Audit Log + User Notification
```

---

## Antrags-Queue

| Feld | Pflicht |
|------|---------|
| Organizer Name | ✅ |
| Website / Social | ✅ min. 1 |
| Kontakt Email | ✅ |
| Bisherige Events (Links) | Empfohlen |
| Gewerbenachweis | Optional (Marktabhängig) |

**SLA:** Entscheidung innerhalb **5 Werktagen**

---

## Prüfkriterien

| Kriterium | Gewicht |
|-----------|---------|
| Nachweisbare Event-Historie | Hoch |
| Konsistente Online-Präsenz | Hoch |
| Keine Spam-/Fake-Signale | Hoch |
| Referenz durch verified Organizer | Mittel |
| Gewerbeanmeldung | Optional Hoch |

**Checkliste Admin:**
- [ ] Name stimmt mit öffentlichen Events überein
- [ ] Links erreichbar und relevant
- [ ] Kein Duplicate-Antrag
- [ ] Kein bekannter Missbrauch

---

## Approve

1. `organizers.verification_status` → `verified`
2. Badge in UI aktivieren (wenn implementiert)
3. Confidence Boost in Automation (+10–20)
4. Willkommens-Email / In-App Notification
5. Audit Log

---

## Reject

| Grund | User-Kommunikation |
|-------|-------------------|
| Unzureichende Nachweise | „Bitte mehr Belege nachreichen" |
| Fake / Identitätsdiebstahl | Generisch, kein Detail |
| Duplicate | Verweis auf bestehenden Account |
| Markt nicht abgedeckt | Policy-Hinweis |

**Re-Apply:** Cooldown 30 Tage

---

## Entzug (Revocation)

| Trigger | Aktion |
|---------|--------|
| Fake Events | Sofort Entzug |
| ToS Verstoß | Review → Entzug |
| Inaktivität > 12 Monate | Optional Review |
| User Request | Downgrade zu User |

**Nach Entzug:**
- Badge entfernen
- Offene Events → Review Queue
- `verification_status` → `rejected` / `revoked`
- Audit Log

---

## Missbrauch & Eskalation

| Stufe | Maßnahme |
|-------|----------|
| 1 | Warnung + Event Review |
| 2 | Verification Entzug |
| 3 | Account Suspend |
| 4 | Permanent Ban + Legal |

Verknüpfung: [08_Community_Moderation.md](./08_Community_Moderation.md)

---

## KPIs

| KPI | Ziel |
|-----|------|
| Anträge / Woche | Tracking |
| Durchschnittliche Bearbeitungszeit | < 5 Werktage |
| Approve Rate | Benchmark (nicht zu hoch — Qualität) |
| Entzüge / Monat | Tracking + Root Cause |
| Verified Organizer Events / Total | Steigend |

---

## Referenzen

- [04.6-authentication-identity/05_Organizer_Verification.md](../04.6-authentication-identity/05_Organizer_Verification.md)
- [04.5-event-automation/08_Organizer_Verification.md](../04.5-event-automation/08_Organizer_Verification.md)
- [13_Automation_Operations.md](./13_Automation_Operations.md)
- [14_Identity_Operations.md](./14_Identity_Operations.md)
