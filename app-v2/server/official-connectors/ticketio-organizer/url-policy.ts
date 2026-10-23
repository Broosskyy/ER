import * as cheerio from 'cheerio';

/** Shops checked manually against actual publicly listed electronic events.
 * More organizer shops may be added only after source and scope review. */
export const APPROVED_TICKETIO_SHOP_HOSTS = [
  'area51events.ticket.io',
  'electric-horizon.ticket.io',
] as const;

export function isApprovedTicketIoEventUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' &&
      APPROVED_TICKETIO_SHOP_HOSTS.some(host => url.hostname === host) &&
      /^\/[a-z0-9]{8}\/?$/i.test(url.pathname) &&
      !url.username && !url.password;
  } catch {
    return false;
  }
}

export function listApprovedTicketIoShopEvents(html: string, shopHost: string): string[] {
  if (!APPROVED_TICKETIO_SHOP_HOSTS.some(host => host === shopHost)) return [];
  const $ = cheerio.load(html);
  const links = new Set<string>();
  $('a[href]').each((_index, node) => {
    const href = $(node).attr('href')?.trim();
    if (!href) return;
    try {
      const url = new URL(href, 'https://' + shopHost + '/');
      if (!isApprovedTicketIoEventUrl(url.toString()) || url.hostname !== shopHost) return;
      links.add('https://' + shopHost + url.pathname.replace(/\/?$/, '/'));
    } catch {
      // Reject invalid source URLs rather than following them.
    }
  });
  return [...links];
}
