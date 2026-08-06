# Source Adapter Guide

**Sprint 7 — Eternal Rave app-v2**

## Interface

```typescript
interface EventSourceAdapter {
  getSourceName(): string;
  validateSourceConfiguration(): { valid: boolean; errors: string[] };
  loadEvents(): RawEvent[];
}
```

Defined in `src/features/events/adapters/types.ts`.

## Responsibilities

| Method | Purpose |
|--------|---------|
| `getSourceName()` | Stable source identifier stored on `Event.source` |
| `validateSourceConfiguration()` | Check adapter config before loading |
| `loadEvents()` | Return raw source records (no normalization) |

Adapters **do not** normalize, validate, deduplicate, or set publish status. That happens in the central pipeline.

## Implemented adapters (local demo only)

### `DemoSourceAdapter`

- Source name: `demo`
- Loads the five Berlin club events from `DEMO_SOURCE_RAW_EVENTS`
- UI label: **Demo source**

### `ManualImportAdapter`

- Source name: `manual`
- Loads manual-import test fixtures + confirmed-duplicate test case
- UI label: **Manual import**

### `LocalJsonAdapter`

- Source name: `local-json`
- Loads local JSON-style test fixtures (no-coords, past event)
- UI label: **Local JSON**

## Adding a new adapter

1. Create `src/features/events/adapters/my-source-adapter.ts`
2. Implement `EventSourceAdapter`
3. Map external fields to `RawEvent` (keep data raw/un-normalized)
4. Register in `runDefaultEventPipeline()` adapter list
5. Add tests for normalization of sample raw records

**Do not** import adapter output directly in UI components.

## Display labels

`getSourceDisplayLabel(source)` in `data/demo-images.ts` maps source ids to user-facing labels. Use neutral names for demo data — no misleading real platform names.

## Configuration validation

Use `validateSourceConfiguration()` to fail fast when required env/config is missing. Current demo adapters always return `{ valid: true }`.

## Example skeleton

```typescript
export class MySourceAdapter implements EventSourceAdapter {
  getSourceName() {
    return 'my-source';
  }

  validateSourceConfiguration() {
    return { valid: true, errors: [] };
  }

  loadEvents(): RawEvent[] {
    return [
      {
        source: 'my-source',
        sourceEventId: 'event-001',
        rawTitle: 'Example Night',
        rawDate: '2026-06-01T22:00:00',
        rawVenue: 'Example Club',
        rawCity: 'Berlin',
        rawArtists: ['DJ Example'],
        rawGenres: ['Techno'],
        rawDescription: 'Imported from my-source.',
        importedAt: new Date().toISOString(),
      },
    ];
  }
}
```

## Sprint 7 limits

- No HTTP requests
- No browser automation
- No third-party APIs
- No scraping

Future server-side imports should produce `RawEvent` payloads and reuse the same pipeline.
