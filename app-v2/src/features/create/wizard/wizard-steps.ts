export const WIZARD_STEP_IDS = [
  'organizer',
  'basics',
  'schedule',
  'venue',
  'genres',
  'lineup',
  'description',
  'media',
  'tickets',
  'social',
  'preview',
  'submit',
] as const;

export type WizardStepId = (typeof WIZARD_STEP_IDS)[number];

export const WIZARD_STEP_LABELS: Record<WizardStepId, string> = {
  organizer: 'Veranstalter',
  basics: 'Grundinformationen',
  schedule: 'Datum und Uhrzeit',
  venue: 'Veranstaltungsort',
  genres: 'Genres',
  lineup: 'Line-up',
  description: 'Beschreibung',
  media: 'Bilder',
  tickets: 'Tickets',
  social: 'Social Links',
  preview: 'Vorschau',
  submit: 'Einreichen',
};

export const WIZARD_STEP_DESCRIPTIONS: Partial<Record<WizardStepId, string>> = {
  organizer: 'Wer veranstaltet dieses Event?',
  basics: 'Name und grundlegende Angaben zum Event.',
  schedule: 'Wann findet das Event statt?',
  venue: 'Wo findet das Event statt?',
  genres: 'Welche Musikrichtungen passen?',
  lineup: 'Welche Artists spielen?',
  description: 'Beschreibung und Hinweise für Besucher.',
  media: 'Cover und weitere Bilder.',
  tickets: 'Ticketinformationen und Preise.',
  social: 'Links zu Website und Social Media.',
  preview: 'So sieht dein Event für Besucher aus.',
  submit: 'Prüfe deine Angaben und reiche das Event ein.',
};

export function getWizardStepIndex(stepId: WizardStepId): number {
  return WIZARD_STEP_IDS.indexOf(stepId);
}

export function getNextWizardStep(stepId: WizardStepId): WizardStepId | null {
  const index = getWizardStepIndex(stepId);
  return index < WIZARD_STEP_IDS.length - 1 ? WIZARD_STEP_IDS[index + 1]! : null;
}

export function getPreviousWizardStep(stepId: WizardStepId): WizardStepId | null {
  const index = getWizardStepIndex(stepId);
  return index > 0 ? WIZARD_STEP_IDS[index - 1]! : null;
}

export function buildWizardStepViewModels(
  currentStep: WizardStepId,
  completedSteps: readonly WizardStepId[],
  errorStep?: WizardStepId,
) {
  return WIZARD_STEP_IDS.map((id, index) => {
    const stepIndex = index + 1;
    let state: 'completed' | 'active' | 'upcoming' | 'error' = 'upcoming';
    if (id === errorStep) {
      state = 'error';
    } else if (id === currentStep) {
      state = 'active';
    } else if (completedSteps.includes(id)) {
      state = 'completed';
    }

    return {
      id,
      index: stepIndex,
      label: WIZARD_STEP_LABELS[id],
      state,
    };
  });
}
