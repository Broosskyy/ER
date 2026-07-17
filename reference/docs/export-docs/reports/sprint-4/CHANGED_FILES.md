# Sprint 4 — Changed Files

## Created

| Path | Purpose |
|------|---------|
| `src/hooks/useOrganizerEvents.ts` | Unified organizer data + CRUD actions |
| `src/utils/organizerFormMapper.ts` | Form ↔ domain entity mapping |
| `src/utils/organizerFormValidation.ts` | Step + full form validation UI |
| `src/components/EventStatusTimeline.tsx` | Lifecycle status timeline |
| `src/components/OrganizerEventCard.tsx` | Dashboard event card |
| `app/admin/review/[id].tsx` | Admin review detail + moderation actions |
| `docs/reports/sprint-4/*` | Sprint deliverables |

## Modified

| Path | Change |
|------|--------|
| `app/organizer.tsx` | Tabs, stats, empty/loading/error, Supabase wiring |
| `app/organizer/create-event.tsx` | Validation, useOrganizerEvents, draft/submit flows |
| `app/organizer/edit/[id].tsx` | Backend edit, timeline, delete, validation |
| `app/organizer/preview/[id].tsx` | Entity-based preview, status timeline |
| `app/admin/review-events.tsx` | useReviewQueue backend + demo fallback |
| `src/components/FormField.tsx` | `error` prop for inline validation |
| `src/components/StatusBadge.tsx` | DB lifecycle status normalization |
| `src/components/index.ts` | Export new components |
