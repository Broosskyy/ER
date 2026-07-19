# Operations — Eternal Rave

**Sprint:** 12.7F  
**Status:** Operations runbook — production procedures  
**Last updated:** July 2026

---

## 1. System overview

| Component | Provider | Purpose |
|-----------|----------|---------|
| Mobile apps | Expo EAS | iOS/Android builds |
| Web/PWA | Static host (TBD) | Public app + admin |
| Database | Supabase PostgreSQL | Events, import data |
| Auth | Supabase Auth | Admin only |
| Storage | Supabase Storage | Event images (future) |
| DNS | TBD (Cloudflare recommended) | Domain routing |
| Email | TBD (Google Workspace) | Support, transactional |

---

## 2. Monitoring

### Current state (beta)

| Layer | Tool | Status |
|-------|------|--------|
| Supabase API/DB | Supabase Dashboard | Available |
| Supabase Auth | Supabase Dashboard | Available |
| Web hosting | Host provider logs | TBD at deploy |
| EAS builds | Expo dashboard | Available |
| iOS crashes | App Store Connect | After TestFlight |
| Android crashes | Play Console vitals | After closed test |
| Web analytics | GA4 (consent-gated) | Optional |
| Uptime | **Not configured** | Recommend UptimeRobot/Better Stack |
| APM | **Not configured** | Consider post-beta |

### Alert levels

| Level | Condition | Response time | Channel |
|-------|-----------|---------------|---------|
| **P0** | Production down, data breach | 15 min | Phone + email |
| **P1** | Core feature broken | 1 hour | Email + Slack |
| **P2** | Degraded performance | 4 hours | Email |
| **P3** | Minor issue | Next business day | Ticket |

*Configure on-call rotation before production.*

### Recommended monitoring (post go-live)

- [ ] Uptime check: `https://www.<domain>.tld/` (5 min interval)
- [ ] Uptime check: Supabase health endpoint
- [ ] EAS build failure notifications (email)
- [ ] Supabase disk/connection alerts
- [ ] Play Console / ASC crash rate thresholds

---

## 3. Backup strategy

### Supabase database

| Property | Value |
|----------|-------|
| Method | Supabase automated backups (plan-dependent) |
| Frequency | Daily (Pro plan); verify tier |
| Retention | 7–30 days per plan |
| Encryption | At rest (AES-256, provider-managed) |
| Access | Supabase dashboard, org admins only |
| RPO | ≤ 24 hours (daily backup) |
| RTO | 1–4 hours (manual restore via dashboard) |

### Point-in-time recovery (PITR)

- **Recommended:** Enable PITR on production Supabase project before go-live
- RPO improves to minutes when enabled
- Additional cost on Pro plan

### Storage backups

| Property | Value |
|----------|-------|
| Method | Supabase storage replication (provider) |
| Client uploads | Not active yet — no backup workflow needed |
| Recommendation | Enable bucket versioning before production uploads |

### Configuration backups

| Item | Backup method |
|------|---------------|
| Supabase migrations | Git repository (`supabase/migrations/`) |
| EAS config | Git (`eas.json`, `app.config.ts`) |
| Environment secrets | EAS secrets + password manager (not git) |
| DNS zone | Cloudflare export / registrar backup |
| Web `dist/` artifacts | CI artifacts or git tags |

### Backup frequency summary

| Data | Frequency | Retention | Owner |
|------|-----------|-----------|-------|
| PostgreSQL | Daily (auto) | Per plan | Supabase |
| Git repo | Every commit | Indefinite | GitHub |
| EAS env secrets | On change | Current only | Operations |
| Web deploy | Per release | Last 3 tags | Operations |

---

## 4. Restore procedures

**Do not modify production data during documentation-only restore analysis.**

### Database restore (Supabase)

1. Identify incident time and required recovery point
2. Supabase Dashboard → Database → Backups (or PITR)
3. Select restore point
4. Restore to **new project** first (recommended for validation)
5. Update `EXPO_PUBLIC_SUPABASE_URL` in staging to validate
6. Run `npm run validate:staging:remote`
7. If validated, switch production env vars or promote restored project
8. Document incident and recovery time

### Storage restore

1. Identify deleted/corrupted objects
2. Re-upload from source import pipeline or backup bucket
3. Verify public URLs resolve

### Configuration restore

1. Checkout git tag: `git checkout v0.2.0`
2. Redeploy web from tag
3. Re-run EAS build if native config changed
4. Verify `release:check` passes

### Integrity checks post-restore

- [ ] Published events count matches expected
- [ ] RLS policies active (`validate:staging:rls-remote`)
- [ ] Admin login works
- [ ] Anon can read published events only
- [ ] No draft events publicly visible

### Restore test status

| Test | Last run | Result |
|------|----------|--------|
| DB restore to staging project | Not run | Documented only |
| Storage object recovery | N/A | No uploads yet |
| Config rollback via git tag | Verified in dev | PASS |
| Full disaster recovery drill | Not run | Scheduled pre-production |

---

## 5. Maintenance windows

| Activity | Window | User impact |
|----------|--------|-------------|
| Supabase maintenance | Provider-scheduled | Possible API downtime |
| Web deploy | Off-peak (Tue–Thu 02:00 CET) | Brief cache refresh |
| EAS builds | Anytime | None until store publish |
| DNS changes | Low-traffic hours | Possible propagation delay |

Communicate maintenance via status page (future) or social channels.

---

## 6. Escalation

```
L1: On-call engineer (P2/P3)
  ↓ (30 min unresolved or P1)
L2: Engineering lead
  ↓ (1 hour unresolved or P0)
L3: Product owner + legal (if data breach)
```

See [security.md](security.md) § Incident Response.

---

## 7. Routine operations

### Weekly (during beta)

- Review crash reports (ASC / Play)
- Check Supabase dashboard for errors
- Triage support@ inbox
- Verify backup status in Supabase dashboard

### Per release

- Run [launch-checklist.md](launch-checklist.md)
- Run `npm run release:check`
- Tag release in git
- Update release notes
- Archive build artifacts (AAB, IPA)

### Quarterly

- Admin role access review
- Third-party inventory update ([privacy.md](privacy.md) §9)
- Backup restore drill
- RLS audit

---

## 8. Known operational risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Single Supabase project | High | PITR + restore drill; consider staging project |
| No uptime monitoring | Medium | Add before go-live |
| Manual deploy process | Medium | Document + automate CI later |
| No status page | Low | Add for production |
| Local favorites not backed up | Low | User communication |

---

## Related documents

- [Compliance](compliance.md)
- [Security](security.md)
- [Go-live](go-live.md)
- [Release management](release.md)
- [Web deployment](web-deployment.md)
