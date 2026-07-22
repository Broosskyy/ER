import { slugify } from '@/features/events/formatting/text';

export function buildOrganizerSlugBase(name: string): string {
  const base = slugify(name);
  return base || 'organizer';
}

export function resolveUniqueOrganizerSlug(
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

export function isValidOrganizerSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}
