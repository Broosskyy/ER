# 08 — Organizer Verification (Automation-Kontext)

> Band 4.5 · Verifizierung als Automation-Vertrauensfaktor

---

## Übersicht

Verifizierte Organizer sind **P0-Event-Quellen** mit hohem Confidence Score. Dieses Kapitel beschreibt den Automation-Bezug; Details siehe [Band 4.6](../04.6-authentication-identity/05_Organizer_Verification.md).

---

## Prozess

```
Antrag (Organizer)
  ↓
Nachweise (Links, Docs, Social, Gewerbe optional)
  ↓
Prüfung (Admin / Moderator)
  ↓
Badge (verified auf Organizer + Events)
  ↓
Rechte (Create, Publish-Request, Analytics future)
  ↓
Missbrauch (Monitoring, Reports)
  ↓
Entzug (Badge + Rechte entfernen)
```

---

## Automation-Auswirkungen

| Status | Confidence Boost | Auto-Route |
|--------|------------------|------------|
| Verifiziert | +10–20 Punkte | Schnellere Review |
| Pending | Standard | Normale Queue |
| Rejected | — | Kein Organizer-Flow |
| Entzogen | — | Zurück zu Community-Level |

---

## DB (Ist)

- `organizers.verification_status`: unverified | pending | verified | rejected
- `profiles.role = organizer`
- UI: 🟡 Badge teilweise, Verification Screen 🔴

---

## Referenzen

- [Band 4.6 Organizer Verification](../04.6-authentication-identity/05_Organizer_Verification.md)
- [05-product-operations/15_Organizer_Verification_Operations.md](../05-product-operations/15_Organizer_Verification_Operations.md)
