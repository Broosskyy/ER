import type { OrganizerRecord } from '@/data/types/records';
import { normalizeOrganizerNameForComparison } from '@/features/organizers/domain/organizer-validation';

export type OrganizerDuplicateStrength = 'strong' | 'moderate' | 'weak';

export interface OrganizerDuplicateCandidate {
  organizer: OrganizerRecord;
  strength: OrganizerDuplicateStrength;
  reason:
    | 'same_name_and_website'
    | 'same_email'
    | 'same_social'
    | 'same_name_city_country'
    | 'same_name_only'
    | 'same_city_only';
}

function normalizeWebsiteHost(value: string | undefined): string | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  try {
    const url = new URL(value.includes('://') ? value : `https://${value}`);
    return url.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return value.trim().toLowerCase();
  }
}

function normalizeSocialKey(value: string | undefined): string | undefined {
  const normalized = value?.trim().toLowerCase();
  return normalized || undefined;
}

export function findOrganizerDuplicateCandidates(
  input: {
    name: string;
    website?: string;
    email?: string;
    instagram?: string;
    facebook?: string;
    soundcloud?: string;
    residentAdvisor?: string;
    city?: string;
    country?: string;
  },
  organizers: OrganizerRecord[],
  excludeId?: string,
): OrganizerDuplicateCandidate[] {
  const normalizedName = normalizeOrganizerNameForComparison(input.name);
  const websiteHost = normalizeWebsiteHost(input.website);
  const email = input.email?.trim().toLowerCase();
  const socialKeys = [
    normalizeSocialKey(input.instagram),
    normalizeSocialKey(input.facebook),
    normalizeSocialKey(input.soundcloud),
    normalizeSocialKey(input.residentAdvisor),
  ].filter(Boolean) as string[];

  const candidates: OrganizerDuplicateCandidate[] = [];

  for (const organizer of organizers) {
    if (excludeId && organizer.id === excludeId) {
      continue;
    }

    const organizerName = normalizeOrganizerNameForComparison(organizer.name);
    const organizerWebsiteHost = normalizeWebsiteHost(organizer.website);
    const organizerEmail = organizer.email?.trim().toLowerCase();
    const organizerSocialKeys = [
      normalizeSocialKey(organizer.instagram),
      normalizeSocialKey(organizer.facebook),
      normalizeSocialKey(organizer.soundcloud),
      normalizeSocialKey(organizer.residentAdvisor),
    ].filter(Boolean) as string[];

    if (email && organizerEmail && email === organizerEmail) {
      candidates.push({ organizer, strength: 'strong', reason: 'same_email' });
      continue;
    }

    if (
      socialKeys.some((key) => organizerSocialKeys.includes(key)) &&
      socialKeys.length > 0 &&
      organizerSocialKeys.length > 0
    ) {
      candidates.push({ organizer, strength: 'strong', reason: 'same_social' });
      continue;
    }

    if (
      organizerName === normalizedName &&
      websiteHost &&
      organizerWebsiteHost &&
      websiteHost === organizerWebsiteHost
    ) {
      candidates.push({ organizer, strength: 'strong', reason: 'same_name_and_website' });
      continue;
    }

    if (
      organizerName === normalizedName &&
      input.city?.trim() &&
      input.country?.trim() &&
      organizer.city?.trim().toLowerCase() === input.city.trim().toLowerCase() &&
      organizer.country?.trim().toLowerCase() === input.country.trim().toLowerCase()
    ) {
      candidates.push({ organizer, strength: 'moderate', reason: 'same_name_city_country' });
      continue;
    }

    if (organizerName === normalizedName) {
      candidates.push({ organizer, strength: 'weak', reason: 'same_name_only' });
    }
  }

  return candidates;
}

export function findStrongOrganizerDuplicate(
  input: Parameters<typeof findOrganizerDuplicateCandidates>[0],
  organizers: OrganizerRecord[],
  excludeId?: string,
): OrganizerDuplicateCandidate | null {
  return (
    findOrganizerDuplicateCandidates(input, organizers, excludeId).find(
      (candidate) => candidate.strength === 'strong',
    ) ?? null
  );
}

export function formatOrganizerPickerLabel(organizer: OrganizerRecord): string {
  const locality = [organizer.city, organizer.country].filter(Boolean).join(', ');
  const contact = organizer.website ?? organizer.instagram ?? organizer.residentAdvisor;
  if (locality && contact) {
    return `${organizer.name}\n${locality}\n${contact}`;
  }
  if (locality) {
    return `${organizer.name}\n${locality}`;
  }
  return organizer.name;
}

export const GENERIC_ORGANIZER_NAMES = new Set([
  'various',
  'unknown',
  'tba',
  'private',
  'self-organized',
  'community',
  'local crew',
]);

export function isGenericOrganizerName(name: string | undefined): boolean {
  if (!name?.trim()) {
    return true;
  }
  return GENERIC_ORGANIZER_NAMES.has(name.trim().toLowerCase());
}
