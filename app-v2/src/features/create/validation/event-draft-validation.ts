import { isValidHttpUrl } from '@/features/events/formatting/urls';

import {
  combineDateAndTime,
  EVENT_DRAFT_DESCRIPTION_MAX_LENGTH,
  EVENT_DRAFT_TITLE_MAX_LENGTH,
  isValidDateInput,
  isValidTimeInput,
  resolveEndDateTime,
} from '@/features/create/utils/event-draft-date-time';
import type {
  EventDraftFieldErrors,
  EventDraftFormValues,
  EventDraftValidationKey,
} from '@/features/create/types/event-draft-form';

function setError(
  errors: EventDraftFieldErrors,
  field: keyof EventDraftFormValues,
  key: EventDraftValidationKey,
): void {
  if (!errors[field]) {
    errors[field] = key;
  }
}

function validateOptionalUrl(
  errors: EventDraftFieldErrors,
  field: keyof EventDraftFormValues,
  value: string,
): void {
  const trimmed = value.trim();
  if (!trimmed) {
    return;
  }

  if (!isValidHttpUrl(trimmed)) {
    setError(errors, field, 'create.event.errors.invalidUrl');
  }
}

export function validateEventDraftForm(values: EventDraftFormValues): EventDraftFieldErrors {
  const errors: EventDraftFieldErrors = {};
  const title = values.title.trim();

  if (!title) {
    setError(errors, 'title', 'create.event.errors.titleRequired');
  } else if (title.length > EVENT_DRAFT_TITLE_MAX_LENGTH) {
    setError(errors, 'title', 'create.event.errors.titleTooLong');
  }

  if (!values.startDate.trim()) {
    setError(errors, 'startDate', 'create.event.errors.startDateRequired');
  } else if (!isValidDateInput(values.startDate.trim())) {
    setError(errors, 'startDate', 'create.event.errors.startDateInvalid');
  }

  if (!values.startTime.trim()) {
    setError(errors, 'startTime', 'create.event.errors.startTimeRequired');
  } else if (!isValidTimeInput(values.startTime.trim())) {
    setError(errors, 'startTime', 'create.event.errors.startTimeInvalid');
  }

  if (values.endDate.trim() && !isValidDateInput(values.endDate.trim())) {
    setError(errors, 'endDate', 'create.event.errors.endDateInvalid');
  }

  if (values.endTime.trim() && !isValidTimeInput(values.endTime.trim())) {
    setError(errors, 'endTime', 'create.event.errors.endTimeInvalid');
  }

  const startDateTime = combineDateAndTime(values.startDate.trim(), values.startTime.trim());
  const endDateTime = resolveEndDateTime(
    values.startDate.trim(),
    values.startTime.trim(),
    values.endDate.trim(),
    values.endTime.trim(),
  );

  if (startDateTime && endDateTime && endDateTime.getTime() < startDateTime.getTime()) {
    setError(errors, 'endDate', 'create.event.errors.endBeforeStart');
    setError(errors, 'endTime', 'create.event.errors.endBeforeStart');
  }

  if (!values.venueId.trim() && !values.venueText.trim()) {
    setError(errors, 'venueText', 'create.event.errors.venueRequired');
  }

  if (!values.genreId.trim()) {
    setError(errors, 'genreId', 'create.event.errors.genreRequired');
  }

  if (!values.description.trim()) {
    setError(errors, 'description', 'create.event.errors.descriptionRequired');
  }

  if (values.description.trim().length > EVENT_DRAFT_DESCRIPTION_MAX_LENGTH) {
    setError(errors, 'description', 'create.event.errors.descriptionTooLong');
  }

  validateOptionalUrl(errors, 'ticketUrl', values.ticketUrl);
  validateOptionalUrl(errors, 'websiteUrl', values.websiteUrl);
  validateOptionalUrl(errors, 'instagramUrl', values.instagramUrl);
  validateOptionalUrl(errors, 'facebookUrl', values.facebookUrl);

  return errors;
}

export function hasEventDraftErrors(errors: EventDraftFieldErrors): boolean {
  return Object.keys(errors).length > 0;
}
