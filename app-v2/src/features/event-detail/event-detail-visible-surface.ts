import type { EventDetail } from '@/features/events/types/event-core';
import type { EventDisplayModel } from '@/features/events/formatting/display-event';
import type { EventTicketStatus } from '@/components/discovery/view-models';
import { resolveConsumerTicketPresentation } from '@/features/events/tickets/consumer-ticket-safety-gate';
import {
  containsTechnicalProviderState,
  isRawTicketStatusValue,
} from '@/features/events/tickets/consumer-ticket-status-label';

export interface EventDetailVisibleSurface {
  eventId: string;
  title: string;
  dateLine: string;
  venueLine: string;
  description: string | null;
  lineup: string[];
  genres: string[];
  priceText: string | null;
  statusLabel: string | null;
  ticketBadgeStatus: EventTicketStatus | null;
  purchaseCtaLabel: string | null;
  presaleCtaLabel: string | null;
  ticketCtaUrl: string | null;
  officialSourceLabel: string | null;
  officialSourceUrl: string | null;
  organizerName: string | null;
  organizerWebsiteLabel: string | null;
  organizerWebsiteUrl: string | null;
  organizerSocialUrls: string[];
  visibleText: string;
  visibleTextWithoutUrls: string;
  rawTicketStatusValuesRendered: number;
  technicalProviderStatesRendered: number;
}

export function buildEventDetailVisibleSurface(
  detail: EventDetail,
  display: EventDisplayModel,
): EventDetailVisibleSurface {
  const ticket = detail.tickets[0] ?? null;
  const ticketPresentation = resolveConsumerTicketPresentation(ticket);
  const dateLine = [
    display.date,
    display.startTime ? `· ${display.startTime}` : '',
    display.endTime ? `– ${display.endTime}` : '',
  ]
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  const venueLine = [display.venue, display.city].filter(Boolean).join(', ');
  const lineup = detail.lineup.map((act) => act.billingName);
  const genres = detail.genres.map((genre) => genre.displayName);
  const officialSource = display.visibleSources?.[0] ?? null;
  const organizerWebsite = (display.organizerLinks ?? []).find((link) => link.role === 'organizer_website');
  const organizerSocialUrls = (display.organizerLinks ?? [])
    .filter((link) => link.role === 'organizer_social')
    .map((link) => link.url);
  const ticketCtaUrl =
    (ticketPresentation.showPurchaseCta || ticketPresentation.showPresaleCta) && ticketPresentation.ticketUrl
      ? ticketPresentation.ticketUrl
      : null;

  const visibleLines = [
    display.title,
    dateLine,
    venueLine,
    display.description || null,
    ...lineup,
    ...genres,
    ticketPresentation.priceText ?? null,
    ticketPresentation.statusLabel ?? null,
    ticketPresentation.showPurchaseCta ? ticketPresentation.purchaseCtaLabel ?? 'Tickets kaufen' : null,
    ticketPresentation.showPresaleCta ? ticketPresentation.presaleCtaLabel ?? 'Vorregistrieren' : null,
    officialSource ? `${officialSource.label} ↗` : null,
    display.organizer ?? null,
    ...(display.organizerLinks ?? []).map((link) => `${link.label} ↗`),
  ].filter((line): line is string => Boolean(line && line.trim()));

  const visibleText = visibleLines.join('\n');
  const visibleTextWithoutUrls = visibleText.replace(/https?:\/\/\S+/gi, '');
  const rawTicketStatusValuesRendered = visibleLines.filter((line) => isRawTicketStatusValue(line)).length;
  const technicalProviderStatesRendered = visibleLines.filter((line) => containsTechnicalProviderState(line)).length;

  return {
    eventId: detail.id,
    title: display.title,
    dateLine,
    venueLine,
    description: display.description || null,
    lineup,
    genres,
    priceText: ticketPresentation.priceText ?? null,
    statusLabel: ticketPresentation.statusLabel ?? null,
    ticketBadgeStatus: ticketPresentation.badgeStatus ?? null,
    purchaseCtaLabel: ticketPresentation.showPurchaseCta
      ? ticketPresentation.purchaseCtaLabel ?? 'Tickets kaufen'
      : null,
    presaleCtaLabel: ticketPresentation.showPresaleCta
      ? ticketPresentation.presaleCtaLabel ?? 'Vorregistrieren'
      : null,
    ticketCtaUrl,
    officialSourceLabel: officialSource?.label ?? null,
    officialSourceUrl: officialSource?.url ?? null,
    organizerName: display.organizer ?? null,
    organizerWebsiteLabel: organizerWebsite?.label ?? null,
    organizerWebsiteUrl: organizerWebsite?.url ?? null,
    organizerSocialUrls,
    visibleText,
    visibleTextWithoutUrls,
    rawTicketStatusValuesRendered,
    technicalProviderStatesRendered,
  };
}

export function eventDetailSurfaceToHtml(surface: EventDetailVisibleSurface): string {
  const lineup = surface.lineup.map((name) => `<li>${escapeHtml(name)}</li>`).join('') || '<li>(kein Line-up)</li>';
  const genres = surface.genres.map((name) => `<span class="chip">${escapeHtml(name)}</span>`).join('') || '(keine)';
  return `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"><title>${escapeHtml(surface.title)}</title></head>
<body>
<main data-testid="event-detail-content">
  <h1>${escapeHtml(surface.title)}</h1>
  <p>${escapeHtml(surface.dateLine)}</p>
  <p>${escapeHtml(surface.venueLine)}</p>
  ${surface.description ? `<section><h2>Beschreibung</h2><p>${escapeHtml(surface.description)}</p></section>` : ''}
  <section><h2>Line-up</h2><ul>${lineup}</ul></section>
  <section><h2>Genres</h2><div>${genres}</div></section>
  <section>
    <h2>Tickets</h2>
    ${surface.priceText ? `<p>${escapeHtml(surface.priceText)}</p>` : ''}
    ${surface.statusLabel ? `<p>${escapeHtml(surface.statusLabel)}</p>` : ''}
    ${surface.purchaseCtaLabel && surface.ticketCtaUrl ? `<a data-testid="ticket-cta" href="${escapeHtml(surface.ticketCtaUrl)}">${escapeHtml(surface.purchaseCtaLabel)}</a>` : ''}
    ${surface.presaleCtaLabel && surface.ticketCtaUrl ? `<a data-testid="presale-cta" href="${escapeHtml(surface.ticketCtaUrl)}">${escapeHtml(surface.presaleCtaLabel)}</a>` : ''}
  </section>
  ${
    surface.officialSourceUrl
      ? `<section data-testid="event-source-section"><h2>Quellen</h2><a data-testid="event-official-source-link" href="${escapeHtml(surface.officialSourceUrl)}">${escapeHtml(surface.officialSourceLabel ?? 'Quelle')} ↗</a></section>`
      : ''
  }
  <section data-testid="event-organizer-section">
    <h2>Veranstalter</h2>
    ${surface.organizerName ? `<p>${escapeHtml(surface.organizerName)}</p>` : ''}
    ${
      surface.organizerWebsiteUrl
        ? `<a data-testid="event-organizer-website-link" href="${escapeHtml(surface.organizerWebsiteUrl)}">${escapeHtml(surface.organizerWebsiteLabel ?? 'Website')} ↗</a>`
        : ''
    }
  </section>
  <pre data-visible-text>${escapeHtml(surface.visibleText)}</pre>
</main>
</body></html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
