# 08 — Account Lifecycle

> Band 4.6 · Registrierung → Aktiv → Verifiziert → Gesperrt → Gelöscht → Wiederhergestellt

---

## Übersicht

Jeder Account durchläuft definierte **Lifecycle-States**. Übergänge sind auditierbar und DSGVO-konform.

---

## Lifecycle-Diagramm

```
Registrierung
  ↓
Aktiv (user)
  ↓
Verifiziert (email confirmed, optional organizer verified)
  ↓
Gesperrt (suspended — Admin/Missbrauch)
  ↓
Gelöscht (soft delete → hard delete nach Frist)
  ↓
Wiederhergestellt (innerhalb Grace Period)
```

---

## Registrierung

| State | Beschreibung |
|-------|--------------|
| Trigger | signUp erfolgreich |
| DB | `auth.users` + `profiles` |
| Default | role=user, status=active |
| Email | unverified bis Bestätigung |

---

## Aktiv

| Aspekt | Detail |
|--------|--------|
| **Rechte** | Volle User-Rechte |
| **Dauer** | Unbegrenzt bei Compliance |
| **Inaktivität** | Kein Auto-Delete im MVP |

---

## Verifiziert

| Typ | Bedeutung |
|-----|-----------|
| Email verified | `email_confirmed_at` gesetzt |
| Organizer verified | `organizers.verification_status = verified` |

Beide unabhängig — User kann email-verified sein ohne Organizer.

---

## Gesperrt

| Trigger | Aktion |
|---------|--------|
| Missbrauch | Admin suspend |
| ToS Verstoß | Temporär oder permanent |
| Legal | Auf Anfrage / Gericht |

**Effekt:**
- Login blockiert
- Sessions revoked
- Events: unpublish oder archivieren (Policy)
- `profiles.status = suspended`

---

## Gelöscht

| Phase | Beschreibung |
|-------|--------------|
| **Soft Delete** | Account deaktiviert, Daten anonymisiert |
| **Grace Period** | 30 Tage Wiederherstellung |
| **Hard Delete** | auth.users + profiles + PII entfernt |
| **Events** | Organizer-Events: archivieren oder übertragen |

**DSGVO:** Recht auf Löschung — siehe Privacy Policy.

**User-Flow:** Settings → „Account löschen" → Bestätigung → Soft Delete

---

## Wiederhergestellt

| Bedingung | Aktion |
|-----------|--------|
| Innerhalb Grace Period | User kontaktiert Support oder Self-Service |
| Admin | Restore account + sessions neu |
| Nach Hard Delete | Nicht möglich — neue Registrierung |

---

## Status-Felder (Ziel-Schema)

| Feld | Werte |
|------|-------|
| `profiles.status` | active, suspended, deleted |
| `profiles.deleted_at` | Timestamp |
| `organizers.verification_status` | unverified, pending, verified, rejected |

---

## Referenzen

- [04_Registration.md](./04_Registration.md)
- [05_Organizer_Verification.md](./05_Organizer_Verification.md)
- [07_Security.md](./07_Security.md)
- [05-product-operations/14_Identity_Operations.md](../05-product-operations/14_Identity_Operations.md)
