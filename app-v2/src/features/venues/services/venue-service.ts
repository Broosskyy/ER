import { AppError } from '@/core/errors/app-error';
import type { VenueRecord, VenueListParams, PaginatedResult } from '@/data/types/records';
import {
  canCreateVenues,
  canDeleteVenues,
  canEditVenues,
} from '@/features/admin/admin-permissions';
import type { AdminRole } from '@/features/import/admin/admin-roles';
import { findDuplicateVenue } from '@/features/venues/domain/venue-duplicate';
import {
  buildVenueSlugBase,
  resolveUniqueVenueSlug,
} from '@/features/venues/domain/venue-slug';
import { validateVenueInput } from '@/features/venues/domain/venue-validation';

export interface VenueMutationInput {
  id?: string;
  slug?: string;
  name: string;
  street?: string;
  houseNumber?: string;
  postalCode?: string;
  city?: string;
  state?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  website?: string;
  capacity?: number;
  notes?: string;
}

function assertCanMutate(role: AdminRole | null): void {
  if (!canEditVenues(role)) {
    throw new AppError('You do not have permission to edit venues.', { code: 'UNAUTHORIZED' });
  }
}

function assertCanCreate(role: AdminRole | null): void {
  if (!canCreateVenues(role)) {
    throw new AppError('You do not have permission to create venues.', { code: 'UNAUTHORIZED' });
  }
}

export class VenueService {
  constructor(
    private readonly repository: {
      list(params: VenueListParams): Promise<PaginatedResult<VenueRecord>>;
      getById(id: string): Promise<VenueRecord | null>;
      getBySlug(slug: string): Promise<VenueRecord | null>;
      getAll(): Promise<VenueRecord[]>;
      save(record: VenueRecord): Promise<VenueRecord>;
      delete(id: string): Promise<void>;
      countEventsForVenue(venueId: string): Promise<number>;
      listEventIdsForVenue(venueId: string): Promise<string[]>;
    },
  ) {}

  async listForAdmin(
    role: AdminRole | null,
    params: VenueListParams = {},
  ): Promise<PaginatedResult<VenueRecord>> {
    if (!role) {
      throw new AppError('Authentication required.', { code: 'UNAUTHORIZED' });
    }

    return this.repository.list(params);
  }

  async getByIdForAdmin(role: AdminRole | null, id: string): Promise<VenueRecord | null> {
    if (!role) {
      throw new AppError('Authentication required.', { code: 'UNAUTHORIZED' });
    }

    return this.repository.getById(id);
  }

  async getBySlugForAdmin(role: AdminRole | null, slug: string): Promise<VenueRecord | null> {
    if (!role) {
      throw new AppError('Authentication required.', { code: 'UNAUTHORIZED' });
    }

    return this.repository.getBySlug(slug);
  }

  async create(role: AdminRole | null, input: VenueMutationInput): Promise<VenueRecord> {
    assertCanCreate(role);
    const validated = validateVenueInput(input);
    const existingVenues = await this.repository.getAll();

    const duplicate = findDuplicateVenue(validated, existingVenues);
    if (duplicate) {
      throw new AppError(
        `A similar venue already exists: ${duplicate.venue.name} (${duplicate.venue.city}).`,
        { code: 'VALIDATION' },
      );
    }

    const slugBase = validated.slug ?? buildVenueSlugBase(validated.name);
    const slug = resolveUniqueVenueSlug(
      slugBase,
      existingVenues.map((venue) => venue.slug),
    );

    const now = new Date().toISOString();
    const id = input.id ?? `venue-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    return this.repository.save({
      id,
      slug,
      name: validated.name,
      street: validated.street,
      houseNumber: validated.houseNumber,
      postalCode: validated.postalCode,
      city: validated.city,
      state: validated.state,
      country: validated.country,
      latitude: validated.latitude,
      longitude: validated.longitude,
      website: validated.website,
      capacity: validated.capacity,
      notes: validated.notes,
      createdAt: now,
      updatedAt: now,
    });
  }

  async update(role: AdminRole | null, input: VenueMutationInput & { id: string }): Promise<VenueRecord> {
    assertCanMutate(role);
    const existing = await this.repository.getById(input.id);
    if (!existing) {
      throw new AppError('Venue not found.', { code: 'NOT_FOUND' });
    }

    const validated = validateVenueInput({
      ...input,
      city: input.city ?? existing.city,
      country: input.country ?? existing.country,
    });
    const existingVenues = await this.repository.getAll();

    const duplicate = findDuplicateVenue(validated, existingVenues, existing.id);
    if (duplicate) {
      throw new AppError(
        `A similar venue already exists: ${duplicate.venue.name} (${duplicate.venue.city}).`,
        { code: 'VALIDATION' },
      );
    }

    const slug = validated.slug ?? existing.slug;
    if (slug !== existing.slug) {
      const taken = existingVenues.some((venue) => venue.slug === slug && venue.id !== existing.id);
      if (taken) {
        throw new AppError('Venue slug is already in use.', { code: 'VALIDATION' });
      }
    }

    return this.repository.save({
      ...existing,
      name: validated.name,
      slug,
      street: validated.street,
      houseNumber: validated.houseNumber,
      postalCode: validated.postalCode,
      city: validated.city,
      state: validated.state,
      country: validated.country,
      latitude: validated.latitude,
      longitude: validated.longitude,
      website: validated.website,
      capacity: validated.capacity,
      notes: validated.notes,
      updatedAt: new Date().toISOString(),
    });
  }

  async delete(role: AdminRole | null, id: string): Promise<void> {
    if (!canDeleteVenues(role)) {
      throw new AppError('You do not have permission to delete venues.', { code: 'UNAUTHORIZED' });
    }

    const existing = await this.repository.getById(id);
    if (!existing) {
      throw new AppError('Venue not found.', { code: 'NOT_FOUND' });
    }

    const eventCount = await this.repository.countEventsForVenue(id);
    if (eventCount > 0) {
      throw new AppError(
        `Venue cannot be deleted while ${eventCount} event(s) still reference it.`,
        { code: 'VALIDATION' },
      );
    }

    await this.repository.delete(id);
  }

  async listVenueEvents(role: AdminRole | null, venueId: string): Promise<string[]> {
    if (!role) {
      throw new AppError('Authentication required.', { code: 'UNAUTHORIZED' });
    }

    return this.repository.listEventIdsForVenue(venueId);
  }

  async venueExists(id: string): Promise<boolean> {
    const venue = await this.repository.getById(id);
    return venue !== null;
  }

  findDuplicateVenue(
    input: VenueMutationInput,
    venues: VenueRecord[],
    excludeId?: string,
  ) {
    const validated = validateVenueInput({
      ...input,
      city: input.city ?? '',
      country: input.country ?? '',
    });
    return findDuplicateVenue(validated, venues, excludeId);
  }
}

export function canAssignVenueToEvent(role: AdminRole | null): boolean {
  return canEditVenues(role);
}

export function canReassignVenue(role: AdminRole | null): boolean {
  return canEditVenues(role);
}

export function canViewVenueEvents(role: AdminRole | null): boolean {
  return role !== null;
}
