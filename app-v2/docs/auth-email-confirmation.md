# Auth: E-Mail-Bestätigung & Callback — ER-005.3

**Stand:** Juli 2026 · **Scope:** Consumer Auth Callback, Deep Linking, Resend, Passwort-Reset

## End-to-End-Flow

```text
Registrierung (/register)
  → signUp mit emailRedirectTo (/auth/callback?returnTo=…)
  → RegistrationSuccessView (+ Resend)
  → Bestätigungs-E-Mail
  → Link öffnet /auth/callback?code=…
  → Session übernehmen
  → Redirect zu returnTo oder Home (/)
```

Passwort-Reset:

```text
Login → Passwort vergessen (/forgot-password)
  → resetPasswordForEmail mit redirectTo (/auth/callback?type=recovery)
  → Reset-E-Mail
  → /auth/callback?code=…&type=recovery
  → /reset-password
  → updatePassword → signOut → Login
```

## Supabase-Client

```ts
// src/services/supabase/client.ts
auth: {
  persistSession: true,
  autoRefreshToken: true,
  detectSessionInUrl: Platform.OS === 'web',
}
```

- **Web:** Supabase kann die Session beim Laden der Callback-URL aus dem `code`-Parameter übernehmen; der Callback-Screen ruft zusätzlich `exchangeCodeForSession` bzw. `getSession` auf.
- **Native:** Deep Link `eternal-rave://auth/callback?...` → `exchangeCodeForSession(code)`.

## Routen

| Route | Zweck |
|-------|--------|
| `/auth/callback` | E-Mail-Bestätigung & Recovery-Callback |
| `/forgot-password` | Reset-Link anfordern |
| `/reset-password` | Neues Passwort nach Recovery-Link |

## Redirect-URLs (im Code generiert)

- Web: `{EXPO_PUBLIC_WEB_BASE_URL}/auth/callback?...`
- Native: `eternal-rave://auth/callback?...`
- `returnTo` nur für sichere interne Pfade (`isSafeReturnRoute`)

**Remote (Supabase Dashboard, manuell):** Dieselben URLs in **Redirect URLs** erlauben, z. B.:

- `https://<web-origin>/auth/callback`
- `eternal-rave://auth/callback`

Keine Remote-Änderungen durch ER-005.3 im Repository.

## Resend

- `authService.resendConfirmationEmail(email)` → `supabase.auth.resend({ type: 'signup', email })`
- UI: `RegistrationSuccessView`, Login bei `emailNotConfirmed`
- Rate-Limit über bestehendes `auth.errors.rateLimit`

## Session Handling

- Ein `AuthProvider` mit `getSession()` beim Start + `onAuthStateChange`
- Callback-Screen nutzt `handledRef`, um Doppelverarbeitung zu vermeiden
- Kein separater paralleler Auth-State

## Bekannte Einschränkungen

- Supabase Redirect URLs müssen im Dashboard zur Umgebung passen (Staging/Prod)
- Lokaler Mock-Modus (`EXPO_PUBLIC_USE_SUPABASE=false`): kein E-Mail-Callback, sofortige Session bei Registrierung
- Universal Links (iOS) erfordern zusätzlich `EXPO_PUBLIC_IOS_ASSOCIATED_DOMAIN` und Apple-Konfiguration
