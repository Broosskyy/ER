import * as cheerio from 'cheerio';

/** Shops checked manually against actual publicly listed electronic events.
 * More organizer shops may be added only after source and scope review. */
export const APPROVED_TICKETIO_SHOP_HOSTS = [
  'area51events.ticket.io',
  'electric-horizon.ticket.io',
  'techno-rave.ticket.io',
  'lieberscholli.ticket.io',
  'capitolpaderborn.ticket.io',
  'sheg-events.ticket.io',
  's-club-fulda.ticket.io',
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


/** Interleave distinct organizer calendars, so the first busy shop cannot
 * monopolize a bounded nationwide admission-check window. */
export function pickBalancedTicketIoEventUrls(
  shopLists: readonly (readonly string[])[],
  limit: number,
): string[] {
  if (!Number.isInteger(limit) || limit < 0 || limit > 40)
    throw new Error('invalid_ticketio_import_limit');
  const output: string[] = [];
  const seen = new Set<string>();
  const maxDepth = Math.max(0,...shopLists.map(list=>list.length));
  for (let depth=0;depth<maxDepth && output.length<limit;depth++) {
    for (const shop of shopLists) {
      const url=shop[depth];
      if (!url || seen.has(url) || !isApprovedTicketIoEventUrl(url)) continue;
      seen.add(url);
      output.push(url);
      if (output.length>=limit) break;
    }
  }
  return output;
}
