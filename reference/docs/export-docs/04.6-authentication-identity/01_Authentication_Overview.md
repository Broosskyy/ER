# 01 — Authentication Overview

> Band 4.6 · Supabase Auth als zentrale Identitätsplattform

---

## Vision

Eternal Rave benötigt ein **sicheres, skalierbares und benutzerfreundliches** Authentifizierungssystem. Nutzer sollen Events entdecken können — mit oder ohne Account — und Organizer sowie Admins erhalten rollenbasierte Rechte.

---

## Architektur-Prinzip

**Supabase Auth** ist die zentrale Identitätsplattform:

```
App (Expo) → Supabase Auth → JWT + Refresh Token
                ↓
           profiles (RLS) → role, metadata
                ↓
           organizers (optional) → verification_status
```

**Vorteile:**
- Managed Auth (Email, OAuth, Magic Link)
- JWT out-of-the-box
- Row Level Security (RLS) auf DB-Ebene
- Kein eigener Auth-Server nötig

---

## Auth-Modi

| Modus | Beschreibung | Status |
|-------|--------------|--------|
| **Gast** | App nutzen ohne Login | ✅ |
| **Email/Password** | Registrierung + Login | ✅ |
| **Google OAuth** | Social Login | 🔴 Geplant |
| **Apple OAuth** | iOS Pflicht für Social | 🔴 Geplant |
| **Passkeys** | WebAuthn | 🔴 Future |
| **MFA** | 2FA | 🔴 Future |

---

## Token-Modell

| Token | Lebensdauer | Verwendung |
|-------|-------------|------------|
| Access Token (JWT) | ~1h | API-Requests |
| Refresh Token | ~7d (konfigurierbar) | Token-Erneuerung |
| Session | Gerätegebunden | Supabase Client |

Details: [03_Login.md](./03_Login.md), [06_Session_Management.md](./06_Session_Management.md)

---

## Rollen-Übersicht

| Rolle | Kurzbeschreibung |
|-------|------------------|
| Gast | Lesen, keine Submissions |
| User | Favorites, Submissions, Profile |
| Organizer | Events erstellen, Verification |
| Moderator | Review Queue (Future) |
| Admin | Vollzugriff, intern |

Details: [02_User_Roles.md](./02_User_Roles.md)

---

## Integration mit anderen Bänden

| Band | Bezug |
|------|-------|
| [Band 4 Backend](../04-backend/README.md) | RLS, profiles, API |
| [Band 4.5 Automation](../04.5-event-automation/README.md) | Organizer als Event-Quelle |
| [Band 5 Operations](../05-product-operations/README.md) | Identity Ops, Verification Ops |

---

## Ist-Stand Code

| Bereich | Pfad | Status |
|---------|------|--------|
| Auth Hook | `src/hooks/useAuth.tsx` | ✅ |
| Login/Register | `app/login.tsx`, `register.tsx` | ✅ |
| Profile | `profiles` Tabelle | ✅ |
| RLS | `supabase/migrations/001_*` | ✅ |

---

## Referenzen

- [02_User_Roles.md](./02_User_Roles.md)
- [04-backend/03_Authentifizierung_Autorisierung.md](../04-backend/03_Authentifizierung_Autorisierung.md)
- [04_Registration.md](./04_Registration.md)
