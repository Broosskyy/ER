import * as cheerio from 'cheerio';

export interface TicketIoVisibleEventMetadata {
  title?: string;
  startsAt?: string;
  venueName?: string;
  cityName?: string;
  venueAddress?: string;
  countryName?: string;
  descriptionClean?: string;
}

function normalizeText(value: string): string {
  return value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function berlinLocalIso(dd: number, mm: number, year: number, hours: number, minutes: number): string | undefined {
  if (year < 2025 || year > 2037 || hours > 23 || minutes > 59 || mm < 1 || mm > 12) return undefined;
  const day = new Date(Date.UTC(year, mm - 1, dd));
  if (day.getUTCFullYear() !== year || day.getUTCMonth() !== mm - 1 ||
      day.getUTCDate() !== dd) return undefined;
  // At 02:00 on CET/CEST switching dates the local time is ambiguous/nonexistent.
  const lastSunday = (month: number): number => {
    const end = new Date(Date.UTC(year, month, 0));
    return end.getUTCDate() - end.getUTCDay();
  };
  if (hours === 2 && ((mm === 3 && dd === lastSunday(3)) ||
      (mm === 10 && dd === lastSunday(10)))) return undefined;
  const daylight = (mm > 3 && mm < 10) ||
    (mm === 3 && (dd > lastSunday(3) || (dd === lastSunday(3) && hours >= 3))) ||
    (mm === 10 && (dd < lastSunday(10) || (dd === lastSunday(10) && hours < 3)));
  const pad = (n: number): string => String(n).padStart(2, '0');
  return year + '-' + pad(mm) + '-' + pad(dd) + 'T' + pad(hours) + ':' +
    pad(minutes) + ':00' + (daylight ? '+02:00' : '+01:00');
}

function dateAndTime(dateText: string, timeText: string): string | undefined {
  const german = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(dateText);
  const english = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(dateText);
  const time = /^(\d{1,2}):(\d{2})$/.exec(timeText);
  if (!time || (!german && !english)) return undefined;
  const parts = german ?? english!;
  return berlinLocalIso(Number(parts[1]), Number(parts[2]), Number(parts[3]),
    Number(time[1]), Number(time[2]));
}

/**
 * Ticket.io often publishes its public event facts in labelled visible HTML
 * instead of JSON-LD MusicEvent. Parse ONLY the event's titled detail page.
 * If location, date, city or event-specific description is absent, the caller
 * must not create a guessed event. No "upcoming" fallback dates are allowed.
 */
export function parseTicketIoVisibleEventMetadata(html: string): TicketIoVisibleEventMetadata {
  const $ = cheerio.load(html);
  $('script,style,noscript,nav,footer').remove();
  const fullText = normalizeText($('body').text());
  // Ticket.io sometimes renders a JavaScript warning above the event h2.
  // Headline order alone is unreliable. Prefer an explicit event heading near
  // the dated Location/Date/Time summary, not a shop/page-global title.
  const candidates = $('h1,h2,h3,[itemprop="name"]')
    .toArray().map(node=>normalizeText($(node).text()))
    .filter(value=>value.length>=5 && value.length<=190 &&
      !/^(?:tickets?|infos?|ticketshop|javascript|shopping cart|warenkorb)$/i.test(value) &&
      !/ticketshop benötigt javascript|(?:tickets?\s+(?:für|for))\b/i.test(value));
  const metaTitle = normalizeText(
    $('meta[property="og:title"]').attr('content') || '',
  ).replace(/^Tickets?\s+(?:für|for)\s+/i,'')
    .replace(/\s*[|–-]\s*(?:Karten|Tickets?)\s+(?:und Infos|and info).*$/i,'');
  const eventTitle = candidates.find(name=>name === metaTitle)
    ?? candidates.find(name=>!/(?:Ausverkauft|Sold out|Informationen zum Event|Buy tickets)/i.test(name))
    ?? (metaTitle.length>=5 && metaTitle.length<=190 ? metaTitle : '');
  if (!eventTitle || !/^[^<>]{5,190}$/.test(eventTitle)) return {};

  const labelPattern = /(?:Adresse\s*\/\s*Location|Address\s*\/\s*Location)\s*:?\s*(.{3,200}?)\s*(?:calendar_month\s*)?(?:Datum|Date)\s+(?:(?:Mo|Di|Mi|Do|Fr|Sa|So|Mon|Tue|Wed|Thu|Fri|Sat|Sun)\.?\s*)?(\d{1,2}[./]\d{1,2}[./]\d{4})\s*(?:schedule\s*)?(?:Uhrzeit|Time)\s*:?\s*(\d{1,2}:\d{2})/i;
  const summary = labelPattern.exec(fullText);
  if (!summary) return { title: eventTitle };
  const venueCity = normalizeText(summary[1] ?? '');
  const cut = venueCity.lastIndexOf(',');
  if (cut < 1) return { title: eventTitle };
  const venueName = venueCity.slice(0,cut).trim();
  const cityName = venueCity.slice(cut+1).trim();
  if (venueName.length < 2 || cityName.length < 2 || cityName.length > 65 ||
      /(?:Deutschland|Germany|Datum|Date)/i.test(cityName)) return { title:eventTitle };

  const startsAt = dateAndTime(summary[2] ?? '',summary[3] ?? '');
  const fullAddressMatch = [...fullText.matchAll(/(?:Adresse\s*\/\s*Location|Address\s*\/\s*Location)\s*:\s*(.{3,240}?)\s*(?:calendar_month\s*)?(?:Datum|Date)\s+/gi)]
    .map(hit=>normalizeText(hit[1] ?? ''))
    .find(location=> /\b(?:Deutschland|Germany)\b/i.test(location) &&
      location.includes(cityName));
  const countryName = fullAddressMatch && /\b(?:Deutschland|Germany)\b/i.test(fullAddressMatch)
    ? 'DE' : undefined;

  const selectors = [
    '[itemprop="description"]', '#eventdescription', '#eventDescription',
    '.eventdescription', '.event-description', '.event-description-content',
    '[class*="eventDescription"]', '[class*="event-description"]',
  ];
  let description = '';
  for (const selector of selectors) {
    const value = normalizeText($(selector).first().text());
    if (value.length >= 40 && value.length <= 10000) {
      description = value;
      break;
    }
  }
  if (!description) {
    // The event-specific summary is the reliable boundary even when the
    // headline occurs twice (h1 and h2). Capture only content between that
    // summary and the *first* ticket table, never cart/insurance/footer copy.
    const afterSummary = fullText.slice(summary.index + summary[0].length);
    const ticketTable = /\bTickets?\s*(?:Einzelpreis|Single\s+price|Preis\s*Anzahl|Price\s*Quantity)\b/i.exec(afterSummary);
    if (ticketTable && ticketTable.index <= 8000) {
      const extracted = normalizeText(afterSummary.slice(0,ticketTable.index));
      if (extracted.length >= 40 && extracted.length <= 8000 &&
          !/^(?:ticketshop|cookies?|datenschutz|impressum)/i.test(extracted)) {
        description = extracted;
      }
    }
  }

  return {
    title:eventTitle, startsAt,
    venueName,cityName,
    venueAddress:fullAddressMatch,
    countryName,
    descriptionClean:description || undefined,
  };
}
