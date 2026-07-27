# Event Submission Wizard — Bestandsaudit

## Vorhandene `/create`-Screens

| Route | Datei | Status |
|-------|-------|--------|
| `/create` | `app/create.tsx` → `CreateHubScreen` | Einstieg, Event + Account |
| `/create/event` | `app/create/event.tsx` | Einseitiges Formular (wird Wizard) |
| `/create/event/success` | `app/create/event/success.tsx` | Entwurf gespeichert |
| `/create/event/submitted` | `app/create/event/submitted.tsx` | Nach Einreichung |
| `/create/[option]` | `app/create/[option].tsx` | Placeholder Organizer/Venue/Artist |
| `/event/[id]/edit` | `app/event/[id]/edit.tsx` | Entwurf bearbeiten |
| `/event/[id]/preview` | `app/event/[id]/preview.tsx` | Vorschau + Einreichen |

## Wizard-Schritte (vor Sprint)

Keine Schritt-Routen. Alle Felder in `EventDraftForm` (eine ScrollView).

## Vorhandene Form-Komponenten

- `FormField`, `GenrePicker`, `VenueAutocomplete`, `EventImagesSection`, `EventImageUpload`
- Organizer-UI: `SubmissionProgress`, `SubmissionStepHeader`, `SubmissionFooterActions`, `SubmissionReviewCard` (Design Preview)
- Inputs: `MultilineInput` (nicht im Create-Flow verdrahtet)

## Placeholder

- `/create/organizer`, `/create/venue`, `/create/artist` — `CreatePlaceholderScreen`
- Multi-Step-Stepper nur in `Phase2HOrganizerAdminPreview`
- Line-up, erweiterte Ticket-Felder, Organizer-Auswahl — fehlend

## Fehlende Routen (vor Sprint)

- `/create/event/status/[id]` — Submission-Status
- Draft-Übersicht im Hub

## Lokale Persistenz

- `app.contributorEvents.v1` — `AdminEventRecord[]` via `local-contributor-event-storage.ts`
- Wizard-Metadaten (Schritt, Extension-Felder): neu `app.eventWizardDrafts.v1`

## Event-Datenmodell

- Form: `EventDraftFormValues` (`types/event-draft-form.ts`)
- Persistenz: `AdminEventRecord` via `event-draft-mapper.ts`
- Status: `draft` → `review` (Anzeige: `pending`)

## Mockup-Zuordnung

| Mockup | Wizard-Schritt |
|--------|----------------|
| 21_Create_Event_Step1 | Veranstalter + Grundinformationen |
| 26–30 Edit Event Steps | Entsprechende Wizard-Schritte |
| 24_Submission_Success | Success Screen |
| 22_Submissions | Submission Status |
| 31_Drafts_List | Create Hub Draft-Liste |

## Entfernen / Konsolidieren

- `EventDraftForm` als primärer Screen → durch `EventSubmissionWizard` ersetzen (Felder wiederverwendet)
- Doppelte Success-Buttons in `EventDraftSuccessScreen` bereinigen
- `EventDraftPreview` → Event-Detail-Komponenten für Vorschau
