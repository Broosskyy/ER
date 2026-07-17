# 06 — Auth Validation (Sprint 0.5 Audit)

> **Rolle:** Senior Security + Backend Architect · **SSOT:** Band 4.6

---

## Rollen-Modell Audit

| Rolle | Doku 4.6 | DB/Code | Konsistent |
|-------|----------|---------|------------|
| Gast | ✅ | ✅ Kein Session | ✅ |
| User | ✅ | ✅ default role | ✅ |
| Organizer | ✅ | ✅ role + organizers table | ✅ |
| Moderator | ✅ | ❌ **Nicht existent** | ❌ **QG-07** |
| Admin | ✅ | ✅ profiles.role | 🟡 Guards incomplete |

**Finding:** 5-Rollen-Modell in Doku, **4 Rollen im Code**. Moderator ist **Phantom-Rolle**.

---

## Gastmodus

| Aspekt | Doku | Code | Urteil |
|--------|------|------|--------|
| App ohne Login | ✅ | ✅ | ✅ MVP-korrekt |
| Feed lesen | ✅ | ✅ published only | ✅ |
| Favorites | ❌ ohne Login | 🟡 Demo local? | 🟡 |
| Submissions | ❌ | ✅ Auth required live | ✅ |
| CTA Login | ✅ | ✅ Profile prompts | ✅ |

---

## Registrierung

| Feature | Doku | Code |
|---------|------|------|
| Email/Password | ✅ | ✅ register.tsx |
| Google | ✅ Roadmap | 🔴 |
| Apple | ✅ Roadmap | 🔴 |
| Email Verification | ✅ | 🟡 Config-dependent |
| Passwort Reset | ✅ | 🟡 Flow prüfen |
| Gast → User Upgrade | ✅ | ✅ |

---

## Login & Tokens

| Feature | Doku | Code |
|---------|------|------|
| JWT Access | ✅ ~1h | ✅ Supabase |
| Refresh Token | ✅ | ✅ |
| signInWithPassword | ✅ | ✅ useAuth |
| Remember Me | ✅ | 🟡 Default persist |
| OAuth | 🔴 Geplant | 🔴 |

**Session Storage:** AsyncStorage via Supabase — ✅ Standard für Expo.

---

## Organizer

| Aspekt | Doku | Code |
|--------|------|------|
| Role upgrade | ✅ | 🟡 |
| verification_status | ✅ | ✅ DB field |
| Verification UI | ✅ | 🔴 |
| Badge | ✅ | 🟡 teilweise |
| Team Accounts | 🔴 Future | 🔴 |
| Rechte Matrix | ✅ 4.6 Kap. 02 | 🟡 nicht enforced überall |

---

## Admin

| Regel Doku | Code | Finding |
|------------|------|---------|
| Nur intern | 🟡 Seed/manuell | ✅ |
| Keine Public Registration | ✅ | ✅ |
| Vollzugriff | ✅ | 🟡 Demo offen |
| Team Accounts Future | ✅ | — |

---

## Account Lifecycle

| State | Doku 4.6 Kap. 08 | Code |
|-------|------------------|------|
| Registrierung | ✅ | ✅ |
| Aktiv | ✅ | ✅ |
| Email Verifiziert | ✅ | 🟡 |
| Organizer Verified | ✅ | 🟡 DB only |
| Gesperrt | ✅ | 🔴 profiles.status? |
| Gelöscht | ✅ Soft/Hard | 🔴 |
| Wiederhergestellt | ✅ Grace 30d | 🔴 |

**Finding QG-AUTH-01:** Account Lifecycle **vollständig dokumentiert**, **minimal implementiert**. Kein Widerspruch — Doku = Zielbild.

---

## Security Features

| Feature | Doku | Code |
|---------|------|------|
| Rate Limiting | ✅ Supabase | ✅ |
| Captcha | ✅ optional | 🔴 |
| Device Management | ✅ Future | 🔴 |
| Remote Logout | ✅ | 🔴 |
| MFA | ✅ Future | 🔴 |

---

## Band 4 vs Band 4.6 — Redundanz

| Band 4 Kap. 03 | Band 4.6 | Empfehlung |
|----------------|----------|------------|
| 3 Zeilen Stub | 10 Kapitel voll | **4.6 = SSOT** |
| Verweis fehlt | — | Band 4 Kap. 03 → Link 4.6 |

---

## Authentication Risiken (Summary)

| ID | Risiko | Severity |
|----|--------|----------|
| AUTH-01 | Moderator dokumentiert, nicht implementiert | P1 |
| AUTH-02 | Admin routes unguarded | P0 (prod) |
| AUTH-03 | Kein OAuth (Apple Pflicht mit Google auf iOS) | P1 |
| AUTH-04 | Account Delete/DSGVO UI fehlt | P1 (pre-V1) |
| AUTH-05 | Remote session revocation fehlt | P2 |

---

## Auth Score

| Dimension | Score |
|-----------|-------|
| Dokumentation 4.6 | 98% |
| MVP Auth (Email) | 85% |
| Rollen-Enforcement | 55% |
| OAuth/Social | 0% |
| Verification Flow | 25% |
| Account Lifecycle UI | 20% |
| Security Hardening | 60% |
| **Gesamt Authentication** | **62%** |

Sprint 0 FINAL: 65% — Auditor: **62%** (Moderator-Widerspruch gewichtet).

---

## Bessere Lösung: Moderator

**Option A:** Moderator in Sprint 8 als `profiles.role = moderator` + RLS — getrennte Admin-Queue-Rechte  
**Option B:** Moderator aus 4.6 entfernen bis Sprint 8 — als „Planned" markieren  
**Empfehlung:** Option A — Doku ist gut, Implementation fehlt nur.

---

*Auth Validation — Band 4.6 bestätigt als SSOT.*
