import type { AdminEventRecord } from '@/data/types/records';
import { filterConfig } from '@/features/search/constants';
import type { EventDisplayModel } from '@/features/events/formatting/display-event';
import { toEventDisplayModel } from '@/features/events/formatting/display-event';
import type { Event } from '@/features/events/types/event';
import { combineDateAndTime } from '@/features/create/utils/event-draft-date-time';

import type { EventFormData } from '../wizard/wizard-types';

export function buildPreviewAdminRecord(
  formData: EventFormData,
  eventId: string,
  userId: string,
): AdminEventRecord {
  const { core, extension } = formData;
  const start = combineDateAndTime(core.startDate.trim(), core.startTime.trim());
  const end = combineDateAndTime(
    (core.endDate || core.startDate).trim(),
    (core.endTime || core.startTime).trim(),
  );

  const genreId = extension.genreIds[0] ?? core.genreId;
  const cityOption = filterConfig.cityOptions.find(
    (city) => city.label.toLowerCase() === extension.city.trim().toLowerCase(),
  );

  return {
    id: eventId,
    title: core.title.trim() || 'Unbenanntes Event',
    subtitle: extension.subtitle || undefined,
    description: core.description.trim() || extension.shortDescription.trim(),
    genreId: genreId || undefined,
    venueId: core.venueId || undefined,
    venueName: core.venueText.trim() || undefined,
    venueCity: extension.city.trim() || undefined,
    cityId: cityOption?.id,
    organizerName: extension.organizerDisplayName.trim() || undefined,
    ticketUrl: extension.ticketMode === 'external' ? core.ticketUrl.trim() || undefined : undefined,
    websiteUrl: core.websiteUrl.trim() || undefined,
    instagramUrl: core.instagramUrl.trim() || undefined,
    facebookUrl: core.facebookUrl.trim() || undefined,
    imageUrl: core.coverImage?.remoteUrl || undefined,
    flyerUrl: core.flyerImage?.remoteUrl || undefined,
    startDate: start?.toISOString() ?? new Date().toISOString(),
    endDate: end?.toISOString(),
    status: 'draft',
    createdBy: userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function buildPreviewDisplayModel(
  record: AdminEventRecord,
  formData: EventFormData,
): EventDisplayModel {
  const genre = filterConfig.genreOptions.find((entry) => entry.id === record.genreId);
  const genres =
    formData.extension.genreIds.length > 0
      ? formData.extension.genreIds
          .map((id) => filterConfig.genreOptions.find((entry) => entry.id === id)?.label)
          .filter((label): label is string => Boolean(label))
      : genre
        ? [genre.label]
        : [];

  const now = new Date().toISOString();
  const previewEvent: Event = {
    id: record.id,
    slug: record.id,
    title: record.title,
    description: record.description,
    imageUrl: record.imageUrl,
    startDateTime: record.startDate,
    endDateTime: record.endDate,
    timezone: formData.extension.timezone,
    venue: record.venueName ?? formData.core.venueText ?? 'TBA',
    city: record.venueCity ?? formData.extension.city ?? 'Köln',
    country: 'DE',
    genres,
    artists: formData.extension.lineup.map((entry) => entry.name),
    lineup: formData.extension.lineup.map((entry) => entry.name),
    organizer: record.organizerName,
    priceText:
      formData.extension.ticketMode === 'free'
        ? 'Kostenlos'
        : formData.extension.priceFrom
          ? `Ab ${formData.extension.priceFrom}`
          : undefined,
    ticketUrl: record.ticketUrl,
    source: 'contributor',
    sourceEventId: record.id,
    status: 'published',
    createdAt: now,
    updatedAt: now,
  };

  return toEventDisplayModel(previewEvent);
}
