import { AppError } from '@/core/errors/app-error';
import { isValidOrganizerSlug } from '@/features/organizers/domain/organizer-slug';
import { validateUrl } from '@/features/import/normalization/url-normalizer';

const MAX_NAME_LENGTH = 160;
const MAX_SLUG_LENGTH = 180;
const MAX_DESCRIPTION_LENGTH = 4000;
const MAX_CITY_LENGTH = 120;
const MAX_COUNTRY_LENGTH = 120;
const MAX_NOTES_LENGTH = 4000;
const MAX_CONTACT_LENGTH = 200;
const MAX_SOCIAL_LENGTH = 300;

export interface OrganizerValidationInput {
  name: string;
  slug?: string;
  description?: string;
  website?: string;
  email?: string;
  phone?: string;
  instagram?: string;
  facebook?: string;
  soundcloud?: string;
  residentAdvisor?: string;
  logoUrl?: string;
  city?: string;
  country?: string;
  notes?: string;
}

export function normalizeOptionalString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function normalizeOrganizerName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function normalizeOrganizerUrlField(value: string | undefined): string | undefined {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    return undefined;
  }

  const result = validateUrl(normalized);
  if (!result.valid || !result.url) {
    throw new AppError(`Invalid URL: ${normalized}`, { code: 'VALIDATION' });
  }

  return result.url;
}

function normalizeEmailField(value: string | undefined): string | undefined {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    return undefined;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || normalized.length > MAX_CONTACT_LENGTH) {
    throw new AppError('Invalid email address.', { code: 'VALIDATION' });
  }

  return normalized;
}

function normalizeSocialField(value: string | undefined, label: string): string | undefined {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    return undefined;
  }

  if (normalized.length > MAX_SOCIAL_LENGTH) {
    throw new AppError(`${label} must be at most ${MAX_SOCIAL_LENGTH} characters.`, {
      code: 'VALIDATION',
    });
  }

  return normalized;
}

export function validateOrganizerInput(input: OrganizerValidationInput): {
  name: string;
  slug?: string;
  description?: string;
  website?: string;
  email?: string;
  phone?: string;
  instagram?: string;
  facebook?: string;
  soundcloud?: string;
  residentAdvisor?: string;
  logoUrl?: string;
  city?: string;
  country?: string;
  notes?: string;
} {
  const name = normalizeOrganizerName(input.name);
  if (!name) {
    throw new AppError('Organizer name is required.', { code: 'VALIDATION' });
  }
  if (name.length > MAX_NAME_LENGTH) {
    throw new AppError(`Organizer name must be at most ${MAX_NAME_LENGTH} characters.`, {
      code: 'VALIDATION',
    });
  }

  const slug = normalizeOptionalString(input.slug);
  if (slug && (slug.length > MAX_SLUG_LENGTH || !isValidOrganizerSlug(slug))) {
    throw new AppError('Organizer slug must use lowercase letters, numbers, and hyphens.', {
      code: 'VALIDATION',
    });
  }

  const description = normalizeOptionalString(input.description);
  if (description && description.length > MAX_DESCRIPTION_LENGTH) {
    throw new AppError(`Description must be at most ${MAX_DESCRIPTION_LENGTH} characters.`, {
      code: 'VALIDATION',
    });
  }

  const city = normalizeOptionalString(input.city);
  if (city && city.length > MAX_CITY_LENGTH) {
    throw new AppError(`City must be at most ${MAX_CITY_LENGTH} characters.`, { code: 'VALIDATION' });
  }

  const country = normalizeOptionalString(input.country);
  if (country && country.length > MAX_COUNTRY_LENGTH) {
    throw new AppError(`Country must be at most ${MAX_COUNTRY_LENGTH} characters.`, {
      code: 'VALIDATION',
    });
  }

  const phone = normalizeOptionalString(input.phone);
  if (phone && phone.length > MAX_CONTACT_LENGTH) {
    throw new AppError(`Phone must be at most ${MAX_CONTACT_LENGTH} characters.`, {
      code: 'VALIDATION',
    });
  }

  const notes = normalizeOptionalString(input.notes);
  if (notes && notes.length > MAX_NOTES_LENGTH) {
    throw new AppError(`Notes must be at most ${MAX_NOTES_LENGTH} characters.`, {
      code: 'VALIDATION',
    });
  }

  return {
    name,
    slug,
    description,
    website: normalizeOrganizerUrlField(input.website),
    email: normalizeEmailField(input.email),
    phone,
    instagram: normalizeSocialField(input.instagram, 'Instagram'),
    facebook: normalizeSocialField(input.facebook, 'Facebook'),
    soundcloud: normalizeSocialField(input.soundcloud, 'SoundCloud'),
    residentAdvisor: normalizeSocialField(input.residentAdvisor, 'Resident Advisor'),
    logoUrl: normalizeOrganizerUrlField(input.logoUrl),
    city,
    country,
    notes,
  };
}

export function normalizeOrganizerNameForComparison(name: string): string {
  return normalizeOrganizerName(name).toLowerCase();
}
