# Bootshaus Live Smoke Test

Manual development smoke test for the first real public source. **Not part of CI.**

## Prerequisites

- Network access to `https://bootshaus.tv/events/`
- No publish or scheduler side effects

## Command

```bash
cd app-v2
npx tsx scripts/dev/bootshaus-live-smoke-test.ts
```

## What It Does

1. Loads `createBootshausKoelnLiveSourceRecord()` (no fixture HTML)
2. Runs `WebsiteProcessor.detect()` against the live events page
3. Runs `WebsiteProcessor.process()` with strict limits:
   - `maxEventsPerRun: 10`
   - `maxPagesPerRun: 1`
   - `maxDetailPages: 0`
4. Prints detection report + sample extracted events
5. Does **not** write to database or publish

## Expected Output

- `recommendedStrategy: html_selector`
- `javascriptRenderingSuspected: false`
- `eventContainerCount` > 0
- Sample events with title, ISO-like start date, and `bootshaus.tv/events/...` URLs

## Safety

- Uses `EternalRave-SourceBot/1.0` user agent
- Respects SSRF rules via `importFetchService`
- Low request volume (single list page)
- No auto-publish, no import job creation

## Full Pipeline Test (development)

For a controlled import through review (in-memory/local stack), run tests:

```bash
npm test -- src/features/sources/production/__tests__/bootshaus-source.test.ts
```

This uses fixture HTML only and validates the full `AggregationPipeline` through `needs_review`.
