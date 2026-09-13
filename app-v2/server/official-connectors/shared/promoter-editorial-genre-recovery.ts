import { fetchAffenkaefigDetailHtml } from '../affenkaefig/fetch-detail-html';
import { parseAffenkaefigDetailPage } from '../affenkaefig/parse-detail';
import { safeFetchHtml } from '../safe-fetch';
import { createEmptyConnectorCounters } from '../types';
import { normalizedGenresToExplicitLabels, normalizeOfficialGenreLabels } from './normalize-genre';
import { parseDescriptionExplicitGenres } from './parse-description-genres';

function extractMetaGenreLabels(html: string): string[] {
  const labels = new Set<string>();
  const metaPatterns = [
    /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/gi,
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/gi,
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/gi,
  ];
  for (const pattern of metaPatterns) {
    for (const match of html.matchAll(pattern)) {
      for (const genre of parseDescriptionExplicitGenres(match[1])) {
        labels.add(genre);
      }
    }
  }
  return [...labels];
}

export async function recoverPromoterEditorialGenresFromOfficialUrl(
  officialUrl: string,
): Promise<{ genres: string[]; sourceReference: string; classificationReason: string }> {
  const counters = createEmptyConnectorCounters();
  if (/affenkaefig\.info\/event\//i.test(officialUrl)) {
    const fetched = await fetchAffenkaefigDetailHtml(officialUrl, { counters, allowDetailOnly: true });
    const detail = parseAffenkaefigDetailPage(fetched.html, fetched.finalUrl, new Date().toISOString(), counters);
    const labels = new Set<string>([
      ...extractMetaGenreLabels(fetched.html),
      ...parseDescriptionExplicitGenres(detail.descriptionClean ?? detail.descriptionRaw),
    ]);
    const normalized = normalizedGenresToExplicitLabels(
      normalizeOfficialGenreLabels([...labels]).normalized,
    );
    return {
      genres: normalized,
      sourceReference: fetched.finalUrl,
      classificationReason: 'affenkaefig_promoter_editorial_genre',
    };
  }

  if (/bootshaus\.tv\/events\//i.test(officialUrl)) {
    const fetched = await safeFetchHtml(officialUrl, { counters, allowDetailOnly: true });
    const labels = new Set<string>([
      ...extractMetaGenreLabels(fetched.html),
      ...parseDescriptionExplicitGenres(fetched.html),
    ]);
    const normalized = normalizedGenresToExplicitLabels(
      normalizeOfficialGenreLabels([...labels]).normalized,
    );
    return {
      genres: normalized,
      sourceReference: fetched.finalUrl,
      classificationReason: 'bootshaus_promoter_editorial_genre',
    };
  }

  return { genres: [], sourceReference: officialUrl, classificationReason: 'unsupported_promoter_url' };
}
