import { extractParagraphBlocksFromHtml } from './description-boundaries';
import type { WebsiteProviderAdapter } from './types';

function extractTagContainerGenres(html: string, containerClass: string): string[] {
  if (!html.includes(containerClass)) return [];
  const genres: string[] = [];
  for (const match of html.matchAll(/<div[^>]*class="[^"]*tag-title[^"]*"[^>]*>([^<]+)</gi)) {
    const label = match[1]?.trim();
    if (label) genres.push(label);
  }
  return [...new Set(genres)];
}

function allowBootshausProviderDefaultVenue(html: string): boolean {
  const contentText = extractParagraphBlocksFromHtml(html).join(' ').toLowerCase();
  if (/essigfabrik|elektroküche|elektrokueche|kd boot|on a ship/i.test(contentText)) {
    return false;
  }
  if (/mainfloor/i.test(contentText)) {
    return true;
  }
  return false;
}

export const bootshausProviderAdapter: WebsiteProviderAdapter = {
  key: 'bootshaus',
  hostPattern: /bootshaus\.tv/i,
  titleSuffixPatterns: [/\s*[|–—-]\s*Bootshaus Club\s*$/i],
  listDiscovery: {
    listPageUrl: 'https://bootshaus.tv/',
    eventLinkPattern: /href=["'](https?:\/\/bootshaus\.tv\/events\/[^"'#?]+)["']/gi,
    strategy: 'bootshaus_upcoming_list',
  },
  extractGenres: (html) => {
    const genres = extractTagContainerGenres(html, 'genres-container');
    return genres.length > 0 ? genres : undefined;
  },
  resolveOrganizerLabel: () => 'Bootshaus',
  resolvePromoterLabel: () => 'Bootshaus',
  allowProviderDefaultVenue: allowBootshausProviderDefaultVenue,
  providerDefaultVenueLabel: 'Bootshaus',
  sourceRoles: ['official_website_source', 'organizer', 'promoter'],
};

export const affenkaefigProviderAdapter: WebsiteProviderAdapter = {
  key: 'affenkaefig',
  hostPattern: /affenkaefig\.info/i,
  titleSuffixPatterns: [/\s*[–—-]\s*Affenkaefig Veranstaltungen\s*$/i],
  listDiscovery: {
    listPageUrl: 'https://affenkaefig.info/tickets/',
    eventLinkPattern: /href=["'](https?:\/\/affenkaefig\.info\/event\/[^"'#?]+)["']/gi,
    strategy: 'affenkaefig_ticket_list',
  },
  resolveOrganizerLabel: () => 'Affenkäfig',
  sourceRoles: ['official_website_source', 'discovery_source', 'organizer'],
};

export const ticketKingsProviderAdapter: WebsiteProviderAdapter = {
  key: 'ticket_kings',
  hostPattern: /ticketkings\.de/i,
  titleSuffixPatterns: [/\s*[|–—-]\s*TicketKings[^|–—-]*$/i],
  listDiscovery: {
    listPageUrl: 'https://ticketkings.de/',
    eventLinkPattern: /href=["'](https?:\/\/ticketkings\.de\/event\/[^"'#?]+)["']/gi,
    strategy: 'ticket_kings_event_list',
  },
  extractGenres: (html) => {
    const genres: string[] = [];
    for (const match of html.matchAll(
      /tribe-events-event-categories[^>]*>[\s\S]*?<a[^>]*>([^<]+)</gi,
    )) {
      const label = match[1]?.trim();
      if (label) genres.push(label);
    }
    return genres.length > 0 ? [...new Set(genres)] : undefined;
  },
  sourceRoles: ['official_website_source', 'ticket_platform'],
};

export const PROVIDER_ADAPTERS: WebsiteProviderAdapter[] = [
  bootshausProviderAdapter,
  affenkaefigProviderAdapter,
  ticketKingsProviderAdapter,
];

export function resolveProviderAdapter(url: string): WebsiteProviderAdapter | undefined {
  return PROVIDER_ADAPTERS.find((adapter) => adapter.hostPattern.test(url));
}
