# Import Operations

Sprint 12D operations guide for source management and import jobs.

## Sources

Sources are managed in **Admin → Imports → Sources**.

### Source Fields

| Field | Description |
|-------|-------------|
| Name | Display name |
| Adapter | `json_ld`, `rss`, `atom`, `ical`, `csv`, `api_json` |
| Source URL | Feed or page URL |
| Trust Score | 0–100 |
| Review Required | Whether imports need manual review |
| Active | Whether imports are allowed |

### Source Configuration

Configuration is strictly typed per adapter. No free-form JavaScript or parser input is accepted. Secrets are not stored in source config — API headers reference environment variable names only.

### Source Actions

- **Create / Edit** — requires `sources:write`
- **Activate / Deactivate** — requires `sources:write`
- **Test** — dry-run fetch + parse, no records persisted
- **Manual Import** — starts orchestrator, creates import job

## Source Test

The test function:

- Validates configuration
- Runs the adapter with a test job ID
- Returns record count, warnings, errors, duration
- Does **not** create events or persist import records

## Manual Import

Flow:

1. Load source and check permissions (`imports:start`)
2. Check for active job on same source (pending/running)
3. Create import job with `triggered_by` set to actor ID
4. Run orchestrator (fetch → normalize → validate → match → save records)
5. Update source `last_import_at` and `last_job_status`
6. Navigate to job detail

Parallel imports for the same source are blocked server-side via unique index on active jobs.

## Import Jobs

### List View

Paginated, filterable by source, status, trigger, date range, errors only.

### Detail View

Shows metrics, error summary, paginated logs, and linked import records.

### Log Filtering

By level, code, record ID, date range. Large log sets are paginated.

## Monitoring Dashboard

**Admin → Imports** shows:

- Active sources
- Failed jobs (last 24h)
- Records in review
- Invalid records
- Duplicate candidates
- Average job duration
- Recent successful imports

## Error Handling

| Message | Cause |
|---------|-------|
| Source is deactivated | `active = false` |
| Import already running | Active job exists for source |
| Feed could not be loaded | Adapter/fetch failure |
| Record was modified | Concurrency conflict |
| Blocking validation errors | Approve attempted with errors |
| Missing permission | Role lacks required permission |

Technical details appear in import logs, not in user-facing messages.

## Architecture

```
Admin UI → ImportOperationsService / ImportReviewService
         → Repositories → Datasource (local | Supabase)
         → ImportOrchestrator (existing pipeline)
```

No direct Supabase calls from UI components. No service role in client.
