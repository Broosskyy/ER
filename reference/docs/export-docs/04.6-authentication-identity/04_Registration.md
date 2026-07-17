# 04 — Registration

> Band 4.6 · Gastmodus, E-Mail, OAuth, Passwort Reset, E-Mail Verifizierung

---

## Übersicht

Registrierung erstellt einen **User-Account** mit Default-Rolle `user`. Organizer und Admin werden nicht über öffentliche Registrierung vergeben.

---

## Gastmodus

| Aspekt | Detail |
|--------|--------|
| **Zweck** | MVP-Kernfrage ohne Reibung beantworten |
| **Rechte** | Feed, Map, Event Details |
| **CTA** | „Anmelden" für Favorites & Submissions |
| **Persistenz** | Keine Server-Session |

Gast → Registrierung jederzeit möglich; lokale Daten (Favorites Demo) ggf. merge.

---

## E-Mail Registrierung

```
User → Email + Password (+ Display Name)
  ↓
Supabase Auth signUp
  ↓
profiles INSERT (Trigger oder Client)
  ↓
E-Mail Verifizierung (optional konfigurierbar)
  ↓
Login → User-Rolle
```

**Passwort-Anforderungen (Empfohlen):**
- Min. 8 Zeichen
- Kein Common-Password-Check (Supabase / HaveIBeenPwned future)

**Code:** `app/register.tsx`, `useAuth.signUp()`

---

## Google Login

| Aspekt | Detail |
|--------|--------|
| **Status** | 🔴 Geplant |
| **Flow** | OAuth 2.0 → Supabase Auth |
| **Profil** | Email + Name aus Google |
| **Merge** | Gleiche Email → Account verknüpfen |

**Voraussetzung:** Google Cloud Console OAuth Client, Supabase Provider konfiguriert.

---

## Apple Login

| Aspekt | Detail |
|--------|--------|
| **Status** | 🔴 Geplant |
| **Pflicht** | Wenn Google auf iOS angeboten wird |
| **Flow** | Sign in with Apple → Supabase |
| **Hide Email** | Apple Relay — Supabase unterstützt |

---

## Passwort Reset

```
User → „Passwort vergessen"
  ↓
Email eingeben
  ↓
Supabase resetPasswordForEmail
  ↓
Link in E-Mail → Deep Link App
  ↓
Neues Passwort setzen
  ↓
Alle Sessions invalidieren (optional)
```

**Deep Link:** `eternalrave://reset-password` (Expo Linking)

---

## E-Mail Verifizierung

| Modus | Verhalten |
|-------|-----------|
| **Strict** | Login blockiert bis verified |
| **Soft (MVP)** | Login erlaubt, Banner „Bitte bestätigen" |

Supabase: `auth.users.email_confirmed_at`

**Resend:** Button in App + Rate Limit

---

## Nach Registrierung

1. Profil anlegen (`profiles`)
2. Default role: `user`
3. Optional: Onboarding (Future)
4. Organizer-Antrag separat — [05_Organizer_Verification.md](./05_Organizer_Verification.md)

---

## Referenzen

- [03_Login.md](./03_Login.md)
- [08_Account_Lifecycle.md](./08_Account_Lifecycle.md)
- [07_Security.md](./07_Security.md)
