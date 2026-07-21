import type { ArtistRecord } from '@/data/types/records';
import type { ArtistBillingRole } from '@/features/events/domain/artist-billing-role';

export interface EventArtistRecord {
  id: string;
  eventId: string;
  artistId: string;
  billingRole: ArtistBillingRole;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface EventLineupArtist {
  relationshipId: string;
  artist: ArtistRecord;
  billingRole: ArtistBillingRole;
  sortOrder: number;
}

export interface EventLineupInput {
  artistId: string;
  billingRole: ArtistBillingRole;
}
