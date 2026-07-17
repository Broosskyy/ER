# 09 — Roadmap

> Band 4.6 · Auth-Roadmap MVP → Enterprise

---

## Übersicht

Authentication wird **schrittweise** erweitert — MVP zuerst stabil, dann Social Login, dann Enterprise-Features.

---

## MVP (✅ Teilweise)

| Feature | Status |
|---------|--------|
| Email/Password Register | ✅ |
| Email/Password Login | ✅ |
| JWT + Session | ✅ |
| Gastmodus | ✅ |
| profiles + RLS | ✅ |
| roles: user, organizer, admin | ✅ |
| Password Reset | 🟡 UI/Flow prüfen |
| Email Verification | 🟡 Supabase Config |

---

## Google Login

| Aspekt | Detail |
|--------|--------|
| Priorität | P1 |
| Plattform | Android, iOS, Web |
| Aufwand | M — OAuth Setup + Deep Links |
| Abhängigkeit | Supabase Google Provider |

---

## Apple Login

| Aspekt | Detail |
|--------|--------|
| Priorität | P1 (mit Google auf iOS) |
| Pflicht | Apple App Store Guideline |
| Aufwand | M |
| Abhängigkeit | Apple Developer, Supabase |

---

## Passkeys (WebAuthn)

| Aspekt | Detail |
|--------|--------|
| Priorität | P2 |
| Nutzen | Passwordless, Phishing-resistent |
| Aufwand | L |
| Abhängigkeit | Supabase WebAuthn Support |

---

## MFA (Multi-Factor Authentication)

| Aspekt | Detail |
|--------|--------|
| Priorität | P2 |
| Methoden | TOTP, SMS (optional) |
| Zielgruppe | Admin, Organizer (optional) |
| Aufwand | M |

---

## Enterprise Login

| Aspekt | Detail |
|--------|--------|
| Priorität | P3 |
| Methoden | SAML, OIDC (Okta, Azure AD) |
| Zielgruppe | Partner, große Venues |
| Aufwand | XL |

---

## Roadmap-Timeline (Technisch)

```
MVP (Email/Password) ✅
  ↓
Google + Apple Login
  ↓
Organizer Verification UI
  ↓
Moderator Role
  ↓
Passkeys
  ↓
MFA (Admin/Organizer)
  ↓
Enterprise SSO
```

---

## Projekt-Meilensteine

Siehe [Migration Roadmap](../analysis/10_migration_roadmap.md):

```
Authentication → Organizer Verification → Event Automation → AI Automation → Monitoring
```

---

## Referenzen

- [01_Authentication_Overview.md](./01_Authentication_Overview.md)
- [04.5-event-automation/12_Roadmap.md](../04.5-event-automation/12_Roadmap.md)
- [analysis/10_migration_roadmap.md](../analysis/10_migration_roadmap.md)
