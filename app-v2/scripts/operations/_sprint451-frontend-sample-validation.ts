/**
 * Phase 4.5.1 — Frontend sample validation (same projection path as Event Detail UI).
 */
import './bootstrap-ops-supabase';

import { classifyTicketUrl, isEventSpecificTicketUrl } from '@/features/events/domain/ticket-url-quality';
import { toEventInfoViewModel, toEventTicketSectionViewModel } from '@/features/event-detail/utils/event-detail-view-model';
import { formatDisplayPriceText } from '@/features/aggregation/connectors/ticket-platform/format-ticket-price';
import { toEventDisplayModel } from '@/features/events/formatting/display-event';
import { eventRepository, importEventPublishService } from '@/data/repositories/registry';
import type { EventFrontendSampleRow } from './ops-supabase-rows';
import { opsClient } from './ops-supabase-rows';

const SAMPLES = [
  { id: 'evt-1785339406307-kw5r61q', label: 'PLAY! Open Air', expectDeepLink: true },
  { id: 'evt-1785339415449-xpazmaq', label: 'Sommerfest Part 4', expectDeepLink: true },
  { id: 'evt-1785339005035-wam829k', label: 'AFFENKÄFIG RULES club event', expectDeepLink: true },
  { id: 'evt-1785339377456-7miaf2o', label: 'Mallorca NOTRE DAME', expectDeepLink: false },
];

async function validateFromRepository(route: string, eventId: string) {
  const event = eventRepository.getEventById(eventId);
  if (!event) {
    return { route, eventId, found: false };
  }

  const client = opsClient();
  const { data: row } = await client
    .from('events')
    .select('description,ticket_url,price_text,venue_name,city_name,source_id')
    .eq('id', eventId)
    .maybeSingle();
  const eventRow = row as EventFrontendSampleRow | null;

  const displayEvent = toEventDisplayModel(event);
  const canonical = {
    ...displayEvent,
    description: eventRow?.description ?? event.description,
    ticketUrl: eventRow?.ticket_url ?? event.ticketUrl,
    displayPriceText: displayEvent.displayPriceText,
    ticketProviderLabel: displayEvent.ticketProviderLabel,
    venueLabel: eventRow?.venue_name ?? event.venue,
    cityLabel: eventRow?.city_name ?? event.city,
    sanitizedDescription: displayEvent.sanitizedDescription,
  };

  const detail = toEventInfoViewModel(canonical);
  const ticket = toEventTicketSectionViewModel(canonical);

  return {
    route,
    eventId,
    found: true,
    title: event.title,
    descriptionLength: detail.description?.length ?? 0,
    descriptionPresent: Boolean(detail.description?.trim()),
    ticketUrl: canonical.ticketUrl,
    ticketClass: classifyTicketUrl(canonical.ticketUrl).class,
    ticketProviderLabel: canonical.ticketProviderLabel,
    priceText: canonical.displayPriceText ?? formatDisplayPriceText(eventRow?.price_text ?? event.priceText),
    venue: canonical.venueLabel,
    city: canonical.cityLabel,
    ticketCta: ticket.ctaLabel,
    ticketMode: ticket.mode,
  };
}

async function main(): Promise<void> {
  await importEventPublishService.refreshConsumerFeed();

  const results = [];
  for (const sample of SAMPLES) {
    const direct = await validateFromRepository('event-detail-direct', sample.id);
    const homeNav = await validateFromRepository('home-nav-simulated', sample.id);
    const searchNav = await validateFromRepository('search-nav-simulated', sample.id);

    const deepLinkOk = sample.expectDeepLink
      ? isEventSpecificTicketUrl(direct.ticketUrl)
      : direct.ticketClass === 'shop_root' || direct.ticketClass === 'event_specific';

    results.push({
      ...sample,
      deepLinkOk,
      descriptionOk: (direct.descriptionLength ?? 0) > 100,
      routes: { direct, homeNav, searchNav },
    });
  }

  console.log(JSON.stringify({ phase: '4.5.1', validatedAt: new Date().toISOString(), results }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
