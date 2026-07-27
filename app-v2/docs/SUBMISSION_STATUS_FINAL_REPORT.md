# Submission Status Final Report

**Sprint:** ORGANIZER PROFILE + MY EVENTS + SUBMISSION STATUS FINAL  
**Date:** 2026-07-26  
**Status:** Complete

## Summary

The submission status screen now shows a full German-localized timeline using existing organizer submission components, with dynamic status resolution from local submission and admin event records.

## Route

`/create/event/status/[id]` — accepts submission ID or event ID

## Timeline steps

1. Entwurf (`draft`)
2. Eingereicht (`pending`)
3. In Prüfung (`in_review`)
4. Änderungen erforderlich (`needs_changes`) — shown when relevant
5. Erneut eingereicht (`resubmitted`) — shown when relevant
6. Genehmigt (`approved`)
7. Veröffentlicht (`published`)
8. Archiviert (`archived`)

## Components reused

- `SubmissionStatusBanner`
- `SubmissionProgress` (numbered stepper from mockup 21)
- `AppText`, `Stack`, `SafeAreaContainer`

## Core logic

- `submission-status-timeline.ts` — step builder and German labels
- `resolveEventSubmission()` — lookup by submission or event ID
- `buildSubmissionFromAdminEvent()` — fallback for events without submission record
- `resolveSubmissionDisplayStatus()` — merges admin event status with submission status

## i18n

All strings under `submissionStatus.*` in `de.ts`:

- Banner titles/messages per status
- Meta labels (status, submitted at, updated at)
- History section title
- Action button labels

## Navigation

```
Wizard submit → /create/event/status/{submissionId}
My Events → Einreichungsstatus → /create/event/status/{submissionId|eventId}
Published status → Öffentliche Seite → /event/{id}
Status screen → Meine Events → /profile/events
```

## Tests

- `submission-status-timeline.test.ts`

## QA screenshots

- `submission-status-mobile-light.png`

## Known limits

- Status transitions after submit are local placeholders (no admin review backend)
- `approved` step appears only when submission history includes it
- History is append-only from wizard submit; admin actions not simulated

## Next sprint

Admin review will drive real status transitions (`needs_changes`, `approved`, `published`).
