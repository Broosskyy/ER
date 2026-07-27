import { describe, expect, it } from 'vitest';

import { EMPTY_EVENT_DRAFT_FORM } from '@/features/create/types/event-draft-form';
import { createEmptyEventDraft } from '@/features/create/wizard/event-wizard-storage';
import {
  createLineupEntry,
} from '@/features/create/wizard/wizard-types';
import {
  getNextWizardStep,
  getPreviousWizardStep,
  WIZARD_STEP_IDS,
} from '@/features/create/wizard/wizard-steps';
import {
  validateFullSubmission,
  validateWizardStep,
} from '@/features/create/wizard/wizard-validation';

function buildValidFormData() {
  const draft = createEmptyEventDraft();
  draft.formData.core = {
    ...EMPTY_EVENT_DRAFT_FORM,
    title: 'VOID Rave',
    startDate: '2026-05-24',
    startTime: '23:00',
    venueText: 'Bootshaus',
    genreId: 'techno',
    description: 'Ein Techno-Abend in Köln.',
    ticketUrl: 'https://example.com/tickets',
  };
  draft.formData.extension = {
    ...draft.formData.extension,
    organizerDisplayName: 'VOID Events',
    city: 'Köln',
    genreIds: ['techno'],
    ticketMode: 'external',
    ticketProvider: 'Resident Advisor',
    legalConfirmed: true,
    accuracyConfirmed: true,
  };
  return draft.formData;
}

describe('event submission wizard', () => {
  it('defines twelve wizard steps in order', () => {
    expect(WIZARD_STEP_IDS).toHaveLength(12);
    expect(WIZARD_STEP_IDS[0]).toBe('organizer');
    expect(WIZARD_STEP_IDS.at(-1)).toBe('submit');
  });

  it('navigates steps forward and backward', () => {
    expect(getNextWizardStep('organizer')).toBe('basics');
    expect(getPreviousWizardStep('basics')).toBe('organizer');
  });

  it('requires organizer and title on early steps', () => {
    const draft = createEmptyEventDraft();
    expect(validateWizardStep('organizer', draft.formData).isValid).toBe(false);
    expect(validateWizardStep('basics', draft.formData).isValid).toBe(false);

    draft.formData.extension.organizerDisplayName = 'VOID Events';
    draft.formData.core.title = 'Test Event';
    expect(validateWizardStep('organizer', draft.formData).isValid).toBe(true);
    expect(validateWizardStep('basics', draft.formData).isValid).toBe(true);
  });

  it('rejects end before start on schedule step', () => {
    const formData = buildValidFormData();
    formData.core.endDate = '2026-05-23';
    formData.core.endTime = '22:00';
    expect(validateWizardStep('schedule', formData).isValid).toBe(false);
  });

  it('supports lineup add and remove with stable ids', () => {
    const draft = createEmptyEventDraft();
    const entry = createLineupEntry('DJ Example');
    draft.formData.extension.lineup = [entry];
    expect(draft.formData.extension.lineup).toHaveLength(1);
    draft.formData.extension.lineup = [];
    expect(validateWizardStep('lineup', draft.formData).isValid).toBe(true);
  });

  it('validates external ticket links', () => {
    const formData = buildValidFormData();
    formData.core.ticketUrl = 'not-a-url';
    expect(validateWizardStep('tickets', formData).isValid).toBe(false);
    formData.extension.ticketMode = 'free';
    formData.core.ticketUrl = '';
    expect(validateWizardStep('tickets', formData).isValid).toBe(true);
  });

  it('requires legal confirmations before submit', () => {
    const formData = buildValidFormData();
    formData.extension.legalConfirmed = false;
    expect(validateWizardStep('submit', formData).isValid).toBe(false);
    formData.extension.legalConfirmed = true;
    formData.extension.accuracyConfirmed = true;
    expect(validateFullSubmission(formData).isValid).toBe(true);
  });
});
