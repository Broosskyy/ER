import AsyncStorage from '@react-native-async-storage/async-storage';

import { EMPTY_EVENT_DRAFT_FORM } from '@/features/create/types/event-draft-form';

import type { EventDraft } from './wizard-types';
import { EMPTY_EVENT_WIZARD_EXTENSION } from './wizard-types';
import { createDraftId } from './wizard-types';
import type { WizardStepId } from './wizard-steps';

export const EVENT_WIZARD_DRAFTS_STORAGE_KEY = 'app.eventWizardDrafts.v1';

function isEventDraft(value: unknown): value is EventDraft {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const draft = value as EventDraft;
  return (
    typeof draft.id === 'string' &&
    typeof draft.organizerId === 'string' &&
    typeof draft.currentStep === 'string' &&
    Array.isArray(draft.completedSteps) &&
    draft.formData?.core &&
    draft.formData?.extension &&
    typeof draft.createdAt === 'string' &&
    typeof draft.updatedAt === 'string'
  );
}

export function createEmptyEventDraft(overrides?: Partial<Pick<EventDraft, 'id' | 'eventId'>>): EventDraft {
  const now = new Date().toISOString();
  return {
    id: overrides?.id ?? createDraftId(),
    eventId: overrides?.eventId,
    organizerId: '',
    currentStep: 'organizer',
    completedSteps: [],
    formData: {
      core: { ...EMPTY_EVENT_DRAFT_FORM },
      extension: { ...EMPTY_EVENT_WIZARD_EXTENSION },
    },
    createdAt: now,
    updatedAt: now,
    status: 'draft',
  };
}

export async function loadEventWizardDrafts(): Promise<EventDraft[]> {
  try {
    const raw = await AsyncStorage.getItem(EVENT_WIZARD_DRAFTS_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isEventDraft);
  } catch {
    return [];
  }
}

export async function saveEventWizardDrafts(drafts: EventDraft[]): Promise<void> {
  try {
    await AsyncStorage.setItem(EVENT_WIZARD_DRAFTS_STORAGE_KEY, JSON.stringify(drafts));
  } catch {
    // Best-effort local persistence.
  }
}

export async function getEventWizardDraft(draftId: string): Promise<EventDraft | null> {
  const drafts = await loadEventWizardDrafts();
  return drafts.find((draft) => draft.id === draftId) ?? null;
}

export async function getEventWizardDraftByEventId(eventId: string): Promise<EventDraft | null> {
  const drafts = await loadEventWizardDrafts();
  return drafts.find((draft) => draft.eventId === eventId) ?? null;
}

export async function upsertEventWizardDraft(draft: EventDraft): Promise<EventDraft> {
  const drafts = await loadEventWizardDrafts();
  const index = drafts.findIndex((entry) => entry.id === draft.id);
  const next = { ...draft, updatedAt: new Date().toISOString() };

  if (index >= 0) {
    drafts[index] = next;
  } else {
    drafts.unshift(next);
  }

  await saveEventWizardDrafts(drafts);
  return next;
}

export async function deleteEventWizardDraft(draftId: string): Promise<void> {
  const drafts = await loadEventWizardDrafts();
  await saveEventWizardDrafts(drafts.filter((draft) => draft.id !== draftId));
}

export async function markWizardDraftSubmitted(draftId: string): Promise<void> {
  const draft = await getEventWizardDraft(draftId);
  if (!draft) {
    return;
  }

  await upsertEventWizardDraft({
    ...draft,
    status: 'submitted',
    autosavedAt: new Date().toISOString(),
  });
}

export function touchWizardDraftStep(
  draft: EventDraft,
  currentStep: WizardStepId,
  completedSteps?: WizardStepId[],
): EventDraft {
  return {
    ...draft,
    currentStep,
    completedSteps: completedSteps ?? draft.completedSteps,
    autosavedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
