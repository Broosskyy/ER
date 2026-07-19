# Email Infrastructure — Eternal Rave

**Sprint:** 12.7B  
**Status:** Preparation only — no accounts created, no DNS records published  
**Last updated:** July 2026

---

## 1. Recommended email structure

All addresses use the production domain: `*@<domain>.tld` (placeholder).

### Functional mailboxes

| Address | Purpose | Public? | Notes |
|---------|---------|---------|-------|
| `hello@<domain>.tld` | General inquiries | Yes | Primary public contact |
| `support@<domain>.tld` | User support | Yes | App Store / Play Store support email |
| `events@<domain>.tld` | Event submissions / corrections | Yes | Organizer-facing |
| `partners@<domain>.tld` | Business partnerships | Yes | Venues, promoters, sponsors |
| `privacy@<domain>.tld` | GDPR / data protection | Yes | Required for privacy policy |
| `legal@<domain>.tld` | Legal notices | Internal + selective | Terms, contracts |
| `security@<domain>.tld` | Security reports | Yes | Vulnerability disclosure |
| `press@<domain>.tld` | Media inquiries | Yes | Press kit requests |
| `jobs@<domain>.tld` | Hiring | Optional | Forward to hello@ until hiring |
| `noreply@<domain>.tld` | Transactional (future) | No reply | System emails only; no inbox |
| `admin@<domain>.tld` | Internal operations | **No** | Never publish; dev mock uses `admin@eternalrave.app` locally only |

### Personal / team addresses

| Pattern | Example | Notes |
|---------|---------|-------|
| `vorname@<domain>.tld` | `max@<domain>.tld` | Founders, core team |
| `vorname.nachname@<domain>.tld` | `max.mustermann@<domain>.tld` | Alternative convention |

**Rules:**
- No personal Gmail/Outlook for official business communication
- Shared mailboxes (support@, hello@) can be Google Groups or aliases
- `noreply@` must not accept replies (or auto-reply with support@)

---

## 2. Mail provider comparison

### Recommendation: **Google Workspace** (Business Starter)

Best balance of reliability, deliverability, admin controls, and ecosystem integration for a small product team launching in DACH + international.

| Provider | Cost (approx.) | Pros | Cons |
|----------|----------------|------|------|
| **Google Workspace** | ~€6–7/user/mo | Excellent deliverability, Gmail UI, Groups, 2FA, mobile | Google account dependency |
| Microsoft 365 Business Basic | ~€5.60/user/mo | Outlook, Teams, Office | Heavier admin for small teams |
| Proton Mail Business | ~€6.99/user/mo | Privacy-focused, E2E option | Fewer integrations, learning curve |
| IONOS Mail | ~€1–4/mailbox/mo | Cheap, German host | Weaker deliverability reputation |
| All-Inkl | ~€1/mailbox/mo | Very cheap DE hosting | Not ideal as primary business mail |

### Why Google Workspace for Eternal Rave

1. **Deliverability** — critical for support@ reaching users
2. **SPF/DKIM/DMARC** — straightforward setup with included guides
3. **Groups** — support@, hello@ as shared inboxes without extra licenses
4. **2FA / admin console** — meets security baseline
5. **Calendar / Drive** — useful for ops without extra tools

### Migration path (when ready)

1. Register domain
2. Verify domain in Google Admin
3. Add MX records (see [domain.md](domain.md))
4. Configure SPF, DKIM, DMARC
5. Create user accounts + group aliases
6. Set `support@` and `privacy@` in store listings
7. Update `.env` placeholders → production values

**No accounts created in this sprint.**

---

## 3. SPF (Sender Policy Framework)

### Purpose

SPF tells receiving mail servers which hosts are allowed to send email claiming to be from `@<domain>.tld`. Without SPF, messages are more likely to land in spam.

### Example structure (placeholder)

```
TXT @ "v=spf1 include:_spf.google.com ~all"
```

| Mechanism | Meaning |
|-----------|---------|
| `v=spf1` | SPF version 1 |
| `include:_spf.google.com` | Authorize Google Workspace servers |
| `~all` | Soft fail for others (use during setup) |
| `-all` | Hard fail (switch after validation) |

### Best practices

- **One SPF TXT record per domain** — merge all includes into a single record
- Keep record under **255 characters per string** (split if needed)
- Add includes only for services that actually send mail:
  - Google Workspace (transactional)
  - Future: SendGrid/Resend/Postmark if transactional API added
- Test with `dig TXT <domain>.tld` and online SPF checkers
- Move from `~all` to `-all` after 2–4 weeks of monitoring

### Common includes (add only when used)

| Service | Include |
|---------|---------|
| Google Workspace | `include:_spf.google.com` |
| SendGrid | `include:sendgrid.net` |
| Amazon SES | `include:amazonses.com` |

---

## 4. DKIM (DomainKeys Identified Mail)

### Purpose

DKIM cryptographically signs outbound messages so receivers can verify they were not altered in transit.

### Setup (Google Workspace example)

1. Admin Console → Apps → Google Workspace → Gmail → Authenticate email
2. Generate DKIM key (2048-bit recommended)
3. Add TXT record at provider-specified selector, e.g.:

```
google._domainkey.<domain>.tld.  TXT  "v=DKIM1; k=rsa; p=<PUBLIC_KEY_PLACEHOLDER>"
```

### Key management

| Practice | Recommendation |
|----------|----------------|
| Key length | 2048-bit RSA |
| Rotation | Every 6–12 months or on provider prompt |
| Selectors | Use provider default (`google`, `selector1` for M365) |
| Storage | Private key stays with mail provider — never commit to repo |

### Verification

- Send test email → check headers for `dkim=pass`
- Use [mail-tester.com](https://www.mail-tester.com) during setup (manual)

**No real keys generated in this sprint.**

---

## 5. DMARC (Domain-based Message Authentication)

### Purpose

DMARC tells receivers what to do when SPF/DKIM fail, and where to send aggregate reports.

### Recommended rollout

| Phase | Policy | Duration |
|-------|--------|----------|
| 1 — Monitor | `p=none` | 2–4 weeks |
| 2 — Quarantine | `p=quarantine; pct=25` → `pct=100` | 2 weeks |
| 3 — Reject | `p=reject` | Production steady state |

### Example records (placeholder)

**Phase 1 — monitoring only:**

```
_dmarc.<domain>.tld.  TXT  "v=DMARC1; p=none; rua=mailto:dmarc-reports@<domain>.tld; ruf=mailto:dmarc-forensic@<domain>.tld; fo=1"
```

**Phase 3 — production:**

```
_dmarc.<domain>.tld.  TXT  "v=DMARC1; p=reject; rua=mailto:dmarc-reports@<domain>.tld; adkim=s; aspf=s"
```

### Reporting & monitoring

| Report type | Address | Purpose |
|-------------|---------|---------|
| Aggregate (rua) | `dmarc-reports@<domain>.tld` or external service | Daily XML summaries |
| Forensic (ruf) | Optional | Per-failure detail (privacy-sensitive) |

Consider a DMARC report parser (dmarcian, Postmark, EasyDMARC) once volume grows.

**No production DMARC policy activated in this sprint.**

---

## 6. Support & contact structure

| Contact type | Channel | Owner (assign manually) |
|--------------|---------|-------------------------|
| User support | `support@<domain>.tld` | Product / ops |
| Privacy / GDPR | `privacy@<domain>.tld` | Legal / DPO |
| Press | `press@<domain>.tld` | Marketing |
| Partners | `partners@<domain>.tld` | Business dev |
| General business | `hello@<domain>.tld` | Founders |
| Technical / security | `security@<domain>.tld` | Engineering |

**No phone numbers documented** — add only when a real number exists.

### Store listing requirements

| Store | Required email |
|-------|----------------|
| Apple App Store Connect | Support URL + support email |
| Google Play Console | Support email + privacy policy URL |

Use `support@<domain>.tld` for both.

---

## 7. Contact page structure (content templates — not final copy)

Prepare these pages on `www.<domain>.tld` before public launch:

| Page | Path | Sections |
|------|------|----------|
| Support | `/support` | FAQ links, contact form or mailto support@, response time expectation |
| Contact | `/contact` | hello@, partners@, press@ |
| Privacy contact | `/privacy#contact` | privacy@, DPO info, data subject rights |
| Press | `/press` | press@, media kit placeholder |
| Business | `/business` | partners@, events@ |

**No final legal text in this sprint** — structure only.

---

## 8. Manual to-do list

- [ ] Choose mail provider (recommended: Google Workspace)
- [ ] Verify domain with provider
- [ ] Create MX, SPF, DKIM, DMARC records
- [ ] Create mailboxes and group aliases
- [ ] Send test emails; verify SPF/DKIM/DMARC pass
- [ ] Set support@ in App Store Connect and Play Console
- [ ] Publish privacy policy with privacy@ contact
- [ ] Add `EXPO_PUBLIC_SUPPORT_EMAIL` to production env (when ready)

---

## Related docs

- [Domain & DNS](domain.md)
- [Business setup](business-setup.md)
- [Brand guidelines](brand.md)
