# Analytics — Eternal Rave

**Sprint:** 12.7D  
**Status:** Prepared — GA4 loads only after explicit user consent  
**Last updated:** July 2026

---

## 1. Goals

| Goal | Method |
|------|--------|
| Understand usage patterns | Aggregated page views and events |
| Detect errors | `error` event (future wiring) |
| Measure performance | Core Web Vitals via Search Console / Lighthouse |
| Identify popular content | `event_opened`, `search_completed` |
| Technical issues | Offline/online events |

**Not in scope:** Marketing profiles, remarketing, cross-site tracking, PII collection.

---

## 2. Architecture

```
Web user visits site
  → AnalyticsProvider mounts
  → Consent Mode V2 defaults: all denied
  → If no saved consent → show CookieConsentBanner
  → User accepts analytics
  → consent saved to localStorage
  → gtag consent update (analytics_storage: granted)
  → GA4 script loaded (if EXPO_PUBLIC_ANALYTICS_ENABLED=true)
  → page_view on route changes
```

**Native (Android/iOS):** No analytics SDK — web only.

### Key files

| File | Purpose |
|------|---------|
| `src/platform/analytics/AnalyticsProvider.tsx` | Consent UI + GA4 lifecycle |
| `src/platform/analytics/ga4-client.ts` | gtag.js loader, Consent Mode |
| `src/platform/analytics/consent-storage.ts` | Persist consent in localStorage |
| `src/platform/analytics/consent-types.ts` | Consent categories + GA mapping |
| `src/platform/analytics/analytics-events.ts` | Event catalog |
| `src/platform/analytics/track-event.ts` | Safe event dispatch |

---

## 3. Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `EXPO_PUBLIC_ANALYTICS_ENABLED` | Yes (to activate) | Must be `true` to show consent banner and enable GA4 |
| `EXPO_PUBLIC_GA4_MEASUREMENT_ID` | Yes (when enabled) | Format `G-XXXXXXXXXX` |
| `EXPO_PUBLIC_GA4_DEBUG` | No | Enables GA4 debug mode |
| `EXPO_PUBLIC_GOOGLE_SITE_VERIFICATION` | No | Search Console HTML meta verification |

**Default:** Analytics disabled until env vars set and user consents.

---

## 4. Google Analytics 4

### Initialization

1. `setDefaultGtagConsent()` — deny all storage types
2. User accepts → `loadGa4Script(measurementId)`
3. `gtag('config', id, { anonymize_ip: true, send_page_view: false })`
4. Manual `page_view` on Expo Router pathname change

### Data collected (with consent)

| Data | Collected | Notes |
|------|-----------|-------|
| Page path / title | Yes | No PII in names |
| Event parameters | Yes | IDs only (event_id), no emails |
| IP address | Anonymized | `anonymize_ip: true` |
| User ID | No | No accounts |
| Device fingerprint | GA default | Minimized via Consent Mode |

### Not collected

- Email, name, phone
- Precise location
- Favorites content tied to identity
- Admin credentials

---

## 5. Consent Mode V2

| Parameter | Default | After analytics opt-in | Marketing |
|-----------|---------|------------------------|-----------|
| `analytics_storage` | denied | granted | denied |
| `ad_storage` | denied | denied | denied |
| `ad_user_data` | denied | denied | denied |
| `ad_personalization` | denied | denied | denied |

### User flows

| Flow | Behavior |
|------|----------|
| New user | Banner shown; GA4 not loaded until accept |
| Returning user (accepted) | Consent restored; GA4 loads automatically |
| Returning user (rejected) | No banner; GA4 never loads |
| Revoke | Clear consent → analytics denied (future: in-app settings) |

---

## 6. Tag Management (GTM)

**Recommendation:** Do **not** use Google Tag Manager at launch.

| Pros | Cons |
|------|------|
| Flexible tag deployment | Additional script weight |
| Non-dev tag changes | Harder GDPR audit trail |
| | Third-party tag risk |

Use direct gtag.js integration. Revisit GTM if marketing tags are needed later.

---

## 7. Event catalog

### Standard events

| Event | Trigger | Consent |
|-------|---------|---------|
| `page_view` | Route change | Required |
| `session_start` | First page in session | Required |
| `session_end` | Tab close (future) | Required |
| `app_open` | PWA launch | Required |
| `404_page` | Not found route | Required |
| `offline_mode` | Network offline | Required |
| `online_mode` | Network restored | Required |

### Custom events

| Event | Trigger | Data |
|-------|---------|------|
| `event_opened` | Event detail view | `event_id` |
| `event_favorited` | Save favorite | `event_id` |
| `event_unfavorited` | Remove favorite | `event_id` |
| `search_started` | Search submit | — |
| `search_completed` | Results shown | `result_count` |
| `admin_login` | Admin auth success | — (no PII) |

### Conversion events (product)

| Event | Purpose |
|-------|---------|
| `favorite_saved` | Engagement conversion |
| `pwa_installed` | Install conversion |
| `app_opened` | Return visit |

Full definitions: `src/platform/analytics/analytics-events.ts`

---

## 8. Privacy measures

- Consent required before any GA4 script load
- IP anonymization enabled
- No user IDs sent
- No marketing/ad tags
- Consent stored locally (`@eternal_rave/analytics_consent_v1`)
- Compatible with Sprint 12.7C privacy architecture
- Update privacy policy before enabling in production

---

## 9. Known limitations

- Event tracking helpers defined but not wired to all UI actions yet
- No in-app consent revocation UI (only reject on first visit)
- No server-side GA4 Measurement Protocol
- Native apps excluded from analytics
- Lighthouse/GA debug requires manual browser testing

---

## 10. Future event catalog (ER-005.4 — not wired)

Planned analytics events for upcoming platform capabilities. **Do not implement without consent review.**

| Event | Purpose | Data fields |
|-------|---------|-------------|
| `contributor_draft_saved` | Contributor funnel | none (aggregate) |
| `contributor_event_submitted` | Submission completion | none |
| `ticket_cta_clicked` | Ticket intent | `event_id` |
| `organizer_profile_viewed` | Organizer discovery | `organizer_id` |
| `content_engagement` | Community actions | `content_type`, `action` (no PII) |

See `app-v2/docs/PLATFORM_ARCHITECTURE_FOUNDATION.md` §3.8 for strategy.

---

## Related docs

- [Privacy architecture](privacy.md)
- [SEO](seo.md)
- [Search Console](search-console.md)
