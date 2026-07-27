import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AdminEventRecord } from '@/data/types/records';
import {
  createContributorEvent,
  submitContributorEventForReview,
  updateContributorEvent,
} from '@/features/create/services/contributor-event-service';
import type { EventDraftLinkLabels } from '@/features/create/mappers/event-draft-mapper';
import type { EventDraftFormValues } from '@/features/create/types/event-draft-form';
import { hasEventDraftErrors, validateEventDraftForm } from '@/features/create/validation/event-draft-validation';

import {
  deleteEventWizardDraft,
  getEventWizardDraft,
  markWizardDraftSubmitted,
  upsertEventWizardDraft,
} from './event-wizard-storage';
import type { EventDraft, EventSubmission, SubmissionDisplayStatus } from './wizard-types';
import { validateFullSubmission } from './wizard-validation';

export const EVENT_SUBMISSIONS_STORAGE_KEY = 'app.eventSubmissions.v1';

function mapAdminStatusToDisplay(status: AdminEventRecord['status']): SubmissionDisplayStatus {
  if (status === 'review') {
    return 'pending';
  }
  if (status === 'draft') {
    return 'draft';
  }
  if (status === 'published') {
    return 'published';
  }
  if (status === 'rejected') {
    return 'rejected';
  }
  if (status === 'archived') {
    return 'archived';
  }
  return 'draft';
}

function isEventSubmission(value: unknown): value is EventSubmission {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const submission = value as EventSubmission;
  return (
    typeof submission.id === 'string' &&
    typeof submission.eventId === 'string' &&
    typeof submission.status === 'string'
  );
}

export async function loadEventSubmissions(): Promise<EventSubmission[]> {
  try {
    const raw = await AsyncStorage.getItem(EVENT_SUBMISSIONS_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isEventSubmission);
  } catch {
    return [];
  }
}

async function saveEventSubmissions(submissions: EventSubmission[]): Promise<void> {
  await AsyncStorage.setItem(EVENT_SUBMISSIONS_STORAGE_KEY, JSON.stringify(submissions));
}

export async function getEventSubmission(submissionId: string): Promise<EventSubmission | null> {
  const submissions = await loadEventSubmissions();
  return submissions.find((entry) => entry.id === submissionId) ?? null;
}

export async function getEventSubmissionByEventId(eventId: string): Promise<EventSubmission | null> {
  const submissions = await loadEventSubmissions();
  return submissions.find((entry) => entry.eventId === eventId) ?? null;
}

export async function resolveEventSubmission(
  submissionOrEventId: string,
): Promise<EventSubmission | null> {
  const byId = await getEventSubmission(submissionOrEventId);
  if (byId) {
    return byId;
  }

  return getEventSubmissionByEventId(submissionOrEventId);
}

export async function syncSubmissionAfterModeration(
  event: AdminEventRecord,
  displayStatus: SubmissionDisplayStatus,
  note?: string,
): Promise<void> {
  const submissions = await loadEventSubmissions();
  const index = submissions.findIndex((entry) => entry.eventId === event.id);
  if (index < 0) {
    return;
  }

  const now = new Date().toISOString();
  const current = submissions[index]!;
  const next: EventSubmission = {
    ...current,
    status: displayStatus,
    updatedAt: now,
    eventSnapshot: event as unknown as Record<string, unknown>,
    history: [...current.history, { status: displayStatus, at: now }],
  };

  if (note?.trim()) {
    next.eventSnapshot = {
      ...next.eventSnapshot,
      moderationNote: note.trim(),
    };
  }

  submissions[index] = next;
  await saveEventSubmissions(submissions);
}

function syncExtensionToCoreForm(draft: EventDraft): EventDraftFormValues {
  const core = { ...draft.formData.core };
  const extension = draft.formData.extension;

  if (extension.genreIds.length > 0) {
    core.genreId = extension.genreIds[0]!;
  }

  if (extension.city.trim() && !core.venueText.trim() && !core.venueId.trim()) {
    core.venueText = extension.city.trim();
  }

  if (extension.ticketMode === 'free') {
    core.ticketUrl = '';
  }

  return core;
}

export async function persistWizardDraftToContributor(
  draft: EventDraft,
  userId: string,
  linkLabels: EventDraftLinkLabels,
): Promise<AdminEventRecord> {
  const form = syncExtensionToCoreForm(draft);

  if (draft.eventId) {
    return updateContributorEvent({
      eventId: draft.eventId,
      form,
      userId,
      linkLabels,
    });
  }

  const created = await createContributorEvent({
    form,
    userId,
    linkLabels,
    eventId: draft.eventId,
  });

  await upsertEventWizardDraft({
    ...draft,
    eventId: created.id,
    autosavedAt: new Date().toISOString(),
  });

  return created;
}

export async function autosaveWizardDraft(draft: EventDraft): Promise<EventDraft> {
  return upsertEventWizardDraft({
    ...draft,
    autosavedAt: new Date().toISOString(),
  });
}

export async function submitWizardEvent(input: {
  draftId: string;
  userId: string;
  linkLabels: EventDraftLinkLabels;
}): Promise<{ submission: EventSubmission; record: AdminEventRecord }> {
  const draft = await getEventWizardDraft(input.draftId);
  if (!draft) {
    throw new Error('Entwurf nicht gefunden.');
  }

  const validation = validateFullSubmission(draft.formData);
  if (!validation.isValid) {
    throw new Error('Bitte korrigiere alle Pflichtfelder vor der Einreichung.');
  }

  const record = await persistWizardDraftToContributor(draft, input.userId, input.linkLabels);
  const submitted = await submitContributorEventForReview({
    eventId: record.id,
    userId: input.userId,
  });

  const now = new Date().toISOString();
  const submission: EventSubmission = {
    id: `submission-${record.id}`,
    eventId: record.id,
    draftId: draft.id,
    organizerId: draft.organizerId || draft.formData.extension.organizerId,
    status: 'pending',
    submittedAt: now,
    updatedAt: now,
    eventSnapshot: submitted as unknown as Record<string, unknown>,
    history: [
      { status: 'draft', at: draft.createdAt },
      { status: 'pending', at: now },
    ],
  };

  const submissions = await loadEventSubmissions();
  const existingIndex = submissions.findIndex((entry) => entry.eventId === record.id);
  if (existingIndex >= 0) {
    submissions[existingIndex] = submission;
  } else {
    submissions.unshift(submission);
  }
  await saveEventSubmissions(submissions);
  await markWizardDraftSubmitted(draft.id);

  return { submission, record: submitted };
}

export async function deleteWizardDraft(draftId: string): Promise<void> {
  await deleteEventWizardDraft(draftId);
}

export function canPersistPartialDraft(form: EventDraftFormValues): boolean {
  const errors = validateEventDraftForm(form);
  return !hasEventDraftErrors(errors) || Boolean(form.title.trim());
}

export { mapAdminStatusToDisplay };
