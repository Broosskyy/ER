import type { AdminEventRecord } from '@/data/types/records';
import { projectCanonicalEventFields } from '@/features/events/formatting/canonical-event-projection';

import type { EventBackupSnapshot, GateMutation } from './types';
import {
  PHASE4864_R3HAB_EVENT_ID,
  PHASE4864_R3HAB_TICKET_URL,
  PHASE4864_SOMMERFEST_EVENT_ID,
  PHASE4864_UNDERLAND_EVENT_ID,
  PHASE4864_UNDERLAND_TICKET_URL,
  PHASE4864_WRONG_TICKET_IO_SLUG,
} from './constants';

export function planGateA(event: AdminEventRecord, sourceRefs: Array<{ sourceId: string; externalEventId: string; active?: boolean }>): {
  mutations: GateMutation[];
  deactivateRefs: Array<{ sourceId: string; externalEventId: string }>;
} {
  const mutations: GateMutation[] = [];
  const deactivateRefs: Array<{ sourceId: string; externalEventId: string }> = [];

  if (event.ticketUrl !== PHASE4864_UNDERLAND_TICKET_URL) {
    mutations.push({
      gate: 'A',
      eventId: event.id,
      field: 'ticketUrl',
      previousValue: event.ticketUrl,
      newValue: PHASE4864_UNDERLAND_TICKET_URL,
      reason: 'Replace wrong R3HAB Ticket.io URL with Underland Ticket Kings destination',
    });
  }

  if (event.priceText?.trim()) {
    mutations.push({
      gate: 'A',
      eventId: event.id,
      field: 'priceText',
      previousValue: event.priceText,
      newValue: '',
      reason: 'wrong_event_ticket_price_removed — borrowed R3HAB Ticket.io price',
    });
  }

  for (const ref of sourceRefs) {
    if (
      ref.active !== false &&
      String(ref.externalEventId).includes(PHASE4864_WRONG_TICKET_IO_SLUG)
    ) {
      deactivateRefs.push({
        sourceId: String(ref.sourceId),
        externalEventId: String(ref.externalEventId),
      });
      mutations.push({
        gate: 'A',
        eventId: event.id,
        field: 'sourceReference',
        previousValue: { active: true, externalEventId: ref.externalEventId },
        newValue: { active: false, reason: 'stale_ticket_io_composite_identity' },
        reason: `Deactivate stale Ticket.io ref ${ref.externalEventId}`,
      });
    }
  }

  return { mutations, deactivateRefs };
}

export function planGateB(
  event: AdminEventRecord,
  sourceRefs: Array<{ sourceId: string; externalEventId: string; active?: boolean }>,
): {
  mutations: GateMutation[];
  deactivateRefs: Array<{ sourceId: string; externalEventId: string }>;
} {
  const mutations: GateMutation[] = [];
  const deactivateRefs: Array<{ sourceId: string; externalEventId: string }> = [];

  if (event.venueName !== 'Bootshaus') {
    mutations.push({
      gate: 'B',
      eventId: event.id,
      field: 'venueName',
      previousValue: event.venueName,
      newValue: 'Bootshaus',
      reason: 'Ticket.io JSON-LD/list evidence: Bootshaus at Auenweg 173',
    });
  }

  for (const ref of sourceRefs) {
    const external = String(ref.externalEventId);
    if (
      ref.active !== false &&
      external.includes('underland-essigfabrik') &&
      ref.sourceId !== 'source-bootshaus-koeln'
    ) {
      deactivateRefs.push({
        sourceId: String(ref.sourceId),
        externalEventId: external,
      });
      mutations.push({
        gate: 'B',
        eventId: event.id,
        field: 'sourceReference',
        previousValue: { active: true, externalEventId: external },
        newValue: { active: false, reason: 'stale_underland_ticket_kings_on_sommerfest' },
        reason: 'Deactivate stale Underland Ticket Kings ref on Sommerfest',
      });
    }
  }

  return { mutations, deactivateRefs };
}

export function planGateC(
  event: AdminEventRecord,
  sourceRefs: Array<{ sourceId: string; externalEventId: string; active?: boolean }>,
): GateMutation[] {
  const mutations: GateMutation[] = [];
  if (!event.priceText?.includes('23,90')) {
    mutations.push({
      gate: 'C',
      eventId: event.id,
      field: 'priceText',
      previousValue: event.priceText ?? '',
      newValue: 'ab 23,90 €',
      reason: 'Ticket.io list-row Event-specific price for C7JPnatZ',
    });
  }
  if (event.ticketUrl !== PHASE4864_R3HAB_TICKET_URL) {
    mutations.push({
      gate: 'C',
      eventId: event.id,
      field: 'ticketUrl',
      previousValue: event.ticketUrl,
      newValue: PHASE4864_R3HAB_TICKET_URL,
      reason: 'Ensure correct Ticket.io CTA preserved',
    });
  }
  const hasEnrichmentRef = sourceRefs.some(
    (ref) =>
      ref.active !== false &&
      ref.sourceId === 'source-bootshaus-ticket-io' &&
      String(ref.externalEventId).includes('C7JPnatZ'),
  );
  if (!hasEnrichmentRef) {
    mutations.push({
      gate: 'C',
      eventId: event.id,
      field: 'sourceReference',
      previousValue: null,
      newValue: {
        sourceId: 'source-bootshaus-ticket-io',
        externalEventId: PHASE4864_R3HAB_TICKET_URL,
        enrichment: true,
      },
      reason: 'Create Ticket.io enrichment source reference',
    });
  }
  return mutations;
}

export function buildBackupSnapshot(
  event: AdminEventRecord,
  sourceRefs: unknown[],
  provenance: Record<string, unknown>,
): EventBackupSnapshot {
  const projection = projectCanonicalEventFields({
    title: event.title,
    description: event.description ?? '',
    venue: event.venueName ?? '',
    city: event.venueCity ?? '',
    artists: [],
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
  return {
    event: {
      id: event.id,
      title: event.title,
      ticketUrl: event.ticketUrl,
      priceText: event.priceText,
      ticketStatus: event.ticketStatus,
      ticketPhases: event.ticketPhases,
      venueName: event.venueName,
      venueCity: event.venueCity,
      venueAddress: event.venueAddress,
      latitude: event.latitude,
      longitude: event.longitude,
      sourceId: event.sourceId,
      description: event.description,
      imageUrl: event.imageUrl,
      websiteUrl: event.websiteUrl,
      genreLabels: event.genreLabels,
    },
    sourceReferences: sourceRefs,
    provenance,
    projection: projection as unknown as Record<string, unknown>,
  };
}

export const GATE_EVENT_IDS = {
  A: PHASE4864_UNDERLAND_EVENT_ID,
  B: PHASE4864_SOMMERFEST_EVENT_ID,
  C: PHASE4864_R3HAB_EVENT_ID,
} as const;
