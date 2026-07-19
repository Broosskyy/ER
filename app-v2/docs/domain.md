# Domain Strategy — Eternal Rave

**Sprint:** 12.7B  
**Status:** Preparation only — no domains registered, no DNS configured  
**Last updated:** July 2026

---

## 1. Recommended domain strategy

### Primary domain

Use **`www.<domain>.tld`** as the canonical public web origin.

| Role | URL pattern | Purpose |
|------|-------------|---------|
| Public app (web/PWA) | `https://www.<domain>.tld/` | Main product, event discovery, installable PWA |
| Admin area | `https://www.<domain>.tld/admin` | Protected admin UI (web-only) |
| API / backend | Supabase hosted URL | No custom API subdomain required at launch |

**Do not create a separate admin subdomain** (e.g. `admin.<domain>.tld`) unless a future requirement demands isolation (separate cookies, WAF rules, or compliance). The current Expo Router setup serves admin at `/admin` on the same origin.

### Root domain handling

| Record | Target | Notes |
|--------|--------|-------|
| `www.<domain>.tld` | Hosting provider (Vercel, Netlify, Cloudflare Pages, etc.) | **Canonical** — set `EXPO_PUBLIC_WEB_BASE_URL` to this |
| `<domain>.tld` (apex) | Redirect → `www` | 301 permanent redirect; avoids duplicate content |

### Subdomains — keep minimal

Only add subdomains when there is a clear technical need. Recommended launch set:

| Subdomain | Needed at launch? | Purpose |
|-----------|-------------------|---------|
| `www` | **Yes** | Public app |
| `staging` | Optional | Preview/staging (`EXPO_PUBLIC_WEB_NOINDEX=true`) |
| `api` | No | Supabase handles API |
| `cdn` | No | Use host/CDN defaults unless traffic requires it |
| `mail` | No | Use provider MX on apex/www |

### Deep linking & mobile

| Platform | Mechanism | Config |
|----------|-----------|--------|
| iOS Universal Links | `https://www.<domain>.tld/event/<id>` | `EXPO_PUBLIC_IOS_ASSOCIATED_DOMAIN` + hosted `apple-app-site-association` |
| Android App Links | Same HTTPS paths | `assetlinks.json` on domain (future sprint) |
| Custom scheme | `eternal-rave://` | Already configured in `app.config.ts` |

---

## 2. Domain registration (manual — not performed)

### Recommended TLD priority

| TLD | Priority | Notes |
|-----|----------|-------|
| `.com` | Primary | Global recognition, App Store / Play Store default |
| `.de` | High (DACH) | German market, Impressum expectations |
| `.app` | Medium | HTTPS-preloaded TLD; aligns with bundle ID `com.eternalrave.app` |
| `.io` | Medium | Common for tech products; less ideal for consumer brand |
| `.music` | Optional | Niche branding; higher cost, limited registrar support |

### Recommended registrars

| Registrar | Best for | Notes |
|-----------|----------|-------|
| Cloudflare Registrar | Cost + DNS integration | At-cost pricing, pairs with Cloudflare DNS |
| Namecheap | Simple registration | Good WHOIS privacy, easy transfers |
| INWX | EU / `.de` domains | German support, local payment |
| Google Domains → Squarespace | If already in Google ecosystem | Check current Squarespace migration status |

### Registration checklist

- [ ] Enable **auto-renewal**
- [ ] Enable **WHOIS / RDAP privacy**
- [ ] Enable **registrar 2FA**
- [ ] Use a **dedicated billing contact** (not personal Gmail)
- [ ] Document registrar login in password manager (team vault)
- [ ] Register primary + defensive variants if budget allows (`.de`, `.app`)
- [ ] Set domain lock after DNS is stable

**Do not register domains in this sprint.** Document decisions and execute manually.

---

## 3. DNS concept

All values below are **placeholders**. Replace `<domain>.tld` with the chosen production domain.

### A / AAAA records (apex)

Used when the apex domain must resolve directly (before redirect) or when the host requires apex A records.

```
<domain>.tld.     A      <HOSTING_IPV4>          ; TTL 300 (during setup), 3600 (stable)
<domain>.tld.     AAAA   <HOSTING_IPV6>          ; if host supports IPv6
```

### CNAME records

```
www.<domain>.tld.   CNAME   <hosting-target>.<provider>.com.
staging.<domain>.tld. CNAME <staging-target>.<provider>.com.   ; optional
```

**Note:** CNAME cannot exist on apex at most DNS providers — use ALIAS/ANAME or redirect service for apex.

### MX records (email)

Point to your mail provider. Example structure (Google Workspace):

```
<domain>.tld.   MX   1   ASPMX.L.GOOGLE.COM.
<domain>.tld.   MX   5   ALT1.ASPMX.L.GOOGLE.COM.
<domain>.tld.   MX   5   ALT2.ASPMX.L.GOOGLE.COM.
<domain>.tld.   MX   10  ALT3.ASPMX.L.GOOGLE.COM.
<domain>.tld.   MX   10  ALT4.ASPMX.L.GOOGLE.COM.
```

### TXT records

| Type | Name | Example value (placeholder) | Purpose |
|------|------|----------------------------|---------|
| SPF | `@` | `v=spf1 include:_spf.google.com ~all` | Authorize sending servers |
| DMARC | `_dmarc` | `v=DMARC1; p=none; rua=mailto:dmarc-reports@<domain>.tld` | Email authentication policy |
| DKIM | `google._domainkey` (provider-specific) | `v=DKIM1; k=rsa; p=<PUBLIC_KEY>` | Outbound signing |
| Domain verification | `@` or provider-specific | `google-site-verification=<TOKEN>` | Google Workspace / Search (later) |
| Apple | `@` or `_apple-domain` | Per Apple instructions | Universal Links / Developer |
| Expo / EAS | per Expo docs | verification token | Optional EAS domain linking |

### Verification records (store / services)

| Service | Record type | When |
|---------|-------------|------|
| Apple Developer | TXT or file at `/.well-known/` | Universal Links, domain association |
| Google Play | — | Uses support URL, not DNS |
| Supabase | CNAME or TXT | Custom domain for Supabase (optional, later) |

### TTL recommendations

| Phase | TTL | Reason |
|-------|-----|--------|
| Initial setup / migration | 300 s (5 min) | Fast rollback during cutover |
| Stable production | 3600 s (1 h) | Balance cache vs. flexibility |
| Rarely changed (SPF/DMARC) | 3600–86400 s | Longer cache acceptable |

---

## 4. HTTPS

### Requirements

- **HTTPS only** for all public endpoints (`www`, staging)
- Apex → `www` redirect must also use HTTPS (301)
- No mixed content in web app (all assets/APIs over TLS)

### Certificate management

| Approach | Recommendation |
|----------|----------------|
| Hosting provider (Vercel, Netlify, Cloudflare Pages) | **Preferred** — automatic Let's Encrypt, auto-renewal |
| Cloudflare proxy (orange cloud) | Universal SSL edge cert + origin cert or Full (Strict) |
| Manual cert | Avoid unless required |

### TLS settings (if using Cloudflare or reverse proxy)

- Minimum TLS **1.2** (prefer 1.3)
- Enable **HSTS** after confirming HTTPS works everywhere:

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

- Enable HSTS preload only after 90+ days of stable HTTPS on all subdomains

### Well-known files (host on `www`)

| Path | Purpose |
|------|---------|
| `/.well-known/apple-app-site-association` | iOS Universal Links |
| `/.well-known/assetlinks.json` | Android App Links (future) |
| `/privacy` | Privacy policy (required for stores) |
| `/terms` | Terms of service |
| `/impressum` | Legal notice (DE market) |

---

## 5. Cloudflare evaluation

### Pros

| Benefit | Relevance to Eternal Rave |
|---------|---------------------------|
| DNS at cost + fast propagation | Good for multi-service setup |
| Free SSL + DDoS protection | Protects public web/PWA |
| WAF / Bot Fight Mode | Reduces scraping abuse on event data |
| Page Rules / Cache Rules | Static web export benefits from edge cache |
| Polish (image optimization) | Event poster images could load faster |
| Registrar integration | Single pane for domain + DNS |

### Cons

| Drawback | Notes |
|----------|-------|
| Proxy adds complexity | Debugging cache issues, origin SSL mode |
| Free tier limits | Advanced WAF rules need paid plan |
| Vendor lock-in for DNS | Export zone file before migration |
| Expo/EAS builds unaffected | Cloudflare only fronts web, not native builds |

### Recommendation

**Use Cloudflare for DNS + optional proxy on `www` and `staging`** once the production domain is registered. Start with:

1. DNS only (grey cloud) during initial hosting setup
2. Enable proxy (orange cloud) after HTTPS verified
3. Cache static assets aggressively; bypass cache for `/admin/*`
4. Enable Bot Fight Mode on production

**No active Cloudflare configuration in this sprint.**

---

## 6. Environment variables

Set after domain registration (placeholders in `.env.example`):

| Variable | Example placeholder | Used by |
|----------|---------------------|---------|
| `EXPO_PUBLIC_WEB_BASE_URL` | `https://www.<domain>.tld` | OG tags, router origin, canonical URLs |
| `EXPO_PUBLIC_IOS_ASSOCIATED_DOMAIN` | `https://www.<domain>.tld` | iOS Universal Links |
| `EXPO_PUBLIC_WEB_NOINDEX` | `true` on staging only | Robots meta |
| `EXPO_PUBLIC_SUPPORT_URL` | `https://www.<domain>.tld/support` | Store listings, footer (future) |
| `EXPO_PUBLIC_PRIVACY_URL` | `https://www.<domain>.tld/privacy` | Store listings, legal |
| `EXPO_PUBLIC_TERMS_URL` | `https://www.<domain>.tld/terms` | Legal |
| `EXPO_PUBLIC_MARKETING_URL` | `https://www.<domain>.tld` | App Store marketing URL |

Admin URL is derived: `{EXPO_PUBLIC_WEB_BASE_URL}/admin` — no separate env var needed.

---

## 7. Manual to-do list

- [ ] Choose and register primary domain
- [ ] Configure DNS (apex redirect, www CNAME/A)
- [ ] Point `EXPO_PUBLIC_WEB_BASE_URL` to production `www`
- [ ] Deploy web build to hosting
- [ ] Verify HTTPS + HSTS
- [ ] Host `apple-app-site-association` for Universal Links
- [ ] Create staging subdomain with `EXPO_PUBLIC_WEB_NOINDEX=true`
- [ ] Document final DNS zone in team password manager

---

## Related docs

- [Email setup](email.md)
- [Business setup](business-setup.md)
- [iOS build & Universal Links](ios-build.md)
- [Web deployment](web-deployment.md)
