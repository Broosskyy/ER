export const ZAKK_PARTY_LIST_FRAGMENT = `
<ul class="ticket-list cf programm">
  <li class="single-ticket cf monthly-list"><h3 id="September 2026">September 2026</h3></li>
  <li class="single-ticket cf" data-value="11.09.2026">
    <div class="ticket-date">
      <span class="day">Fr.</span><span class="date">11.<small>9.</small></span>
      <a href="/event-detail?event=16192&event-ics-cmd=1" class="link-unstyled"></a>
    </div>
    <div class="ticket-content">
      <div class="ticket-info">
        <h2><a href="/event-detail?event=16192">Wir können auch anders: 50+ Party</a></h2>
        <h3>am 2. Freitag</h3>
        <p>Die garantiert jugendfreie Party mit DJ Ingwart.</p>
      </div>
      <div class="event-overview">
        <div class="box">
          <p class="event-categorie">Party</p>
          <p class="event-time">20 Uhr<br>Einlass 19 Uhr<br>Halle</p>
        </div>
      </div>
    </div>
  </li>
  <li class="single-ticket cf" data-value="11.09.2026">
    <div class="ticket-date">
      <a href="/event-detail?event=16193"></a>
    </div>
    <div class="ticket-content">
      <div class="ticket-info">
        <h2><a href="/event-detail?event=16193">Der Rockclub</a></h2>
        <h3>jeden 2. Freitag</h3>
        <p>Finest Alternative Rock mit DJ MajorTom im zakk Club.</p>
      </div>
      <div class="event-overview">
        <div class="box">
          <p class="event-categorie">Party</p>
          <p class="event-time">22 Uhr<br>Club</p>
        </div>
      </div>
    </div>
  </li>
  <li class="single-ticket cf" data-value="11.09.2026">
    <div class="ticket-date">
      <a href="/event-detail?event=16192"></a>
    </div>
    <div class="ticket-content">
      <div class="ticket-info">
        <h2><a href="/event-detail?event=16192">Wir können auch anders: 50+ Party</a></h2>
      </div>
    </div>
  </li>
</ul>
`;

export const ZAKK_NIGHTCLUB_DETAIL_FRAGMENT = `
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Event",
  "location": {
    "@type": "Place",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "Fichtenstr. 40",
      "addressLocality": "Düsseldorf",
      "postalCode": "40233",
      "addressCountry": "DE"
    },
    "name": "zakk – Zentrum für Aktion, Kultur und Kommunikation"
  },
  "name": "Nightclub",
  "startDate": "2026-08-28CEST22:00:00+02:00",
  "description": "Neu im zakk - House und Club Classics mit DJ Chewie.",
  "image": ["https://zakk.de//images/quadrat/16107.jpg"]
}
</script>
<section id="site-content">
  <article class="event-block cf" id="event-detail">
    <div id="event-header" class="has-image">
      <div class="event-image-box"><img src="https://zakk.de//images/quadrat/16107.jpg" class="event-list-image"></div>
      <div class="event-content-info">
        <h2>Nightclub</h2>
        <div class="event-info">
          <h3>Neu im zakk</h3>
          <h4>Das Beste aus Pop, Rock, Hip-Hop, Eurodance, House bis hin zu Club Classics mit DJ Chewie.</h4>
        </div>
      </div>
    </div>
    <div class="event-overview">
      <div class="box">
        <p class="event-categorie">Party</p>
        <p class="event-date">Fr. 28.08.2026</p>
        <p class="event-time">22 Uhr<br>Club</p>
      </div>
    </div>
    <div class="event-additional">
      <div class="box"><p>Der Nightclub lädt euch ein zu einem Streifzug durch die Jahrzehnte der Hits.</p></div>
    </div>
  </article>
</section>
`;

export const ZAKK_MALFORMED_DATE_FRAGMENT = `
<section id="site-content">
  <article class="event-block cf" id="event-detail">
    <div id="event-header">
      <h2>Broken Date Party</h2>
    </div>
    <div class="event-overview">
      <p class="event-date">not-a-date</p>
      <p class="event-time">22 Uhr<br>Club</p>
    </div>
  </article>
</section>
`;
