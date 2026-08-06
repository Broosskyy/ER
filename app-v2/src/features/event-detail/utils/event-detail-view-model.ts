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
import { getSourceDisplayLabel } from '@/features/events/formatting/source-display-labels';
import { resolveConsumerTicketPresentation } from '@/features/events/formatting/resolve-consumer-ticket-presentation';
import { resolvePublicTicketPresentation } from '@/features/events/formatting/ticket-presentation';
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
import { resolveVenueVerificationStatus } from '@/features/profiles/utils/entity-verification-status';
import { inferLineupCompleteness, resolveLineupSectionTitle } from '@/features/event-detail/utils/lineup-completeness';
import { buildLineupBillingRows } from '@/features/event-detail/utils/lineup-billing-display';
import { resolveAddressValidity } from '@/features/event-detail/utils/address-validity';
import { normalizePublicEventDescription } from '@/features/events/formatting/public-description-normalizer';
import {
  collectSearchableAttributeTerms,
  projectEventAttributeBadges,
} from '@/features/events/domain/event-attribute-badge-projection';

export { inferLineupCompleteness } from '@/features/event-detail/utils/lineup-completeness';

export function toEventHeroViewModel(event: EventDisplayModel): EventHeroViewModel {
  const presentation = resolveEventPresentation(event);
  const card = toEventCardViewModel(event);
  const ticketPresentation = resolveConsumerTicketPresentation(event);
  const attributeBadges = projectEventAttributeBadges(event.eventAttributes, {
    floorCount: event.floorCount,
    stageCount: event.stageCount,
  });

  return {
    id: event.id,
    title: event.title,
    image: event.image,
    galleryImageUrls: event.galleryImageUrls,
    dateLabel: card.dateLabel,
    weekdayLabel: card.weekdayLabel,
    timeLabel: card.timeLabel,
    endTimeLabel: card.endTimeLabel,
    venueLabel: event.venueLabel,
    cityLabel: event.cityLabel,
    genreLabels: event.genres,
    attributeBadges,
    categoryLabel: card.categoryLabel,
    ticketLabel: ticketPresentation.headerPriceLabel ?? card.ticketLabel,
    ticketColorToken: card.ticketColorToken,
    ticketStatus: presentation.ticketStatus,
    status: presentation.primaryStatus,
    accessibilityLabel: card.accessibilityLabel,
  };
}

export function toEventInfoViewModel(
  event: EventDisplayModel,
  options?: { hideOrganizer?: boolean; hidePrice?: boolean },
): EventInfoViewModel {
  const sanitizedDescription =
    normalizePublicEventDescription(event.sanitizedDescription) ??
    normalizePublicEventDescription(event.description);

  const items: EventInfoViewModel['items'] = [
    {
      id: 'datetime',
      icon: 'calendar-outline',
      label: 'Datum und Uhrzeit',
      value: formatEventDateTime(event),
    },
    {
      id: 'venue',
      icon: 'location-outline',
      label: 'Veranstaltungsort',
      value: event.venueLabel,
      secondaryValue:
        event.cityLabel && event.venueLabel.toLowerCase() !== event.cityLabel.toLowerCase()
          ? event.cityLabel
          : undefined,
    },
  ];

  if (!options?.hidePrice) {
    const ticket = resolvePublicTicketPresentation(event);
    if (ticket.ticketLabel) {
      items.push({
        id: 'price',
        icon: 'ticket-outline',
        label: 'Preis',
        value: ticket.ticketLabel,
      });
    }
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

  if (!options?.hideOrganizer && event.organizer) {
    items.push({
      id: 'organizer',
      icon: 'people-outline',
      label: 'Veranstalter',
      value: event.organizer,
    });
  }

  return {
    description: sanitizedDescription,
    items,
  };
}

export function toLineupSectionViewModel(
  event: EventDisplayModel,
  entities?: Pick<EventDetailEntities, 'artistsById'>,
): LineupSectionViewModel | undefined {
  const structuredEntries =
    event.lineupEntries && event.lineupEntries.length > 0 ? event.lineupEntries : undefined;

  if (structuredEntries) {
    const billingRows = buildLineupBillingRows({
      lineupEntries: structuredEntries,
      artistsById: entities?.artistsById,
      artistIds: event.artistIds,
      knownArtistNames: event.knownArtistNames,
    });
    const completeness =
      event.lineupCompleteness ??
      inferLineupCompleteness(event, billingRows.reduce((sum, row) => sum + row.artists.length, 0));

    return {
      artists: billingRows.flatMap((row) => row.artists),
      billingRows,
      accessibilityLabel: `Line-up für ${event.title}`,
      sectionTitle: event.lineupSectionTitle ?? resolveLineupSectionTitle(completeness, billingRows.length),
      lineupCompleteness: completeness,
    };
  }

  const names = event.knownArtistNames ?? [];
  if (names.length === 0) {
    const completeness =
      event.lineupCompleteness ??
      inferLineupCompleteness(event, 0);

    return {
      artists: [],
      tba: true,
      placeholderMessage:
        completeness === 'none'
          ? 'Kein Line-up verfügbar.'
          : 'Line-up wird bald bekannt gegeben.',
      accessibilityLabel: `Line-up für ${event.title}`,
      sectionTitle: resolveLineupSectionTitle(completeness, 0),
      lineupCompleteness: completeness,
    };
  }

  const completeness =
    event.lineupCompleteness ??
    inferLineupCompleteness(event, names.length);

  const showHeadlinerBadge = completeness === 'partial' && names.length <= 2;
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
        return [toLineupItemFromArtist(record, showHeadlinerBadge && index === 0)];
      }
    }
    return [toLineupItemFromName(name, showHeadlinerBadge && index === 0)];
  });

  return {
    artists,
    accessibilityLabel: `Line-up für ${event.title}`,
    sectionTitle: event.lineupSectionTitle ?? resolveLineupSectionTitle(completeness, artists.length),
    lineupCompleteness: completeness,
  };
}

export function toTimetableSectionViewModel(
  _event: EventDisplayModel,
): TimetableSectionViewModel | undefined {
  // Hide timetable until real stage/slot data exists — no duplicate empty cards.
  return undefined;
}

export function toVenueDetailViewModel(
  event: EventDisplayModel,
  entities?: Pick<EventDetailEntities, 'venue'>,
): VenueDetailViewModel {
  const venueStreet =
    entities?.venue?.street && entities.venue.houseNumber
      ? `${entities.venue.street} ${entities.venue.houseNumber}`
      : entities?.venue?.street ?? entities?.venue?.address;
  const addressValidity = resolveAddressValidity({
    venueName: entities?.venue?.name ?? event.venue,
    address: event.address ?? venueStreet,
    city: entities?.venue?.city ?? event.city,
    latitude: event.latitude ?? entities?.venue?.latitude,
    longitude: event.longitude ?? entities?.venue?.longitude,
  });

  if (entities?.venue) {
    const fromRecord = toVenueDetailFromRecord(entities.venue, event);
    return {
      ...fromRecord,
      addressLabel: addressValidity.streetAddress,
      profileNavigable: true,
      verified: resolveVenueVerificationStatus(entities.venue.id) === 'official_source',
    };
  }

  const address =
    addressValidity.streetAddress ??
    (event.address?.trim() && event.address.trim().toLowerCase() !== event.venueLabel.toLowerCase()
      ? event.address.trim()
      : undefined);

  return {
    id: event.venueId ?? event.venueLabel,
    name: event.venueLabel,
    addressLabel: address,
    cityLabel: event.cityLabel,
    image: event.image,
    verified: event.venueId ? resolveVenueVerificationStatus(event.venueId) === 'official_source' : false,
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
      verificationStatus: 'profile_not_claimed',
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
