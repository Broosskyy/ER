import { hasEventDraftErrors, validateEventDraftForm } from '@/features/create/validation/event-draft-validation';
import { isValidHttpUrl } from '@/features/events/formatting/urls';
import type { EventDraftFieldErrors, EventDraftFormValues } from '@/features/create/types/event-draft-form';

import type { EventFormData, EventWizardExtension } from './wizard-types';
import type { WizardStepId } from './wizard-steps';
import { WIZARD_STEP_IDS } from './wizard-steps';

const STEP_FIELDS: Partial<Record<WizardStepId, Array<keyof EventDraftFormValues>>> = {
  basics: ['title'],
  schedule: ['startDate', 'startTime', 'endDate', 'endTime'],
  venue: ['venueId', 'venueText'],
  genres: ['genreId'],
  description: ['description'],
  media: ['coverImage', 'flyerImage'],
  tickets: ['ticketUrl'],
  social: ['websiteUrl', 'instagramUrl', 'facebookUrl'],
};

function pickFieldErrors(
  allErrors: EventDraftFieldErrors,
  fields: Array<keyof EventDraftFormValues>,
): EventDraftFieldErrors {
  const picked: EventDraftFieldErrors = {};
  for (const field of fields) {
    if (allErrors[field]) {
      picked[field] = allErrors[field];
    }
  }
  return picked;
}

function validateOrganizer(extension: EventWizardExtension): string | undefined {
  if (!extension.organizerDisplayName.trim()) {
    return 'Bitte gib einen Veranstalternamen an.';
  }
  return undefined;
}

function validateExtensionUrl(value: string): boolean {
  const trimmed = value.trim();
  return !trimmed || isValidHttpUrl(trimmed);
}

function validateTickets(core: EventDraftFormValues, extension: EventWizardExtension): EventDraftFieldErrors {
  const errors: EventDraftFieldErrors = {};

  if (extension.ticketMode === 'external') {
    if (!core.ticketUrl.trim()) {
      errors.ticketUrl = 'create.event.errors.invalidUrl';
    } else if (!isValidHttpUrl(core.ticketUrl.trim())) {
      errors.ticketUrl = 'create.event.errors.invalidUrl';
    }
  }

  if (extension.ticketMode === 'free' && core.ticketUrl.trim()) {
    errors.ticketUrl = 'create.event.errors.invalidUrl';
  }

  return errors;
}

function validateSocial(core: EventDraftFormValues, extension: EventWizardExtension): EventDraftFieldErrors {
  const errors: EventDraftFieldErrors = {};
  const urlFields: Array<keyof EventDraftFormValues> = [
    'websiteUrl',
    'instagramUrl',
    'facebookUrl',
    'ticketUrl',
  ];

  for (const field of urlFields) {
    const value = core[field];
    if (typeof value === 'string' && !validateExtensionUrl(value)) {
      errors[field] = 'create.event.errors.invalidUrl';
    }
  }

  if (extension.tiktokUrl.trim() && !validateExtensionUrl(extension.tiktokUrl)) {
    errors.websiteUrl = 'create.event.errors.invalidUrl';
  }

  if (extension.telegramUrl.trim() && !validateExtensionUrl(extension.telegramUrl)) {
    errors.websiteUrl = 'create.event.errors.invalidUrl';
  }

  return errors;
}

function validateVenueExtension(extension: EventWizardExtension): string | undefined {
  if (extension.secretLocation) {
    return undefined;
  }

  if (!extension.city.trim()) {
    return 'Bitte gib eine Stadt an.';
  }

  return undefined;
}

function validateSubmit(extension: EventWizardExtension): string[] {
  const issues: string[] = [];
  if (!extension.legalConfirmed) {
    issues.push('Bitte bestätige die rechtlichen Hinweise.');
  }
  if (!extension.accuracyConfirmed) {
    issues.push('Bitte bestätige, dass deine Angaben korrekt sind.');
  }
  return issues;
}

export interface StepValidationResult {
  fieldErrors: EventDraftFieldErrors;
  extensionError?: string;
  submitIssues?: string[];
  isValid: boolean;
}

export function validateWizardStep(
  stepId: WizardStepId,
  formData: EventFormData,
): StepValidationResult {
  const allErrors = validateEventDraftForm(formData.core);
  const fields = STEP_FIELDS[stepId] ?? [];
  let fieldErrors = pickFieldErrors(allErrors, fields);
  let extensionError: string | undefined;
  let submitIssues: string[] | undefined;

  switch (stepId) {
    case 'organizer':
      extensionError = validateOrganizer(formData.extension);
      break;
    case 'venue':
      fieldErrors = { ...fieldErrors, ...pickFieldErrors(allErrors, ['venueId', 'venueText']) };
      extensionError = validateVenueExtension(formData.extension);
      break;
    case 'genres':
      if (formData.extension.genreIds.length === 0 && !formData.core.genreId.trim()) {
        fieldErrors.genreId = 'create.event.errors.genreRequired';
      }
      break;
    case 'tickets':
      fieldErrors = { ...fieldErrors, ...validateTickets(formData.core, formData.extension) };
      break;
    case 'social':
      fieldErrors = { ...fieldErrors, ...validateSocial(formData.core, formData.extension) };
      break;
    case 'submit':
      submitIssues = validateSubmit(formData.extension);
      fieldErrors = allErrors;
      break;
    case 'lineup':
      return { fieldErrors: {}, isValid: true };
    case 'preview':
      return { fieldErrors: {}, isValid: true };
    default:
      break;
  }

  const isValid =
    !extensionError &&
    !hasEventDraftErrors(fieldErrors) &&
    !(submitIssues && submitIssues.length > 0);

  return { fieldErrors, extensionError, submitIssues, isValid };
}

export function validateFullSubmission(formData: EventFormData): StepValidationResult {
  const allErrors = validateEventDraftForm(formData.core);
  const extensionError =
    validateOrganizer(formData.extension) ?? validateVenueExtension(formData.extension);
  const ticketErrors = validateTickets(formData.core, formData.extension);
  const socialErrors = validateSocial(formData.core, formData.extension);
  const submitIssues = validateSubmit(formData.extension);

  const fieldErrors = { ...allErrors, ...ticketErrors, ...socialErrors };

  if (formData.extension.genreIds.length === 0 && !formData.core.genreId.trim()) {
    fieldErrors.genreId = 'create.event.errors.genreRequired';
  }

  const isValid =
    !extensionError &&
    !hasEventDraftErrors(fieldErrors) &&
    submitIssues.length === 0;

  return { fieldErrors, extensionError, submitIssues, isValid };
}

export function findFirstInvalidStep(formData: EventFormData): WizardStepId | null {
  for (const stepId of WIZARD_STEP_IDS) {
    if (stepId === 'preview') {
      continue;
    }
    const result = validateWizardStep(stepId, formData);
    if (!result.isValid) {
      return stepId;
    }
  }
  return null;
}
