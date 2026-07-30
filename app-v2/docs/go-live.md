# Go-Live — Eternal Rave

**Sprint:** 12.7F  
**Status:** Production readiness gate — no go-live performed  
**Last updated:** July 2026

---

## 1. Release gate

A production release may proceed **only when all criteria below are met**.

### Gate criteria

| # | Criterion | Required | Verified by |
|---|-----------|----------|-------------|
| G1 | Zero P0 (crash/data loss) bugs | Yes | QA lead |
| G2 | Zero P1 (broken core flow) bugs | Yes | QA lead |
| G3 | Privacy policy live (HTTPS) | Yes | Privacy owner |
| G4 | Support URL live (HTTPS) | Yes | Operations |
| G5 | Impressum live (DE market) | Yes | Legal |
| G6 | Security review sign-off | Yes | Security owner |
| G7 | `release:check` PASS | Yes | Engineering |
| G8 | Regression on Android, iOS, Web | Yes | QA |
| G9 | Store compliance (ASC + Play forms) | Yes | Operations |
| G10 | Rollback plan documented & tested | Yes | Engineering |
| G11 | Monitoring baseline active | Yes | Operations |
| G12 | On-call / support contact defined | Yes | Operations |
| G13 | Backup + restore procedure documented | Yes | Operations |
| G14 | EAS production builds successful | Yes | Engineering |
| G15 | Documentation complete | Yes | Engineering |

**Any failed required criterion = NO-GO.**

---

## 2. Go / No-Go process

### Timeline

```
T-7 days:  RC build cut, internal soak test begins
T-3 days:  Go/No-Go pre-meeting, open risks reviewed
T-1 day:   Final sign-offs collected
T-0:       Go decision → store submission / web deploy
T+1 day:   Post-launch smoke test + monitoring review
T+7 days:  Retrospective
```

### Sign-off matrix

| Gate | Responsible | Criteria checklist | Status | Date | Decision |
|------|-------------|-------------------|--------|------|----------|
| **Technical** | Engineering lead | G7, G8, G14, rollback tested | ☐ Pending | | |
| **Privacy / GDPR** | Privacy owner | G3, G5, consent, DPA signed | ☐ Pending | | |
| **Security** | Security owner | G6, secrets scan, RLS audit | ☐ Pending | | |
| **QA** | QA lead | G1, G2, smoke tests, device matrix | ☐ Pending | | |
| **Performance** | Engineering | Acceptable CWV, no regressions | ☐ Pending | | |
| **Store compliance** | Operations | G9, listings, screenshots, data safety | ☐ Pending | | |
| **Operations** | Operations lead | G10–G13, monitoring, backups | ☐ Pending | | |
| **Production go-live** | Product owner | All above APPROVED | ☐ Pending | | |

**Decision values:** APPROVED | APPROVED WITH CONDITIONS | REJECTED

### No-Go triggers (automatic)

- P0 bug discovered in RC build
- Privacy policy URL returns 404
- Service role key found in client bundle
- RLS bypass discovered
- Store rejection with blocking issue unresolved

---

## 3. Production checklist

### Source onboarding (Sprint 33.2)

- [x] Migration `20260765000000` + `20260766000000` applied
- [x] `source_onboarding_jobs` persistent (service-role grants)
- [x] Live onboarding validation (`_sprint331-onboarding-validation.ts`)
- [x] Origin backfill complete (`event_origins` type)
- [x] SSRF / redirect validation (no regression)
- [x] Tag `source-onboarding-foundation-ready`

### Ticket platform imports (Sprint 33.3)

- [x] `source-bootshaus-ticket-io` live import (17 events, 10 duplicate matches)
- [x] `source-affenkaefig-ticket-kings` live import (5 events, 1 duplicate match)
- [x] Idempotent re-import validated
- [x] Scheduler interval configured (`every_6_hours`)
- [ ] Admin review + publish for enrichment records → ticket origins

### Builds & quality

- [ ] Version bumped (if required)
- [ ] `npm run release:check` PASS
- [ ] Android AAB uploaded to Play (production track or staged rollout)
- [ ] iOS build submitted to App Store (or TestFlight → production promotion)
- [ ] Web deployed to production with `EXPO_PUBLIC_WEB_BASE_URL`
- [ ] `npm run generate:seo` run with production URL
- [ ] Smoke tests PASS on production URLs

### Compliance & legal

- [ ] Privacy policy: `https://www.<domain>.tld/privacy`
- [ ] Terms: `https://www.<domain>.tld/terms`
- [ ] Impressum: `https://www.<domain>.tld/impressum`
- [ ] Support: `https://www.<domain>.tld/support`
- [ ] Supabase DPA signed
- [ ] Analytics disabled OR consent banner verified

### Security

- [ ] `EXPO_PUBLIC_USE_SUPABASE=true` in all production builds
- [ ] No mock admin credentials in production
- [ ] Service role key not in bundle (`validate:build-output`)
- [ ] HTTPS enforced on all public endpoints
- [ ] Security headers configured ([web-deployment.md](web-deployment.md))
- [ ] Admin roles reviewed (least privilege)

### Operations

- [ ] Supabase backups enabled (+ PITR recommended)
- [ ] Restore procedure documented ([operations.md](operations.md))
- [ ] Uptime monitoring configured
- [ ] Incident response contacts defined
- [ ] Rollback artifacts archived (previous AAB, IPA, web dist)
- [ ] On-call schedule for launch week

### Store

- [ ] Apple: privacy labels, review notes, screenshots
- [ ] Google: data safety, content rating, feature graphic
- [ ] Release notes published in both stores
- [ ] `ascAppId` set in `eas.json`

### Post-launch (T+24h)

- [ ] Production smoke test
- [ ] Crash rate baseline established
- [ ] Support inbox checked
- [ ] Search Console: no crawl errors spike
- [ ] Retrospective scheduled

---

## 4. Rollback procedure

### When to rollback

- Crash rate > 1% of sessions
- Unable to load events (API/RLS failure)
- Security incident
- Store-critical bug

### How to rollback

| Platform | Action | Owner | ETA |
|----------|--------|-------|-----|
| **Web** | Redeploy previous git tag `dist/` | Engineering | 15 min |
| **Android** | Halt rollout; promote previous release in Play Console | Operations | 1–4 hours |
| **iOS** | Remove current version from sale; expedite previous build review | Operations | 24–48 hours |
| **Supabase** | Restore from backup/PITR to new project if data corrupted | Engineering | 1–4 hours |
| **DNS** | Revert DNS records at registrar | Operations | 5 min–48 hours (TTL) |

### Post-rollback

1. Notify users (status page / social / email to beta list)
2. Document incident timeline
3. Root cause analysis within 48 hours
4. Hotfix branch if needed

---

## 5. Contacts (assign before go-live)

| Role | Name | Email | Phone |
|------|------|-------|-------|
| Product owner | TBD | | |
| Engineering on-call | TBD | | |
| Security | TBD | security@<domain>.tld | |
| Privacy / DPO | TBD | privacy@<domain>.tld | |
| Support | TBD | support@<domain>.tld | |
| Legal | TBD | legal@<domain>.tld | |

---

## 6. Post-launch review (T+7)

- [ ] Crash rate within acceptable range
- [ ] No P0/P1 incidents open
- [ ] User feedback triaged
- [ ] Performance metrics baseline recorded
- [ ] Lessons learned documented
- [ ] Technical debt items prioritized

---

## Related documents

- [Compliance](compliance.md)
- [Operations](operations.md)
- [Launch checklist](launch-checklist.md)
- [Release management](release.md)
- [Beta program](beta.md)
