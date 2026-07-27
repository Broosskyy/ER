# Event Submission Wizard Final

## Summary

The contributor event flow at `/create/event` is now a **12-step submission wizard** using the existing organizer submission components. Create and edit-draft modes are fully functional; additional modes are typed for future use.

## Changed files

- `src/features/create/components/ContributorEventFormScreen.tsx` — hosts `EventSubmissionWizard`
- `src/features/create/components/EventSubmissionWizard.tsx` — wizard orchestrator
- `src/features/create/components/wizard/WizardStepContent.tsx` — step field UI
- `src/features/create/components/wizard/EventWizardDetailPreview.tsx` — Phase 2F preview
- `src/features/create/components/CreateHubScreen.tsx` — draft list on hub
- `src/features/create/components/GenrePicker.tsx` — multi-select support
- `src/features/create/components/EventSubmissionStatusScreen.tsx` — post-submit status
- `app/create/event/status/[id].tsx` — status route

## New files

### Wizard core
- `src/features/create/wizard/wizard-steps.ts`
- `src/features/create/wizard/wizard-types.ts`
- `src/features/create/wizard/wizard-validation.ts`
- `src/features/create/wizard/event-wizard-storage.ts`
- `src/features/create/wizard/event-submission-service.ts`
- `src/features/create/wizard/use-event-submission-wizard.ts`
- `src/features/create/wizard/wizard-preview-mapper.ts`

### Tests
- `src/features/create/__tests__/event-submission-wizard.test.ts`
- `src/features/create/__tests__/event-submission-wizard-wiring.test.ts`

### Documentation
- `docs/EVENT_SUBMISSION_WIZARD_AUDIT.md`
- `docs/EVENT_SUBMISSION_WIZARD_FLOW.md`
- `docs/EVENT_DRAFT_MODEL.md`
- `docs/EVENT_SUBMISSION_MODEL.md`
- `scripts/capture-event-submission-wizard-screenshots.mjs`

## Wizard steps

1. Veranstalter → 2. Grundinformationen → 3. Datum/Uhrzeit → 4. Ort → 5. Genres → 6. Line-up → 7. Beschreibung → 8. Bilder → 9. Tickets → 10. Social → 11. Vorschau → 12. Einreichen

## Modes

| Mode | Status |
|------|--------|
| `create` | Functional |
| `editDraft` | Functional |
| `editRequestedChanges` | Typed only |
| `editPublished` | Typed only |
| `claimImportedEvent` | Typed only |

## Architecture

- **Form state:** `EventFormData` = `core` (`EventDraftFormValues`) + `extension` (`EventWizardExtension`)
- **Validation:** central `validateWizardStep` / `validateFullSubmission`
- **Draft persistence:** `app.eventWizardDrafts.v1` (wizard meta) + `app.contributorEvents.v1` (event record when valid)
- **Autosave:** 2s debounce to wizard storage
- **Submission:** `app.eventSubmissions.v1`, status `pending` (internal `review`)
- **Preview:** reuses `EventHero`, `EventInfoSection`, `LineupSection`, `VenueDetailCard`, `OrganizerDetailCard`, `EventTicketSection`

## Verification

- `npm run typecheck` — passed
- `npm test` — 688 tests (after fixes)

## Known gaps

- Partial contributor sync before all required fields are valid (wizard storage only until then)
- Extended venue address fields stored in extension, not yet in `AdminEventRecord`
- Line-up stored in extension; not synced to event pipeline lineup table
- `editRequestedChanges` / `editPublished` / `claimImportedEvent` modes not wired
- Screenshot capture requires authenticated dev session on port 8091

## Recommended next sprint

**ORGANIZER PROFILE + MY EVENTS + SUBMISSION STATUS FINAL** — deepen submission status timeline, requested-changes flow, and organizer profile integration.
