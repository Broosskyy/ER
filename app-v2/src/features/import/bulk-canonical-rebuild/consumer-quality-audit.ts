import type { AdminEventRecord } from '@/data/types/records';

import { buildConsumerProjection } from './evidence-field-extractor';

const RAW_LABEL_PATTERNS = [
  /list admission/i,
  /public transport info/i,
  /mobile app/i,
  /cookie/i,
  /checkout/i,
];

const CHECKOUT_HOSTS = ['nacht-manager.de', 'embed=1', 'embed_layout=checkout'];

export interface ConsumerQualityResult {
  publishable: boolean;
  partial: boolean;
  issues: string[];
  checks: Record<string, boolean>;
}

export function auditConsumerQuality(
  event: AdminEventRecord,
  lineupArtistNames: string[] = [],
): ConsumerQualityResult {
  const projection = buildConsumerProjection(event, lineupArtistNames);
  const issues: string[] = [];
  const checks: Record<string, boolean> = {};

  const ticketUrl = String(event.ticketUrl ?? '');
  const websiteUrl = String(event.websiteUrl ?? '');
  const description = String(event.description ?? projection.sanitizedDescription ?? '');
  const displayPrice = String(projection.displayPriceText ?? event.priceText ?? '');

  checks.noCheckoutAsCta = !CHECKOUT_HOSTS.some((host) => ticketUrl.includes(host));
  if (!checks.noCheckoutAsCta) issues.push('checkout_url_as_public_cta');

  checks.noTicketPageAsWebsite =
    !websiteUrl.includes('ticket.io') && !websiteUrl.includes('ticketkings.de');
  if (!checks.noTicketPageAsWebsite) issues.push('ticket_page_as_official_website');

  checks.noDuplicatePriceLine =
    !displayPrice ||
    !String(projection.displayPriceText ?? '')
      .split('\n')
      .filter((line) => line.includes('€'))
      .some((line, index, arr) => arr.indexOf(line) !== index);
  if (!checks.noDuplicatePriceLine) issues.push('duplicate_price_line');

  checks.noRawLabels = !RAW_LABEL_PATTERNS.some((pattern) => pattern.test(description));
  if (!checks.noRawLabels) issues.push('raw_label_in_description');

  const artistNames = lineupArtistNames.map((name) => name.toLowerCase());
  checks.noTransportAsArtist = !artistNames.some((name) => name.includes('public transport'));
  if (!checks.noTransportAsArtist) issues.push('transport_text_as_artist');

  checks.noTbaAsArtist = !artistNames.some((name) => name === 'tba' || name === 'to be announced');
  if (!checks.noTbaAsArtist) issues.push('tba_published_as_artist');

  const now = new Date().toISOString();
  const ended = Boolean(event.endDate && event.endDate < now);
  checks.noActiveTicketsWhenEnded =
    !ended || event.ticketStatus === 'sales_ended' || event.ticketStatus === 'sold_out';
  if (!checks.noActiveTicketsWhenEnded) issues.push('active_tickets_after_end');

  checks.hasTitle = Boolean(event.title?.trim());
  if (!checks.hasTitle) issues.push('missing_title');

  const publishable = issues.length === 0 && checks.hasTitle;
  const partial = !publishable && Boolean(event.title && event.startDate);

  return {
    publishable,
    partial,
    issues,
    checks,
  };
}
