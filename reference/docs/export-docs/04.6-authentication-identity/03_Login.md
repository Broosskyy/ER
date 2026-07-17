# 03 — Login

> Band 4.6 · JWT, Refresh Token, Sessions, Remember Me

---

## Übersicht

Login stellt eine **authentifizierte Session** her. Eternal Rave nutzt Supabase Auth mit JWT Access Tokens und Refresh Tokens.

---

## Login-Flow

```
User → Email/Password oder OAuth
  ↓
Supabase Auth validates
  ↓
JWT Access Token + Refresh Token
  ↓
Session in Supabase Client (Secure Storage)
  ↓
Profile laden (profiles.role)
  ↓
App State (AuthProvider)
```

---

## JWT (Access Token)

| Eigenschaft | Wert |
|-------------|------|
| Format | JWT (HS256) |
| Lebensdauer | ~3600s (1h, konfigurierbar) |
| Payload | sub (user_id), email, role claims |
| Verwendung | Authorization Header bei API-Calls |
| Speicherung | Supabase Client (in-memory + secure) |

**RLS:** Supabase nutzt JWT `sub` für Row Level Security Policies.

---

## Refresh Token

| Eigenschaft | Wert |
|-------------|------|
| Lebensdauer | 7 Tage (konfigurierbar) |
| Verwendung | Neues Access Token ohne Re-Login |
| Rotation | Supabase optional aktivierbar |
| Speicherung | Secure Storage (Expo SecureStore) |

Bei abgelaufenem Refresh Token → erneuter Login erforderlich.

---

## Sessions

| Konzept | Beschreibung |
|---------|--------------|
| Session | Verbindung User ↔ Gerät ↔ Tokens |
| Multi-Device | Mehrere Sessions pro User möglich |
| Session ID | Von Supabase verwaltet |
| Invalidierung | Logout, Remote Logout, Password Change |

Details: [06_Session_Management.md](./06_Session_Management.md)

---

## Remember Me

| Option | Verhalten |
|--------|-----------|
| **An** | Refresh Token lange gültig, Session persistiert |
| **Aus** | Session endet bei App-Kill (kürzerer Refresh) |

**Implementierung (Ziel):** Flag in Secure Storage → Refresh-Dauer oder Session-Persistenz steuern.

**MVP:** Session persistiert standardmäßig (Supabase Default).

---

## OAuth Login (Geplant)

| Provider | Plattform | Status |
|----------|-----------|--------|
| Google | Android, iOS, Web | 🔴 |
| Apple | iOS (Pflicht bei Social) | 🔴 |

Flow: OAuth Redirect → Supabase → gleiche JWT/Session wie Email.

---

## Fehlerbehandlung

| Fehler | UX |
|--------|-----|
| Invalid credentials | „E-Mail oder Passwort falsch" |
| Email not verified | Hinweis + Resend |
| Rate limited | „Zu viele Versuche" |
| Network error | Retry + Offline-Hinweis |

---

## Code-Referenz

- `src/hooks/useAuth.tsx` — signIn, signOut, session
- `app/login.tsx` — Login UI
- Supabase: `supabase.auth.signInWithPassword()`

---

## Referenzen

- [04_Registration.md](./04_Registration.md)
- [06_Session_Management.md](./06_Session_Management.md)
- [07_Security.md](./07_Security.md)
