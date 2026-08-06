# Architecture — Production Shadow Plan

**Phase:** 4.8.1.4  
**Production shadow executed:** NO  
**First candidate:** Official Website importer  
**Approval required:** Human sign-off before shadow execution

## Selected first shadow candidate

**Official Website** importer is the first candidate for read-only production shadow based on:

- Zero unresolved `BOTH_INCORRECT` for fields it claims
- Generic body description extractor validated on Bootshaus + Affenkäfig samples
- Stale JSON-LD offers demoted and cannot win consumer CTA
- Fixture replay deterministic (0 semantic drift)
- Unsupported fields explicitly declared — legacy remains authoritative

Ticket.io, Ticket Kings, and Nacht-Manager remain `READY_FOR_MORE_STAGING`.

## Bounded shadow scope

| Parameter | Value |
|-----------|-------|
| Importer | `official-website` |
| Importer version | `phase4814-official-website` |
| Source scope | Bootshaus.tv + Affenkäfig.info official pages (43 events in staging sample) |
| Expected event count | 43 |
| Duration | 72 hours observation window |
| Rate limit | 30 requests/minute |

### Supported fields (shadow may propose)

`title`, `description`, `flyer`, `gallery`, `date_time`, `venue`, `location`, `city`, `coordinates`

### Intentionally unsupported (legacy authoritative)

`price`, `ticket_phases`, `availability`, `sold_out`, `checkout_url`, `lineup`

## Read-only guarantees

Shadow mode MUST:

1. Read live production Source configuration and matching context
2. Run unified importer pilots
3. Produce proposed evidence and merge decisions
4. Compare with current canonical production
5. Write **no** Event, Import Record, review state, cache, or schedule
6. Send **no** automatic publication action

Enforcement: `stagingOnly: true`, `validateShadowNoWrite()`, ops script has no mutation paths.

## Abort conditions

Shadow aborts automatically on:

- Any production write attempt
- Contract schema failure
- Unexplained identity collision
- Cross-Event contamination
- Unexpected event-count growth
- Importer nondeterminism
- Rate-limit/block escalation beyond threshold

## Monitoring

- Contract schema validation per batch
- Contamination detector
- Identity cluster cardinality
- HTTP 429/403 rate
- Manual review output: `docs/real-data/_shadow_review_queue.json`

## Rollback

1. Abort shadow job
2. Discard shadow evidence artifacts only
3. No canonical rollback (read-only)
4. File incident report with diagnostics

## Exact approval required

Before executing production shadow:

1. **Product/ops sign-off** on Official Website as first candidate
2. **Confirm** 43-event scope and 72h duration
3. **Acknowledge** 45 `LEGACY_BETTER` fields remain for controlled batch (venue/ticketUrl gaps)
4. **Acknowledge** Ticket Kings catalog still limited (5 public events on list page)
5. **Acknowledge** production canonical price/description drift on 4 Ticket.io events (stale, not importer bugs)

Shadow plan artifact: [`docs/real-data/_phase4814_shadow_safety_plan.json`](real-data/_phase4814_shadow_safety_plan.json)

## Architecture verdict (unchanged from 4.8.1.3)

| Subsystem | Verdict |
|-----------|---------|
| Unified Import Contract | KEEP |
| Evidence Contract | MODERNIZE (stale tier implemented in 4.8.1.4) |
| Identity Matching | MODERNIZE |
| Merge Engine | KEEP |
| Multi-source Support | KEEP |
| Canonical Event Model | KEEP |
| Projection Layer | MODERNIZE (production stale prices) |

Long-term platform capable: **yes**. No replacement recommended.
