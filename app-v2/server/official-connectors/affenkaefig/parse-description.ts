import * as cheerio from 'cheerio';
import { deduplicateDescriptionBlocks } from '../shared/deduplicate-description';

const LINEUP_NOT_ANNOUNCED_PATTERNS = [
  /line\s*-?\s*up.*bald/i,
  /lineup.*soon/i,
  /wird bald angekündigt/i,
  /coming soon/i,
  /line-?up\s+soon/i,
  /ticket\s+infos?\s+soon/i,
];

export function containsLineupNotAnnouncedSignal(text: string): boolean {
  return LINEUP_NOT_ANNOUNCED_PATTERNS.some((pattern) => pattern.test(text));
}

const CHECKOUT_CONTAMINATION_MARKERS = [
  /N8\s*Manager\s*Events\s*Ticketbörse/i,
  /Bestellerdaten\s+Deine\s+Angaben/i,
  /Bitte\s+wähle\s+mindestens\s+ein\s+Ticket/i,
  /Warenkorb\s+ansehen/i,
  /Sicher\s+bezahlen\s+über\s+Stripe/i,
  /Ticket\s*Flex\s*Option/i,
  /Newsletter\s+abonnieren\s+und\s+Event-Updates/i,
  /(?:Zwischensumme\s*0,00|Gesamt\s*0,00)\s*EUR/i,
];

export function containsEmbeddedCheckoutContamination(value: string): boolean {
  const markers = CHECKOUT_CONTAMINATION_MARKERS.filter(pattern => pattern.test(value)).length;
  return markers >= 2 || (value.length > 3500 && markers >= 1);
}

const EDITORIAL_END = /\+\+\s*(?:line\s*-?\s*up|location)\s*\+\+|(?:Bitte\s+prüfe\s+deine\s+Angaben|Tickets\s+auswählen|Weitere\s+Extras|Deine\s+Tickets|Bestellerdaten|Impressum\s*Affenkäfig|N8\s*Manager\s*Events)/i;

function normalizeDescriptionHtml(html: string): string {
  const $ = cheerio.load(html);
  // WordPress pages can inline/render the entire N8 checkout *inside* the
  // event content node; never treat ticket widgets as editorial copy.
  $('script,style,iframe,form,nav,footer,header,button,input,select,textarea,option').remove();
  $('[class*="ticket-snippet"],[class*="ticket-widget"],[class*="checkout"],[id*="checkout"],[class*="n8manager"]').remove();
  const cleanedHtml = $('body').html() ?? '';
  return cleanedHtml
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|section|article|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function cleanAffenkaefigDescription(html: string): string | undefined {
  const normalized = normalizeDescriptionHtml(html);
  if (!normalized) return undefined;

  if (containsEmbeddedCheckoutContamination(normalized)) {
    // The organizer page can carry a provider's entire *rendered* checkout
    // text inline. Recover only the short "Infos zur Veranstaltung" passage.
    const intro = /Infos\s+zur\s+Veranstaltung\s*/i.exec(normalized);
    if (!intro) return undefined;
    const afterIntro = normalized.slice(intro.index + intro[0].length);
    const cutoff = EDITORIAL_END.exec(afterIntro);
    const editorial = (cutoff ? afterIntro.slice(0,cutoff.index) : afterIntro).trim();
    if (!editorial || editorial.length > 1800 ||
        containsEmbeddedCheckoutContamination(editorial)) {
      return undefined;
    }
    return deduplicateDescriptionBlocks(editorial);
  }
  // Fail closed even for rare provider variants without the two known markers.
  if (normalized.length > 5000) return undefined;
  return deduplicateDescriptionBlocks(normalized);
}
