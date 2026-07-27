# My Events Final Report

**Sprint:** ORGANIZER PROFILE + MY EVENTS + SUBMISSION STATUS FINAL  
**Date:** 2026-07-26  
**Status:** Complete

## Summary

My Events now separates the full contributor event lifecycle with status-aware filters, actions, and navigation to submission status and event detail.

## Filter categories

| Filter | German label | Maps to |
|--------|--------------|---------|
| `all` | Alle | All events |
| `draft` | Entwürfe | `status === draft` |
| `submitted` | Eingereicht | `review` + submission `pending` (or legacy review) |
| `in_review` | In Prüfung | `review` + submission `in_review` |
| `needs_changes` | Änderungen erforderlich | `rejected` or submission `needs_changes` |
| `published` | Veröffentlicht | `status === published` |
| `archived` | Archiviert | `status === archived` |

## Actions by status

| Status | Actions |
|--------|---------|
| Draft | Bearbeiten, Vorschau, Entwurf löschen |
| Review (pending/submitted) | Einreichungsstatus, Vorschau, Zurückziehen |
| Rejected (needs changes) | Bearbeiten, Erneut einreichen, Einreichungsstatus |
| Published | Öffentliche Seite, Einreichungsstatus, Duplizieren/Archivieren (vorbereitet, disabled) |
| Archived | Einreichungsstatus, Vorschau |

## Components reused

- `MyEventCard` (extended)
- `AdminEventStatusBadge` (new thin wrapper over `Badge`)
- `FilterChip`
- `EmptyState`
- `PrimaryButton` / `SecondaryButton` / `GhostButton`

## Service changes

- `contributorEventService.deleteDraft()` — hard-deletes local drafts
- `contributorEventService.resubmitForReview()` — rejected → review
- `CONTRIBUTOR_EDITABLE_STATUSES` includes `rejected`
- `CONTRIBUTOR_ALLOWED_TRANSITIONS.rejected` → `['review', 'draft']`

## Navigation

```
Profile → My Events (/profile/events)
My Events → Draft edit (/event/{id}/edit)
My Events → Submission status (/create/event/status/{id})
Published → Event detail (/event/{id})
```

## Tests

- `my-events-filters.test.ts` (updated for sprint filters)

## QA screenshots

- `my-events-mobile-light.png`
- `my-events-mobile-dark.png`
- `my-events-desktop-light.png`

## Known limits

- Duplicate and archive actions are UI placeholders (disabled)
- Submission status differentiation for `submitted` vs `in_review` depends on local submission record
- No admin moderation UI in this sprint
