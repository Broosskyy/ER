# Terms of Service — Structure

**Sprint:** 12.7C  
**Status:** Structure only — no legal advice; qualified counsel must draft final text  
**Last updated:** July 2026

---

## Purpose

This document defines the **chapter structure** for Eternal Rave's Nutzungsbedingungen (Terms of Service). It does not contain binding legal language.

**Planned URL:** `EXPO_PUBLIC_TERMS_URL` → `https://www.<domain>.tld/terms`

---

## Chapter outline

### 1. Geltungsbereich (Scope)

- Who these terms apply to (all users of the app and website)
- Which services are covered (event discovery, web, mobile apps)
- Excluded services (ticketing, event organization)
- Age requirements (if applicable)
- Geographic scope (DACH primary, international availability)

### 2. Nutzung der Plattform (Platform use)

- Permitted use: browse events, save favorites locally, receive local notifications
- Prohibited use: scraping, automated access, reverse engineering
- No account required for consumer use (current state)
- Admin access restricted to authorized personnel

### 3. Inhalte (Content)

- Event data sourced from third parties and imports
- Accuracy disclaimer: information may be incomplete or outdated
- User responsibility to verify event details with organizers
- Intellectual property of event listings belongs to respective rights holders

### 4. Veranstaltungen (Events)

- Eternal Rave is a discovery platform, not an event organizer
- No responsibility for event cancellation, changes, or safety
- Ticket links redirect to third-party providers
- No guarantee of ticket availability or pricing

### 5. Haftung (Liability)

- Limitation of liability to extent permitted by law
- No warranty for uninterrupted service
- Exclusion of indirect/consequential damages (where legally permissible)
- Force majeure

### 6. Verfügbarkeit (Availability)

- Best-effort service availability
- Maintenance windows
- Offline functionality limitations (PWA, local data)

### 7. Urheberrechte (Copyright)

- Platform code and design protected
- Event images and descriptions: respective owner rights
- DMCA / notice-and-takedown process (if applicable)

### 8. Marken (Trademarks)

- "Eternal Rave" trademark usage restrictions
- Third-party trademarks belong to their owners

### 9. Missbrauch (Abuse)

- Prohibited activities list
- Reporting mechanism (`support@<domain>.tld`)
- Investigation and response process

### 10. Sperrung (Suspension)

- Grounds for access restriction
- Admin account suspension process
- No consumer account suspension (no accounts currently)

### 11. Kündigung (Termination)

- User may stop using the app at any time
- Service discontinuation notice period
- Effect on locally stored data

### 12. Änderungen (Changes)

- Right to modify terms
- Notification method (in-app, website, email for admin users)
- Continued use as acceptance (or explicit re-consent if required)

### 13. Gerichtsstand (Jurisdiction)

- Applicable law (German law, if DE entity)
- Place of jurisdiction
- EU consumer rights reservation

---

## Implementation notes

| Item | Status |
|------|--------|
| Legal text drafted | Not started |
| Web route `/terms` | Not implemented |
| In-app link | Not wired (env var placeholder exists) |
| Version tracking | Add `terms-version` and `last-updated` date when published |
| Language | German primary; English optional |

---

## Related documents

- [Privacy architecture](privacy.md)
- [Legal / Impressum](legal.md)
- [Business setup](business-setup.md)
