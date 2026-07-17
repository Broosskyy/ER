import { DbLifecycleStatus } from '@/types/database';

/** Canonical event domain model — Sprint 3 foundation */
export interface EventAddress {
  venueName: string;
  street?: string;
  houseNumber?: string;
  postalCode?: string;
  city: string;
  state?: string;
  country: string;
  latitude?: number | null;
  longitude?: number | null;
  /** Legacy single-line address */
  formatted?: string;
}

export interface EventSchedule {
  startDatetime: string;
  endDatetime?: string | null;
  timezone: string;
  /** Derived display fields */
  date?: string;
  startTime?: string;
  endTime?: string;
}

export interface EventMedia {
  coverImageUrl?: string | null;
  galleryUrls: string[];
  imageGradient?: [string, string];
}

/** Automation fields — prepared, not active in Sprint 3 */
export interface EventAutomationMeta {
  confidenceScore?: number | null;
  sourceType?: string | null;
  automationStatus?: string | null;
  duplicateGroup?: string | null;
  importSource?: string | null;
  externalId?: string | null;
  automationNotes?: string | null;
  duplicateOfEventId?: string | null;
  duplicateWarning?: string | null;
}

export interface EventOrganizerRef {
  organizerId?: string | null;
  organizerName?: string | null;
  createdBy?: string | null;
  verificationStatus?: 'unverified' | 'pending' | 'verified' | 'rejected' | null;
}

export interface EventEntity {
  id: string;
  title: string;
  shortDescription?: string | null;
  description?: string | null;
  schedule: EventSchedule;
  address: EventAddress;
  media: EventMedia;
  genres: string[];
  tags: string[];
  eventType?: string | null;
  minAge?: string | null;
  price?: number | null;
  ticketUrl?: string | null;
  instagramUrl?: string | null;
  websiteUrl?: string | null;
  sourceUrl?: string | null;
  lineup: string[];
  status: DbLifecycleStatus;
  organizer: EventOrganizerRef;
  automation: EventAutomationMeta;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
  archivedAt?: string | null;
  deletedAt?: string | null;
}

export type EventDraftInput = Omit<EventEntity, 'id' | 'createdAt' | 'updatedAt' | 'publishedAt' | 'archivedAt' | 'deletedAt'> & {
  id?: string;
};

export type EventSubmissionInput = Pick<
  EventEntity,
  'title' | 'shortDescription' | 'description' | 'schedule' | 'address' | 'genres' | 'tags' | 'eventType' | 'minAge' | 'price' | 'ticketUrl' | 'lineup'
> & {
  sourceType?: string;
};

export interface PaginationParams {
  limit?: number;
  offset?: number;
  orderBy?: 'start_datetime' | 'updated_at' | 'published_at' | 'created_at';
  ascending?: boolean;
}

export interface EventFilterParams {
  status?: DbLifecycleStatus | DbLifecycleStatus[];
  organizerId?: string;
  createdBy?: string;
  sourceType?: string;
}
