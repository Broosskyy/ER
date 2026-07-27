# Event Draft Model

## EventDraft (Wizard-Persistenz)

```typescript
interface EventDraft {
  id: string;
  eventId?: string;
  organizerId: string;
  currentStep: WizardStepId;
  completedSteps: WizardStepId[];
  formData: EventFormData;
  createdAt: string;
  updatedAt: string;
  autosavedAt?: string;
  status: 'draft' | 'submitted';
}
```

## EventFormData

```typescript
interface EventFormData {
  core: EventDraftFormValues;      // bestehendes Flat-Form-Modell
  extension: EventWizardExtension; // Organizer, Line-up, Tickets, Venue-Details
}
```

## EventWizardExtension (lokal, nicht in AdminEventRecord)

- `organizerDisplayName`, `organizerContactEmail`
- `subtitle`, `genreIds[]`, `lineup[]`
- `shortDescription`, `highlights`, `awarenessNotes`, `entryRules`
- `ticketMode`, `ticketProvider`, `priceFrom`, `priceTo`
- `street`, `houseNumber`, `postalCode`, `city`, `country`
- `indoorOutdoor`, `secretLocation`, `timezone`, `multiDay`, `doorsOpen`
- `tiktokUrl`, `telegramUrl`

## Persistenz

| Key | Inhalt |
|-----|--------|
| `app.contributorEvents.v1` | `AdminEventRecord` (Kern-Eventdaten) |
| `app.eventWizardDrafts.v1` | `EventDraft[]` (Wizard-State + Extension) |

## Mapping

- `genreIds[0]` → `AdminEventRecord.genreId`
- `extension.organizerDisplayName` → `organizerName`
- `extension.city` + Adresse → `venueCity`, `venueName`
- Line-up → lokal in Extension (Detail-Vorschau)
