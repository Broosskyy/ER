# 14 Identity Operations

> Band 5 · Betrieb von Authentication, Accounts und Sessions

---

## Übersicht

Identity Operations beschreibt den **täglichen Betrieb** des Auth-Systems: Account-Support, Sicherheitsvorfälle, Session-Management und Compliance.

**Technische Referenz:** [Band 4.6 Authentication & Identity](../04.6-authentication-identity/README.md)

---

## Support-Aufgaben

| Anfrage | Aktion | SLA |
|---------|--------|-----|
| Passwort vergessen | Self-Service Link | Sofort |
| Email nicht bestätigt | Resend Verification | < 24h |
| Account gesperrt (Appeal) | Admin Review | < 48h |
| Account löschen (DSGVO) | Soft Delete Prozess | < 72h |
| Login-Probleme OAuth | Provider-Status prüfen | < 24h |

---

## Account Lifecycle Operations

Siehe [08_Account_Lifecycle](../04.6-authentication-identity/08_Account_Lifecycle.md)

| State | Ops-Aktion |
|-------|------------|
| Registrierung | Monitoring: Spam-Rate |
| Aktiv | — |
| Verifiziert | Email + Organizer getrennt tracken |
| Gesperrt | Sessions revoken, Events prüfen |
| Gelöscht | Grace Period überwachen |
| Wiederhergestellt | Audit Log Eintrag |

---

## Security Operations

| Event | Response |
|-------|----------|
| Brute Force Spike | Rate Limit prüfen, ggf. IP-Block |
| Compromised Account | Sperren → Passwort Reset → User informieren |
| Mass Registration | Captcha aktivieren, Accounts prüfen |
| Token Leak | Global Sign-Out, Keys rotieren |

Referenz: [07_Security](../04.6-authentication-identity/07_Security.md)

---

## Session Management

| Aufgabe | Tool |
|---------|------|
| User „alle Geräte abmelden" | Supabase Admin / Future Self-Service |
| Admin Session Audit | Auth Logs |
| Inaktive Sessions | Policy: Refresh Token TTL |

---

## OAuth Betrieb (Future)

| Provider | Monitoring |
|----------|------------|
| Google | OAuth Client Status, Quota |
| Apple | Certificate Expiry, Team ID |

**Vor Launch:** Redirect URLs, Deep Links, Test auf iOS + Android

---

## DSGVO / Compliance

- Auskunftsanfragen: Export `profiles` + `favorites` + Submissions
- Löschanfragen: Soft Delete → Hard Delete nach 30 Tagen
- Audit: Wer hat wann Account-Status geändert
- Keine Passwörter in Support-Tickets

---

## KPIs

| KPI | Ziel |
|-----|------|
| Login Success Rate | > 98% |
| Password Reset Completion | > 80% |
| Support Tickets Auth | < 5% aller Tickets |
- Email Verification Rate | > 70% (7 Tage) |

---

## Referenzen

- [04.6-authentication-identity/README.md](../04.6-authentication-identity/README.md)
- [07_Support_Kundenerfolg.md](./07_Support_Kundenerfolg.md)
- [04-backend/03_Authentifizierung_Autorisierung.md](../04-backend/03_Authentifizierung_Autorisierung.md)
- [15_Organizer_Verification_Operations.md](./15_Organizer_Verification_Operations.md)
