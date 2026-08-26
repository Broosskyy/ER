export const AFFENKAEFIG_LIST_FRAGMENT = `
<a href="https://affenkaefig.info/event/underland-essigfabrik-05-09-2026/">Underland</a>
<a href="/event/14-jahreaffenkafig19-09-2026/">14 Jahre</a>
<a href="/event/underland-essigfabrik-05-09-2026/">Duplicate</a>
<a href="https://affenkaefig.info/tickets/">Not an event</a>
`;

export const AFFENKAEFIG_FULL_EVENT_FRAGMENT = `
<script type="application/ld+json" class="event-cards-manager-schema">{"@context":"https://schema.org","@type":"Event","name":"14 Jahre Affenkäfig 19.09.2026","startDate":"2026-09-19T00:00:00+02:00","eventStatus":"https://schema.org/EventScheduled","url":"https://affenkaefig.info/event/14-jahreaffenkafig19-09-2026/","description":"Seit über 14 Jahren trifft sich nun das Rudel.","image":["https://affenkaefig.info/wp-content/uploads/2026/06/19.09.26_QUADA_LineUP_AK_WEB.jpg"],"location":{"@type":"Place","name":"Essigfabrik / Elektroküche","address":{"@type":"PostalAddress","streetAddress":"Siegburger Str. 110, 50679 Köln","addressLocality":"Köln"}}}</script>
<h1 class="entry-title">14 Jahre Affenkäfig 19.09.2026</h1>
<div class="ecm-event-single__title">14 Jahre Affenkäfig 19.09.2026</div>
<div class="ecm-event-meta-item"><span class="ecm-event-meta-item__label">Datum</span><span class="ecm-event-meta-item__value">19.09.2026</span></div>
<div class="ecm-event-meta-item"><span class="ecm-event-meta-item__label">Location</span><span class="ecm-event-meta-item__value">Essigfabrik / Elektroküche · Köln</span></div>
<div class="ecm-event-meta-item"><span class="ecm-event-meta-item__label">Adresse</span><span class="ecm-event-meta-item__value">Siegburger Str. 110, 50679 Köln</span></div>
<div class="ecm-event-single__content"><p>Seit über 14 Jahren trifft sich nun das Rudel.</p><p>fängt die VA ganz normal um 22 Uhr an.</p></div>
<section class="ecm-event-lineup"><div class="ecm-event-lineup__grid">
<div class="ecm-event-lineup__item"><span class="ecm-event-lineup__name">IMHAPPY</span></div>
<div class="ecm-event-lineup__item"><span class="ecm-event-lineup__name">KOPF &amp; HÖRER</span></div>
</div></section>
<meta property="og:image" content="https://affenkaefig.info/wp-content/uploads/2026/06/19.09.26_QUADA_LineUP_AK_WEB.jpg" />
`;

export const AFFENKAEFIG_LINEUP_NOT_ANNOUNCED_FRAGMENT = `
<script type="application/ld+json" class="event-cards-manager-schema">{"@context":"https://schema.org","@type":"Event","name":"AFFENKÄFIG RULES // BOOTSHAUS KÖLN","startDate":"2026-10-23T00:00:00+02:00","url":"https://affenkaefig.info/event/affenkaefigrulesbootshaus-koeln-23-10-26/","description":"AFFENKÄFIG RULES!","location":{"@type":"Place","name":"Bootshaus","address":{"@type":"PostalAddress","streetAddress":"Auenweg 173, 51063 Köln","addressLocality":"Köln"}}}</script>
<h1 class="entry-title">AFFENKÄFIG RULES // BOOTSHAUS KÖLN</h1>
<div class="ecm-event-meta-item"><span class="ecm-event-meta-item__label">Datum</span><span class="ecm-event-meta-item__value">23.10.2026</span></div>
<div class="ecm-event-meta-item"><span class="ecm-event-meta-item__label">Location</span><span class="ecm-event-meta-item__value">Bootshaus · Köln</span></div>
<div class="ecm-event-single__content"><p>AFFENKÄFIG RULES! BOOTSHAUS – FULL HOUSE!</p><p>Das Line Up hauen wir euch bald um die Ohren.</p></div>
<section class="ecm-event-lineup"><div class="ecm-event-lineup__grid"></div></section>
`;

export const AFFENKAEFIG_MISSING_DESCRIPTION_FRAGMENT = `
<script type="application/ld+json" class="event-cards-manager-schema">{"@context":"https://schema.org","@type":"Event","name":"Affenkäfig XXX CAPITOL XXX Hagen","startDate":"2026-10-17T00:00:00+02:00","url":"https://affenkaefig.info/event/affenkaefig-xxx-capitol-xxx-hagen-17-10-2026/","description":"","location":{"@type":"Place","name":"Capitol","address":{"@type":"PostalAddress","streetAddress":"Dödterstraße 10, 58095 Hagen","addressLocality":"Hagen"}}}</script>
<h1 class="entry-title">Affenkäfig XXX CAPITOL XXX Hagen</h1>
<div class="ecm-event-meta-item"><span class="ecm-event-meta-item__label">Datum</span><span class="ecm-event-meta-item__value">17.10.2026</span></div>
<div class="ecm-event-meta-item"><span class="ecm-event-meta-item__label">Location</span><span class="ecm-event-meta-item__value">Capitol · Hagen</span></div>
<div class="ecm-event-single__content"></div>
`;

export const AFFENKAEFIG_MALFORMED_DATE_FRAGMENT = `
<script type="application/ld+json" class="event-cards-manager-schema">{"@context":"https://schema.org","@type":"Event","name":"Broken Date Event","startDate":"not-a-date","url":"https://affenkaefig.info/event/broken-date/"}</script>
<h1 class="entry-title">Broken Date Event</h1>
<div class="ecm-event-meta-item"><span class="ecm-event-meta-item__label">Datum</span><span class="ecm-event-meta-item__value">invalid</span></div>
<div class="ecm-event-meta-item"><span class="ecm-event-meta-item__label">Location</span><span class="ecm-event-meta-item__value">Bootshaus · Köln</span></div>
`;
