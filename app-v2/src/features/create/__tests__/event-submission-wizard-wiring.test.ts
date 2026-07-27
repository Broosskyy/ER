import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const createEventSource = readFileSync(join(process.cwd(), 'app/create/event.tsx'), 'utf8');
const contributorFormSource = readFileSync(
  join(process.cwd(), 'src/features/create/components/ContributorEventFormScreen.tsx'),
  'utf8',
);
const wizardSource = readFileSync(
  join(process.cwd(), 'src/features/create/components/EventSubmissionWizard.tsx'),
  'utf8',
);
const previewSource = readFileSync(
  join(process.cwd(), 'src/features/create/components/wizard/EventWizardDetailPreview.tsx'),
  'utf8',
);

describe('event submission wizard wiring', () => {
  it('uses the shared submission wizard on /create/event', () => {
    expect(createEventSource).toContain('EventDraftFormScreen');
    expect(contributorFormSource).toContain('EventSubmissionWizard');
    expect(wizardSource).toContain('SubmissionStepHeader');
    expect(wizardSource).toContain('WizardStepContent');
  });

  it('reuses event detail components for preview', () => {
    expect(previewSource).toContain('EventHero');
    expect(previewSource).toContain('EventInfoSection');
    expect(previewSource).toContain('EventTicketSection');
    expect(previewSource).toContain('LineupSection');
  });
});
