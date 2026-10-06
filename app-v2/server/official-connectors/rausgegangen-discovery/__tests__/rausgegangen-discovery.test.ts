import { describe, expect, it } from 'vitest';

import { discoverRegionSlugsFromHomepageHtml, displayNameForRegionSlug } from '../discover-regions';
import { parseRausgegangenEventDetail } from '../parse-rausgegangen-detail';
import {
  dedupeListingEntries,
  parseRausgegangenCityListing,
} from '../parse-rausgegangen-listing';
import {
  buildRausgegangenIdentityKey,
  extractEventSlugFromUrl,
  normalizeRausgegangenEventUrl,
  titleFromEventSlug,
} from '../rausgegangen-url';

const TECHNOLIEBE_JSON_LD = `<!DOCTYPE html><html><head>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Event","name":"TECHNOLiEBE A.M.","description":"TECHNOLiEBE Vol. 44 bringt tech-begeisterte Menschen zusammen. Mit Acts wie RGb, eVe und Jan Zuen.","startDate":"2026-09-16T21:00+0200","endDate":"2026-09-17T03:00+0200","location":{"@type":"Place","name":"Garagen Club Köln","address":{"@type":"PostalAddress","streetAddress":"Oskar-Jäger-Straße 179","addressLocality":"Köln","postalCode":"50825","addressCountry":"DE"}},"image":["https://s3.eu-central-1.amazonaws.com/rausgegangen/example.png"],"offers":{"@type":"Offer","url":"https://t.rausgegangen.de/tickets/technoliebe-ammittwoch-4","price":"10.00","priceCurrency":"EUR","availability":"https://schema.org/InStock"},"organizer":{"@type":"Organization","name":"3A","url":"https://rausgegangen.de/organizations/technoliebe/"}}</script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Köln","item":"https://rausgegangen.de/cologne/"},{"@type":"ListItem","position":2,"name":"Party","item":"https://rausgegangen.de/cologne/kategorie/party/"}]}</script>
</head><body>
<a href="/cologne/tags/techno/">techno</a>
<a href="https://bootshaus-club.ticket.io/abc123/">ticket</a>
</body></html>`;

const COLOGNE_LISTING_SNIPPET = `
<a href="/events/technoliebe-ammittwoch-50/">Techno</a>
<a href="/events/comedy-frischgezapft-70/">Comedy</a>
<a href="https://rausgegangen.de/events/technoliebe-ammittwoch-50/?utm_source=test">dup</a>
`;

const SCHROTTY_LOCATION_SNIPPET = `
<a href="/events/ehrenklub-im-schrotty-14-0/">EhrenKlub</a>
<a href="/events/bailoteo-schrotty-september-0/">Bailoteo</a>
`;

describe('rausgegangen url normalization', () => {
  it('normalizes event urls and builds identity keys', () => {
    expect(normalizeRausgegangenEventUrl('https://rausgegangen.de/events/technoliebe-ammittwoch-50/?utm=1')).toBe(
      'https://rausgegangen.de/events/technoliebe-ammittwoch-50/',
    );
    expect(extractEventSlugFromUrl('https://rausgegangen.de/events/technoliebe-ammittwoch-50/')).toBe(
      'technoliebe-ammittwoch-50',
    );
    expect(buildRausgegangenIdentityKey('technoliebe-ammittwoch-50')).toBe('rausgegangen:technoliebe-ammittwoch-50');
    expect(titleFromEventSlug('technoliebe-ammittwoch-50')).toContain('Technoliebe');
  });
});

describe('rausgegangen listing parsing', () => {
  it('extracts venue location page events not present on city listing', () => {
    const cityEntries = parseRausgegangenCityListing(COLOGNE_LISTING_SNIPPET, 'cologne', 'https://rausgegangen.de/cologne/');
    const locationEntries = parseRausgegangenCityListing(
      SCHROTTY_LOCATION_SNIPPET,
      'location',
      'https://rausgegangen.de/locations/schrotty/',
    );
    expect(locationEntries.map((entry) => entry.eventSlug)).toContain('ehrenklub-im-schrotty-14-0');
    expect(cityEntries.map((entry) => entry.eventSlug)).not.toContain('ehrenklub-im-schrotty-14-0');
  });

  it('extracts and deduplicates listing urls', () => {
    const entries = parseRausgegangenCityListing(COLOGNE_LISTING_SNIPPET, 'cologne', 'https://rausgegangen.de/cologne/');
    expect(entries).toHaveLength(2);
    const { unique, duplicateCount } = dedupeListingEntries([
      ...entries,
      ...entries,
    ]);
    expect(unique).toHaveLength(2);
    expect(duplicateCount).toBe(2);
  });
});

describe('rausgegangen detail parsing', () => {
  it('parses schema.org Event JSON-LD', () => {
    const detail = parseRausgegangenEventDetail(
      TECHNOLIEBE_JSON_LD,
      'https://rausgegangen.de/events/technoliebe-ammittwoch-50/',
    );
    expect(detail.title).toBe('TECHNOLiEBE A.M.');
    expect(detail.city).toBe('Köln');
    expect(detail.ticketPriceMinor).toBe(1000);
    expect(detail.ticketUrl).toContain('t.rausgegangen.de');
    expect(detail.jsonLdPresent).toBe(true);
    expect(detail.tagHints).toEqual([]);
    expect(detail.categoryHints).not.toContain('Köln');
  });
});

describe('rausgegangen region discovery', () => {
  it('discovers city slugs from homepage html', () => {
    const html = `
      <a href="/cologne/">Köln</a>
      <a href="/berlin/">Berlin</a>
      <a href="/login/">Login</a>
    `;
    const slugs = discoverRegionSlugsFromHomepageHtml(html);
    expect(slugs).toContain('cologne');
    expect(slugs).toContain('berlin');
    expect(slugs).not.toContain('login');
    expect(displayNameForRegionSlug('cologne')).toBe('Köln');
  });
});
