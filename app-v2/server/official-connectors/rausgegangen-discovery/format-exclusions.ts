/**
 * An electronic keyword is not sufficient if the event's advertised
 * purpose is education or a swap market. Be specific: legitimate club
 * nights must not be rejected merely for mentioning a bus or DJ workshop.
 */
export function isNonPerformanceEventFormat(title: string, description: string): boolean {
  const t=title.trim();
  const d=description.trim();
  const learning=/(?:musikproduktion|music[ -]?production|dj[ -]?workshop|produktionsworkshop|beatmaking[ -]?kurs)/i.test(t);
  const learningContext=/(?:komponier|workshop|kurs|unterricht|lernt|lerne|software|synthesizer|empfohlen von \d+[-–]\d+ jahren)/i.test(d);
  if(learning && learningContext) return true;
  const swap=/(?:techno\s*(?:&|und)\s*tauschen|kleidertausch|tauschb[oö]rse|flohmarkt|secondhand[ -]?markt)/i.test(t);
  const marketContext=/(?:secondhand|kleider|tausch|flohmarkt|marktstand|vintage)/i.test(d);
  return swap && marketContext;
}
