export const WEBSITE_JSON_LD_GRAPH_FIXTURE = `<!DOCTYPE html><html><head>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", "name": "Events Portal" },
    {
      "@type": "MusicEvent",
      "name": "Graph Event One",
      "startDate": "2026-10-01T20:00:00+02:00",
      "url": "https://events.example/graph-1"
    },
    {
      "@type": "Festival",
      "name": "Graph Festival",
      "startDate": "2026-10-02T18:00:00+02:00",
      "location": { "@type": "Place", "name": "Open Air" }
    }
  ]
}
</script></head><body></body></html>`;

export const WEBSITE_EMBEDDED_JSON_FIXTURE = `<!DOCTYPE html><html><head>
<script id="__NEXT_DATA__" type="application/json">
{
  "props": {
    "pageProps": {
      "events": [
        { "id": "next-1", "title": "Next Event", "starts_at": "2026-11-01T21:00:00.000Z" }
      ]
    }
  }
}
</script></head><body></body></html>`;

export const WEBSITE_HTML_SELECTOR_FIXTURE = `<!DOCTYPE html><html><body>
<div class="event">
  <h2 class="title">Selector Night</h2>
  <span class="date">2026-12-01</span>
  <span class="venue">Warehouse</span>
  <a class="ticket" href="/tickets/selector-night">Tickets</a>
  <a class="detail" href="/events/selector-night">Details</a>
</div>
<div class="event">
  <h2 class="title">Second Night</h2>
  <span class="date">2026-12-02</span>
  <span class="venue">Club</span>
</div>
<a rel="next" href="/events?page=2">Next</a>
</body></html>`;

export const WEBSITE_EVENT_LIST_FIXTURE = `<!DOCTYPE html><html><body>
<ul class="events-list">
  <li><a href="/events/detail-1">Detail Event 1</a></li>
  <li><a href="/events/detail-2">Detail Event 2</a></li>
</ul>
</body></html>`;

export const WEBSITE_DETAIL_PAGE_FIXTURE = `<!DOCTYPE html><html><body>
<h1>Detail Event 1</h1>
<p>Full description for detail event.</p>
</body></html>`;

export const WEBSITE_PAGINATION_FIXTURE_PAGE_1 = `<!DOCTYPE html><html><body>
<div class="event"><h2 class="title">Page One Event</h2><span class="date">2026-12-10</span></div>
<a rel="next" href="/events?page=2">Next</a>
</body></html>`;

export const WEBSITE_PAGINATION_FIXTURE_PAGE_2 = `<!DOCTYPE html><html><body>
<div class="event"><h2 class="title">Page Two Event</h2><span class="date">2026-12-11</span></div>
</body></html>`;

export const WEBSITE_JS_RENDERED_FIXTURE = `<!DOCTYPE html><html><body>
<div id="root"></div>
<p>Please enable JavaScript to view events.</p>
</body></html>`;
