import { AppError } from '@/core/errors/app-error';
import type { OrganizerRecord, OrganizerListParams, PaginatedResult } from '@/data/types/records';
import {
  canCreateOrganizers,
  canDeleteOrganizers,
  canEditOrganizers,
} from '@/features/admin/admin-permissions';
import type { AdminRole } from '@/features/import/admin/admin-roles';
import {
  findOrganizerDuplicateCandidates,
  findStrongOrganizerDuplicate,
  type OrganizerDuplicateCandidate,
} from '@/features/organizers/domain/organizer-duplicate';
import {
  buildOrganizerSlugBase,
  resolveUniqueOrganizerSlug,
} from '@/features/organizers/domain/organizer-slug';
import { validateOrganizerInput } from '@/features/organizers/domain/organizer-validation';

export interface OrganizerMutationInput {
  id?: string;
  slug?: string;
  name: string;
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

function assertCanMutate(role: AdminRole | null): void {
  if (!canEditOrganizers(role)) {
    throw new AppError('You do not have permission to edit organizers.', { code: 'UNAUTHORIZED' });
  }
}

function assertCanCreate(role: AdminRole | null): void {
  if (!canCreateOrganizers(role)) {
    throw new AppError('You do not have permission to create organizers.', { code: 'UNAUTHORIZED' });
  }
}

export class OrganizerService {
  constructor(
    private readonly repository: {
      list(params: OrganizerListParams): Promise<PaginatedResult<OrganizerRecord>>;
      getById(id: string): Promise<OrganizerRecord | null>;
      getBySlug(slug: string): Promise<OrganizerRecord | null>;
      getAll(): Promise<OrganizerRecord[]>;
      save(record: OrganizerRecord): Promise<OrganizerRecord>;
      delete(id: string): Promise<void>;
      countEventsForOrganizer(organizerId: string): Promise<number>;
      listEventIdsForOrganizer(organizerId: string): Promise<string[]>;
    },
  ) {}

  async listForAdmin(
    role: AdminRole | null,
    params: OrganizerListParams = {},
  ): Promise<PaginatedResult<OrganizerRecord>> {
    if (!role) {
      throw new AppError('Authentication required.', { code: 'UNAUTHORIZED' });
    }

    return this.repository.list(params);
  }

  async getByIdForAdmin(role: AdminRole | null, id: string): Promise<OrganizerRecord | null> {
    if (!role) {
      throw new AppError('Authentication required.', { code: 'UNAUTHORIZED' });
    }

    return this.repository.getById(id);
  }

  async getBySlugForAdmin(role: AdminRole | null, slug: string): Promise<OrganizerRecord | null> {
    if (!role) {
      throw new AppError('Authentication required.', { code: 'UNAUTHORIZED' });
    }

    return this.repository.getBySlug(slug);
  }

  async create(role: AdminRole | null, input: OrganizerMutationInput): Promise<OrganizerRecord> {
    assertCanCreate(role);
    const validated = validateOrganizerInput(input);
    const existingOrganizers = await this.repository.getAll();

    const duplicate = findStrongOrganizerDuplicate(validated, existingOrganizers);
    if (duplicate) {
      throw new AppError(
        `A similar organizer already exists: ${duplicate.organizer.name}.`,
        { code: 'VALIDATION' },
      );
    }

    const slugBase = validated.slug ?? buildOrganizerSlugBase(validated.name);
    const slug = resolveUniqueOrganizerSlug(
      slugBase,
      existingOrganizers.map((organizer) => organizer.slug),
    );

    const now = new Date().toISOString();
    const id = input.id ?? `organizer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    return this.repository.save({
      id,
      slug,
      name: validated.name,
      description: validated.description,
      website: validated.website,
      email: validated.email,
      phone: validated.phone,
      instagram: validated.instagram,
      facebook: validated.facebook,
      soundcloud: validated.soundcloud,
      residentAdvisor: validated.residentAdvisor,
      logoUrl: validated.logoUrl,
      city: validated.city,
      country: validated.country,
      notes: validated.notes,
      createdAt: now,
      updatedAt: now,
    });
  }

  async update(
    role: AdminRole | null,
    input: OrganizerMutationInput & { id: string },
  ): Promise<OrganizerRecord> {
    assertCanMutate(role);
    const existing = await this.repository.getById(input.id);
    if (!existing) {
      throw new AppError('Organizer not found.', { code: 'NOT_FOUND' });
    }

    const validated = validateOrganizerInput(input);
    const existingOrganizers = await this.repository.getAll();

    const duplicate = findStrongOrganizerDuplicate(validated, existingOrganizers, existing.id);
    if (duplicate) {
      throw new AppError(
        `A similar organizer already exists: ${duplicate.organizer.name}.`,
        { code: 'VALIDATION' },
      );
    }

    const slug = validated.slug ?? existing.slug;
    if (slug !== existing.slug) {
      const taken = existingOrganizers.some(
        (organizer) => organizer.slug === slug && organizer.id !== existing.id,
      );
      if (taken) {
        throw new AppError('Organizer slug is already in use.', { code: 'VALIDATION' });
      }
    }

    return this.repository.save({
      ...existing,
      name: validated.name,
      slug,
      description: validated.description,
      website: validated.website,
      email: validated.email,
      phone: validated.phone,
      instagram: validated.instagram,
      facebook: validated.facebook,
      soundcloud: validated.soundcloud,
      residentAdvisor: validated.residentAdvisor,
      logoUrl: validated.logoUrl,
      city: validated.city,
      country: validated.country,
      notes: validated.notes,
      updatedAt: new Date().toISOString(),
    });
  }

  async delete(role: AdminRole | null, id: string): Promise<void> {
    if (!canDeleteOrganizers(role)) {
      throw new AppError('You do not have permission to delete organizers.', { code: 'UNAUTHORIZED' });
    }

    const existing = await this.repository.getById(id);
    if (!existing) {
      throw new AppError('Organizer not found.', { code: 'NOT_FOUND' });
    }

    const eventCount = await this.repository.countEventsForOrganizer(id);
    if (eventCount > 0) {
      throw new AppError(
        `Organizer cannot be deleted while ${eventCount} event(s) still reference it.`,
        { code: 'VALIDATION' },
      );
    }

    await this.repository.delete(id);
  }

  async listOrganizerEvents(role: AdminRole | null, organizerId: string): Promise<string[]> {
    if (!role) {
      throw new AppError('Authentication required.', { code: 'UNAUTHORIZED' });
    }

    return this.repository.listEventIdsForOrganizer(organizerId);
  }

  async organizerExists(id: string): Promise<boolean> {
    const organizer = await this.repository.getById(id);
    return organizer !== null;
  }

  findDuplicateCandidates(
    input: OrganizerMutationInput,
    organizers: OrganizerRecord[],
    excludeId?: string,
  ): OrganizerDuplicateCandidate[] {
    const validated = validateOrganizerInput(input);
    return findOrganizerDuplicateCandidates(validated, organizers, excludeId);
  }
}

export function canAssignOrganizerToEvent(role: AdminRole | null): boolean {
  return canEditOrganizers(role);
}

export function canRemoveOrganizerFromEvent(role: AdminRole | null): boolean {
  return canEditOrganizers(role);
}

export function canViewOrganizerAdmin(role: AdminRole | null): boolean {
  return role !== null;
}

export function canViewOrganizerEvents(role: AdminRole | null): boolean {
  return role !== null;
}
