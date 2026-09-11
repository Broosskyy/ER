import { parseBootshausDetailPage } from '../bootshaus/parse-detail';
import { safeFetchHtml } from '../safe-fetch';
import { createEmptyConnectorCounters } from '../types';
import { normalizedGenresToExplicitLabels, normalizeOfficialGenreLabels } from './normalize-genre';
import { parseDescriptionExplicitGenres } from './parse-description-genres';

export async function recoverBootshausGenresFromOfficialUrl(
  officialUrl: string,
): Promise<string[]> {
  if (!/bootshaus\.tv\/events\//i.test(officialUrl)) {
    return [];
  }
  const counters = createEmptyConnectorCounters();
  const fetched = await safeFetchHtml(officialUrl, { counters, allowDetailOnly: true });
  const evidence = parseBootshausDetailPage(
    fetched.html,
    fetched.finalUrl,
    new Date().toISOString(),
    counters,
  );
  const labels = new Set<string>([
    ...evidence.explicitGenreLabels,
    ...parseDescriptionExplicitGenres(evidence.descriptionClean ?? evidence.descriptionRaw),
  ]);
  return normalizedGenresToExplicitLabels(normalizeOfficialGenreLabels([...labels]).normalized);
}
