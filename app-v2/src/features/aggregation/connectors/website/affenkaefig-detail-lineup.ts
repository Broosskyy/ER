import { decodeHtmlEntities, stripHtml } from '@/features/import/normalization/text-normalizer';
import { sanitizeLineupArtistNames } from '@/features/events/domain/lineup-artist-quality';

const AFFENKAEFIG_LINEUP_NAME_PATTERN =
  /class=["']ecm-event-lineup__name["'][^>]*>([^<]+)</gi;

/** Parses Affenkäfig event detail grid lineup (`ecm-event-lineup__name` spans). */
export function parseAffenkaefigLineupFromHtml(html: string): string[] | undefined {
  const names: string[] = [];
  let match: RegExpExecArray | null;
  const pattern = new RegExp(AFFENKAEFIG_LINEUP_NAME_PATTERN.source, 'gi');
  while ((match = pattern.exec(html)) !== null) {
    const raw = stripHtml(decodeHtmlEntities(match[1] ?? '')).trim();
    if (raw) {
      names.push(raw);
    }
  }
  return sanitizeLineupArtistNames(names);
}
