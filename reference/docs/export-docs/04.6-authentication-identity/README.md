# Band 4.6 — Authentication & Identity Bible

> **Status:** Kanonische Dokumentation · **Implementierung:** MVP Email/Password (Supabase)  
> **Verwandt:** [Band 4 Backend](../04-backend/README.md) · [Band 4.5 Automation](../04.5-event-automation/README.md)

Vollständige Dokumentation des Authentifizierungs- und Identitätssystems für Eternal Rave.

---

## Kapitel

| # | Datei | Thema |
|---|-------|-------|
| 01 | [Authentication Overview](./01_Authentication_Overview.md) | Supabase Auth, Prinzipien |
| 02 | [User Roles](./02_User_Roles.md) | Gast, User, Organizer, Moderator, Admin |
| 03 | [Login](./03_Login.md) | JWT, Sessions, OAuth |
| 04 | [Registration](./04_Registration.md) | E-Mail, OAuth, Gastmodus |
| 05 | [Organizer Verification](./05_Organizer_Verification.md) | Antrag, Badge, Rechte |
| 06 | [Session Management](./06_Session_Management.md) | Multi-Device, Logout |
| 07 | [Security](./07_Security.md) | Rate Limiting, Missbrauch |
| 08 | [Account Lifecycle](./08_Account_Lifecycle.md) | Registrierung → Löschung |
| 09 | [Roadmap](./09_Roadmap.md) | MVP → MFA → Enterprise |

---

## Ist-Stand Code (Referenz)

| Bereich | Code-Pfad | Status |
|---------|-----------|--------|
| Auth | `src/hooks/useAuth.tsx` | ✅ Email/Password, sessions, roles |
| Auth Service | `src/services/authService.ts` | ✅ Login, register, reset, verify |
| Auth Screens | `login`, `register`, `forgot-password`, `reset-password`, `verify-email` | ✅ |
| Route Guards | `AuthGate`, `app/admin/_layout`, `app/organizer/_layout` | ✅ |
| Profile + Roles | `profiles` + `organizers`, RLS | ✅ user/organizer/moderator/admin |
| Guest Mode | Browse without session | ✅ |
| Google/Apple OAuth | — | 🔴 Sprint 3+ |
| Organizer Verification UI | — | 🔴 Sprint 3+ |

---

## Quell-ZIP

Archiv: [Eternal_Rave_Band_4_6_Authentication_Identity_Bible.zip](../Eternal_Rave_Band_4_6_Authentication_Identity_Bible.zip)
