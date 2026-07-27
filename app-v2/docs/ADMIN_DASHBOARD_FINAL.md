# Admin Dashboard Final

**Sprint:** ADMIN EVENT REVIEW + MODERATION + SOURCES FINAL  
**Date:** 2026-07-26  
**Status:** Complete

## Summary

The admin dashboard is the central moderation overview. All counts are derived from real contributor events and local moderation state — no fake statistics.

## Route

| Route | Screen |
|-------|--------|
| `/admin` | Moderation dashboard |

## Dashboard areas

| Area | Data source | Navigation |
|------|-------------|------------|
| Ausstehend | `getDashboardCounts().pending` | `/admin/events/review?filter=pending` |
| In Prüfung | `getDashboardCounts().in_review` | `/admin/events/review?filter=in_review` |
| Änderungen erforderlich | `getDashboardCounts().needs_changes` | `/admin/events/review?filter=needs_changes` |
| Genehmigt | `getDashboardCounts().approved` | `/admin/events/review?filter=approved` |
| Veröffentlicht | `getDashboardCounts().published` | `/admin/events/review?filter=published` |
| Abgelehnt | `getDashboardCounts().rejected` | `/admin/events/review?filter=rejected` |
| Meldungen | 0 (prepared, no backend) | Informational only |
| Quellen | `sourceService.listForAdmin().total` | `/admin/sources` |

## Components reused

- `AdminDashboardHeader`
- `AdminMetricGrid`
- `AdminQueueTabs`
- `PrimaryButton` / `SecondaryButton`
- `AdminLoadingState` / `AdminErrorState`

## Implementation

- Screen: `src/features/admin/components/AdminDashboardContent.tsx`
- Route: `app/admin/index.tsx`
- Metrics mapper: `src/features/admin/utils/admin-review-mapper.ts`
- Counts service: `AdminEventModerationService.getDashboardCounts()`

## Moderation status model

Queue statuses (local overlay on event records):

- `pending`
- `in_review`
- `needs_changes`
- `approved`
- `published`
- `rejected`
- `archived`

## Tests

- `admin-review-mapper.test.ts` — dashboard metrics
- `admin-event-moderation-service.test.ts` — `getDashboardCounts`
- `admin-navigation.test.ts` — route wiring

## QA screenshots

```bash
node scripts/capture-admin-review-final-screenshots.mjs
```

Outputs in `docs/visual-qa/admin-review-final/`:

- `admin-dashboard-desktop-light.png`
- `admin-dashboard-mobile-light.png`
- `admin-dashboard-mobile-dark.png`
