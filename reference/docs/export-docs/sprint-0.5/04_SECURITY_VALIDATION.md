# 04 — Security Validation (Sprint 0.5 Audit)

> **Rolle:** Senior Security Engineer · **Scope:** Auth, RLS, Admin, DSGVO, Automation

---

## Security Posture Summary

| Bereich | Score | Status |
|---------|-------|--------|
| Authentication | 62% | Email OK, OAuth fehlt |
| Authorization (RLS) | 78% | DB gut, Client schwach |
| Admin Security | 45% | **Kritisch in Demo** |
| Data Protection | 50% | DSGVO dokumentiert, nicht implementiert |
| Automation Security | 65% | Regeln gut, Enforcement partial |
| Input Validation | 55% | Form-level only |
| Secrets Management | 85% | Anon key only im Client ✅ |
| Crash/Error Leakage | 60% | Kein Sentry, console in dev |

**Gesamt Security: 58%**

---

## Authentication Risiken

| Risiko | Severity | Ist | Doku (4.6) |
|--------|----------|-----|------------|
| Kein OAuth | Mittel | Email only | 🔴 Geplant P1 |
| Admin Demo offen | **Hoch** | Kein Guard auf meisten Admin-Routes | Dokumentiert AR-05 |
| Session Hijacking | Mittel | SecureStore via Supabase | 🟡 Standard |
| Brute Force | Mittel | Supabase Rate Limit | ✅ |
| Passwort Policy | Niedrig | Supabase default | 🟡 Nicht verschärft |
| Email Verification | Mittel | Konfigurierbar | 🟡 Soft mode möglich |
| MFA | Niedrig | — | 🔴 Future |
| Passkeys | Niedrig | — | 🔴 Future |

### Moderator-Rolle (Finding QG-07)

- **Dokumentiert** in Band 4.6 als eigene Rolle mit Review-Rechten
- **Code:** Kein `moderator` in types, hooks, oder DB enum
- **Risiko:** Entwickler implementieren Moderator als Admin-Alias → Audit-Trail verwischt
- **Empfehlung:** Entweder DB enum + RLS in Sprint 7–8, oder Rolle als „Future" in 4.6 markieren

---

## JWT & Sessions

| Aspekt | Status | Finding |
|--------|--------|---------|
| JWT via Supabase | ✅ | Standard |
| Refresh Token | ✅ | Default rotation unklar |
| Multi-Device | ✅ | Möglich |
| Remote Logout | 🔴 | Nicht implementiert |
| Global Sign-Out on Password Change | 🔴 | Nicht implementiert |
| Remember Me | 🟡 | Supabase default |

---

## Authorization — RLS

| Tabelle | RLS | Geprüft |
|---------|-----|---------|
| profiles | ✅ | Migration 001 |
| events | ✅ | Lifecycle + role |
| favorites | ✅ | User-scoped |
| event_sources | ✅ | Admin |
| organizers | 🟡 | verification_status |

**Stärke:** Server-side RLS ist **korrekte** Authorization-Schicht.

**Schwäche:** Client-side `isAdmin` Checks sind **UX-only** — direkte Supabase API Calls könnten umgangen werden wenn RLS Lücken hat (nicht vollständig auditiert in Sprint 0.5).

---

## Admin & Route Security

| Route | Guard | Finding |
|-------|-------|---------|
| admin/sources | ✅ isAdmin (wenn remote) | Einzige geprüfte Route |
| admin/review | 🔴 | Offen in Demo |
| admin/import | 🔴 | Offen |
| admin/* (rest) | 🔴 | Offen |

**Production-Risiko:** Hoch wenn Demo-Modus oder fehlende Guards in Live.

**Empfehlung Sprint 8:** Layout group `(admin)` mit `requireAdmin()` HOC — dokumentiert, muss umgesetzt werden vor Play Store.

---

## DSGVO & Privacy

| Anforderung | Band 4.5/4.6 | Implementierung |
|-------------|----------------|-----------------|
| Privacy Policy | Erwähnt | 🔴 Fehlt |
| Auskunft/Löschung | Account Lifecycle 4.6 | 🔴 UI fehlt |
| DPA Supabase | Erwähnt | 🟡 Extern |
| Logging ohne PII | Dokumentiert | 🟡 Nicht enforced |
| Bild-Rechte Import | Dokumentiert | 🟡 Manuell |

**Blocker für V1/Play Store** — nicht für Sprint 1.

---

## Automation Security

| Risiko | Severity | Mitigation (Doku) | Code |
|--------|----------|-------------------|------|
| Spam Imports | Mittel | Rate Limit, Confidence | 🟡 Partial |
| Fake Organizer | Hoch | Verification | 🔴 UI fehlt |
| Scraping Rechtsverletzung | Hoch | Quellenbewertung | ✅ Doku |
| Auto-Publish | Hoch | Verboten | ✅ Enforced |
| Bulk Approve Missbrauch | Mittel | Audit Log | 🔴 Audit nicht implementiert |
| KI Halluzination Events | Hoch | Immer Review | ✅ Policy |

### Moderationsrisiken

| Risiko | Beschreibung | Mitigation |
|--------|--------------|------------|
| Queue Backlog | Admin überlastet | Band 5 Kap. 13 SLAs |
| Single Admin | Bus Factor | Moderator-Rolle geplant, nicht implementiert |
| Kein Audit Log | Keine Nachvollziehbarkeit | 4.5 Kap. 09 dokumentiert, DB fehlt |
| Bulk Reject Fehler | Falsche Events gelöscht | MVP: kein Bulk — gut |

---

## Input Validation & Injection

| Vektor | Status |
|--------|--------|
| SQL Injection | ✅ Supabase parameterized |
| XSS in Event Text | 🟡 React Native Text — low risk |
| URL Import SSRF | 🔴 Mock parser — Future Risk |
| Deep Link Auth | 🟡 scheme eternalrave — nicht getestet |

---

## Secrets & Env

| Check | Status |
|-------|--------|
| Nur EXPO_PUBLIC_* im Client | ✅ |
| Service Role Key im Client | ✅ Nicht gefunden |
| .env in git | ✅ Nicht committed |

---

## Crash Reporting

| Aspekt | Status |
|--------|--------|
| Sentry/Crashlytics | 🔴 Nicht implementiert |
| ADR | ❌ Fehlt |
| Roadmap | ❌ Nicht explizit |

**Finding:** Production ohne Crash Reporting = **blind**. ADR-010 empfohlen.

---

## Security Empfehlungen (priorisiert)

| P | Maßnahme | Sprint |
|---|----------|--------|
| P0 | Admin Route Guards (alle admin/*) | 8 |
| P1 | Privacy Policy Draft | Pre-V1 |
| P1 | Audit Log Tabelle (Moderation) | 8–9 |
| P1 | OAuth + Email Verification strict | 7 |
| P2 | Remote Logout / Session Revocation | 7 |
| P2 | Sentry ADR + Integration | 12+ |
| P2 | Server-side Duplicate Check | 9 |

---

*Security Validation — skeptischer Audit, kein Pen-Test.*
