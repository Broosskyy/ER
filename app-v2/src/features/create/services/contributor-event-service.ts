import { AppError } from '@/core/errors/app-error';
import { featureFlags } from '@/core/config/feature-flags';
import { getDatasourceBundle } from '@/data/datasources/supabase/supabase-datasource';
import type { AdminEventRecord, AdminEventStatus } from '@/data/types/records';
import { canContributorTransition } from '@/features/create/constants/contributor-event-status';
import {
  isContributorEditableStatus,
  mapEventDraftFormToAdminRecord,
  type EventDraftLinkLabels,
} from '@/features/create/mappers/event-draft-mapper';
import { contributorImageUploadService } from '@/features/create/services/contributor-image-upload-service';
import type { EventDraftFormValues } from '@/features/create/types/event-draft-form';
import { isPersistableImageUrl } from '@/features/create/utils/event-image-url';
import { resolveContributorCityId } from '@/features/create/utils/resolve-contributor-city-id';
import { hasEventDraftErrors, validateEventDraftForm } from '@/features/create/validation/event-draft-validation';

export interface ContributorEventMutationInput {
  form: EventDraftFormValues;
  userId: string;
  linkLabels: EventDraftLinkLabels;
  eventId?: string;
}

export interface ContributorEventUpdateInput extends ContributorEventMutationInput {
  eventId: string;
}

export interface ContributorEventSubmitInput {
  eventId: string;
  userId: string;
}

export interface ContributorEventWithdrawInput {
  eventId: string;
  userId: string;
}

function assertValidForm(form: EventDraftFormValues): void {
  const errors = validateEventDraftForm(form);
  if (hasEventDraftErrors(errors)) {
    throw new AppError('Event draft validation failed.', { code: 'VALIDATION', cause: errors });
  }
}

function assertOwnedEditableDraft(record: AdminEventRecord | null, userId: string): AdminEventRecord {
  if (!record || record.createdBy !== userId) {
    throw new AppError('Event not found.', { code: 'NOT_FOUND' });
  }

  if (!isContributorEditableStatus(record.status)) {
    throw new AppError('Only draft events can be edited.', { code: 'VALIDATION' });
  }

  return record;
}

function assertOwnedReviewEvent(record: AdminEventRecord | null, userId: string): AdminEventRecord {
  if (!record || record.createdBy !== userId) {
    throw new AppError('Event not found.', { code: 'NOT_FOUND' });
  }

  if (record.status !== 'review') {
    throw new AppError('Only events in review can be withdrawn.', { code: 'VALIDATION' });
  }

  return record;
}

async function resolveFormImages(
  form: EventDraftFormValues,
  userId: string,
  eventId: string,
): Promise<EventDraftFormValues> {
  const nextForm = { ...form };

  if (nextForm.coverImage?.localUri && !isPersistableImageUrl(nextForm.coverImage.remoteUrl)) {
    const remoteUrl = await contributorImageUploadService.uploadEventImage({
      userId,
      eventId,
      kind: 'cover',
      image: nextForm.coverImage,
    });

    nextForm.coverImage = isPersistableImageUrl(remoteUrl)
      ? { remoteUrl, localUri: nextForm.coverImage.localUri }
      : null;
  }

  if (nextForm.flyerImage?.localUri && !isPersistableImageUrl(nextForm.flyerImage.remoteUrl)) {
    const remoteUrl = await contributorImageUploadService.uploadEventImage({
      userId,
      eventId,
      kind: 'flyer',
      image: nextForm.flyerImage,
    });

    nextForm.flyerImage = isPersistableImageUrl(remoteUrl)
      ? { remoteUrl, localUri: nextForm.flyerImage.localUri }
      : null;
  }

  return nextForm;
}

async function finalizeContributorRecord(record: AdminEventRecord): Promise<AdminEventRecord> {
  const cityId = await resolveContributorCityId(record.cityId);
  return cityId ? { ...record, cityId } : record;
}

function assertImagesPersistableWhenRequired(form: EventDraftFormValues): void {
  const hasLocalOnlyImages =
    (form.coverImage?.localUri && !isPersistableImageUrl(form.coverImage.remoteUrl)) ||
    (form.flyerImage?.localUri && !isPersistableImageUrl(form.flyerImage.remoteUrl));

  if (hasLocalOnlyImages && !featureFlags.useSupabase) {
    throw new AppError('Images cannot be persisted without Supabase.', {
      code: 'VALIDATION',
      cause: 'create.event.errors.imageRequiresSupabase',
    });
  }
}

export class ContributorEventService {
  async getEvent(eventId: string, userId: string): Promise<AdminEventRecord | null> {
    return getDatasourceBundle().events.getContributorEventById(eventId, userId);
  }

  async getMyEvents(userId: string): Promise<AdminEventRecord[]> {
    return getDatasourceBundle().events.listEventsByCreatedBy(userId);
  }

  async getMyEventsByStatus(userId: string, status: AdminEventStatus): Promise<AdminEventRecord[]> {
    return getDatasourceBundle().events.listEventsByCreatedBy(userId, { status });
  }

  async createEvent(input: ContributorEventMutationInput): Promise<AdminEventRecord> {
    assertValidForm(input.form);
    assertImagesPersistableWhenRequired(input.form);

    const draftId = input.eventId ?? `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const formWithImages = await resolveFormImages(input.form, input.userId, draftId);

    const record = await finalizeContributorRecord(
      mapEventDraftFormToAdminRecord(formWithImages, {
        userId: input.userId,
        linkLabels: input.linkLabels,
        eventId: draftId,
      }),
    );

    if (record.status !== 'draft') {
      throw new AppError('Contributor events must start as draft.', { code: 'VALIDATION' });
    }

    return getDatasourceBundle().events.saveEvent(record);
  }

  async updateEvent(input: ContributorEventUpdateInput): Promise<AdminEventRecord> {
    assertValidForm(input.form);
    assertImagesPersistableWhenRequired(input.form);

    const existing = assertOwnedEditableDraft(
      await this.getEvent(input.eventId, input.userId),
      input.userId,
    );

    const formWithImages = await resolveFormImages(input.form, input.userId, input.eventId);

    const record = await finalizeContributorRecord(
      mapEventDraftFormToAdminRecord(formWithImages, {
        userId: input.userId,
        linkLabels: input.linkLabels,
        existing,
      }),
    );

    return getDatasourceBundle().events.saveEvent(record);
  }

  async submitForReview(input: ContributorEventSubmitInput): Promise<AdminEventRecord> {
    const existing = assertOwnedEditableDraft(
      await this.getEvent(input.eventId, input.userId),
      input.userId,
    );

    if (!canContributorTransition(existing.status, 'review')) {
      throw new AppError('Event cannot be submitted for review.', { code: 'VALIDATION' });
    }

    const record: AdminEventRecord = {
      ...existing,
      status: 'review',
      updatedAt: new Date().toISOString(),
    };

    return getDatasourceBundle().events.saveEvent(record);
  }

  async withdrawFromReview(input: ContributorEventWithdrawInput): Promise<AdminEventRecord> {
    const existing = assertOwnedReviewEvent(
      await this.getEvent(input.eventId, input.userId),
      input.userId,
    );

    if (!canContributorTransition(existing.status, 'draft')) {
      throw new AppError('Event cannot be withdrawn from review.', { code: 'VALIDATION' });
    }

    const record: AdminEventRecord = {
      ...existing,
      status: 'draft',
      updatedAt: new Date().toISOString(),
    };

    return getDatasourceBundle().events.saveEvent(record);
  }

  /** @deprecated Use getEvent */
  async getOwnDraftById(eventId: string, userId: string): Promise<AdminEventRecord | null> {
    const event = await this.getEvent(eventId, userId);
    return event?.status === 'draft' ? event : null;
  }

  /** @deprecated Use createEvent */
  async saveDraft(input: ContributorEventMutationInput): Promise<AdminEventRecord> {
    return this.createEvent(input);
  }
}

export const contributorEventService = new ContributorEventService();

/** @deprecated Use contributorEventService */
export const contributorEventRepository = contributorEventService;

export async function createContributorEvent(
  input: ContributorEventMutationInput,
): Promise<AdminEventRecord> {
  return contributorEventService.createEvent(input);
}

export async function updateContributorEvent(
  input: ContributorEventUpdateInput,
): Promise<AdminEventRecord> {
  return contributorEventService.updateEvent(input);
}

export async function submitContributorEventForReview(
  input: ContributorEventSubmitInput,
): Promise<AdminEventRecord> {
  return contributorEventService.submitForReview(input);
}

export async function withdrawContributorEventFromReview(
  input: ContributorEventWithdrawInput,
): Promise<AdminEventRecord> {
  return contributorEventService.withdrawFromReview(input);
}

/** @deprecated Use createContributorEvent */
export async function saveContributorEventDraft(
  input: ContributorEventMutationInput,
): Promise<AdminEventRecord> {
  return contributorEventService.createEvent(input);
}
