# Single productive import path

## Entry

`runSourcePackImport()` in `source-pack-import-entry.ts`

## Flow

```
Source Connector
→ SourceEvent validation
→ Identity / Duplicate Resolution
→ optional enrichment sources
→ ImportDraft
→ ReviewDecision
→ Consumer Preview
→ Noop Persistence
```

## Publish (post-review only)

`ImportEventPublishService.publishRecord()` with optional `controlledPublish` for approved drafts.

## Retired in this reset

Legacy phase operations runners moved to `scripts/operations/_archive/import-legacy/`.
Scheduler-driven `ImportAggregationService` remains for existing jobs but is not the source-pack ingress.
