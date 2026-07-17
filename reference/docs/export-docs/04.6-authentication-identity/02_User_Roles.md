# 02 — User Roles

> Band 4.6 · Rollenmodell Eternal Rave

---

## Übersicht

Eternal Rave verwendet ein **festes Rollenmodell** mit fünf Stufen. Rollen werden in `profiles.role` gespeichert und über RLS durchgesetzt.

---

## Gast

| Aspekt | Detail |
|--------|--------|
| **Auth** | Kein Account, anonymer App-Zugriff |
| **Rechte** | Public Feed lesen, Event Details, Map |
| **Einschränkungen** | Keine Favorites sync, keine Submissions |
| **Upgrade** | Registrierung → User |

**MVP:** Gastmodus ist Standard beim App-Start ohne Session.

---

## User

| Aspekt | Detail |
|--------|--------|
| **Auth** | Email/Password oder OAuth (future) |
| **Rechte** | Favorites, Event Submissions, Profil bearbeiten, Reports |
| **Einschränkungen** | Kein Organizer-Dashboard, kein Admin |
| **Upgrade** | Organizer-Antrag → Organizer (nach Verification) |

**DB:** `profiles.role = 'user'` (Default nach Registrierung)

---

## Organizer

| Aspekt | Detail |
|--------|--------|
| **Auth** | Wie User + Organizer-Profil |
| **Rechte** | Events erstellen/bearbeiten, Submission als Organizer, Analytics (future) |
| **Verification** | unverified → pending → verified |
| **Badge** | Verified Badge auf Profil und Events |
| **Einschränkungen** | Kein Admin, kein Bulk-Import |

**DB:** `profiles.role = 'organizer'`, `organizers.verification_status`

Siehe [05_Organizer_Verification.md](./05_Organizer_Verification.md)

---

## Moderator

| Aspekt | Detail |
|--------|--------|
| **Auth** | Intern vergeben (kein Self-Service) |
| **Rechte** | Moderation Queue, Bulk Review (future), Kommentare |
| **Einschränkungen** | Kein Source Manager, kein User-Management |
| **Status** | 🔴 Rolle dokumentiert, nicht implementiert |

**Ziel:** Entlastung der Admins bei hohem Queue-Volumen.

---

## Admin

| Aspekt | Detail |
|--------|--------|
| **Auth** | Nur intern — keine öffentliche Registrierung |
| **Rechte** | Vollzugriff: Import, Sources, Users, Verification, Config |
| **Vergabe** | Manuell in Supabase / Seed |
| **Einschränkungen** | — |

Siehe [Admin](#admin-intern) unten und [01_Authentication_Overview.md](./01_Authentication_Overview.md)

---

## Rollen-Matrix

| Aktion | Gast | User | Organizer | Moderator | Admin |
|--------|------|------|-----------|-----------|-------|
| Feed lesen | ✅ | ✅ | ✅ | ✅ | ✅ |
| Favorites | ❌ | ✅ | ✅ | ✅ | ✅ |
| Event Submission | ❌ | ✅ | ✅ | ❌ | ✅ |
| Organizer Events | ❌ | ❌ | ✅ | ❌ | ✅ |
| Review Queue | ❌ | ❌ | ❌ | ✅ | ✅ |
| Source Manager | ❌ | ❌ | ❌ | ❌ | ✅ |
| User Management | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## Admin (intern)

- Keine Registrierungs-UI für Admin
- Rolle wird in DB gesetzt: `profiles.role = 'admin'`
- Demo-Modus: Admin oft offen (⚠️ Production absichern)
- Team Accounts (Future): mehrere Admins mit Audit

---

## Referenzen

- [01-product-vision/09_Roles.md](../01-product-vision/09_Roles.md)
- [04-backend/03_Authentifizierung_Autorisierung.md](../04-backend/03_Authentifizierung_Autorisierung.md)
- [04.5-event-automation/08_Organizer_Verification.md](../04.5-event-automation/08_Organizer_Verification.md)
