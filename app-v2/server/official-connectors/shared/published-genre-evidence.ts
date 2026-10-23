import { normalizeOfficialGenreLabels } from './normalize-genre';

/**
 * Only explicit genre words found on the event's own source page qualify.
 * No event title, city, club identity, DJ name or marketing word ("rave",
 * "club", "DJ") may silently stand in for published genre information.
 */
const GENRE_SIGNALS: ReadonlyArray<{ label: string; expression: RegExp; family?: string }> = [
  { label: 'Hard Techno', expression: /\bhard[ -]?techno\b/i, family: 'techno' },
  { label: 'Industrial Techno', expression: /\bindustrial[ -]?techno\b/i, family: 'techno' },
  { label: 'Melodic Techno', expression: /\bmelodic[ -]?techno\b/i, family: 'techno' },
  { label: 'Acid Techno', expression: /\bacid[ -]?techno\b/i, family: 'techno' },
  { label: 'Tech House', expression: /\btech[ -]?house\b/i, family: 'house' },
  { label: 'Hard House', expression: /\bhard[ -]?house\b/i, family: 'house' },
  { label: 'Deep House', expression: /\bdeep[ -]?house\b/i, family: 'house' },
  { label: 'Psytrance', expression: /\bpsy[ -]?trance\b/i, family: 'trance' },
  { label: 'Hard Trance', expression: /\bhard[ -]?trance\b/i, family: 'trance' },
  { label: 'Drum & Bass', expression: /\b(?:drum\s*(?:and|&)\s*bass|dnb)\b/i },
  { label: 'Hardstyle', expression: /\bhardstyle\b/i },
  { label: 'Gabber', expression: /\bgabber\b/i },
  { label: 'Schranz', expression: /\bschranz\b/i },
  { label: 'Hardcore', expression: /\b(?:early[ -]?hardcore|hardcore)\b/i },
  { label: 'Breakbeat', expression: /\bbreakbeat\b/i },
  { label: 'UK Garage', expression: /\b(?:uk[ -]?garage|ukg)\b/i },
  { label: 'Goa', expression: /\bgoa\b/i },
  { label: 'Techno', expression: /\btechno\b/i, family: 'techno' },
  { label: 'House', expression: /\bhouse\b/i, family: 'house' },
  { label: 'Trance', expression: /\btrance\b/i, family: 'trance' },
];
export function extractExplicitGenresFromPublishedText(sourceText: string): string[] {
  const genres: string[] = [];
  for (const signal of GENRE_SIGNALS) {
    const found = signal.expression.exec(sourceText);
    if (!found) continue;
    // Do not claim a genre specifically negated on the official page.
    const context = sourceText.slice(Math.max(0, found.index - 18), found.index);
    if (/(?:\bkein(?:e|en|er)?|\bohne|\bnot|\bno)\s*$/i.test(context)) continue;
    // A generic term contained only inside "Hard Techno", "Deep House",
    // etc. must not create a second genre. But if "House & Hardhouse"
    // explicitly names both floors, retain both.
    if (['Techno','House','Trance'].includes(signal.label)) {
      const matches = [...sourceText.matchAll(
        new RegExp(signal.expression.source, 'gi'),
      )];
      if (matches.every(match => {
        const contextBefore = sourceText.slice(
          Math.max(0, (match.index ?? 0) - 18), match.index ?? 0,
        );
        return /(?:hard|industrial|melodic|acid|tech|deep|psy)\\s*[- ]?$/i.test(contextBefore);
      })) continue;
    }
    const normalized = normalizeOfficialGenreLabels([signal.label]).normalized[0];
    if (normalized) {
      if (!genres.includes(normalized.displayName)) genres.push(normalized.displayName);
    }
  }
  return genres;
}
