const HTTP_URL_PATTERN = /^https?:\/\//i;

export function isSafeExternalHttpUrl(url: string): boolean {
  const normalized = url.trim();

  if (!HTTP_URL_PATTERN.test(normalized)) {
    return false;
  }

  try {
    const parsed = new URL(normalized);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
