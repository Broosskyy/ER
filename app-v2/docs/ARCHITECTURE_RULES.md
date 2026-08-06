# Eternal Rave — Event Pipeline Architecture Rules

Permanent engineering rules for the event import → publish → consumer display pipeline.
Phase 4.5.2 established these as mandatory conventions before large-scale source onboarding.

## Single authoritative implementations

| Concern | Authoritative module | Do not duplicate |
|---------|-------------------|------------------|
| Consumer display projection | `toEventDisplayModel()` → `projectCanonicalEventFields()` | Raw `Event` field reads in UI |
| Field meaningfulness | `event-field-value.ts` | Connector-specific placeholder sets |
| Field trust / merge | `field-trust-merge-service.ts` + `ticket-url-quality.ts` | Ad-hoc `??` merge in publish paths |
| Ticket URL quality | `ticket-url-quality.ts` | Blind `candidate ?? existing` |
| Ticket price display | `formatDisplayPriceText()` + `event-price-availability-semantics.ts` | Inline price string building / ad-hoc free/sold-out heuristics |
| Provider labels | `getSourceDisplayLabel()` | Hardcoded provider strings in consumer UI |
| Location labels (consumer) | `canonical-event-projection.ts` | `venue + ', ' + city` concatenation |
| Location labels (ingest) | `event-venue-display.ts` | Re-normalizing venue at display time |
| Description sanitization (display) | `sanitizeEventDescription()` in projection | HTML stripping in components |
| Description normalization (ingest) | `text-normalizer.ts` | — |
| Lineup completeness (consumer) | `lineup-completeness.ts` | Re-inferring in view-models |
| Coordinate validation | `hasValidEventCoordinates()` | Parallel validators rejecting 0,0 inconsistently |
| Provenance writes | `EventFieldProvenanceWriter` | Direct `event_field_provenance` inserts from ops scripts |
| Moderation publish provenance | `EventFieldProvenanceWriter.writeFromModerationPublish()` | Direct `eventRepository.save` without provenance |
| Consumer cache invalidation | `invalidateConsumerEventCaches()` | Partial clears after canonical mutations |

## Consumer UI rules

1. All public surfaces (Home, Search, Map, Saved, Event Detail, Share) must consume `EventDisplayModel` projection fields:
   - `sanitizedDescription`, `displayPriceText`, `venueLabel`, `cityLabel`, `locationLabelComma`
   - `ticketProviderLabel`, `lineupCompleteness`, `lineupSectionTitle`
2. Never read raw `event.description` / `event.ticketUrl` in components when projection fields exist.
3. View-models (`event-card-view-model`, `event-detail-view-model`) must not re-project or re-infer fields already on `EventDisplayModel`.

## Import / publish rules

1. Every canonical field mutation through publish must call `EventFieldProvenanceWriter.writeFromPublish()` (or targeted `writeTicketUrlCorrection()` for surgical repairs).
2. Contributor moderation publish must call `EventFieldProvenanceWriter.writeFromModerationPublish()` and `invalidateConsumerEventCaches()`.
3. `publishRecord()` must load existing `provenanceByField` before field-trust merge when `genericSourceFieldTrustMerge` is enabled.
3. Empty, generic, or placeholder values must never overwrite meaningful canonical values (enforced by field-trust + URL quality gates).
4. Ops scripts must not direct-update `events` without corresponding provenance and cache invalidation.

## Cache rules

After any operation that changes published canonical event data:

```typescript
await invalidateConsumerEventCaches(consumerEventRepository);
```

Required for: import publish, merge, conflict resolution, provenance correction, moderation publish.

## Testing rules

1. Full test suite must pass before merging pipeline changes.
2. Network-dependent connector tests must use fixture HTML (`reference.html`) — no live fetches in unit tests.
3. Add regression tests in `sprint452-architecture-consolidation.test.ts` when consolidating formatters.

## Typecheck

- `npm run typecheck:app` — application + app routes (`tsconfig.app.json`)
- `npm run typecheck:operations` — active `scripts/operations/*` entry points (`tsconfig.operations.json`, strict; historical scripts excluded — see `scripts/operations/HISTORICAL_SCRIPTS.md`)
- `npm run typecheck` runs both targets

## PR checklist

- [ ] No new duplicate formatter / resolver / label helper
- [ ] UI uses projection fields
- [ ] Provenance written on canonical mutations
- [ ] `invalidateConsumerEventCaches()` called after consumer-visible changes
- [ ] Tests green (typecheck, lint, vitest)

## Generic source architecture (Phase 4.6.6 §2B)

The import → merge → publish pipeline is **source-agnostic**. Future organizers, clubs, and ticket providers (Resident Advisor, Eventbrite, Dice, Shotgun, Rausgegangen, Facebook Events, additional websites) onboard through connector adapters only.

### Connector contract

Every connector must emit `ConnectorNormalizedOutput` (`connector-normalized-contract.ts`) before entering the shared pipeline:

- Identity: title, subtitle, description
- Lineup: artist names, structured artists, running order, timetable
- Context: genres, badges/attributes, organizer, venue, address, coordinates
- Commerce: ticket URL, status, phases, price
- Admission: minimum age, doors open
- Provenance: extraction strategy, confidence, field evidence

### Merge pipeline rules

1. **No provider-specific logic** in merge, publish, field-trust, or reconciliation services.
2. Provider-specific HTML/API parsing lives **only** in connector adapters under `src/features/aggregation/connectors/`.
3. Field fallback uses generic origins: `ticket_platform_detail` / `ticket_platform_list` — never `ticket_io_*` or `ticket_kings_*` in merge code.
4. Venue repair uses `source-default-venue-repair.ts` (field defaults + external-location titles) — never hardcoded source IDs.
5. Ticket URL quality uses commerce-host detection — never hardcoded club domains.
6. Every new connector automatically participates in: field-quality merge, multi-origin matching, repair, provenance, quality gates, validation, audit, cache invalidation via `SourceModule` + existing pipeline steps.

### Authoritative modules

| Concern | Module |
|---------|--------|
| Connector output contract | `connector-normalized-contract.ts` |
| Source module boundary | `source-module-contract.ts` |
| Multi-origin field priority | `field-fallback-priority.ts` |
| Source default venue repair | `source-default-venue-repair.ts` |
| Ticket platform field repair | `ticket-platform-field-repair.ts` |
