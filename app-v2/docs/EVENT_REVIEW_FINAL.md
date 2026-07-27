# Event Review Final

**Sprint:** ADMIN EVENT REVIEW + MODERATION + SOURCES FINAL  
**Date:** 2026-07-26  
**Status:** Complete

## Summary

Administrators can review contributor event submissions end-to-end: inspect full event data, view status history, approve, request changes, reject, and publish separately.

## Routes

| Route | Screen |
|-------|--------|
| `/admin/events/review` | Pending / review queue |
| `/admin/events/review?filter=pending` | Filtered queue |
| `/admin/events/review/[id]` | Event review detail |
| `/admin/events/review/[id]/duplicates` | Duplicate review |

## Pending queue (per event)

Each queue card shows:

- Titel
- Veranstalter
- Datum
- Venue / Stadt
- Einreichungsdatum
- Status (German badge)
- Quelle (Community-Einreichung)
- Priorität (vorbereitet: Standard)

Actions:

- Öffnen / Prüfen → review detail
- Schnellaktionen → review detail (approve/changes/reject on detail screen)

## Review detail

Displays:

- Eventdaten (Titel, Datum, Genre, Stadt, Venue)
- Bilder (Cover, Flyer)
- Beschreibung
- Tickets, Website, Social Links
- Veranstalter
- Quellenattribution
- Statushistorie (`ReviewTimeline`)

## Moderation actions

| Action | Effect | Auto-publish |
|--------|--------|--------------|
| Genehmigen | Queue → `approved`, event stays `review` | No |
| Änderungen anfordern | Queue → `needs_changes`, organizer synced | No |
| Ablehnen | Queue → `rejected` | No |
| Veröffentlichen | Event → `published` (only when approved) | Separate step |
| Als in Prüfung markieren | Queue → `in_review` | No |

Reason codes: `MODERATION_REASON_CODES` with German labels.

## Navigation

- Dashboard → Pending queue
- Queue → Review detail
- Review → Dublettenprüfung
- Review → Event-Editor (`/admin/events/[id]`)
- Review → Veranstalter-Profil (`/profile/organizer`)
- Review → Öffentliche Eventseite (`/event/[id]`)
- Zurück → previous screen

## Components reused

- `AdminReviewCard`
- `AdminDecisionBar`
- `ReviewReasonField`
- `ReviewTimeline`
- `SourceAttributionRow`
- `EventStatusBadge` patterns via review mapper

## Services

- `AdminEventModerationService`
- `AdminModerationStateService`
- `EventModerationAuditService`
- `syncSubmissionAfterModeration()` — organizer submission sync

## Tests

- `admin-event-moderation-service.test.ts` — approve, publish, needs-changes, reject
- `admin-review-mapper.test.ts` — review cards, timeline, status labels
- `admin-navigation.test.ts` — route builders

## QA screenshots

See `docs/visual-qa/admin-review-final/`:

- `admin-pending-desktop-light.png`
- `admin-review-desktop-light.png`
