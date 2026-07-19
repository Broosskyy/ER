# Privacy Architecture — Eternal Rave

**Sprint:** 12.7C  
**Status:** Internal documentation — no legal advice; structures prepared for legal review  
**Last updated:** July 2026

---

## 1. Overview

Eternal Rave is an event discovery platform (Android, iOS, Web/PWA) with **no end-user accounts**. Consumer data is stored **on-device only**. Authentication exists solely for the **admin panel** (web-only).

**Principles applied:** Privacy by Design, Privacy by Default, Data Minimization, Least Privilege, GDPR First.

**Related docs:** [terms.md](terms.md) · [legal.md](legal.md) · [data-retention.md](data-retention.md) · [security-privacy.md](security-privacy.md) · [security.md](security.md)

---

## 2. Architecture audit summary

### Frontend (Expo / React Native)

| Component | Status | Privacy notes |
|-----------|--------|---------------|
| Expo Router | Active | File-based routing; admin at `/admin` |
| Navigation | Tab + stack | No tracking of navigation paths |
| Environment vars | `src/core/config/env.ts` | Only public keys in client bundle |
| AsyncStorage | Favorites, notifications | Device-local; no account link |
| SecureStore | **Not used** | Supabase tokens use SDK default storage |
| Theme / language | Fixed dark / German | No user preference persistence |

### Backend (Supabase)

| Component | Status | Privacy notes |
|-----------|--------|---------------|
| Auth | Admin-only | Email/password via Supabase Auth |
| Database | PostgreSQL + RLS | 14 tables in `public` schema |
| Storage | 4 public buckets | Only `events` bucket has RLS policies |
| RPC / Functions | None | No edge functions deployed |
| RLS | Enabled on all tables | Anon read for published content only |

### Web / PWA

| Component | Status | Privacy notes |
|-----------|--------|---------------|
| Static export | Active | No server-side rendering of user data |
| Service worker | Production only | Caches static assets; bypasses `/admin/*` and Supabase |
| HTTPS | Required at deploy | See [domain.md](domain.md) |
| Cookies | None set by app | Supabase Auth may use browser storage for admin sessions |

### Admin

| Component | Status | Privacy notes |
|-----------|--------|---------------|
| Login | Supabase Auth | Web-only; native shows block screen |
| Roles | JWT `app_metadata.role` | Fail-closed; 6 role levels |
| Session | Persist + auto-refresh | No idle timeout implemented |
| Guards | Route + permission checks | Client guards + server RLS |

---

## 3. Personal data inventory

### 3.1 End-user data (device-local)

| Data | Fields | Purpose | Storage | Retention | Classification |
|------|--------|---------|---------|-----------|----------------|
| Favorites | Event ID strings | Save events | AsyncStorage `@eternal_rave/favorite_event_ids_v1` | Until user clears app data | Personenbezogen (device-bound) |
| Notifications | id, type, title, message, eventId, timestamps, metadata | Local notification center | AsyncStorage `@eternal_rave/notifications_v2` | Until deleted or app data cleared | Personenbezogen (device-bound) |
| Event snapshots | Event metadata cache for diffing | Generate notifications | AsyncStorage `@eternal_rave/event_snapshot_v2` | Until app data cleared | Intern |
| Sync state | `lastSuccessfulSyncAt` | Notification sync timing | AsyncStorage `@eternal_rave/notification_sync_v2` | Until app data cleared | Intern |

**Not stored:** User ID, login, profile, location GPS, theme preference, language preference, search history.

### 3.2 Admin data (Supabase)

| Data | Fields | Purpose | Storage | Retention | Classification |
|------|--------|---------|---------|-----------|----------------|
| Auth session | user.id, email, access_token, role | Admin authentication | Supabase SDK storage (browser/local) | Session lifetime + refresh | Personenbezogen |
| Import audit | actor_id (UUID), action, entity, summary | Accountability | `import_audit_logs` table | Per [data-retention.md](data-retention.md) | Personenbezogen |
| Import jobs | triggered_by (UUID) | Job attribution | `import_jobs` table | Per retention policy | Personenbezogen |
| Import records | reviewed_by (UUID) | Review attribution | `import_records` table | Per retention policy | Personenbezogen |

### 3.3 Public content data (not personal)

| Data | Classification | Accessible by |
|------|----------------|---------------|
| Published events | Öffentlich | Anon + authenticated (read) |
| Genres, cities, collections (active) | Öffentlich | Anon (read) |
| Venues, artists | Öffentlich | Anon (read, all rows) |
| Draft/review events | Intern | Admin only |
| Import staging (`raw_payload`) | Intern | Admin only; may contain third-party data |

### 3.4 Device data

| Data | Collected? | Notes |
|------|------------|-------|
| GPS / location | **No** | Map tab is placeholder; no location permission requested |
| Device ID / advertising ID | **No** | No analytics SDKs |
| IP address | Indirect | Standard server logs at Supabase/hosting (processor) |
| Crash reports | **No** | No Sentry/Crashlytics |

### 3.5 Settings

| Setting | Persisted? | Default |
|---------|------------|---------|
| Theme | No | Dark (fixed) |
| Language | No | German (fixed) |
| App preferences | No | — |

---

## 4. Data classification

| Class | Definition | Examples in Eternal Rave |
|-------|------------|--------------------------|
| **Öffentlich** | Freely publishable | Published events, genres, venues |
| **Intern** | Operational, not user-facing | Import configs, sync state, draft events |
| **Personenbezogen** | Relates to identifiable individual | Admin email/UUID, device-local favorites |
| **Sensibel** | Special categories (Art. 9 GDPR) | **None stored** |

---

## 5. Data flow analysis

### 5.1 Event discovery (consumer)

```
App (anon key)
  → HTTPS/TLS
  → Supabase PostgREST API
  → RLS: status = 'published'
  → Response: event records
  → UI rendering
```

| Property | Value |
|----------|-------|
| Authentication | Anon key (public, RLS-scoped) |
| Encryption in transit | TLS 1.2+ |
| Personal data transferred | None (content only) |
| Purpose | Display events |

### 5.2 Favorites (consumer, offline)

```
User taps save
  → favorites-storage.ts
  → AsyncStorage (local)
  → No network call
```

| Property | Value |
|----------|-------|
| Authentication | None |
| Encryption at rest | OS-level device encryption |
| Personal data | Event IDs only (indirect preference data) |
| Purpose | App functionality |

### 5.3 Notification center (consumer)

```
App startup / refresh
  → Fetch published events (Supabase)
  → Compare with event-snapshot cache (local)
  → Generate notifications (client-side)
  → Store in AsyncStorage
```

| Property | Value |
|----------|-------|
| Authentication | Anon key for event fetch |
| Personal data | Locally stored notification content |
| Purpose | Inform user about saved event changes |

### 5.4 Admin login

```
Admin enters credentials (web)
  → auth-service.signInWithPassword()
  → HTTPS/TLS → Supabase Auth
  → JWT with app_metadata.role
  → Session persisted (SDK default storage)
  → Admin UI with RLS-enforced queries
```

| Property | Value |
|----------|-------|
| Authentication | Email/password → JWT |
| Encryption in transit | TLS |
| Personal data | Admin email, UUID, role |
| Purpose | Admin panel access |

### 5.5 Import pipeline (admin)

```
Admin triggers import
  → Fetch external feed (HTTPS)
  → Parse + normalize
  → Store raw_payload + normalized_payload (admin RLS)
  → Audit log with actor_id
```

| Property | Value |
|----------|-------|
| Authentication | Admin JWT |
| Third-party data | External event feeds (unknown PII in raw_payload) |
| Purpose | Event data ingestion |

---

## 6. GDPR analysis

| Principle | Current status | Risk | Recommended measures |
|-----------|----------------|------|----------------------|
| **Rechtmäßigkeit** | Legitimate interest / contract for app function; admin on employment basis | Low (no consumer accounts) | Document legal bases (§7 below) |
| **Transparenz** | Profile note on local favorites; no privacy policy hosted yet | **Medium** | Publish privacy policy before public release |
| **Zweckbindung** | Data used only for stated purposes | Low | Maintain processing register |
| **Datenminimierung** | No accounts; minimal local storage | Low | Continue no-account model |
| **Richtigkeit** | Event data from imports; admin review workflow | Medium | Import review process exists |
| **Speicherbegrenzung** | Local data unbounded until app clear; import logs need retention | Medium | Implement retention per data-retention.md |
| **Integrität** | RLS + TLS; no tamper detection | Low | Regular RLS audits |
| **Vertraulichkeit** | RLS enforced; service role not in client | Medium | SecureStore for tokens (future) |

---

## 7. Legal bases for processing (Art. 6 GDPR)

| Processing | Purpose | Legal basis | Controller | Recipients | Retention | Deletion |
|------------|---------|-------------|------------|------------|-----------|----------|
| Event display | Show published events | Berechtigtes Interesse (Art. 6(1)(f)) | Eternal Rave | Supabase (processor) | Content lifecycle | Archive/delete events |
| Favorites (local) | App functionality | Vertragserfüllung / berechtigtes Interesse | Eternal Rave | None (device only) | Until app data cleared | User clears app data |
| Notifications (local) | Inform about saved events | Vertragserfüllung / berechtigtes Interesse | Eternal Rave | None (device only) | Until deleted/cleared | User action or app clear |
| Admin login | Authentication | Vertrag (employment/contract) | Eternal Rave | Supabase Auth | Session + account lifetime | Account deletion |
| Import audit logs | Accountability | Berechtigtes Interesse (Art. 6(1)(f)) | Eternal Rave | Supabase | Per retention policy | Scheduled purge |
| Error/import logs | Stability, debugging | Berechtigtes Interesse | Eternal Rave | Supabase | Time-limited | Auto-purge |
| Support requests (future) | Communication | Vertrag / Einwilligung | Eternal Rave | Mail provider | Case-by-case | On resolution + legal hold |

*Legal review required before publication.*

---

## 8. Processing activities register (internal)

| Field | Value |
|-------|-------|
| **Controller** | Eternal Rave (legal entity TBD — see [legal.md](legal.md)) |
| **DPO** | Not appointed (assess when >20 employees processing sensitive data regularly) |
| **Categories of data** | Admin contact data; device-local preferences; public event content |
| **Data subjects** | Admin users; app users (anonymous); event organizers (indirect, via public data) |
| **Recipients** | Supabase Inc. (processor); hosting provider; mail provider (future) |
| **Transfers** | Supabase EU region (configure at project creation); verify DPA |
| **Retention** | See [data-retention.md](data-retention.md) |
| **Security** | See [security-privacy.md](security-privacy.md) |
| **Legal bases** | See §7 above |

---

## 9. Third-party inventory

| Service | Active? | Purpose | Data shared | Location | DPA | Privacy |
|---------|---------|---------|-------------|----------|-----|---------|
| **Supabase** | Yes | DB, Auth, Storage | Event content, admin auth | Configurable (EU recommended) | Required | [supabase.com/privacy](https://supabase.com/privacy) |
| **Expo / EAS** | Yes | Builds, OTA (if used) | Build metadata, no end-user PII | US | Review Expo DPA | [expo.dev/privacy](https://expo.dev/privacy) |
| **Google Maps** | Configured | Map tiles (native, placeholder UI) | API key, tile requests | US/EU | Google Cloud terms | Google privacy policy |
| **Apple** | Prepared | App Store, TestFlight | Store metadata, crash (if enabled later) | US | Apple Developer agreement | Apple privacy |
| **Google Play** | Prepared | Play Console | Store metadata | US | Play Developer agreement | Google privacy |
| **Hosting** | TBD | Static web deploy | Access logs | TBD | Required | Provider policy |

### Not active (documented for future reference)

| Service | Status |
|---------|--------|
| Google Analytics | Not integrated |
| Firebase | Not integrated |
| Sentry | Not integrated |
| Resend / Mailgun | Not integrated |
| PostHog | Not integrated |
| Push notifications (FCM/APNs) | Not integrated |

---

## 10. Privacy policy structure

*Structure only — legal text to be drafted by qualified counsel.*

1. **Verantwortlicher** — Company name, address (when registered)
2. **Kontakt** — `privacy@<domain>.tld`, `support@<domain>.tld`
3. **Datenschutzbeauftragter** — If appointed
4. **Verarbeitete Daten** — Sections for app usage, admin, local storage
5. **Zweck** — Event discovery, favorites, notifications, admin operations
6. **Rechtsgrundlagen** — Art. 6 GDPR mapping
7. **Speicherdauer** — Link to retention policy
8. **Weitergabe** — Processors (Supabase, hosting)
9. **Drittanbieter** — Third-party table (§9)
10. **Cookies** — See §12; currently no analytics cookies
11. **Rechte der Nutzer** — Access, rectification, erasure, portability, objection, complaint
12. **Löschung** — App data clear; future account deletion process
13. **Auskunft** — Contact privacy@
14. **Berichtigung** — Contact support@
15. **Widerspruch** — Against legitimate interest processing
16. **Datenübertragbarkeit** — JSON export (future, when accounts exist)
17. **Beschwerderecht** — Supervisory authority (e.g. state DPA in Germany)
18. **Änderungen** — Version date, notification method

**URL:** `EXPO_PUBLIC_PRIVACY_URL` → `https://www.<domain>.tld/privacy`

---

## 11. Terms of service structure

See [terms.md](terms.md) for chapter outline. No legal text in this sprint.

---

## 12. Consent management concept

| Category | Purpose | Required? | Opt-in default | Revocable? |
|----------|---------|-----------|----------------|------------|
| **Erforderlich** | App function, security, admin auth | Yes | N/A (no choice) | No |
| **Funktional** | Local favorites, notifications | Implicit (use app) | On by use | Clear app data |
| **Statistik** | Usage analytics | No | **Off** | N/A (not implemented) |
| **Marketing** | Newsletters, ads | No | **Off** | N/A (not implemented) |

**Current state:** No consent banner needed — no analytics or marketing cookies/trackers. When analytics are added (future sprint), implement opt-in consent before activation.

**Privacy by default:** No tracking opt-ins, no marketing consent, no hidden data sharing.

---

## 13. Cookie concept (web)

| Cookie type | Current status | Examples |
|-------------|----------------|----------|
| **Session (required)** | Supabase Auth session storage (admin only) | Auth tokens in browser storage |
| **Preference** | None | — |
| **Analytics** | **Not implemented** | — |
| **Marketing** | **Not implemented** | — |

Service worker caches static assets only — not personal data. No cookie banner implemented in this sprint.

---

## 14. Privacy by design / default checklist

| Check | Status |
|-------|--------|
| No unnecessary data collection | ✓ |
| No consumer accounts (minimal PII) | ✓ |
| Local storage limited to app function | ✓ |
| No analytics by default | ✓ |
| RLS on all database tables | ✓ |
| Service role blocked from client | ✓ |
| Admin web-only on native | ✓ |
| Import log secret redaction | ✓ |
| No location permission | ✓ |
| Fixed privacy-friendly defaults | ✓ |

---

## 15. Account deletion concept

*For future user accounts — not implemented.*

```
User requests deletion (support@ or in-app)
  → Identity verification (email confirmation)
  → Grace period: 14 days (documented, configurable)
  → Hard delete: profile, favorites (if synced), settings
  → Anonymize: aggregated usage stats (if any)
  → Retain: legal obligations (invoices, audit logs per retention)
  → Completion notification + audit log entry
```

**Current state (no accounts):** Users clear app data on device to remove favorites/notifications.

| Data | Deletion method | Timing |
|------|-----------------|--------|
| Favorites (local) | App data clear / uninstall | Immediate |
| Notifications (local) | App data clear / in-app delete | Immediate |
| Admin account | Supabase Auth admin delete | On request |
| Import audit logs | Scheduled retention purge | Per policy |

---

## 16. Data export concept

*For future user accounts — not implemented.*

| Exportable data | Format | Auth | Delivery |
|-----------------|--------|------|----------|
| Profile | JSON | Authenticated session | Download link / email |
| Favorites | JSON, CSV optional | Authenticated | Same |
| Settings | JSON | Authenticated | Same |
| Notifications | JSON | Authenticated | Same |

**Current state:** Device-local data accessible via OS backup/export only; no cloud export endpoint.

---

## 17. Apple privacy manifest

| Field | Current value |
|-------|---------------|
| `NSPrivacyAccessedAPITypes` | `UserDefaults` / `CA92.1` (AsyncStorage) |
| `NSPrivacyCollectedDataTypes` | Empty |
| `NSPrivacyTracking` | `false` |
| `NSPrivacyTrackingDomains` | Empty |

**File:** `app.config.ts`, `ios/EternalRave/PrivacyInfo.xcprivacy`

**Missing for future:** Declare any additional Required Reason APIs if added (e.g. file timestamps).

---

## 18. App Store privacy labels (preparation)

| Data type | Collected | Linked to user | Used for tracking |
|-----------|-----------|----------------|-------------------|
| Contact info | No | — | No |
| Health/fitness | No | — | No |
| Financial info | No | — | No |
| Location | No | — | No |
| Sensitive info | No | — | No |
| Contacts | No | — | No |
| User content | No (local only) | — | No |
| Browsing history | No | — | No |
| Search history | No (not persisted) | — | No |
| Identifiers | No | — | No |
| Usage data | No | — | No |
| Diagnostics | No | — | No |
| Other (favorites local) | Device-local preferences | Not linked to identity | No |

---

## 19. Google Play Data Safety (preparation)

| Question | Answer |
|----------|--------|
| Data collected? | No personal data collected from users |
| Data shared? | No |
| Encrypted in transit? | Yes (TLS) |
| Users can request deletion? | Clear app data (no account); future: yes |
| Data types to declare | None currently; favorites are local-only |
| Security practices | RLS, no service role in client |

---

## 20. Privacy checklist

See [security-privacy.md](security-privacy.md) §10 for full checklist.

---

## Related documents

- [Terms structure](terms.md)
- [Legal / Impressum](legal.md)
- [Data retention](data-retention.md)
- [Security & privacy review](security-privacy.md)
- [Business setup](business-setup.md)
- [Domain & HTTPS](domain.md)
