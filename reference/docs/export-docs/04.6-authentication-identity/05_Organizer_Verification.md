# 05 — Organizer Verification

> Band 4.6 · Antrag, Nachweise, Badge, Rechte, Missbrauch, Entzug

---

## Übersicht

Organizer Verification stellt sicher, dass **echte Veranstalter** Events unter ihrem Namen einstellen können. Verifizierte Organizer erhalten höheres Vertrauen in der Event Automation.

---

## Antrag

| Schritt | Beschreibung |
|---------|--------------|
| 1 | User registriert sich |
| 2 | Beantragt Organizer-Rolle (Formular) |
| 3 | `profiles.role` → `organizer` (pending) |
| 4 | `organizers.verification_status` → `pending` |
| 5 | Admin/Moderator prüft |

**Pflichtfelder (Ziel):**
- Organizer-Name / Label
- Website oder Social Proof
- Kontakt-E-Mail
- Optional: Gewerbenachweis, bisherige Events

---

## Nachweise

| Nachweis-Typ | Gewicht |
|--------------|---------|
| Offizielle Website mit Event-Historie | Hoch |
| Social Media (verified accounts) | Mittel |
| Ticketplattform-Profil | Hoch |
| Referenz durch verifizierten Organizer | Mittel |
| Gewerbeanmeldung | Hoch (optional je Markt) |

**Speicherung:** Links + Admin-Notizen (keine sensiblen Docs öffentlich)

---

## Prüfung

```
Antrag eingegangen
  ↓
Admin Queue (Verification)
  ↓
Nachweise prüfen (manuell)
  ↓
Entscheidung: approve | reject | more_info
  ↓
Status Update + Notification
```

**SLA (Ziel):** 5 Werktage

---

## Badge

| Element | Anzeige |
|---------|---------|
| Verified Badge | Profil, Event Cards, Detail |
| Tooltip | „Verifizierter Organizer" |
| Confidence | +10–20 Punkte in Automation |

**UI Status:** 🟡 Teilweise — siehe Sprint Roadmap

---

## Rechte (verified)

| Recht | Unverified | Verified |
|-------|------------|----------|
| Events erstellen | ✅ (Review) | ✅ (Priority Review) |
| Publish Request | ❌ | ✅ (Future) |
| Team Accounts | ❌ | 🔴 Future |
| Analytics | ❌ | 🔴 Future |
| Source eigene RSS | ❌ | 🔴 Future |

---

## Missbrauch

| Szenario | Maßnahme |
|----------|----------|
| Fake Events | Reject + Entzug |
| Spam Submissions | Rate Limit + Ban |
| Identitätsdiebstahl | Entzug + Report |
| Wiederholte Verstöße | Account sperren |

Monitoring: [Band 4.5 Moderation](../04.5-event-automation/09_Moderation_Workflow.md)

---

## Entzug

```
Missbrauch / Fake / Inaktivität
  ↓
Admin → verification_status = rejected / revoked
  ↓
Badge entfernt
  ↓
Events: Review oder Archivierung
  ↓
Optional: role → user
  ↓
Audit Log
```

**Re-Apply:** Cooldown 30 Tage (Policy)

---

## Referenzen

- [04.5-event-automation/08_Organizer_Verification.md](../04.5-event-automation/08_Organizer_Verification.md)
- [05-product-operations/15_Organizer_Verification_Operations.md](../05-product-operations/15_Organizer_Verification_Operations.md)
- [02_User_Roles.md](./02_User_Roles.md)
