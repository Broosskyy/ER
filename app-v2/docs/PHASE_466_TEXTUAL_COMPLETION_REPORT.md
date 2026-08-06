# Phase 4.6.6 — Textual Detail Completion Before Flyer OCR

Generated: 2026-08-02T21:29:49.266Z

## 1. Website parser audit

Generic website connectors audited: Bootshaus, Affenkäfig, MDMA (Ticket Kings), Lehmann, Technodampfer.
Structured HTML, JSON-LD, custom lineup adapters and description/timetable/attribute parsers are now wired through `website-textual-enrichment`.

### Bootshaus
- Strategy: html_selector + list/detail enrichment
- Supported: lineup, description, genres, venue, ticket links, images, organizer
- Partial: address, coordinates, timetable, attributes, doors, minimum age
- Unsupported / blocked: structured FAQ, multi-floor HTML blocks without text

### Affenkäfig
- Strategy: json_ld + custom ecm-event-lineup parser
- Supported: lineup, description, venue, ticket links, images
- Partial: genres, attributes, timetable from description
- Unsupported / blocked: coordinates, doors structured, FAQ blocks

### Musik die mich antreibt (MDMA)
- Strategy: ticket_kings detail parser
- Supported: lineup, description, genres, attributes, doors, minimum age, ticket URL, price
- Partial: timetable, running order from description
- Unsupported / blocked: coordinates, multi-origin website merge unless linked

### Lehmann Club
- Strategy: ticket_io list + detail (detail blocked by ALTCHA)
- Supported: title, date, genre list, price, ticket URL
- Partial: description from list JSON-LD, lineup from description text
- Unsupported / blocked: detail HTML while ALTCHA active

### Technodampfer
- Strategy: ticket_io list + detail (detail blocked by ALTCHA)
- Supported: title, date, genre list, price, ticket URL
- Partial: description lineup text, single-DJ title inference
- Unsupported / blocked: detail HTML while ALTCHA active

## 2. Description lineup extraction

Extended `lineup-text-parser` with Line Up, Artists, Running Order, Live, Support, Special Guests and B2B/F2F billing units.
Rejects venue, organizer, sponsor, edition, doors and URL noise.

## 3. Cross-source detail discovery

Website descriptions are scanned for outbound Ticket.io / Ticket Kings links (`cross-source-ticket-discovery`).
Bootshaus + Ticket.io and Affenkäfig + Ticket Kings remain complementary origins merged per field.

## 4. Timetable extraction

`textual-timetable-parser` preserves artist order, stage grouping and optional start/end times without inventing missing times.

## 5. Attribute extraction

`textual-attribute-parser` extracts indoor/outdoor/open air, festival, floors, age restriction and doors open from text.

## 6. Representative events

| Event | Class | Notes |
|-------|-------|-------|
| Bootshaus on a Ship | E | Ticket.io detail ALTCHA-blocked; website description retained; lineup improved from website textual enrichment |
| Vision Ekstase | E | Detail blocked; list-only ticket.io origin |
| PURE TECHNO | E | Detail blocked; title carries DJ/floor hints pending OCR |
| Blacklist Festival | E | Ticket.io detail inaccessible |
| LEVI | C | Genuine flyer-only remainder (2 class-C events total post-repair) |
| Sommerfest | E | Multi-origin Affenkäfig + Ticket Kings; attributes/timetable still partial |
| MDMA | B | Ticket Kings textual signals present; genres/attributes not yet fully projected |
| 100 % SCHRANZ | E | Ticket.io detail blocked |

Full traces: `representativeEvents` in `_phase466_textual_matrix.json`.

## 7. Controlled repair

Backup: `docs/real-data/_phase466_textual_backup.json` (70 affected events).

Repair sources (2 passes, idempotent): Bootshaus website, Affenkäfig website, Bootshaus Ticket.io, Affenkäfig Ticket Kings, MDMA Ticket Kings, Lehmann Ticket.io, Technodampfer Ticket.io.

Per-source abort: `source-ticket-io-lehmannclub` returned zero parsed events in one pass and was skipped without clearing existing data.

## 8. Before/after metrics

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| Published events | 108 | 108 | 0 |
| Complete lineups | 70 | 81 | +11 |
| Descriptions | 50 | 50 | 0 |
| Genres | 7 | 10 | +3 |
| Addresses | 28 | 36 | +8 |
| Coordinates | 18 | 18 | 0 |

Completeness classes (post-repair):

| Class | Count | Meaning |
|-------|-------|---------|
| A | 0 | Complete from textual sources |
| B | 28 | Partial — textual improvement still possible |
| C | 2 | Only flyer remains |
| D | 15 | Source has no additional information |
| E | 63 | Textual detail exists but Ticket.io detail is ALTCHA-blocked |

Class C dropped from 24 → 2 after parser wiring and controlled repair. No field regressions observed on published counts.

## 9. Remaining flyer-only events

See `_phase466_remaining_flyer_candidates.json`. Class E (textual exists but externally inaccessible) is tracked separately from class C.

## 10. Recommendation for Flyer OCR

Proceed with flyer OCR only for class C events after class B parser improvements are republished.
Class E events may enter flyer inventory as fallback but must retain documented ALTCHA limitation.
OCR remains the final enrichment stage — not a substitute for textual parsers.

## 11. Generic source architecture (§2B)

The merge pipeline is source-agnostic. See `docs/ARCHITECTURE_RULES.md` § Generic source architecture.

- **Connector contract:** `connector-normalized-contract.ts` — all adapters emit the same normalized shape.
- **Field fallback:** `ticket_platform_detail` / `ticket_platform_list` (no Ticket.io/Ticket Kings-specific merge origins).
- **Venue repair:** `source-default-venue-repair.ts` — field-defaults driven, not Bootshaus-specific IDs.
- **Ticket repair:** `ticket-platform-field-repair.ts` — connectorKey `ticket_platform`, not source ID lists.
- **Ticket URL quality:** commerce-host detection replaces hardcoded `bootshaus.tv` rules.

Provider-specific parsing remains only in connector adapters under `src/features/aggregation/connectors/`.

## Artifacts

- `docs/real-data/_phase466_textual_matrix.json`
- `docs/real-data/_phase466_remaining_flyer_candidates.json`
- `docs/real-data/_phase466_textual_backup.json`
- `docs/real-data/_phase466_metrics_before.json`
- `docs/real-data/_phase466_metrics_after.json`