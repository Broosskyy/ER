# Sprint 12.7C — Legal, Privacy & Consent Report

**Project:** Eternal Rave  
**Sprint:** 12.7C  
**Date:** July 2026  
**Status:** Complete — documentation and audit only; no legal text, no analytics, no cookie banners

---

## Executive summary

Sprint 12.7C established the complete legal and privacy **documentation foundation** for Eternal Rave's public release. The audit confirms a **privacy-favorable architecture**: no end-user accounts, device-local consumer data only, admin-only authentication with RLS-enforced backend, and no analytics or tracking SDKs.

**Key finding:** The app is well-positioned for GDPR compliance due to data minimization, but **legal text, hosted privacy policy, Impressum, and admin session timeout** remain open before public launch.

**No application code was changed.** No new features. No analytics. No cookie banners.

---

## 1. Architecture audit

### Frontend
- Expo SDK 57, React Native, Expo Router
- Consumer data: AsyncStorage only (favorites, notifications, event snapshots)
- No SecureStore; Supabase admin tokens use SDK default persistence
- Fixed dark theme, German locale — no preference storage
- No analytics or tracking imports

### Backend (Supabase)
- 14 tables, all RLS-enabled
- Admin-only auth via JWT `app_metadata.role`
- No edge functions
- 4 public storage buckets; RLS policies only on `events` bucket
- Import pipeline with audit logging and secret redaction

### Web / PWA
- Static export; service worker caches assets only
- `/admin/*` and Supabase bypassed by SW
- No app-set cookies; Supabase Auth uses browser storage for admin

### Admin
- Web-only; native blocked
- Multi-layer guards (auth → role → permission → route)
- No idle session timeout

Full detail: `docs/privacy.md` §2, `docs/security-privacy.md`

---

## 2. Privacy analysis

### Personal data processed

| Category | Data | Location | Account-linked? |
|----------|------|----------|-----------------|
| Favorites | Event IDs | Device (AsyncStorage) | No |
| Notifications | Titles, messages, event refs | Device | No |
| Event snapshots | Event metadata cache | Device | No |
| Admin auth | Email, UUID, role | Supabase + browser storage | Yes (admin) |
| Import audit | Admin UUID, actions | Supabase | Yes (admin) |

**Not collected:** GPS, device ID, advertising ID, user accounts, search history, theme/language prefs.

### Data classification

| Class | Examples |
|-------|----------|
| Öffentlich | Published events, genres, venues |
| Intern | Import configs, sync state, drafts |
| Personenbezogen | Admin email/UUID, device-local favorites |
| Sensibel | None |

---

## 3. Data inventory

Complete inventory in `docs/privacy.md` §3–4.

**14 Supabase tables audited.** No consumer profile or favorites tables in database.

---

## 4. Data flow analysis

Five primary flows documented:
1. Event discovery (anon → Supabase → UI)
2. Favorites (local only)
3. Notification center (fetch + local diff)
4. Admin login (Supabase Auth → JWT → RLS queries)
5. Import pipeline (external fetch → staging → audit)

All flows documented with source, destination, encryption, authentication, and purpose.

---

## 5. GDPR assessment

| Principle | Status | Risk |
|-----------|--------|------|
| Rechtmäßigkeit | Documented legal bases | Low |
| Transparenz | Structure ready; policy not hosted | **Medium** |
| Zweckbindung | Compliant | Low |
| Datenminimierung | Strong (no accounts) | Low |
| Richtigkeit | Import review workflow | Medium |
| Speicherbegrenzung | Retention policy documented; automation pending | Medium |
| Integrität | RLS + TLS | Low |
| Vertraulichkeit | RLS; service role blocked | Low-Medium |

---

## 6. Legal bases

Documented in `docs/privacy.md` §7 for: event display, favorites, notifications, admin login, audit logs, import logs, support (future).

---

## 7. Processing activities register

Internal register created in `docs/privacy.md` §8. Controller: Eternal Rave (legal entity TBD).

---

## 8. Third-party inventory

| Service | Active |
|---------|--------|
| Supabase | Yes |
| Expo/EAS | Yes |
| Google Maps | Configured (placeholder UI) |
| Apple / Google stores | Prepared |
| Analytics (GA, Firebase, Sentry, PostHog) | **No** |
| Email (Resend, Mailgun) | **No** |
| Push (FCM/APNs) | **No** |

---

## 9–11. Legal document structures

| Document | File | Status |
|----------|------|--------|
| Privacy policy (18 sections) | `docs/privacy.md` §10 | Structure ✓ |
| Terms of service (13 chapters) | `docs/terms.md` | Structure ✓ |
| Impressum | `docs/legal.md` §2 | Structure ✓ — no invented data |

---

## 12–13. Consent & cookies

- **Consent categories:** Required, Functional, Statistics (off), Marketing (off)
- **No consent banner needed** currently — no analytics/marketing trackers
- **Cookies:** Only Supabase Auth session storage for admin; no analytics cookies
- **Privacy by default:** No opt-in tracking, no hidden sharing

---

## 14–15. Privacy by design / default

All checks passed. See `docs/privacy.md` §14.

---

## 16–17. Deletion & export concepts

Documented in `docs/privacy.md` §15–16 and `docs/data-retention.md`.

**Current:** Users clear app data to delete local favorites/notifications. No cloud accounts.

---

## 18. Data retention

Full schedule in `docs/data-retention.md`:
- Device data: until app clear
- Import logs: 90 days (target)
- Import records: 6 months (target)
- Audit logs: 24 months (target)
- Admin sessions: Supabase defaults

Automation not implemented.

---

## 19. Deletion concept

Soft delete (events: status field), hard delete (admin accounts, import records), anonymization (audit actor_id) — documented with dependency order.

---

## 20–22. Supabase security & RLS & auth

Full audit in `docs/security-privacy.md` §1–2.

**RLS:** 14/14 tables enabled. All admin/import tables admin-only. Anon reads published content only.

**Gaps:**
- Storage buckets `artists`, `venues`, `collections` lack RLS policies
- No admin idle timeout
- `raw_payload` may contain third-party PII

---

## 23–25. Store privacy preparation

| Platform | Status |
|----------|--------|
| Apple Privacy Manifest | Configured (`UserDefaults` / CA92.1) |
| Apple Privacy Labels | Documented — no data collection declared |
| Google Play Data Safety | Documented — no personal data collected |

---

## 26–28. Security & frontend/admin privacy

See `docs/security-privacy.md` §3–5.

---

## 29. Documentation created

| File | Content |
|------|---------|
| `docs/privacy.md` | Privacy architecture, inventory, GDPR, third-party, consent, store prep |
| `docs/terms.md` | Terms chapter structure |
| `docs/legal.md` | Impressum structure, contacts, publication status |
| `docs/data-retention.md` | Retention schedule, backups, deletion order |
| `docs/security-privacy.md` | Security review, RLS audit, risks, test plan, checklist |

---

## 30. Privacy checklist

20/20 items addressed (structures or audits complete). Legal text and hosting remain manual.

---

## 31. Risk analysis

11 risks identified. Highest priority open items:
1. Missing hosted privacy policy
2. Admin idle session timeout
3. Storage bucket RLS gaps
4. `raw_payload` PII in import staging

Full table: `docs/security-privacy.md` §6

---

## 32. Test plan

| Category | Automated | Manual |
|----------|-----------|--------|
| Functional | 202 unit tests PASS | App restart, offline — not in CI |
| Security | RLS validation PASS | Token manipulation — not in CI |
| Privacy | Code audit PASS | App data clear — not in CI |

---

## 33. Regression tests

| Platform | Result |
|----------|--------|
| TypeScript | PASS |
| ESLint | PASS (0 errors) |
| Tests | PASS (202) |
| `validate:ios` | PASS |
| Web build | PASS |
| Android `assembleRelease` | PASS |
| iOS prep | Unchanged |
| Admin | Unchanged |
| Notification Center | Unchanged |
| PWA | Unchanged |

---

## 34. Performance review

No additional queries or PII transfers introduced. PASS.

---

## 35. Technical debt

10 privacy-related items documented in `docs/security-privacy.md` §9. Not auto-fixed.

---

## 36. Known limitations

- No legal text drafted (requires qualified counsel)
- No privacy policy hosted
- No Impressum with real entity data
- No consent UI (not needed until analytics)
- No admin session timeout
- No automated retention purge
- No user accounts → no cloud export/deletion endpoints
- SecureStore not used for auth tokens

---

## 37. Manual remaining work

1. Register legal entity
2. Engage legal counsel for privacy policy + terms (DE/EU)
3. Host `/privacy`, `/terms`, `/impressum` on production domain
4. Wire `EXPO_PUBLIC_PRIVACY_URL` / `EXPO_PUBLIC_TERMS_URL` in app
5. Complete Apple App Store privacy questionnaire
6. Complete Google Play Data Safety form
7. Implement admin idle timeout
8. Add storage RLS policies before enabling uploads
9. Implement retention purge jobs
10. Add local storage notice on first app launch (optional, 12.7D)

---

## 38. Publication prerequisites

Before public release:

- [ ] Hosted privacy policy URL
- [ ] Hosted terms of service URL
- [ ] Impressum (DE market)
- [ ] Support email active
- [ ] Privacy email active
- [ ] Apple Developer privacy labels submitted
- [ ] Google Play Data Safety completed
- [ ] Production `USE_SUPABASE=true` (no mock admin creds)
- [ ] HTTPS on production domain

---

## 39. Open points for Sprint 12.7D

- Implement legal page routes (`/privacy`, `/terms`, `/impressum`)
- Wire privacy URLs in app footer/settings
- Admin session idle timeout
- First-launch local storage disclosure
- Automated import log/record retention purge
- Storage bucket RLS policies
- Legal text from counsel integration

---

## 40. Changed files

| File | Change |
|------|--------|
| `docs/privacy.md` | **New** |
| `docs/terms.md` | **New** |
| `docs/legal.md` | **New** |
| `docs/data-retention.md` | **New** |
| `docs/security-privacy.md` | **New** |
| `README.md` | Updated sprint status + doc links |
| `SPRINT_12_7C_LEGAL_PRIVACY_CONSENT_REPORT.md` | **New** |

---

## Definition of done

| Criterion | Status |
|-----------|--------|
| Datenschutzarchitektur dokumentiert | ✓ |
| Dateninventar vollständig | ✓ |
| Datenklassifizierung abgeschlossen | ✓ |
| Datenflussanalyse erstellt | ✓ |
| DSGVO Analyse abgeschlossen | ✓ |
| Rechtsgrundlagen dokumentiert | ✓ |
| Third-Party Inventar erstellt | ✓ |
| Privacy Policy vorbereitet | ✓ (structure) |
| Terms of Service vorbereitet | ✓ (structure) |
| Impressum vorbereitet | ✓ (structure) |
| Consent-Konzept erstellt | ✓ |
| Cookie-Konzept vorbereitet | ✓ |
| Data Retention dokumentiert | ✓ |
| Löschkonzept erstellt | ✓ |
| Exportkonzept erstellt | ✓ |
| Supabase Security Review abgeschlossen | ✓ |
| RLS Audit abgeschlossen | ✓ |
| Authentication geprüft | ✓ |
| Apple Privacy Manifest vorbereitet | ✓ |
| App Store Privacy Labels vorbereitet | ✓ |
| Google Play Data Safety vorbereitet | ✓ |
| Sicherheitsprüfung abgeschlossen | ✓ |
| Datenschutzprüfung Frontend abgeschlossen | ✓ |
| Datenschutzprüfung Admin abgeschlossen | ✓ |
| Dokumentation erstellt | ✓ |
| Datenschutz-Checkliste vollständig | ✓ |
| Risikoanalyse abgeschlossen | ✓ |
| Testplan durchgeführt | ✓ |
| Regressionen bestanden | ✓ |
| Abschlussbericht erstellt | ✓ |
| Android funktionsfähig | ✓ |
| Web funktionsfähig | ✓ |
| iOS Vorbereitung unverändert | ✓ |
| Admin funktionsfähig | ✓ |
| Notification Center funktionsfähig | ✓ |

**Sprint 12.7C complete.**
