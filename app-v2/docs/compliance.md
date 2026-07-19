# Compliance Overview — Eternal Rave

**Sprint:** 12.7F  
**Status:** Governance documentation — no production release performed  
**Last updated:** July 2026

---

## 1. Purpose

This document consolidates regulatory and store compliance requirements for Eternal Rave's production release. It does not constitute legal advice.

**Related:** [privacy.md](privacy.md) · [legal.md](legal.md) · [security.md](security.md) · [go-live.md](go-live.md)

---

## 2. Compliance matrix

| Requirement | Regulation / Policy | Status | Owner | Blocker? |
|-------------|---------------------|--------|-------|----------|
| Privacy policy (hosted) | GDPR Art. 13/14 | Structure ready | Legal | **Yes** |
| Terms of service | Contract law | Structure ready | Legal | Recommended |
| Impressum (DE) | TMG/DDG | Structure ready | Legal | **Yes (DE web)** |
| Consent (analytics) | GDPR Art. 6/7, ePrivacy | Implemented (web) | Engineering | No |
| Cookie policy | ePrivacy | Documented (no marketing cookies) | Legal | No |
| Data retention | GDPR Art. 5(1)(e) | [data-retention.md](data-retention.md) | Operations | No |
| Data deletion concept | GDPR Art. 17 | Documented | Operations | Partial (no accounts) |
| Data export concept | GDPR Art. 20 | Documented | Operations | N/A until accounts |
| Apple App Store Guidelines | Apple | Prepared | Operations | Privacy URL |
| Google Play Policies | Google | Prepared | Operations | Privacy URL |
| Apple Privacy Labels | Apple | Documented | Operations | At submission |
| Google Data Safety | Google | Documented | Operations | At submission |
| Encryption export | US EAR | Declared exempt (iOS) | Engineering | No |
| Accessibility | WCAG 2.1 AA (target) | Partial review | Engineering | No (beta) |

---

## 3. Apple App Store compliance

| Guideline area | Eternal Rave status | Notes |
|----------------|---------------------|-------|
| 2.1 App completeness | Beta-ready | Map placeholder documented as known issue |
| 2.3 Accurate metadata | Draft listings | Screenshots pending |
| 4.0 Design | Dark UI, native patterns | Safe areas implemented |
| 5.1 Privacy | Policy URL required | **Not hosted** |
| 5.1.1 Data collection | Minimal | No accounts; local favorites |
| 5.1.2 Permission use | No sensitive permissions | No location/camera/push |
| 2.5.14 Encryption | `ITSAppUsesNonExemptEncryption: false` | Documented in ios-build.md |

---

## 4. Google Play compliance

| Policy area | Status | Notes |
|-------------|--------|-------|
| User data policy | Compliant design | No PII collection from users |
| Data safety form | Prepared | Declare local-only favorites |
| Deceptive behavior | None | No hidden features |
| Families policy | Not targeted at children | Declare in questionnaire |
| Permissions | Minimal | No dangerous permissions |
| Target API level | Expo-managed | Verify at build time |

---

## 5. GDPR / DSGVO compliance

| Principle | Status | Evidence |
|-----------|--------|----------|
| Lawfulness | Documented | [privacy.md](privacy.md) §7 |
| Transparency | Partial | Policy structure ready, not published |
| Purpose limitation | ✓ | Event discovery only |
| Data minimization | ✓ | No consumer accounts |
| Accuracy | Import review workflow | Admin process |
| Storage limitation | Documented | [data-retention.md](data-retention.md) |
| Integrity & confidentiality | RLS + TLS | [security-privacy.md](security-privacy.md) |
| Accountability | Processing register | [privacy.md](privacy.md) §8 |

### Data subject rights

| Right | Consumer app | Admin users |
|-------|--------------|-------------|
| Access | Clear app data (local) | Supabase Auth admin |
| Rectification | N/A (no profile) | Admin dashboard |
| Erasure | Uninstall / clear data | Account deletion process |
| Portability | N/A until accounts | N/A |
| Objection | Analytics opt-out (web) | N/A |
| Complaint | privacy@ contact | Documented |

---

## 6. Consent compliance

| Category | Implementation | Legal basis |
|----------|----------------|-------------|
| Necessary (app function) | Implicit | Legitimate interest / contract |
| Functional (local storage) | Implicit on use | Legitimate interest |
| Analytics (GA4) | **Opt-in banner** (web) | Consent Art. 6(1)(a) |
| Marketing | Not implemented | — |

See [analytics.md](analytics.md) and [privacy.md](privacy.md) §12.

---

## 7. Governance & responsibilities

| Role | Responsibility |
|------|----------------|
| **Product owner** | Release scope, go/no-go business decision |
| **Engineering lead** | Technical release gate, builds, rollback |
| **Security owner** | Security review sign-off |
| **Privacy owner** | GDPR compliance, privacy policy |
| **Operations** | Hosting, backups, monitoring, incidents |
| **Legal counsel** | Privacy policy, terms, impressum (external) |

*Assign named individuals before production release.*

---

## 8. Release approvals required

Before production, all gates in [go-live.md](go-live.md) must be signed off:

1. Technical
2. Privacy / GDPR
3. Security
4. QA
5. Performance
6. Store compliance
7. Operations
8. Production go-live

**No release without complete sign-off.**

---

## 9. Compliance gaps (pre-production)

| Gap | Priority | Remediation |
|-----|----------|-------------|
| Privacy policy not hosted | Critical | Legal review + deploy `/privacy` |
| Impressum not hosted | Critical (DE) | Legal review + deploy `/impressum` |
| Support URL not live | Critical | Deploy `/support` |
| DPA with Supabase | High | Sign Supabase DPA in dashboard |
| Admin idle timeout | Medium | Implement in future sprint |
| Storage bucket RLS gaps | Medium | Before enabling uploads |
| Accessibility audit incomplete | Medium | Manual WCAG review |

---

## 10. Audit schedule (recommended)

| Audit | Frequency | Owner |
|-------|-----------|-------|
| RLS policy review | Per release | Engineering |
| Secrets scan (`validate:build-output`) | Per CI build | Engineering |
| Privacy impact assessment | Major feature changes | Privacy owner |
| Third-party inventory | Quarterly | Operations |
| Access review (admin roles) | Quarterly | Security owner |
| Backup restore test | Quarterly | Operations |

---

## Related documents

- [Security](security.md)
- [Security & privacy review](security-privacy.md)
- [Operations](operations.md)
- [Go-live](go-live.md)
- [Data retention](data-retention.md)
- [Legal](legal.md)
