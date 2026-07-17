export function isValidHttpUrl(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function normalizeOptionalUrl(value: string | undefined | null): string | undefined {
  const normalized = value?.trim();

  if (!normalized || normalized.toLowerCase() === 'undefined') {
    return undefined;
  }

  if (!isValidHttpUrl(normalized)) {
    return undefined;
  }

  return normalized;
}
