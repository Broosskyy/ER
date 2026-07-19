export const JSON_LD_SINGLE_EVENT = `<!DOCTYPE html><html><head>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "MusicEvent",
  "name": "Techno Night",
  "startDate": "2026-08-15T22:00:00+02:00",
  "endDate": "2026-08-16T04:00:00+02:00",
  "description": "Underground techno",
  "url": "/events/techno-night",
  "location": {
    "@type": "Place",
    "name": "Warehouse",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "Main St 1",
      "addressLocality": "Köln",
      "addressCountry": "DE"
    },
    "geo": { "@type": "GeoCoordinates", "latitude": 50.9, "longitude": 6.9 }
  },
  "performer": { "@type": "Person", "name": "DJ Test" },
  "offers": { "@type": "Offer", "url": "https://tickets.example.com/techno" }
}
</script></head><body></body></html>`;

export const JSON_LD_GRAPH = `{
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Event", "name": "Graph Event", "startDate": "2026-09-01T20:00:00Z", "location": { "name": "Club", "address": "Berlin" } },
    { "@type": "WebSite", "name": "Ignored" }
  ]
}`;

export const RSS_FEED = `<?xml version="1.0"?>
<rss version="2.0"><channel>
<title>Events</title>
<item>
  <title>RSS Event</title>
  <description><![CDATA[<p>Great rave</p>]]></description>
  <link>https://example.com/events/rss-1</link>
  <guid>rss-1</guid>
  <pubDate>Sat, 20 Sep 2026 20:00:00 GMT</pubDate>
  <enclosure url="https://example.com/poster.jpg" type="image/jpeg"/>
</item>
</channel></rss>`;

export const ATOM_FEED = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
<title>Atom Events</title>
<entry>
  <title>Atom Event</title>
  <content>Atom description</content>
  <id>atom-1</id>
  <updated>2026-10-01T18:00:00Z</updated>
  <link href="https://example.com/events/atom-1"/>
</entry>
</feed>`;

export const ICAL_EVENT = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Eternal Rave//Test//EN
BEGIN:VEVENT
UID:test-uid-1
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

export const ICAL_ALL_DAY = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:allday-1
SUMMARY:Festival Day
DTSTART;VALUE=DATE:20260801
DTEND;VALUE=DATE:20260802
LOCATION:Open Air
END:VEVENT
END:VCALENDAR`;

export const CSV_CONTENT = `external_id,title,description,start_date,city_name
csv-1,CSV Rave,Description here,2026-11-01T21:00:00Z,Köln
csv-2,Missing Date,No date,,Berlin`;

export const API_JSON = `{
  "events": [
    { "id": "api-1", "name": "API Event", "starts_at": "2026-12-01T22:00:00Z", "city": "Hamburg" }
  ]
}`;
