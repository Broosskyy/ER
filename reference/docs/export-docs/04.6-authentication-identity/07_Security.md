# 07 — Security

> Band 4.6 · Rate Limiting, Missbrauchsschutz, Captcha, Device Management

---

## Übersicht

Auth-Security schützt User-Accounts und das System vor **Brute Force, Spam und Missbrauch**.

---

## Rate Limiting

| Endpoint / Aktion | Limit (Richtwert) |
|-------------------|-------------------|
| Login | 5 Versuche / 15min / IP |
| Registration | 3 / Stunde / IP |
| Password Reset | 3 / Stunde / Email |
| OAuth | Provider-Limits + Supabase |

**Umsetzung:** Supabase Auth Built-in + Edge Functions (Future) für App-spezifische Limits.

---

## Missbrauchsschutz

| Bedrohung | Maßnahme |
|-----------|----------|
| Credential Stuffing | Rate Limit + Lockout |
| Fake Accounts | Email Verification |
| Bot Registration | Captcha (optional) |
| Organizer Spam | Verification + Review |
| Session Hijacking | Secure Storage, HTTPS only |
| Admin Enumeration | Keine öffentliche Admin-Registrierung |

---

## Captcha (optional)

| Phase | Empfehlung |
|-------|------------|
| MVP | Supabase Rate Limits ausreichend |
| Growth | hCaptcha / reCAPTCHA bei Register |
| High Abuse | Captcha auch bei Login nach Fehlversuchen |

Nur auf Register/Reset — nicht bei jedem Login (UX).

---

## Device Management

| Feature | Status |
|---------|--------|
| Session pro Gerät | ✅ (Supabase) |
| Geräteliste UI | 🔴 Future |
| „Dieses Gerät abmelden" | 🔴 Future |
| „Alle abmelden" | 🔴 Future |
| Unbekanntes Gerät Alert | 🔴 Future |

**Metadaten (Ziel):** device_name, last_active, platform aus User-Agent

---

## Passwort & Token

- Passwörter: bcrypt via Supabase (never client-side hash for storage)
- JWT: kurze Access Token Lebensdauer
- Refresh Token Rotation (empfohlen aktivieren)
- Keine Tokens in Logs oder Analytics

---

## RLS & Authorization

- Auth allein reicht nicht — **RLS** auf allen Tabellen
- Client role checks sind UX-only — Server muss durchsetzen
- Admin-Routen: Server-side Guard (Future)

Siehe [04-backend/07_Sicherheit_Compliance.md](../04-backend/07_Sicherheit_Compliance.md)

---

## Incident Response

1. Account sperren (`profiles.status = suspended`)
2. Sessions revoken
3. Audit Log prüfen
4. Betroffene User informieren (DSGVO)

Ops: [05-product-operations/14_Identity_Operations.md](../05-product-operations/14_Identity_Operations.md)

---

## Referenzen

- [03_Login.md](./03_Login.md)
- [06_Session_Management.md](./06_Session_Management.md)
- [04.5-event-automation/11_Security_Legal.md](../04.5-event-automation/11_Security_Legal.md)
