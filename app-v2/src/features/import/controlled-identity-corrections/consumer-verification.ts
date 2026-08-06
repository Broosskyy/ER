import type { AdminEventRecord } from '@/data/types/records';
import { projectCanonicalEventFields } from '@/features/events/formatting/canonical-event-projection';

import {
  PHASE4864_R3HAB_EVENT_ID,
  PHASE4864_SOMMERFEST_EVENT_ID,
  PHASE4864_UNDERLAND_EVENT_ID,
  PHASE4864_UNDERLAND_TICKET_URL,
} from './constants';
import type { ConsumerVerificationResult } from './types';

const R3HAB_ARTISTS = ['R3HAB', 'LA FUENTE', 'OLIVER MAGENTA', 'RELOVA', 'DAVE REPLAY'];

function buildProjection(event: AdminEventRecord, artists: string[]) {
  return projectCanonicalEventFields({
    title: event.title,
    description: event.description ?? '',
    venue: event.venueName ?? '',
    city: event.venueCity ?? '',
    artists,
    priceText: event.priceText,
    source: event.sourceId ?? '',
    ticketUrl: event.ticketUrl,
    imageUrl: event.imageUrl,
    genres: event.genreLabels,
    ticketStatus: event.ticketStatus,
    ticketPhases: event.ticketPhases,
    latitude: event.latitude,
    longitude: event.longitude,
  });
}

export function verifyR3habConsumer(
  event: AdminEventRecord,
  artists: string[],
): ConsumerVerificationResult {
  const projection = buildProjection(event, artists);
  const desc = projection.sanitizedDescription ?? '';
  const checks: Record<string, boolean> = {
    septemberDescription: desc.includes('September'),
    noFooterContamination: !desc.includes('Mobile App') && !desc.includes('Merchandise'),
    ticketIoCta: String(event.ticketUrl ?? '').includes('C7JPnatZ'),
    price2390: Boolean(
      event.priceText?.includes('23,90') || projection.displayPriceText?.includes('23,90'),
    ),
    venueBootshaus: (event.venueName ?? '').toLowerCase().includes('bootshaus'),
    lineupFiveArtists: R3HAB_ARTISTS.every((name) =>
      artists.some((a) => a.toUpperCase().includes(name)),
    ),
  };
  return {
    eventId: PHASE4864_R3HAB_EVENT_ID,
    title: event.title,
    checks,
    projection: projection as unknown as Record<string, unknown>,
    passed: Object.values(checks).every(Boolean),
  };
}

export function verifyUnderlandConsumer(event: AdminEventRecord): ConsumerVerificationResult {
  const projection = buildProjection(event, []);
  const checks: Record<string, boolean> = {
    ticketKingsCta: event.ticketUrl === PHASE4864_UNDERLAND_TICKET_URL,
    noR3habTicketIo: !String(event.ticketUrl ?? '').includes('C7JPnatZ'),
    noBorrowedPrice: !event.priceText?.includes('23,90'),
    venueEssigfabrik: (event.venueName ?? '').toLowerCase().includes('essigfabrik'),
    providerTicketKings: String(projection.ticketProviderLabel ?? '')
      .toLowerCase()
      .includes('ticket'),
  };
  return {
    eventId: PHASE4864_UNDERLAND_EVENT_ID,
    title: event.title,
    checks,
    projection: projection as unknown as Record<string, unknown>,
    passed: Object.values(checks).every(Boolean),
  };
}

export function verifySommerfestConsumer(event: AdminEventRecord): ConsumerVerificationResult {
  const projection = buildProjection(event, []);
  const checks: Record<string, boolean> = {
    venueBootshaus: (event.venueName ?? '').toLowerCase().includes('bootshaus'),
    addressAuenweg: (event.venueAddress ?? '').includes('Auenweg 173'),
    noEssigfabrikVenue: !(event.venueName ?? '').toLowerCase().includes('essigfabrik'),
    ticketIoCta: String(event.ticketUrl ?? '').includes('vB0cAmWg'),
    price1190: Boolean(
      event.priceText?.includes('11,90') || projection.displayPriceText?.includes('11,90'),
    ),
    noUnderlandUrl: !String(event.ticketUrl ?? '').includes('underland'),
  };
  return {
    eventId: PHASE4864_SOMMERFEST_EVENT_ID,
    title: event.title,
    checks,
    projection: projection as unknown as Record<string, unknown>,
    passed: Object.values(checks).every(Boolean),
  };
}

export function buildDisplayModelVerification(event: AdminEventRecord): Record<string, unknown> {
  const projection = buildProjection(event, []);
  return {
    ticketUrl: projection.ticketUrl ?? event.ticketUrl,
    displayPriceText: projection.displayPriceText,
    venue: projection.venueLabel,
    city: projection.cityLabel,
    ticketProviderLabel: projection.ticketProviderLabel,
  };
}
