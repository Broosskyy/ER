import { slugify } from '@/features/events/formatting/text';

export function buildArtistSlugBase(name: string): string {
  const base = slugify(name);
  return base || 'artist';
}

export function resolveUniqueArtistSlug(
  baseSlug: string,
  existingSlugs: Iterable<string>,
  excludeSlug?: string,
): string {
  const taken = new Set(
    [...existingSlugs].filter((slug) => slug !== excludeSlug),
  );

  if (!taken.has(baseSlug)) {
    return baseSlug;
  }

  let suffix = 2;
  while (taken.has(`${baseSlug}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseSlug}-${suffix}`;
}

export function isValidArtistSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}
