import type { RawImportedEvent } from '@/features/aggregation/connectors/types';

export const MANUAL_REFERENCE_EVENTS: RawImportedEvent[] = [
  {
    externalId: 'manual-ref-1',
    importId: 'manual-ref-1',
    title: 'Reference Night',
    subtitle: 'Manual fixture event',
    description: 'Curated reference event for import validation.',
    startDate: '2026-09-20T22:00:00.000Z',
    endDate: '2026-09-21T04:00:00.000Z',
    venueName: 'Gretchen',
    cityName: 'Berlin',
    countryCode: 'DE',
    genreNames: ['Techno'],
    artistNames: ['Reference DJ'],
    organizerName: 'Eternal Rave Reference',
    ticketUrl: 'https://tickets.example/reference-night',
    originalLink: 'https://example.com/events/reference-night',
    imageUrl: 'https://example.com/images/reference-night.jpg',
    rawSourceType: 'unknown',
    sourceMetadata: { fixture: 'manual_reference' },
  },
];

export const CLUB_WEBSITE_FIXTURE_HTML = `<!DOCTYPE html><html><head>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "MusicEvent",
  "name": "Club Night Berlin",
  "alternateName": "Warehouse Session",
  "startDate": "2026-10-05T22:00:00+02:00",
  "endDate": "2026-10-06T04:00:00+02:00",
  "description": "Techno night at the club",
  "url": "https://club.example/events/warehouse-session",
  "location": {
    "@type": "Place",
    "name": "Tresor",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Berlin",
      "addressCountry": "DE"
    }
  },
  "performer": { "@type": "Person", "name": "Club DJ" },
  "offers": { "@type": "Offer", "url": "https://tickets.example/club-night" }
}
</script></head><body></body></html>`;

export const ORGANIZER_WEBSITE_FIXTURE_HTML = `<!DOCTYPE html><html><head>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Event",
  "name": "Organizer Showcase",
  "startDate": "2026-11-12T20:00:00+01:00",
  "description": "Organizer curated showcase",
  "url": "https://organizer.example/showcase",
  "location": {
    "@type": "Place",
    "name": "Kantine am Berghain",
    "address": { "addressLocality": "Berlin", "addressCountry": "DE" }
  },
  "organizer": { "@type": "Organization", "name": "Night Collective" }
}
</script></head><body></body></html>`;

export const OPEN_DATA_API_FIXTURE = `{
  "events": [
    {
      "id": "open-data-1",
      "name": "Open Data Festival",
      "subtitle": "Public API fixture",
      "description": "Imported from open data API fixture",
      "starts_at": "2026-12-15T18:00:00Z",
      "ends_at": "2026-12-16T02:00:00Z",
      "city": "Hamburg",
      "venue": "Dockville",
      "url": "https://open-data.example/events/festival",
      "ticket_url": "https://tickets.example/open-data-festival",
      "organizer": "Dock Events",
      "genres": ["Electronic"]
    }
  ]
}`;

export const ICAL_EVENT_FIXTURE = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Eternal Rave//Reference//EN
BEGIN:VEVENT
UID:reference-ical-uid-1
SUMMARY:iCal Party
DESCRIPTION:All night long
DTSTART:20260720T200000Z
DTEND:20260721T040000Z
LOCATION:Club Köln
URL:https://example.com/ical-1
GEO:50.9375;6.9603
ORGANIZER:mailto:promoter@example.com
END:VEVENT
END:VCALENDAR`;
