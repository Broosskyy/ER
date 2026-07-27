import type { AdminEventRecord } from '@/data/types/records';
import { ADMIN_EVENT_STATUSES } from '@/data/types/records';
import { filterConfig } from '@/features/search/config/filter-config';
import type { EventDraftFormValues } from '@/features/create/types/event-draft-form';
import { normalizeOptionalUrlField, parseContributorDescription } from '@/features/create/utils/event-draft-description';
import {
  isPersistableImageUrl,
  resolvePersistableImageUrl,
} from '@/features/create/utils/event-image-url';
import {
  combineDateAndTime,
  formatIsoToDateInput,
  formatIsoToTimeInput,
  resolveEndDateTime,
} from '@/features/create/utils/event-draft-date-time';

export const CONTRIBUTOR_EDITABLE_STATUSES = ['draft', 'rejected'] as const satisfies readonly (typeof ADMIN_EVENT_STATUSES)[number][];

export type ContributorEditableStatus = (typeof CONTRIBUTOR_EDITABLE_STATUSES)[number];

export function isContributorEditableStatus(
  status: AdminEventRecord['status'],
): status is ContributorEditableStatus {
  return (CONTRIBUTOR_EDITABLE_STATUSES as readonly string[]).includes(status);
}

export interface EventDraftLinkLabels {
  website: string;
  instagram: string;
  facebook: string;
}

export interface MapEventDraftFormOptions {
  userId: string;
  linkLabels: EventDraftLinkLabels;
  existing?: AdminEventRecord;
  eventId?: string;
}

function createDraftEventId(): string {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function resolveFormSocialLinks(
  record: AdminEventRecord,
  linkLabels: EventDraftLinkLabels,
): Pick<EventDraftFormValues, 'websiteUrl' | 'instagramUrl' | 'facebookUrl'> {
  if (record.websiteUrl || record.instagramUrl || record.facebookUrl) {
    return {
      websiteUrl: record.websiteUrl ?? '',
      instagramUrl: record.instagramUrl ?? '',
      facebookUrl: record.facebookUrl ?? '',
    };
  }

  const legacy = parseContributorDescription(record.description, linkLabels);
  return {
    websiteUrl: legacy.websiteUrl,
    instagramUrl: legacy.instagramUrl,
    facebookUrl: legacy.facebookUrl,
  };
}

function resolveFormDescription(record: AdminEventRecord, linkLabels: EventDraftLinkLabels): string {
  if (record.websiteUrl || record.instagramUrl || record.facebookUrl) {
    return record.description;
  }

  return parseContributorDescription(record.description, linkLabels).description;
}

function resolveFormVenueText(record: AdminEventRecord): string {
  if (record.venueId) {
    return '';
  }

  if (record.venueName?.trim()) {
    return record.venueName.trim();
  }

  return record.subtitle?.trim() ?? '';
}

export function mapAdminRecordToEventDraftForm(
  record: AdminEventRecord,
  linkLabels: EventDraftLinkLabels,
): EventDraftFormValues {
  const socialLinks = resolveFormSocialLinks(record, linkLabels);

  return {
    title: record.title,
    startDate: formatIsoToDateInput(record.startDate),
    startTime: formatIsoToTimeInput(record.startDate),
    endDate: record.endDate ? formatIsoToDateInput(record.endDate) : '',
    endTime: record.endDate ? formatIsoToTimeInput(record.endDate) : '',
    venueId: record.venueId ?? '',
    venueText: resolveFormVenueText(record),
    genreId: record.genreId ?? '',
    description: resolveFormDescription(record, linkLabels),
    ticketUrl: record.ticketUrl ?? '',
    websiteUrl: socialLinks.websiteUrl,
    instagramUrl: socialLinks.instagramUrl,
    facebookUrl: socialLinks.facebookUrl,
    coverImage: isPersistableImageUrl(record.imageUrl)
      ? { remoteUrl: record.imageUrl, localUri: '' }
      : null,
    flyerImage: isPersistableImageUrl(record.flyerUrl)
      ? { remoteUrl: record.flyerUrl, localUri: '' }
      : null,
  };
}

export function mapEventDraftFormToAdminRecord(
  form: EventDraftFormValues,
  options: MapEventDraftFormOptions,
): AdminEventRecord {
  const start = combineDateAndTime(form.startDate.trim(), form.startTime.trim());
  if (!start) {
    throw new Error('Invalid start date or time.');
  }

  const end = resolveEndDateTime(
    form.startDate.trim(),
    form.startTime.trim(),
    form.endDate.trim(),
    form.endTime.trim(),
  );
  const now = new Date().toISOString();
  const existing = options.existing;
  const venueId = form.venueId.trim() || undefined;

  return {
    id: existing?.id ?? options.eventId ?? createDraftEventId(),
    title: form.title.trim(),
    description: form.description.trim(),
    genreId: form.genreId.trim(),
    venueId,
    venueName: venueId ? undefined : form.venueText.trim() || undefined,
    venueCity: venueId ? undefined : existing?.venueCity,
    cityId: existing?.cityId ?? filterConfig.defaultCityId,
    startDate: start.toISOString(),
    endDate: end?.toISOString(),
    ticketUrl: normalizeOptionalUrlField(form.ticketUrl),
    websiteUrl: normalizeOptionalUrlField(form.websiteUrl),
    instagramUrl: normalizeOptionalUrlField(form.instagramUrl),
    facebookUrl: normalizeOptionalUrlField(form.facebookUrl),
    imageUrl: resolvePersistableImageUrl(form.coverImage),
    flyerUrl: resolvePersistableImageUrl(form.flyerImage),
    status: existing?.status ?? 'draft',
    createdBy: existing?.createdBy ?? options.userId,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}
