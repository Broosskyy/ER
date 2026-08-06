import type {
  EventHeroViewModel,
  EventInfoViewModel,
  EventNoticeType,
  EventNoticeViewModel,
  EventTicketMode,
  EventTicketSectionViewModel,
  LineupSectionViewModel,
  OrganizerDetailViewModel,
  TimetableSectionViewModel,
  VenueDetailViewModel,
} from '@/components/event-detail/view-models';
import { resolveEventNoticeTitle } from '@/components/event-detail/event-detail-styles';
import type { EventDisplayModel } from '@/features/events/formatting/display-event';
import { formatEventDateTime, formatEventTimeRange } from '@/features/events/formatting/date-time';
import { toEventCardViewModel } from '@/features/events/formatting/event-card-view-model';
import {
  isTicketActionDisabled,
  resolveEventNoticeType,
  resolveEventPresentation,
} from '@/features/events/status/event-status-resolver';
import { resolveConsumerTicketPresentation } from '@/features/events/formatting/resolve-consumer-ticket-presentation';
import { readCanonicalTicket } from '@/features/events/domain/canonical-ticket-read';
import type { ArtistRecord, OrganizerRecord, VenueRecord } from '@/data/types/records';
import type { Event } from '@/features/events/types/event';
import type { EventDetailEntities } from '@/features/event-detail/services/event-detail-entity-loader';
import {
  toLineupItemFromArtist,
  toLineupItemFromName,
  toOrganizerDetailFromRecord,
  toVenueDetailFromRecord,
} from '@/features/profiles/utils/profile-view-models';

export function toEventHeroViewModel(event: EventDisplayModel): EventHeroViewModel {
  const presentation = resolveEventPresentation(event);
  const card = toEventCardViewModel(event);
  const ticketPresentation = resolveConsumerTicketPresentation(event);

  return {
    id: event.id,
    title: event.title,
    image: event.image,
    dateLabel: card.dateLabel,
    weekdayLabel: card.weekdayLabel,
    timeLabel: card.timeLabel,
    endTimeLabel: card.endTimeLabel,
    venueLabel: event.venue,
    cityLabel: event.city,
    genreLabels: event.genres,
    categoryLabel: card.categoryLabel,
    ticketLabel: ticketPresentation.headerPriceLabel ?? card.ticketLabel,
    ticketStatus: presentation.ticketStatus,
    status: presentation.primaryStatus,
    accessibilityLabel: card.accessibilityLabel,
  };
}

export function toEventInfoViewModel(event: EventDisplayModel): EventInfoViewModel {
  const items: EventInfoViewModel['items'] = [
    {
      id: 'datetime',
      icon: 'calendar-outline',
      label: 'Datum und Uhrzeit',
      value: formatEventDateTime(event),
      secondaryValue: formatEventTimeRange(event),
    },
    {
      id: 'venue',
      icon: 'location-outline',
      label: 'Veranstaltungsort',
      value: event.venue,
      secondaryValue: event.city,
    },
  ];

  if (event.priceText) {
    items.push({
      id: 'price',
      icon: 'ticket-outline',
      label: 'Preis',
      value: event.priceText,
    });
  }

  if (event.ageRestriction) {
    items.push({
      id: 'age',
      icon: 'shirt-outline',
      label: 'Mindestalter',
      value: event.ageRestriction,
    });
  }

  if (event.venueType) {
    const environmentLabel =
      event.venueType === 'open_air' || event.venueType === 'festival_ground'
        ? 'Outdoor'
        : event.venueType === 'hybrid'
          ? 'Indoor / Outdoor'
          : 'Indoor';
    items.push({
      id: 'environment',
      icon: 'information-circle-outline',
      label: 'Location',
      value: environmentLabel,
    });
  }

  if (event.festivalLabel) {
    items.push({
      id: 'festival',
      icon: 'musical-notes-outline',
      label: 'Festival',
      value: event.festivalLabel,
      secondaryValue: event.festivalEditionId,
    });
  }

  if (event.organizer) {
    items.push({
      id: 'organizer',
      icon: 'people-outline',
      label: 'Veranstalter',
      value: event.organizer,
    });
  }

  return {
    description: event.description,
    items,
  };
}

export function toLineupSectionViewModel(
  event: EventDisplayModel,
  entities?: Pick<EventDetailEntities, 'artistsById'>,
): LineupSectionViewModel {
  const names = event.lineup ?? event.artists;

  if (!names || names.length === 0) {
    return {
      artists: [],
      tba: true,
      placeholderMessage: 'Line-up wird bald bekannt gegeben.',
      accessibilityLabel: `Line-up für ${event.title}`,
    };
  }

  const seenArtistIds = new Set<string>();
  const artists = names.flatMap((name, index) => {
    const artistId = event.artistIds?.[index];
    if (artistId) {
      if (seenArtistIds.has(artistId)) {
        return [];
      }
      seenArtistIds.add(artistId);
      const record = entities?.artistsById.get(artistId);
      if (record) {
        return [toLineupItemFromArtist(record, index === 0)];
      }
    }
    return [toLineupItemFromName(name, index === 0)];
  });

  return {
    artists,
    accessibilityLabel: `Line-up für ${event.title}`,
  };
}

export function toTimetableSectionViewModel(
  event: EventDisplayModel,
): TimetableSectionViewModel {
  // Foundation only: real stage/slot data will be wired when festival timetable API exists.
  return {
    slots: [],
    placeholderMessage: 'Timetable noch nicht veröffentlicht',
    accessibilityLabel: `Timetable für ${event.title}`,
  };
}

export function toVenueDetailViewModel(
  event: EventDisplayModel,
  entities?: Pick<EventDetailEntities, 'venue'>,
): VenueDetailViewModel {
  if (entities?.venue) {
    return {
      ...toVenueDetailFromRecord(entities.venue, event),
      profileNavigable: true,
    };
  }

  const address = event.address ?? `${event.venue}, ${event.city}`;

  return {
    id: event.venueId ?? event.venue,
    name: event.venue,
    addressLabel: address,
    cityLabel: event.city,
    image: event.image,
    verified: false,
    profileNavigable: false,
    accessibilityLabel: `${event.venue}, ${event.city}`,
  };
}

export function toOrganizerDetailViewModel(
  event: EventDisplayModel,
  entities?: Pick<EventDetailEntities, 'organizer'>,
): OrganizerDetailViewModel | undefined {
  if (!event.organizer && !entities?.organizer) {
    return undefined;
  }

  if (entities?.organizer) {
    return {
      organizer: toOrganizerDetailFromRecord(entities.organizer, 0),
      profileNavigable: true,
    };
  }

  if (!event.organizer) {
    return undefined;
  }

  return {
    organizer: {
      id: event.organizer,
      name: event.organizer,
      eventCountLabel: '',
      followerCountLabel: '',
      verificationStatus: 'unverified',
      accessibilityLabel: `Veranstalter ${event.organizer}`,
    },
    profileNavigable: false,
  };
}

export function toEventTicketSectionViewModel(event: EventDisplayModel): EventTicketSectionViewModel {
  const presentation = resolveEventPresentation(event);
  const notice = resolveEventNoticeType(event);
  const disabled = isTicketActionDisabled(event);
  const ticketStatus = presentation.ticketStatus;
  const canonicalTicket = readCanonicalTicket({
    ticketUrl: event.ticketUrl,
    websiteUrl: event.officialEventUrl,
    sourceUrl: event.sourceUrl,
    priceText: event.priceText ?? event.displayPriceText,
    ticketStatus: event.ticketAvailability,
    ticketPhases: event.ticketPhases,
  });

  let mode: EventTicketMode = 'unavailable';
  let ctaLabel = canonicalTicket.ctaLabel ?? 'Tickets ansehen';
  let noticeLabel: string | undefined;

  if (notice === 'cancelled') {
    mode = 'sold_out';
    ctaLabel = 'Tickets nicht verfügbar';
    noticeLabel = 'Dieses Event wurde abgesagt.';
  } else if (notice === 'postponed') {
    mode = 'external';
    ctaLabel = 'Ticketinformationen';
    noticeLabel = 'Das Event wurde verschoben. Bitte prüfe die aktuellen Ticketinformationen.';
  } else if (ticketStatus === 'sold_out') {
    mode = 'sold_out';
    ctaLabel = 'Ausverkauft';
  } else if (ticketStatus === 'free') {
    mode = 'free_rsvp';
    ctaLabel = 'Kostenlos teilnehmen';
  } else if (canonicalTicket.hasActiveCta) {
    mode = 'external';
    ctaLabel = canonicalTicket.ctaLabel ?? 'Tickets ansehen';
  }

  const resolvedMode = disabled && mode !== 'free_rsvp' ? 'sold_out' : mode;
  const ticketPresentation = resolveConsumerTicketPresentation(event, {
    mode: resolvedMode,
    ctaLabel,
  });

  return {
    mode: resolvedMode,
    ticketTypes: ticketPresentation.ticketTypes,
    summary: ticketPresentation.summary,
    showSummary: ticketPresentation.showSummary,
    ctaLabel: ticketPresentation.cta,
    priceLabel: ticketPresentation.sectionPriceLabel,
    availabilityLabel: ticketPresentation.availabilityLabel,
    externalUrlLabel: ticketPresentation.providerLabel,
    noticeLabel,
    accessibilityLabel: `Tickets für ${event.title}`,
  };
}

export function toEventNoticeViewModel(event: EventDisplayModel): EventNoticeViewModel | undefined {
  const noticeType = resolveEventNoticeType(event) as EventNoticeType | undefined;

  if (!noticeType || noticeType === 'sold_out') {
    return undefined;
  }

  let message: string | undefined;
  if (noticeType === 'postponed') {
    message = 'Das Datum kann sich noch ändern. Gespeicherte Events bleiben in deiner Übersicht.';
  } else if (noticeType === 'venue_changed' && event.previousVenue) {
    message = `Vorheriger Ort: ${event.previousVenue}`;
  } else if (noticeType === 'time_changed' && event.previousStartDateTime) {
    message = `Vorherige Zeit: ${formatEventDateTime({ ...event, startDateTime: event.previousStartDateTime })}`;
  } else if (noticeType === 'venue_changed') {
    message = 'Der Veranstaltungsort wurde aktualisiert.';
  } else if (noticeType === 'time_changed') {
    message = 'Die Startzeit wurde aktualisiert.';
  }

  return {
    type: noticeType,
    title: resolveEventNoticeTitle(noticeType),
    message,
  };
}

export function toSimilarEventCards(event: EventDisplayModel, candidates: EventDisplayModel[]) {
  return candidates
    .filter((candidate) => candidate.id !== event.id)
    .filter((candidate) => candidate.genres.some((genre) => event.genres.includes(genre)))
    .slice(0, 3)
    .map((candidate) => toEventCardViewModel(candidate));
}
