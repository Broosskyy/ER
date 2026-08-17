import type { DiscoveredTicketLink, ResolvedTicketLink, TicketActionKind, ResolvedTicketAction } from './types';
import { isMerchandiseUrl } from './url-policy';

const PRESALE_REGISTRATION_PATTERN = /sibforms\.com|mailchimp|newsletter|waitlist|vormerken|presale.?reg/i;
const BOX_OFFICE_PATTERN = /abendkasse|box\s*office/i;

export function classifyTicketActionKind(
  discovered: DiscoveredTicketLink,
  resolved?: ResolvedTicketLink,
  options?: { eventEnded?: boolean },
): TicketActionKind {
  const url = resolved?.canonicalTicketUrl ?? discovered.rawUrl;
  const text = `${discovered.elementText ?? ''} ${discovered.relation}`;
  if (options?.eventEnded && resolved?.canonicalTicketUrl) {
    return 'historical_ticket_detail';
  }
  if (isMerchandiseUrl(url)) {
    return 'ticket_detail';
  }
  if (/sibforms\.com/i.test(url)) {
    return 'presale_registration';
  }
  if (PRESALE_REGISTRATION_PATTERN.test(url) || PRESALE_REGISTRATION_PATTERN.test(text) || discovered.relation === 'presale') {
    if (/vorverkauf|presale|vormerken/i.test(text)) {
      return 'presale_registration';
    }
  }
  if (BOX_OFFICE_PATTERN.test(text)) {
    return 'box_office';
  }
  return 'ticket_detail';
}

export function buildResolvedTicketAction(input: {
  discovered: DiscoveredTicketLink;
  resolved?: ResolvedTicketLink;
  observedAt: string;
  contentFingerprint: string;
  eventEnded?: boolean;
}): ResolvedTicketAction {
  const kind = classifyTicketActionKind(input.discovered, input.resolved, { eventEnded: input.eventEnded });
  return {
    kind,
    sourceEventUrl: input.discovered.discoveredOnUrl,
    rawUrl: input.discovered.rawUrl,
    resolvedUrl: input.resolved?.resolvedUrl ?? input.discovered.rawUrl,
    canonicalTicketUrl: input.resolved?.canonicalTicketUrl,
    providerKey: input.resolved?.providerKey,
    observedAt: input.observedAt,
    contentFingerprint: input.contentFingerprint,
  };
}

export function consumerActionLabel(kind: TicketActionKind): string {
  switch (kind) {
    case 'presale_registration':
      return 'Zum Vorverkauf vormerken';
    case 'waitlist':
      return 'Auf Warteliste';
    case 'box_office':
      return 'Abendkasse';
    case 'historical_ticket_detail':
      return 'Ticketarchiv öffnen';
    default:
      return 'Tickets kaufen';
  }
}
