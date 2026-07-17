# Sprint 3 — Changed Files

## Created

| Path | Purpose |
|------|---------|
| `src/domain/event/types.ts` | EventEntity, address, automation meta |
| `src/domain/event/status.ts` | Lifecycle transitions |
| `src/domain/event/permissions.ts` | Organizer/admin permissions |
| `src/domain/event/index.ts` | Barrel export |
| `src/repositories/eventRepository.ts` | Event data access |
| `src/validation/eventValidation.ts` | Validation layer |
| `src/utils/eventEntityMapper.ts` | Row ↔ entity mapper |
| `src/services/eventLifecycleService.ts` | Lifecycle + audit |
| `src/services/eventDraftService.ts` | Draft CRUD |
| `src/services/eventSubmissionService.ts` | Submissions + history |
| `src/services/eventReviewService.ts` | Review queue |
| `src/hooks/useEventDraft.ts` | Draft hook |
| `src/hooks/useEventSubmission.ts` | Submission hook |
| `src/hooks/useReviewQueue.ts` | Review hook |
| `supabase/migrations/006_event_foundation.sql` | DB extensions |
| `docs/reports/sprint-3/*` | Deliverables |

## Modified

| Path | Change |
|------|--------|
| `src/types/database.ts` | Extended EventRow, audit types |
| `src/types/lifecycle.ts` | Archived, Deleted statuses |
| `src/utils/lifecycleMap.ts` | New status mappings |
| `src/services/events.ts` | Lifecycle via service |
| `src/services/eventService.ts` | Sprint 3 exports |
| `supabase/README.md` | Migration 006 |
| `docs/analysis/06_architecture_review.md` | Sprint 3 note |
