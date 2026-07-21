import { AppError } from '@/core/errors/app-error';
import { isValidArtistSlug } from '@/features/artists/domain/artist-slug';
import {
  isArtistLifecycleStatus,
  isArtistVerificationStatus,
  type ArtistLifecycleStatus,
  type ArtistVerificationStatus,
} from '@/features/artists/types/artist-status';
import { validateUrl } from '@/features/import/normalization/url-normalizer';

const MAX_NAME_LENGTH = 120;
const MAX_SLUG_LENGTH = 160;
const MAX_BIO_LENGTH = 4000;
const MAX_LOCATION_LENGTH = 120;
const MAX_GENRE_IDS = 12;

export interface ArtistValidationInput {
  name: string;
  slug?: string;
  bio?: string;
  imageUrl?: string;
  genreIds?: string[];
  country?: string;
  city?: string;
  website?: string;
  instagram?: string;
  facebook?: string;
  soundcloud?: string;
  spotify?: string;
  status?: ArtistLifecycleStatus;
  verificationStatus?: ArtistVerificationStatus;
}

export function normalizeOptionalString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function normalizeArtistName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function normalizeArtistUrlField(value: string | undefined): string | undefined {
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

export function normalizeArtistGenreIds(genreIds: string[] | undefined): string[] {
  const unique = [...new Set((genreIds ?? []).map((id) => id.trim()).filter(Boolean))];
  if (unique.length > MAX_GENRE_IDS) {
    throw new AppError(`Artists support at most ${MAX_GENRE_IDS} genres.`, { code: 'VALIDATION' });
  }
  return unique;
}

export function validateArtistInput(input: ArtistValidationInput): {
  name: string;
  slug?: string;
  bio?: string;
  imageUrl?: string;
  genreIds: string[];
  country?: string;
  city?: string;
  website?: string;
  instagram?: string;
  facebook?: string;
  soundcloud?: string;
  spotify?: string;
  status: ArtistLifecycleStatus;
  verificationStatus: ArtistVerificationStatus;
} {
  const name = normalizeArtistName(input.name);
  if (!name) {
    throw new AppError('Artist name is required.', { code: 'VALIDATION' });
  }
  if (name.length > MAX_NAME_LENGTH) {
    throw new AppError(`Artist name must be at most ${MAX_NAME_LENGTH} characters.`, {
      code: 'VALIDATION',
    });
  }

  const slug = normalizeOptionalString(input.slug);
  if (slug && (slug.length > MAX_SLUG_LENGTH || !isValidArtistSlug(slug))) {
    throw new AppError('Artist slug must use lowercase letters, numbers, and hyphens.', {
      code: 'VALIDATION',
    });
  }

  const bio = normalizeOptionalString(input.bio);
  if (bio && bio.length > MAX_BIO_LENGTH) {
    throw new AppError(`Artist bio must be at most ${MAX_BIO_LENGTH} characters.`, {
      code: 'VALIDATION',
    });
  }

  const country = normalizeOptionalString(input.country);
  if (country && country.length > MAX_LOCATION_LENGTH) {
    throw new AppError(`Country must be at most ${MAX_LOCATION_LENGTH} characters.`, {
      code: 'VALIDATION',
    });
  }

  const city = normalizeOptionalString(input.city);
  if (city && city.length > MAX_LOCATION_LENGTH) {
    throw new AppError(`City must be at most ${MAX_LOCATION_LENGTH} characters.`, {
      code: 'VALIDATION',
    });
  }

  const status = input.status ?? 'draft';
  if (!isArtistLifecycleStatus(status)) {
    throw new AppError('Invalid artist lifecycle status.', { code: 'VALIDATION' });
  }

  const verificationStatus = input.verificationStatus ?? 'unverified';
  if (!isArtistVerificationStatus(verificationStatus)) {
    throw new AppError('Invalid artist verification status.', { code: 'VALIDATION' });
  }

  return {
    name,
    slug,
    bio,
    imageUrl: normalizeArtistUrlField(input.imageUrl),
    genreIds: normalizeArtistGenreIds(input.genreIds),
    country,
    city,
    website: normalizeArtistUrlField(input.website),
    instagram: normalizeArtistUrlField(input.instagram),
    facebook: normalizeArtistUrlField(input.facebook),
    soundcloud: normalizeArtistUrlField(input.soundcloud),
    spotify: normalizeArtistUrlField(input.spotify),
    status,
    verificationStatus,
  };
}

export function normalizeArtistNameForComparison(name: string): string {
  return normalizeArtistName(name).toLowerCase();
}
