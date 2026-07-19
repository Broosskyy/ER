# Import Normalization (Sprint 12B)

## NormalizedEventCandidate

Central intermediate model in `src/features/import/models/normalized-event-candidate.ts`.

Required after normalization:

- `externalId`
- `title`
- `startDate`
- `rawSourceType`

All other fields optional. Original values remain in `raw_payload` on the import record.

## Normalization Pipeline

`EventNormalizer` (`src/features/import/normalization/event-normalizer.ts`):

1. Trim strings, collapse whitespace
2. Strip HTML safely (no script execution)
3. Decode HTML entities
4. Parse dates to ISO-8601 UTC
5. Resolve relative URLs against source base
6. Normalize artist/genre lists (split, dedupe)
7. Validate coordinate ranges

The normalizer performs **no database lookups** — no venue/city/artist/genre matching.

## Date Strategy

`date-time-normalizer.ts`:

- Output: ISO-8601 strings
- Preserves `isAllDay` flag for date-only values
- Missing timezone → warning + `defaultTimezone` from source if configured
- Invalid dates → normalization failure → `invalid` record status

## URL Strategy

`url-normalizer.ts`:

- Allowed: `http:`, `https:`
- Blocked: `javascript:`, `data:`, `file:`, `vbscript:`, `ftp:`
- Relative URLs resolved against `sourceUrl` or `website`

## Text Cleaning

`text-normalizer.ts`:

- Removes null bytes
- Strips HTML tags (including script/style blocks)
- Normalizes line breaks
- Enforces `importConfig` field length limits
- CSV formula injection prefix (`=`, `+`, `-`, `@`) sanitized on export paths

## Validation

`ImportCandidateValidator` returns:

```typescript
{
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  normalizedCandidate?: NormalizedEventCandidate;
}
```

### Required for validity

- `title`
- `startDate`
- At least one location signal: `venueName`, `cityName`, `venueAddress`, or coordinates

### Error codes

`TITLE_MISSING`, `START_DATE_MISSING`, `START_DATE_INVALID`, `END_DATE_BEFORE_START`, `LOCATION_MISSING`, `URL_INVALID`, `COORDINATES_INVALID`, `TIMEZONE_MISSING`, `FIELD_TOO_LONG`, `COUNTRY_CODE_INVALID`, `MINIMUM_AGE_INVALID`

### Warning codes

`TIMEZONE_MISSING`, `END_DATE_MISSING`, `DESCRIPTION_MISSING`, `URL_INVALID`, `FIELD_TRUNCATED`

## Record Status Mapping

| Validation result | Status |
|---|---|
| Normalization failed | `invalid` |
| Validation errors | `invalid` |
| Valid candidate | `needs_review` |

Statuses `duplicate`, `approved`, `rejected`, `imported` are reserved for Sprint 12C+.
