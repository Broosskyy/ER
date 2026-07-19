# Legal Documents — Eternal Rave

**Sprint:** 12.7C  
**Status:** Structures prepared — no legal entity data invented  
**Last updated:** July 2026

---

## 1. Publication status

| Document | Structure | Legal text | Hosted | In-app link |
|----------|-----------|------------|--------|-------------|
| Datenschutzerklärung | ✓ [privacy.md](privacy.md) §10 | Pending counsel | No | Env placeholder |
| Nutzungsbedingungen | ✓ [terms.md](terms.md) | Pending counsel | No | Env placeholder |
| Impressum | ✓ below | Pending entity registration | No | Not wired |
| Cookie policy | ✓ [privacy.md](privacy.md) §13 | N/A (no analytics cookies) | No | — |

---

## 2. Impressum structure (§5 TMG)

*Fill with real data when legal entity is registered. Do not use placeholder company names.*

### Required sections

| Section | Content to provide | Status |
|---------|-------------------|--------|
| **Unternehmen** | Legal company name (e.g. GmbH, UG, Einzelunternehmen) | TBD |
| **Anschrift** | Full postal address (street, PLZ, city, country) | TBD |
| **Kontakt** | Email: `hello@<domain>.tld`; phone (optional, only if real) | Email planned |
| **Vertretungsberechtigte** | Managing director(s) / Geschäftsführer | TBD |
| **Register** | Handelsregister, registration number, court (if applicable) | TBD |
| **Umsatzsteuer-ID** | VAT ID per §27a UStG (if applicable) | TBD |
| **Verantwortlicher i.S.d. §18 Abs. 2 MStV** | Name and address for editorial content | TBD |

### Web route

`https://www.<domain>.tld/impressum`

---

## 3. Contact structure

| Contact type | Channel | Public? |
|--------------|---------|---------|
| General | `hello@<domain>.tld` | Yes |
| Support | `support@<domain>.tld` | Yes |
| Privacy / GDPR | `privacy@<domain>.tld` | Yes |
| Legal | `legal@<domain>.tld` | Internal / selective |
| Security | `security@<domain>.tld` | Yes |
| Press | `press@<domain>.tld` | Yes |
| Business / Partners | `partners@<domain>.tld` | Yes |

See [email.md](email.md) for full mail structure.

---

## 4. Contact pages (web structure)

| Page | Path | Sections |
|------|------|----------|
| Support | `/support` | FAQ, support@, response expectations |
| Contact | `/contact` | hello@, partners@, press@ |
| Privacy | `/privacy` | Full privacy policy + privacy@ contact |
| Terms | `/terms` | Full terms of service |
| Impressum | `/impressum` | Legal notice per §5 TMG |
| Press | `/press` | press@, media kit placeholder |
| Business | `/business` | partners@, events@ |

**Not implemented in this sprint** — structure only.

---

## 5. Legal document dependencies

Before public release:

1. Register legal entity (if not sole proprietor)
2. Engage legal counsel for privacy policy and terms (German + EU law)
3. Host documents at production domain
4. Wire `EXPO_PUBLIC_PRIVACY_URL` and `EXPO_PUBLIC_TERMS_URL` in app/store listings
5. Add Impressum link in web footer (required for DE)
6. Complete Apple App Store privacy questionnaire
7. Complete Google Play Data Safety form

---

## 6. Regulatory context

| Regulation | Relevance | Status |
|------------|-----------|--------|
| GDPR / DSGVO | Privacy policy, data processing | Documentation complete; legal text pending |
| TMG / DDG | Impressum for commercial website | Structure ready; entity data pending |
| ePrivacy | Cookies | No non-essential cookies currently |
| App Store Review Guidelines | Privacy policy URL required | Prepared |
| Google Play Developer Policy | Privacy policy + Data Safety | Prepared |
| BDSG | German federal data protection | Covered via GDPR compliance |

---

## Related documents

- [Privacy architecture](privacy.md)
- [Terms structure](terms.md)
- [Business setup](business-setup.md)
- [Email infrastructure](email.md)
- [Domain strategy](domain.md)
