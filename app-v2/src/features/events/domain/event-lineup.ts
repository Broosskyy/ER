import type { ArtistRecord } from '@/data/types/records';
import type { ArtistBillingRole } from '@/features/events/domain/artist-billing-role';
import type {
  BillingRelation,
  ResolvedCanonicalLineupEntry,
} from '@/features/aggregation/domain/canonical-lineup-entry';

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

export interface StructuredLineupEntryInput {
  order: number;
  artistIds: string[];
  billingRelation: BillingRelation;
  stage?: string;
  startTime?: string;
  endTime?: string;
  runningOrder?: number;
  confidence?: number;
  provenance?: ResolvedCanonicalLineupEntry['provenance'];
}
