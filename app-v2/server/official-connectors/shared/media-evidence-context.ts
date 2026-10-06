export interface MediaEvidenceContext {
  venueNames: string[];
  organizerNames: string[];
  cityNames: string[];
  sourceHosts: string[];
  additionalNoiseTerms?: string[];
}

export function createEmptyMediaEvidenceContext(): MediaEvidenceContext {
  return {
    venueNames: [],
    organizerNames: [],
    cityNames: [],
    sourceHosts: [],
    additionalNoiseTerms: [],
  };
}

function normalizeContextTerm(term: string): string {
  return term
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[øØ]/g, 'o')
    .replace(/[äÄ]/g, 'a')
    .replace(/[öÖ]/g, 'o')
    .replace(/[üÜ]/g, 'u')
    .replace(/æ/g, 'ae')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function tokenizeContextValue(value: string): string[] {
  const normalized = normalizeContextTerm(value);
  if (!normalized) {
    return [];
  }
  return normalized
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

function isOneEditAway(left: string, right: string): boolean {
  if (left === right) {
    return true;
  }
  if (Math.abs(left.length - right.length) > 1) {
    return false;
  }
  if (left.length < 4 || right.length < 4) {
    return false;
  }

  let mismatches = 0;
  let leftIndex = 0;
  let rightIndex = 0;
  while (leftIndex < left.length && rightIndex < right.length) {
    if (left[leftIndex] === right[rightIndex]) {
      leftIndex += 1;
      rightIndex += 1;
      continue;
    }
    mismatches += 1;
    if (mismatches > 1) {
      return false;
    }
    if (left.length > right.length) {
      leftIndex += 1;
    } else if (right.length > left.length) {
      rightIndex += 1;
    } else {
      leftIndex += 1;
      rightIndex += 1;
    }
  }
  return mismatches + (left.length - leftIndex) + (right.length - rightIndex) <= 1;
}

export function buildContextNoiseTerms(context: MediaEvidenceContext): Set<string> {
  const terms = new Set<string>();
  const addValue = (value: string): void => {
    const normalized = normalizeContextTerm(value);
    if (normalized) {
      terms.add(normalized);
    }
    for (const token of tokenizeContextValue(value)) {
      terms.add(token);
    }
  };

  for (const value of [
    ...context.venueNames,
    ...context.organizerNames,
    ...context.cityNames,
    ...context.sourceHosts,
    ...(context.additionalNoiseTerms ?? []),
  ]) {
    addValue(value);
  }

  return terms;
}

export function isContextNoiseTerm(text: string, context: MediaEvidenceContext): boolean {
  const normalized = normalizeContextTerm(text);
  if (!normalized) {
    return false;
  }

  const terms = buildContextNoiseTerms(context);
  if (terms.has(normalized)) {
    return true;
  }

  for (const term of terms) {
    if (term.length >= 4 && normalized.includes(term)) {
      return true;
    }
    if (normalized.length >= 3 && term.includes(normalized)) {
      return true;
    }
    if (isOneEditAway(normalized, term)) {
      return true;
    }
  }

  const tokens = tokenizeContextValue(text);
  if (tokens.length === 1) {
    const token = tokens[0]!;
    for (const term of terms) {
      if (token === term || isOneEditAway(token, term)) {
        return true;
      }
    }
  }

  return false;
}

function expandCityAliases(city: string): string[] {
  const normalized = normalizeContextTerm(city);
  const aliases = new Set<string>([city]);
  if (normalized === 'koln' || normalized === 'koeln') {
    aliases.add('Köln');
    aliases.add('Cologne');
    aliases.add('KOELN');
  }
  if (normalized === 'cologne') {
    aliases.add('Köln');
    aliases.add('Koeln');
  }
  return [...aliases];
}

export function buildMediaEvidenceContextFromEvidence(input: {
  venueName?: string;
  organizerLabel?: string;
  city?: string;
  officialUrl?: string;
  officialImageUrl?: string;
  additionalNoiseTerms?: string[];
}): MediaEvidenceContext {
  const sourceHosts: string[] = [];
  for (const url of [input.officialUrl, input.officialImageUrl]) {
    if (!url) {
      continue;
    }
    try {
      sourceHosts.push(new URL(url).hostname.toLowerCase());
    } catch {
      // ignore invalid URLs
    }
  }

  const cityNames = input.city ? expandCityAliases(input.city) : [];
  if (input.venueName?.includes(',')) {
    const trailingCity = input.venueName.split(',').slice(1).join(',').trim();
    if (trailingCity) {
      cityNames.push(trailingCity);
    }
  }

  return {
    venueNames: input.venueName ? [input.venueName] : [],
    organizerNames: input.organizerLabel ? [input.organizerLabel] : [],
    cityNames,
    sourceHosts,
    additionalNoiseTerms: input.additionalNoiseTerms ?? [],
  };
}
