import { describe, expect, it } from 'vitest';

import {
  formatLocationLabel,
  isPlaceholderEventText,
  projectCanonicalEventFields,
  sanitizeEventDescription,
  stripTrailingCityFromVenue,
} from '@/features/events/formatting/canonical-event-projection';
import { getSourceDisplayLabel } from '@/features/events/formatting/source-display-labels';
import { toEventCardViewModel } from '@/features/events/formatting/event-card-view-model';
import { toEventInfoViewModel } from '@/features/event-detail/utils/event-detail-view-model';
import { inferLineupCompleteness, resolveLineupSectionTitle } from '@/features/event-detail/utils/lineup-completeness';
import type { EventDisplayModel } from '@/features/events/formatting/display-event';
import { applySourceFieldDefaults } from '@/features/import/normalization/source-field-defaults';
import { extractExternalLocationFromTitle } from '@/features/import/normalization/external-location-from-title';

describe('sprint 43.3 canonical projection', () => {
  it('strips placeholder descriptions', () => {
    expect(isPlaceholderEventText('N/A')).toBe(true);
    expect(sanitizeEventDescription('N/A')).toBeUndefined();
    expect(sanitizeEventDescription('Real copy')).toBe('Real copy');
  });

  it('prevents duplicate city in location labels', () => {
    expect(stripTrailingCityFromVenue('Bootshaus, Köln', 'Köln')).toBe('Bootshaus');
    expect(formatLocationLabel('Köln', 'Köln')).toBe('Köln');
    expect(formatLocationLabel('Bootshaus', 'Köln')).toBe('Bootshaus, Köln');
  });

  it('resolves ticket provider labels for production sources', () => {
    expect(getSourceDisplayLabel('source-bootshaus-koeln')).toBe('Bootshaus');
    expect(getSourceDisplayLabel('source-affenkaefig')).toBe('Affenkäfig');
    expect(getSourceDisplayLabel('source-ticket-io-protontheclub')).toBe('Ticket.io');
    expect(getSourceDisplayLabel('unknown-source', 'https://ra.co/events/123')).toBe(
      'Resident Advisor',
    );
    expect(getSourceDisplayLabel('unknown-source')).toBe('Externe Quelle');
  });

  it('projects the same price and provider across card and detail', () => {
    const canonical = projectCanonicalEventFields({
      title: 'DNB CONNECTION pres. SHOCKONE',
      description: 'N/A',
      venue: 'Proton The Club',
      city: 'Stuttgart',
      artists: ['SHOCKONE'],
      lineup: ['SHOCKONE'],
      priceText: 'Tickets ab 12,00 Euro',
      source: 'source-ticket-io-protontheclub',
      ticketUrl: 'https://proton-the-club.ticket.io/hyHJr2xd/',
    });
    const display = {
      id: 'evt-1',
      slug: 'evt-1',
      title: 'DNB CONNECTION pres. SHOCKONE',
      description: 'N/A',
      image: 0,
      date: '01 AUG',
      startTime: '22:00',
      venue: canonical.venueLabel,
      city: canonical.cityLabel,
      genres: [],
      artists: canonical.knownArtistNames,
      lineup: canonical.knownArtistNames,
      priceText: canonical.displayPriceText,
      source: 'source-ticket-io-protontheclub',
      sourceLabel: canonical.ticketProviderLabel,
      startsAt: '2026-08-01T22:00:00+02:00',
      startDateTime: '2026-08-01T22:00:00+02:00',
      timezone: 'Europe/Berlin',
      status: 'published',
      ...canonical,
    } as EventDisplayModel;
    const card = toEventCardViewModel(display);
    const info = toEventInfoViewModel(display);

    expect(display.displayPriceText).toBe('ab 12,00 €');
    expect(card.ticketLabel).toBe('ab 12,00 €');
    expect(info.items.find((item) => item.id === 'price')?.value).toBe('ab 12,00 €');
    expect(display.ticketProviderLabel).toBe('Ticket.io');
  });

  it('exposes public semantics without requiring surface fallbacks', () => {
    const projection = projectCanonicalEventFields({
      title: 'AMØK Open Air',
      description: 'A complete event description for Palma.',
      venue: 'AMØK Club',
      city: 'Palma de Mallorca',
      countryCode: 'ES',
      countryLabel: 'Spain',
      latitude: 39.5696,
      longitude: 2.6502,
      timezone: 'Europe/Madrid',
      organizer: 'Bootshaus',
      artists: ['Artist A'],
      genres: ['Techno'],
      priceText: 'Tickets ab 18,00 Euro',
      source: 'source-bootshaus-koeln',
      ticketUrl: 'https://bootshaus.tv/events/amok-open-air',
      ticketStatus: 'on_sale',
      imageUrl: 'https://images.example.com/hero.jpg',
      originCount: 2,
    });

    expect(projection.ticketAvailability).toBe('on_sale');
    expect(projection.isSoldOut).toBe(false);
    expect(projection.locationLabelComma).toBe('AMØK Club, Palma de Mallorca');
    expect(projection.countryCode).toBe('ES');
    expect(projection.hasCoordinates).toBe(true);
    expect(projection.organizerLabel).toBe('Bootshaus');
    expect(projection.heroImageUrl).toContain('hero.jpg');
    expect(projection.galleryImageUrls).toHaveLength(1);
    expect(projection.originCount).toBe(2);
    expect(projection.qualityState).toBe('complete');
  });

  it('shows partial lineup instead of empty placeholder', () => {
    const canonical = projectCanonicalEventFields({
      title: 'DNB CONNECTION pres. SHOCKONE',
      description: '',
      venue: 'Club',
      city: 'Stuttgart',
      artists: ['SHOCKONE'],
      lineup: ['SHOCKONE'],
      source: 'source-ticket-io-protontheclub',
    });
    const display = {
      id: 'evt-1',
      slug: 'evt-1',
      title: 'DNB CONNECTION pres. SHOCKONE',
      description: '',
      image: 0,
      date: '01 AUG',
      startTime: '22:00',
      venue: 'Club',
      city: 'Stuttgart',
      genres: [],
      artists: ['SHOCKONE'],
      source: 'source-ticket-io-protontheclub',
      sourceLabel: 'Ticket.io',
      startsAt: '2026-08-01T22:00:00+02:00',
      startDateTime: '2026-08-01T22:00:00+02:00',
      timezone: 'Europe/Berlin',
      status: 'published',
      ...canonical,
    } as EventDisplayModel;
    const lineup = {
      sectionTitle: resolveLineupSectionTitle(canonical.lineupCompleteness),
      completeness: canonical.lineupCompleteness,
      artistCount: canonical.knownArtistNames.length,
    };
    expect(lineup.completeness).toBe('partial');
    expect(lineup.sectionTitle).toBe('BEKANNTE ARTISTS');
    expect(lineup.artistCount).toBe(1);
  });

  it('extracts Mallorca external location from Bootshaus-style titles', () => {
    const location = extractExternalLocationFromTitle(
      '122 pres. MAXI MERAKI @ Palma de Mallorca (ES)',
    );
    expect(location?.cityName).toBe('Palma de Mallorca');
    expect(location?.countryCode).toBe('ES');
  });

  it('skips Bootshaus venue defaults for external location titles', () => {
    const enriched = applySourceFieldDefaults(
      {
        title: '122 pres. MAXI MERAKI @ AMØK Club, Palma de Mallorca (ES)',
        cityName: '',
        venueName: '',
      },
      {
        cityName: 'Köln',
        venueName: 'Bootshaus',
        venueId: 'venue-bootshaus-koeln',
        organizerName: 'Bootshaus',
      },
    );

    expect(enriched.cityName).toBe('Palma de Mallorca');
    expect(enriched.venueName).toBe('AMØK Club');
    expect(enriched.sourceMetadata?.defaultVenueId).toBeUndefined();
    expect(enriched.sourceMetadata?.externalLocationFromTitle).toBe(true);
  });

  it('strips Bootshaus scraper venue for city-only external titles', () => {
    const enriched = applySourceFieldDefaults(
      {
        title: '122 pres. MAXI MERAKI @ Palma de Mallorca (ES)',
        cityName: 'Köln',
        venueName: 'Bootshaus',
      },
      {
        cityName: 'Köln',
        venueName: 'Bootshaus',
        venueId: 'venue-bootshaus-koeln',
        organizerName: 'Bootshaus',
      },
    );

    expect(enriched.cityName).toBe('Palma de Mallorca');
    expect(enriched.venueName).toBeUndefined();
    expect(enriched.sourceMetadata?.defaultVenueId).toBeUndefined();
  });

  it('keeps canonical artist names aligned between projection helpers', () => {
    const projection = projectCanonicalEventFields({
      title: 'FATALITY pres. DEXPHASE',
      description: '',
      venue: 'Club',
      city: 'Stuttgart',
      artists: ['DEXPHASE'],
      lineup: ['DEXPHASE'],
      source: 'source-ticket-io-protontheclub',
    });
    expect(projection.knownArtistNames).toEqual(['DEXPHASE']);
    expect(projection.lineupCompleteness).toBe('partial');
  });
});
