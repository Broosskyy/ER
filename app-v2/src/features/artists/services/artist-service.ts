import { AppError } from '@/core/errors/app-error';
import type { ArtistRecord, ArtistListParams, PaginatedResult } from '@/data/types/records';
import {
  assertValidArtistLifecycleTransition,
  requiresPrivilegedArtistLifecycleTransition,
} from '@/features/artists/domain/artist-status-transitions';
import {
  buildArtistSlugBase,
  resolveUniqueArtistSlug,
} from '@/features/artists/domain/artist-slug';
import {
  normalizeArtistNameForComparison,
  validateArtistInput,
} from '@/features/artists/domain/artist-validation';
import type { ArtistLifecycleStatus, ArtistVerificationStatus } from '@/features/artists/types/artist-status';
import {
  canArchiveArtists,
  canCreateArtists,
  canEditArtists,
  canPublishArtists,
  canVerifyArtists,
} from '@/features/admin/admin-permissions';
import type { AdminRole } from '@/features/import/admin/admin-roles';

export interface ArtistMutationInput {
  id?: string;
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

function assertCanMutate(role: AdminRole | null): void {
  if (!canEditArtists(role)) {
    throw new AppError('You do not have permission to edit artists.', { code: 'UNAUTHORIZED' });
  }
}

function assertCanCreate(role: AdminRole | null): void {
  if (!canCreateArtists(role)) {
    throw new AppError('You do not have permission to create artists.', { code: 'UNAUTHORIZED' });
  }
}

export class ArtistService {
  constructor(
    private readonly publicRepository: {
      getPublishedBySlug(slug: string): Promise<ArtistRecord | null>;
      getPublishedById(id: string): Promise<ArtistRecord | null>;
    },
    private readonly adminRepository: {
      list(params: ArtistListParams): Promise<PaginatedResult<ArtistRecord>>;
      getById(id: string): Promise<ArtistRecord | null>;
      getAll(): Promise<ArtistRecord[]>;
      save(record: ArtistRecord): Promise<ArtistRecord>;
    },
  ) {}
  async listForAdmin(
    role: AdminRole | null,
    params: ArtistListParams = {},
  ): Promise<PaginatedResult<ArtistRecord>> {
    if (!role) {
      throw new AppError('Authentication required.', { code: 'UNAUTHORIZED' });
    }

    return this.adminRepository.list(params);
  }

  async getByIdForAdmin(role: AdminRole | null, id: string): Promise<ArtistRecord | null> {
    if (!role) {
      throw new AppError('Authentication required.', { code: 'UNAUTHORIZED' });
    }

    return this.adminRepository.getById(id);
  }

  async getPublishedBySlug(slug: string): Promise<ArtistRecord | null> {
    return this.publicRepository.getPublishedBySlug(slug);
  }

  async getPublishedById(id: string): Promise<ArtistRecord | null> {
    return this.publicRepository.getPublishedById(id);
  }

  async create(role: AdminRole | null, input: ArtistMutationInput): Promise<ArtistRecord> {
    assertCanCreate(role);
    const validated = validateArtistInput(input);
    const existingArtists = await this.adminRepository.getAll();

    const duplicate = existingArtists.find(
      (artist) => normalizeArtistNameForComparison(artist.name) === normalizeArtistNameForComparison(validated.name),
    );
    if (duplicate) {
      throw new AppError('An artist with this name already exists.', { code: 'VALIDATION' });
    }

    const slugBase = validated.slug ?? buildArtistSlugBase(validated.name);
    const slug = resolveUniqueArtistSlug(
      slugBase,
      existingArtists.map((artist) => artist.slug),
    );

    const status = validated.status;
    if (status === 'published' && !canPublishArtists(role)) {
      throw new AppError('You do not have permission to publish artists.', { code: 'UNAUTHORIZED' });
    }
    if (status === 'archived') {
      throw new AppError('New artists cannot be created as archived.', { code: 'VALIDATION' });
    }
    if (validated.verificationStatus === 'verified' && !canVerifyArtists(role)) {
      throw new AppError('You do not have permission to verify artists.', { code: 'UNAUTHORIZED' });
    }

    const now = new Date().toISOString();
    return this.adminRepository.save({
      id: input.id ?? `artist-${Date.now()}`,
      name: validated.name,
      slug,
      bio: validated.bio,
      imageUrl: validated.imageUrl,
      genreIds: validated.genreIds,
      country: validated.country,
      city: validated.city,
      website: validated.website,
      instagram: validated.instagram,
      facebook: validated.facebook,
      soundcloud: validated.soundcloud,
      spotify: validated.spotify,
      status,
      verificationStatus: validated.verificationStatus,
      createdAt: now,
      updatedAt: now,
    });
  }

  async update(
    role: AdminRole | null,
    input: ArtistMutationInput & { id: string },
  ): Promise<ArtistRecord> {
    assertCanMutate(role);
    const existing = await this.adminRepository.getById(input.id);
    if (!existing) {
      throw new AppError('Artist not found.', { code: 'NOT_FOUND' });
    }

    const validated = validateArtistInput({
      ...existing,
      ...input,
      status: input.status ?? existing.status,
      verificationStatus: input.verificationStatus ?? existing.verificationStatus,
    });

    if (
      validated.verificationStatus !== existing.verificationStatus &&
      !canVerifyArtists(role)
    ) {
      throw new AppError('You do not have permission to change verification status.', {
        code: 'UNAUTHORIZED',
      });
    }

    if (validated.status !== existing.status) {
      assertValidArtistLifecycleTransition(existing.status, validated.status);
      if (requiresPrivilegedArtistLifecycleTransition(existing.status, validated.status)) {
        if (validated.status === 'published' && !canPublishArtists(role)) {
          throw new AppError('You do not have permission to publish artists.', {
            code: 'UNAUTHORIZED',
          });
        }
        if (validated.status === 'archived' && !canArchiveArtists(role)) {
          throw new AppError('You do not have permission to archive artists.', {
            code: 'UNAUTHORIZED',
          });
        }
        if (existing.status === 'archived' && !canPublishArtists(role)) {
          throw new AppError('You do not have permission to restore archived artists.', {
            code: 'UNAUTHORIZED',
          });
        }
      }
    }

    const existingArtists = await this.adminRepository.getAll();
    const duplicate = existingArtists.find(
      (artist) =>
        artist.id !== existing.id &&
        normalizeArtistNameForComparison(artist.name) === normalizeArtistNameForComparison(validated.name),
    );
    if (duplicate) {
      throw new AppError('An artist with this name already exists.', { code: 'VALIDATION' });
    }

    const slug =
      validated.slug ??
      existing.slug ??
      resolveUniqueArtistSlug(
        buildArtistSlugBase(validated.name),
        existingArtists.map((artist) => artist.slug),
        existing.slug,
      );

    if (validated.slug && validated.slug !== existing.slug) {
      const slugTaken = existingArtists.some(
        (artist) => artist.id !== existing.id && artist.slug === validated.slug,
      );
      if (slugTaken) {
        throw new AppError('Artist slug is already in use.', { code: 'VALIDATION' });
      }
    }

    return this.adminRepository.save({
      ...existing,
      ...validated,
      slug,
      updatedAt: new Date().toISOString(),
    });
  }

  async archive(role: AdminRole | null, id: string): Promise<ArtistRecord> {
    assertCanMutate(role);
    if (!canArchiveArtists(role)) {
      throw new AppError('You do not have permission to archive artists.', { code: 'UNAUTHORIZED' });
    }

    const existing = await this.adminRepository.getById(id);
    if (!existing) {
      throw new AppError('Artist not found.', { code: 'NOT_FOUND' });
    }

    return this.update(role, {
      id,
      name: existing.name,
      status: 'archived',
    });
  }
}