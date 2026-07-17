import { ImportedEventDraft } from '@/types/lifecycle';

export type UserRole = 'user' | 'organizer' | 'moderator' | 'admin';
export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

export type DbLifecycleStatus =
  | 'draft'
  | 'pending_review'
  | 'imported_draft'
  | 'needs_review'
  | 'approved'
  | 'published'
  | 'rejected'
  | 'duplicate'
  | 'archived'
  | 'deleted';

export type DbSubmissionStatus = 'pending' | 'approved' | 'rejected' | 'duplicate';

export type DbImportSourceType =
  | 'website'
  | 'instagram'
  | 'resident_advisor'
  | 'eventbrite'
  | 'shotgun'
  | 'csv'
  | 'text'
  | 'flyer';

export type DbImportStatus =
  | 'queued'
  | 'parsed'
  | 'needs_review'
  | 'approved'
  | 'rejected'
  | 'duplicate'
  | 'failed';

export type DbReportStatus = 'open' | 'reviewed' | 'dismissed';

export interface ProfileRow {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  created_at: string;
}

export interface OrganizerRow {
  id: string;
  profile_id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  instagram_url: string | null;
  website_url: string | null;
  verification_status: VerificationStatus;
  created_at: string;
}

export interface VenueRow {
  id: string;
  name: string;
  city: string;
  country: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
}

export interface EventRow {
  id: string;
  title: string;
  short_description: string | null;
  description: string | null;
  event_type: string | null;
  genres: string[];
  tags: string[];
  start_datetime: string;
  end_datetime: string | null;
  timezone: string | null;
  city: string;
  country: string;
  venue_name: string;
  street: string | null;
  house_number: string | null;
  postal_code: string | null;
  state: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  price: number | null;
  age_restriction: string | null;
  ticket_url: string | null;
  instagram_url: string | null;
  website_url: string | null;
  flyer_url: string | null;
  gallery_urls: string[];
  organizer_id: string | null;
  source_url: string | null;
  source_type: string | null;
  lifecycle_status: DbLifecycleStatus;
  confidence_score: number | null;
  duplicate_of_event_id: string | null;
  duplicate_warning: string | null;
  automation_status: string | null;
  duplicate_group: string | null;
  import_source: string | null;
  external_id: string | null;
  automation_notes: string | null;
  created_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  published_at: string | null;
  archived_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventReviewAuditRow {
  id: string;
  event_id: string;
  actor_id: string | null;
  action: string;
  from_status: DbLifecycleStatus | null;
  to_status: DbLifecycleStatus | null;
  note: string | null;
  created_at: string;
}

export interface EventSubmissionHistoryRow {
  id: string;
  event_id: string;
  submitted_by: string | null;
  snapshot: Record<string, unknown>;
  status: DbLifecycleStatus;
  created_at: string;
}

export interface EventArtistRow {
  id: string;
  event_id: string;
  artist_name: string;
  slot_time: string | null;
  sort_order: number;
}

export interface FavoriteRow {
  id: string;
  user_id: string;
  event_id: string;
  created_at: string;
}

export interface EventSubmissionRow {
  id: string;
  submitted_by: string;
  title: string;
  raw_payload: Record<string, unknown>;
  status: DbSubmissionStatus;
  created_at: string;
}

export interface ImportSourceRow {
  id: string;
  source_type: DbImportSourceType;
  source_url: string | null;
  raw_text: string | null;
  status: DbImportStatus;
  parsed_event_id: string | null;
  confidence_score: number | null;
  duplicate_warning: string | null;
  created_at: string;
}

export interface ReportRow {
  id: string;
  event_id: string;
  user_id: string;
  reason: string;
  status: DbReportStatus;
  created_at: string;
}

type TableDef<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      profiles: TableDef<ProfileRow, Omit<ProfileRow, 'created_at'> & { created_at?: string }, Partial<ProfileRow>>;
      organizers: TableDef<OrganizerRow, Omit<OrganizerRow, 'id' | 'created_at'> & { id?: string; created_at?: string }, Partial<OrganizerRow>>;
      venues: TableDef<VenueRow, Omit<VenueRow, 'id' | 'created_at'> & { id?: string; created_at?: string }, Partial<VenueRow>>;
      events: TableDef<EventRow, Omit<EventRow, 'id' | 'created_at' | 'updated_at'> & { id?: string; created_at?: string; updated_at?: string }, Partial<EventRow>>;
      event_artists: TableDef<EventArtistRow, Omit<EventArtistRow, 'id'> & { id?: string }, Partial<EventArtistRow>>;
      favorites: TableDef<FavoriteRow, Omit<FavoriteRow, 'id' | 'created_at'> & { id?: string; created_at?: string }, Partial<FavoriteRow>>;
      event_submissions: TableDef<EventSubmissionRow, Omit<EventSubmissionRow, 'id' | 'created_at'> & { id?: string; created_at?: string }, Partial<EventSubmissionRow>>;
      import_sources: TableDef<ImportSourceRow, Omit<ImportSourceRow, 'id' | 'created_at'> & { id?: string; created_at?: string }, Partial<ImportSourceRow>>;
      reports: TableDef<ReportRow, Omit<ReportRow, 'id' | 'created_at'> & { id?: string; created_at?: string }, Partial<ReportRow>>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type { ImportedEventDraft };
