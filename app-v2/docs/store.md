# Store Listings & Assets — Eternal Rave

**Sprint:** 12.7E  
**Status:** Structure prepared — no store submission, no final marketing copy  
**Last updated:** July 2026

---

## 1. App identifiers

| Field | Value |
|-------|-------|
| App name | Eternal Rave |
| Bundle ID (iOS) | `com.eternalrave.app` |
| Package name (Android) | `com.eternalrave.app` |
| SKU (Apple) | `eternal-rave` (suggested) |
| Version | `0.2.0` |
| iOS build number | EAS auto-increment / env override |
| Android versionCode | `5` |

---

## 2. Store listing structure

### Apple App Store Connect

| Field | Limit | Draft content | Status |
|-------|-------|---------------|--------|
| Name | 30 chars | Eternal Rave | Ready |
| Subtitle | 30 chars | Discover electronic events | Draft |
| Promotional text | 170 chars | (optional, update without review) | Empty |
| Description | 4000 chars | See §3 structure | Draft |
| Keywords | 100 chars | rave,techno,events,electronic,festival,club,köln | Draft |
| Support URL | HTTPS required | `https://www.<domain>.tld/support` | **Not hosted** |
| Marketing URL | Optional | `https://www.<domain>.tld` | **Not hosted** |
| Privacy Policy URL | Required | `https://www.<domain>.tld/privacy` | **Not hosted** |
| Primary category | — | Entertainment | Ready |
| Secondary category | — | Music | Ready |
| Age rating | — | 4+ / Everyone (no mature content) | Pending questionnaire |
| Copyright | — | © 2026 Eternal Rave | Pending entity |
| Price | — | Free | Ready |

### Google Play Console

| Field | Limit | Draft content | Status |
|-------|-------|---------------|--------|
| App name | 30 chars | Eternal Rave | Ready |
| Short description | 80 chars | Discover electronic music events near you. | Draft |
| Full description | 4000 chars | See §3 structure | Draft |
| Category | — | Events (or Music & Audio) | Draft |
| Contact email | — | `support@<domain>.tld` | **Not active** |
| Privacy policy URL | Required | `https://www.<domain>.tld/privacy` | **Not hosted** |
| Website | Optional | `https://www.<domain>.tld` | **Not hosted** |
| Content rating | — | IARC questionnaire | Pending |
| Data safety form | — | See privacy.md | Pending |
| Target audience | — | Not designed for children | Ready |
| Price | — | Free | Ready |

---

## 3. Description structure (not final copy)

### Short description (Play / subtitle concept)

- What: Event discovery for electronic music
- Where: Near you (DACH focus)
- How: Browse, save, get local notifications
- No account required

### Full description sections

1. **Intro** — What Eternal Rave is
2. **Features** — Browse events, collections, search, favorites, notifications
3. **For whom** — Ravers, festival-goers, club visitors
4. **Privacy** — Local favorites, no account, link to privacy policy
5. **Disclaimer** — Not an organizer; verify event details with venues
6. **Support** — Contact support@

**Language:** German primary for DE store; English optional for international.

---

## 4. Screenshots plan

**No final screenshots produced in this sprint.** Capture from production-like build with real or demo data.

### Apple App Store

| Device | Size (portrait) | Count | Content order |
|--------|-----------------|-------|---------------|
| iPhone 6.7" (15 Pro Max) | 1290×2796 | 5–10 | Home → Event detail → Search → Saved → Notifications |
| iPhone 6.5" (11 Pro Max) | 1242×2688 | 5–10 | Same set |
| iPhone 5.5" (8 Plus) | 1242×2208 | 5–10 | Same set (optional) |
| iPad Pro 12.9" | 2048×2732 | 5–10 | Optional (tablet disabled in app — may skip) |

Format: PNG or JPEG, no alpha, no device frame required (Apple adds frames).

### Google Play

| Type | Size | Count | Notes |
|------|------|-------|-------|
| Phone | 1080×1920 min | 4–8 | Same narrative as iOS |
| 7" tablet | 1200×1920 | Optional | App is phone-only UI |
| 10" tablet | 1600×2560 | Optional | Skip if not optimized |

### Web (marketing / PWA)

| Use | Size | Notes |
|-----|------|-------|
| Landing page | 1440×900 | Browser frame optional |
| PWA install promo | 1280×720 | For future marketing |

### Screenshot content guidelines

- Dark theme (`#0B0B0F` background)
- Show real UI, no lorem ipsum
- German UI text (current default)
- No misleading features (no map if placeholder)
- Include status bar; use 9:41 time for iOS convention
- Brand purple accent visible

---

## 5. App icons audit

| Asset | Path | Size | Format | Status |
|-------|------|------|--------|--------|
| iOS App Store | `assets/images/icon.png` | 1024×1024 | PNG RGB, no alpha | ✓ PASS |
| Android adaptive foreground | `assets/images/android-icon-foreground.png` | 1024×1024 | PNG | ✓ PASS |
| Android adaptive background | `assets/images/android-icon-background.png` | 1024×1024 | `#0B0B0F` | ✓ PASS |
| Android monochrome | `assets/images/android-icon-monochrome.png` | 1024×1024 | Grayscale | ✓ PASS |
| Play Store listing | Derive from icon.png | 512×512 | PNG | Ready to export |
| Web favicon | `assets/images/favicon.png` | 48×48 | PNG | ✓ PASS |
| PWA 192 | `public/pwa/icon-192.png` | 192×192 | PNG | ✓ PASS |
| PWA 512 | `public/pwa/icon-512.png` | 512×512 | PNG | ✓ PASS |
| PWA maskable | `public/pwa/icon-maskable-512.png` | 512×512 | PNG | ✓ PASS |
| Apple touch (web) | `public/pwa/apple-touch-icon.png` | 180×180 | PNG | ✓ PASS |

**Safe area:** Icon fills square; no text in icon asset.

---

## 6. Feature graphic (Google Play)

| Property | Requirement |
|----------|-------------|
| Dimensions | **1024×500 px** |
| Format | PNG or JPEG |
| File size | Max 15 MB |

### Design brief (not produced)

- Background: `#0B0B0F`
- App icon left third
- Title: "Eternal Rave" in white
- Tagline: "Discover. Connect. Rave." in `#9CA3AF`
- Accent: `#7C3AED` gradient or line element
- No small text (illegible on mobile store)
- No event photos (licensing risk)

**Status:** Not created — use brand guidelines from [brand.md](brand.md).

---

## 7. App preview video (future)

### Apple App Preview

| Property | Value |
|----------|-------|
| Length | 15–30 seconds |
| Resolution | Match device screenshot sizes |
| Format | H.264, .mov or .mp4 |
| Content | Home → tap event → save → notification |

### Google Promo video

| Property | Value |
|----------|-------|
| Source | YouTube URL |
| Length | 30 seconds – 2 minutes |
| Content | Same storyline as Apple |

**Status:** Documented only — no video produced.

---

## 8. Release notes structure

```markdown
## Eternal Rave {version} (Beta)

### New
- [Feature bullet]

### Improvements
- [Improvement bullet]

### Fixes
- [Fix bullet]

### Known issues
- [Issue + workaround]

### Privacy
- [Any privacy-related changes]

### Compatibility
- Android {min SDK} / iOS 15.1+
- Requires network for event data
```

### Beta release notes template (0.2.0)

```
Eternal Rave 0.2.0 (Beta)

- Browse electronic music events
- Save favorites locally on your device
- Local notification center for saved event updates
- Search and filter by genre, city, date
- Web app installable as PWA
- Admin tools available on web only

Known: Map tab shows placeholder. Favorites are not synced across devices.
```

---

## 9. Support & privacy links

| Link | URL | HTTPS | Hosted |
|------|-----|-------|--------|
| Support | `https://www.<domain>.tld/support` | Required | No |
| Privacy | `https://www.<domain>.tld/privacy` | Required | No |
| Terms | `https://www.<domain>.tld/terms` | Recommended | No |
| Impressum | `https://www.<domain>.tld/impressum` | Required (DE) | No |
| Marketing | `https://www.<domain>.tld` | Optional | No |

Env vars: `EXPO_PUBLIC_SUPPORT_URL`, `EXPO_PUBLIC_PRIVACY_URL`, `EXPO_PUBLIC_TERMS_URL`

**Blocker for store submission:** Privacy policy and support URL must be live.

---

## 10. App Review information (Apple)

| Field | Value |
|-------|-------|
| Sign-in required | No (public app) |
| Demo account | Not required — no consumer login |
| Admin access | Web-only at `/admin` — note in review notes |
| Notes | "Public read-only event discovery. No user registration. Admin panel is web-only and not part of the iOS app review scope." |
| Encryption | Standard — exempt (`ITSAppUsesNonExemptEncryption: false`) |
| IDFA / tracking | No tracking |

---

## 11. Data Safety (Google Play)

| Data type | Collected | Shared | Purpose |
|-----------|-----------|--------|---------|
| Personal info | No | No | — |
| Financial info | No | No | — |
| Location | No | No | — |
| App activity | Optional (analytics, with consent) | No | Analytics |
| Device IDs | No | No | — |
| Crash logs | No (no SDK) | No | — |

Declare local favorites as not collected (device-only, not transmitted).

---

## Related documents

- [Beta program](beta.md)
- [Release management](release.md)
- [Launch checklist](launch-checklist.md)
- [iOS build](ios-build.md)
- [Privacy](privacy.md)
- [Brand guidelines](brand.md)
