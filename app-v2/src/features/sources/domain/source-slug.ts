import { slugify } from '@/features/events/formatting/text';

export function buildSourceSlugBase(displayName: string): string {
  const base = slugify(displayName);
  return base || 'source';
}

export function resolveUniqueSourceSlug(
  baseSlug: string,
  existingSlugs: Iterable<string>,
  excludeSlug?: string,
): string {
  const taken = new Set([...existingSlugs].filter((slug) => slug !== excludeSlug));

  if (!taken.has(baseSlug)) {
    return baseSlug;
  }

  let suffix = 2;
  while (taken.has(`${baseSlug}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseSlug}-${suffix}`;
}

export function isValidSourceSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}
