# Architecture — Canonical Event Attributes (Phase 4.7.3)

## Lifecycle

```
Source evidence
  → connector extraction (unchanged)
  → EventAttributeCandidate[]
  → mergeEventAttributeCandidates()
  → CanonicalEventAttributeBundle
  → events.event_attributes (+ scalar columns)
  → Event / EventDisplayModel
  → projectEventAttributeBadges()
  → Event Detail hero chips
  → (future) filters / search / recommendations
```

Connectors **never** write canonical attributes directly. They continue emitting `sourceMetadata.eventAttributes` and related metadata. The import publish mapper normalizes candidates and merges them at publish time.

## Domain modules

| Module | Responsibility |
|---|---|
| `canonical-event-attribute-types.ts` | Attribute type catalog, domains, filter/search metadata |
| `event-attribute-candidates.ts` | Candidate builder from import payloads (wraps existing parser output) |
| `event-attribute-merge.ts` | Generic merge, provenance, scalar derivation |
| `event-attribute-badge-projection.ts` | Consumer badges (not ticket/editorial/commercial) |
| `event-attribute-quality-rules.ts` | Pipeline stage audit rules |

## Storage model (recommended)

**Primary:** `events.event_attributes jsonb` — array of `CanonicalEventAttribute`

**Filter/search scalars (denormalized from merge):**

- `floor_count integer`
- `stage_count integer`
- `venue_environment text` (`indoor | outdoor | hybrid`)
- `last_entry_at timestamptz`
- `dress_code text`
- `accessibility_notes text`

**Existing visitor fields (unchanged):**

- `age_restriction text`
- `doors_open_at timestamptz`

Migration: `supabase/migrations/20260803140000_phase473_canonical_event_attributes.sql`

### Why not dozens of columns or a child table?

- Matches `ticket_phases` / `genre_labels` jsonb precedent
- Attributes are simple key/label/provenance records without FK complexity
- Scalars cover high-cardinality filter dimensions
- GIN index on jsonb supports future search facets

## Badge domains (strict separation)

| Domain | Examples | Source |
|---|---|---|
| Event attributes | Open Air, Festival, Boat, Indoor, Multi Floor | `event_attributes` |
| Ticket status | Sold Out, Presale, Limited | `ticket_status` / phases |
| Editorial | Featured, Editors Pick | **not implemented** |
| Organic | Trending, Popular | **not implemented** |
| Commercial | Sponsored | **not implemented** |

## Merge rules

1. Stronger confidence + explicit evidence wins
2. Multiple origins increase provenance depth (origins array)
3. Conflicting explicit values → `reviewRequired`, no overwrite
4. Never invent attributes without candidate evidence
5. Source-agnostic — no Affenkäfig/Bootshaus/MDMA-specific merge rules

## Future consumers (prepared, not implemented)

- **Filters:** `FILTERABLE_ATTRIBUTE_TYPES` + scalar columns
- **Search:** `SEARCHABLE_ATTRIBUTE_LABELS` + `searchableAttributeTerms` on display model
- **Recommendations:** canonical attribute types as stable feature keys

## UI projection

Event Detail uses existing hero layout. `EventHeroViewModel.attributeBadges` renders chips when canonical attributes exist. No page redesign.
