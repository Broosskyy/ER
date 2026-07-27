import type {
  EventHeroViewModel,
  EventInfoViewModel,
  EventNoticeViewModel,
  EventTicketMode,
  EventTicketSectionViewModel,
  LineupSectionViewModel,
  OrganizerDetailViewModel,
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
import { getSourceDisplayLabel } from '@/features/events/data/demo-images';

function slugifyVenueId(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-');
}

export function toEventHeroViewModel(event: EventDisplayModel): EventHeroViewModel {
  const presentation = resolveEventPresentation(event);
  const card = toEventCardViewModel(event);

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
    ticketLabel: card.ticketLabel,
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

  return {
    description: event.description,
    items,
  };
}

export function toLineupSectionViewModel(event: EventDisplayModel): LineupSectionViewModel | undefined {
  const artists = event.lineup ?? event.artists;

  if (!artists || artists.length === 0) {
    return undefined;
  }

  return {
    artists: artists.map((name, index) => ({
      name,
      headliner: index === 0,
      accessibilityLabel: name,
    })),
    accessibilityLabel: `Line-up für ${event.title}`,
  };
}

export function toVenueDetailViewModel(event: EventDisplayModel): VenueDetailViewModel {
  const address = event.address ?? `${event.venue}, ${event.city}`;

  return {
    id: slugifyVenueId(event.venue),
    name: event.venue,
    addressLabel: address,
    cityLabel: event.city,
    image: event.image,
    verified: false,
    accessibilityLabel: `${event.venue}, ${event.city}`,
  };
}

export function toOrganizerDetailViewModel(event: EventDisplayModel): OrganizerDetailViewModel | undefined {
  if (!event.organizer) {
    return undefined;
  }

  return {
    organizer: {
      id: slugifyVenueId(event.organizer),
      name: event.organizer,
      eventCountLabel: '1 Event',
      followerCountLabel: '',
      verificationStatus: 'unverified',
      accessibilityLabel: `Veranstalter ${event.organizer}`,
    },
  };
}

export function toEventTicketSectionViewModel(event: EventDisplayModel): EventTicketSectionViewModel {
  const presentation = resolveEventPresentation(event);
  const notice = resolveEventNoticeType(event);
  const disabled = isTicketActionDisabled(event);
  const ticketStatus = presentation.ticketStatus;

  let mode: EventTicketMode = 'unavailable';
  let ctaLabel = 'Tickets ansehen';
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
  } else if (event.ticketUrl) {
    mode = 'external';
    ctaLabel = 'Tickets ansehen';
  }

  return {
    mode: disabled && mode !== 'free_rsvp' ? 'sold_out' : mode,
    ticketTypes: [],
    ctaLabel,
    externalUrlLabel: event.ticketUrl ? getSourceDisplayLabel(event.source) : undefined,
    noticeLabel,
    accessibilityLabel: `Tickets für ${event.title}`,
  };
}

export function toEventNoticeViewModel(event: EventDisplayModel): EventNoticeViewModel | undefined {
  const noticeType = resolveEventNoticeType(event);

  if (!noticeType || noticeType === 'sold_out') {
    return undefined;
  }

  return {
    type: noticeType,
    title: resolveEventNoticeTitle(noticeType),
    message:
      noticeType === 'postponed'
        ? 'Das Datum kann sich noch ändern. Gespeicherte Events bleiben in deiner Übersicht.'
        : undefined,
  };
}

export function toSimilarEventCards(event: EventDisplayModel, candidates: EventDisplayModel[]) {
  return candidates
    .filter((candidate) => candidate.id !== event.id)
    .filter((candidate) => candidate.genres.some((genre) => event.genres.includes(genre)))
    .slice(0, 3)
    .map((candidate) => toEventCardViewModel(candidate));
}
