export function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function normalizeOptionalString(value: string | undefined | null): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const normalized = normalizeWhitespace(value);

  if (!normalized || normalized.toLowerCase() === 'undefined' || normalized.toLowerCase() === 'null') {
    return undefined;
  }

  return normalized;
}

export function normalizeRequiredString(value: string | undefined | null): string {
  return normalizeWhitespace(value ?? '');
}

export function normalizeStringArray(values: string[] | undefined | null): string[] {
  if (!values || !Array.isArray(values)) {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of values) {
    const normalized = normalizeOptionalString(item);

    if (!normalized) {
      continue;
    }

    const key = normalized.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(normalized);
  }

  return result;
}

export function normalizeTitle(value: string): string {
  return normalizeRequiredString(value);
}

export function normalizeCity(value: string): string {
  return normalizeRequiredString(value);
}

export function normalizeVenue(value: string): string {
  return normalizeRequiredString(value);
}

export function slugify(value: string): string {
  return normalizeRequiredString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function normalizeDedupeKeyPart(value: string): string {
  return normalizeRequiredString(value).toLowerCase();
}
