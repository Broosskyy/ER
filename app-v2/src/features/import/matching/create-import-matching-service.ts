import { createEntityAliasStore } from '@/features/entity-resolution/create-entity-alias-store';
import { ArtistIdentityResolver } from '@/features/entity-resolution/artist-identity-resolver';
import { OrganizerIdentityResolver } from '@/features/entity-resolution/organizer-identity-resolver';
import { VenueIdentityResolver } from '@/features/entity-resolution/venue-identity-resolver';
import type { EntityAliasStore } from '@/features/entity-resolution/types';
import { ImportMatchingService } from './import-matching-service';

export interface ImportMatchingServiceBundle {
  matchingService: ImportMatchingService;
  aliasStore: EntityAliasStore;
}

export function createImportMatchingService(
  aliasStore: EntityAliasStore = createEntityAliasStore(),
): ImportMatchingServiceBundle {
  const matchingService = new ImportMatchingService({
    venueResolver: new VenueIdentityResolver(aliasStore),
    organizerResolver: new OrganizerIdentityResolver(aliasStore),
    artistResolver: new ArtistIdentityResolver(aliasStore),
  });

  return { matchingService, aliasStore };
}
