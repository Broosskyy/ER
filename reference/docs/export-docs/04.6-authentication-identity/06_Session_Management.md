# 06 — Session Management

> Band 4.6 · Mehrere Geräte, Logout, Remote Logout, Session Ablauf

---

## Übersicht

Session Management steuert, **wie lange** und **auf welchen Geräten** ein User angemeldet bleibt.

---

## Mehrere Geräte

| Aspekt | Verhalten |
|--------|-----------|
| Parallel Sessions | ✅ Erlaubt (Phone + Tablet) |
| Pro Gerät | Eigene Refresh Token Session |
| Sync | Server-State (Favorites, Profile) über Account |
| Konflikt | Last-write-wins bei Profile-Edits |

**Future:** Geräteliste in Settings mit „Abmelden"-Option pro Gerät.

---

## Logout

```
User → Logout
  ↓
supabase.auth.signOut()
  ↓
Local Tokens löschen (Secure Storage)
  ↓
AuthProvider → null session
  ↓
Navigation → Gast / Login
```

**Scope:**
- **Local:** Nur dieses Gerät (Default)
- **Global:** Alle Geräte (Future — `signOut({ scope: 'global' })`)

---

## Remote Logout

| Trigger | Aktion |
|---------|--------|
| User in Settings | „Alle Geräte abmelden" |
| Passwort geändert | Alle Sessions invalidieren |
| Admin sperrt Account | Force logout |
| Security Incident | Token Revocation |

**Implementierung:** Supabase Admin API `auth.admin.signOut(userId)` oder Session Revocation.

---

## Session Ablauf

| Ereignis | Ergebnis |
|----------|----------|
| Access Token expired | Auto-Refresh via Refresh Token |
| Refresh Token expired | Re-Login erforderlich |
| App im Hintergrund (lang) | Refresh beim Resume |
| Inaktivität (Future) | Optional Re-Auth nach 30 Tagen |

**UX bei Ablauf:** Sanfter Redirect zu Login, Return-URL speichern.

---

## Secure Storage

| Plattform | Speicher |
|-----------|----------|
| iOS | Keychain via Expo SecureStore |
| Android | Encrypted SharedPreferences |
| Web (Future) | httpOnly Cookie (nicht localStorage für Tokens) |

---

## Demo-Modus

Ohne Supabase Env: Keine echte Session — lokaler Demo-State in AuthProvider.

---

## Referenzen

- [03_Login.md](./03_Login.md)
- [07_Security.md](./07_Security.md)
- [08_Account_Lifecycle.md](./08_Account_Lifecycle.md)
