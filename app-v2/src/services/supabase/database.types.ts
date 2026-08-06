/**
 * Supabase Database schema types.
 *
 * Regenerate when migrations change (requires Docker + local Supabase):
 *   npm run gen:supabase-types
 *
 * Until CI can run `supabase gen types`, this file is maintained from mapper row
 * contracts and open tables for ancillary queries.
 */
import type { ArtistRow } from '@/data/mappers/artist-mapper';
import type { EventRow } from '@/data/mappers/event-mapper';
import type {
  ImportJobRow,
  ImportLogRow,
  ImportRecordRow,
  SourceRow,
} from '@/data/mappers/import-mapper';
import type { OrganizerRow } from '@/data/mappers/organizer-mapper';
import type { CityRow, CollectionRow, GenreRow } from '@/data/mappers/reference-mapper';
import type { VenueRow } from '@/data/mappers/venue-mapper';
import type { EntityFollowRow } from '@/features/follows/entity-follow-row';

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type TableDefinition<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

type OpenTable = TableDefinition<Record<string, Json>>;

export type Database = {
  public: {
    Tables: {
      events: TableDefinition<EventRow>;
      sources: TableDefinition<SourceRow>;
      import_records: TableDefinition<ImportRecordRow>;
      import_jobs: TableDefinition<ImportJobRow>;
      import_logs: TableDefinition<ImportLogRow>;
      import_audit_logs: OpenTable;
      artists: TableDefinition<ArtistRow>;
      venues: TableDefinition<VenueRow>;
      organizers: TableDefinition<OrganizerRow>;
      cities: TableDefinition<CityRow>;
      genres: TableDefinition<GenreRow>;
      collections: TableDefinition<CollectionRow>;
      event_artists: OpenTable;
      event_source_references: OpenTable;
      event_field_provenance: OpenTable;
      event_conflicts: OpenTable;
      duplicate_decisions: OpenTable;
      trust_quality_rules: OpenTable;
      import_review_queue: OpenTable;
      source_reputation_events: OpenTable;
      platform_operations_state: OpenTable;
      operations_backfill_jobs: OpenTable;
      source_intelligence_snapshots: OpenTable;
      connector_health_snapshots: OpenTable;
      worker_recovery_runs: OpenTable;
      event_lifecycle_history: OpenTable;
      event_lifecycle_changes: OpenTable;
      event_blocking_keys: OpenTable;
      event_match_evaluations: OpenTable;
      event_merge_candidates: OpenTable;
      entity_identity_aliases: OpenTable;
      entity_resolution_decisions: OpenTable;
      source_onboarding_jobs: OpenTable;
      entity_follows: TableDefinition<EntityFollowRow>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
