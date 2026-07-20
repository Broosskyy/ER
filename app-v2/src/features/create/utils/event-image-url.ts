const LOCAL_IMAGE_URI_PATTERN = /^(file:|content:|blob:)/i;

/** True for device-local URIs that must never be written to the database. */
export function isLocalImageUri(uri: string): boolean {
  return LOCAL_IMAGE_URI_PATTERN.test(uri.trim());
}

/** True only for remote http(s) URLs suitable for persistence (e.g. Supabase Storage). */
export function isPersistableImageUrl(url: string | undefined | null): url is string {
  if (!url?.trim()) {
    return false;
  }

  const trimmed = url.trim();
  if (isLocalImageUri(trimmed)) {
    return false;
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

/** Alias for list/card display — persisted storage URLs only. */
export const isPersistedEventImageUrl = isPersistableImageUrl;

export function resolvePersistableImageUrl(
  image: { remoteUrl?: string; localUri?: string } | null | undefined,
): string | undefined {
  if (isPersistableImageUrl(image?.remoteUrl)) {
    return image.remoteUrl;
  }

  return undefined;
}
