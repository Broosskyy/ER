/**
 * Data governance foundation (ER-005.5) — planning types only.
 *
 * Tracks provenance for events and future content without requiring schema now.
 */

export type DataSourceType =
  | 'contributor'
  | 'admin'
  | 'import'
  | 'organizer_sync'
  | 'automation';

export interface DataProvenanceFoundation {
  source: DataSourceType;
  sourceUrl?: string;
  sourceType?: string;
  importedAt?: string;
  lastCheckedAt?: string;
  confirmedBy?: string;
  confidenceScore?: number;
}
