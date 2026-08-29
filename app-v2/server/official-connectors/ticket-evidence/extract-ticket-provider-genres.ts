import * as cheerio from 'cheerio';

import { parseDescriptionExplicitGenres } from '../shared/parse-description-genres';
import {
  normalizedGenresToExplicitLabels,
  normalizeOfficialGenreLabels,
} from '../shared/normalize-genre';

const NON_MUSIC_CATEGORY_PATTERN =
  /^(?:club\s*event|festival|konzert|concert|party|live\s*event|event|veranstaltung|open\s*air|indoor|outdoor|rave|nightlife)$/i;

const DESCRIPTION_GENRE_FOR_PATTERN =
  /\b(?:für|for|with|mit)\s+([^.!?\n]{3,120})/gi;

function extractJsonLdGenreLabels(body: string): string[] {
  const labels: string[] = [];
  const pattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(body)) !== null) {
    try {
      const parsed = JSON.parse(match[1] ?? '') as Record<string, unknown> | Array<Record<string, unknown>>;
      const events = Array.isArray(parsed) ? parsed : [parsed];
      for (const event of events) {
        const genre = event?.genre;
        if (typeof genre === 'string') {
          labels.push(genre);
        } else if (Array.isArray(genre)) {
          for (const entry of genre) {
            if (typeof entry === 'string') {
              labels.push(entry);
            } else if (entry && typeof entry === 'object' && 'name' in entry) {
              labels.push(String((entry as { name?: string }).name ?? ''));
            }
          }
        }
      }
    } catch {
      // ignore malformed JSON-LD
    }
  }
  return labels;
}

function extractDomCategoryLabels(body: string): string[] {
  const $ = cheerio.load(body);
  const selectors = [
    '.espbp-single-event-category a',
    '.tribe-events-event-categories a',
    '.tribe-events-single-event-categories a',
    '.event-category a',
    '.product_meta .posted_in a',
    '[rel="tag"]',
  ];
  const labels: string[] = [];
  for (const selector of selectors) {
    $(selector).each((_index, element) => {
      const text = $(element).text().replace(/\s+/g, ' ').trim();
      if (text) {
        labels.push(text);
      }
    });
  }
  return labels;
}

function isNonMusicEventCategory(label: string): boolean {
  return NON_MUSIC_CATEGORY_PATTERN.test(label.trim());
}

function splitGenrePhraseList(phrase: string): string[] {
  return phrase
    .replace(/\s+in all its forms\.?$/i, '')
    .split(/\s*,\s*|\s+und\s+|\s+and\s+|\s*\/\s*/i)
    .map((part) => part.replace(/[.!]+$/, '').trim())
    .filter((part) => part.length >= 3 && part.length <= 40);
}

function extractDescriptionGenrePhraseLabels(description?: string): string[] {
  if (!description) {
    return [];
  }

  const labels = new Set<string>(parseDescriptionExplicitGenres(description));
  let match: RegExpExecArray | null;
  const pattern = new RegExp(DESCRIPTION_GENRE_FOR_PATTERN.source, DESCRIPTION_GENRE_FOR_PATTERN.flags);
  while ((match = pattern.exec(description)) !== null) {
    const phrase = match[1]?.trim();
    if (!phrase) {
      continue;
    }
    for (const part of splitGenrePhraseList(phrase)) {
      labels.add(part);
    }
  }
  return [...labels];
}

function normalizeStructuredGenreLabels(rawLabels: string[]): string[] {
  const filtered = rawLabels
    .map((label) => label.trim())
    .filter((label) => label.length > 0 && !isNonMusicEventCategory(label));
  const { normalized } = normalizeOfficialGenreLabels(filtered);
  return normalizedGenresToExplicitLabels(normalized);
}

export function extractTicketProviderGenreLabels(input: {
  body?: string;
  description?: string;
  structuredLabels?: string[];
}): string[] {
  const rawLabels = [
    ...(input.structuredLabels ?? []),
    ...(input.body ? extractJsonLdGenreLabels(input.body) : []),
    ...(input.body ? extractDomCategoryLabels(input.body) : []),
    ...extractDescriptionGenrePhraseLabels(input.description),
  ];
  return normalizeStructuredGenreLabels(rawLabels);
}
