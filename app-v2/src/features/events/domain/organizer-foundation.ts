/**
 * Organizer domain foundation (ER-005.4 / ER-010).
 *
 * Canonical organizers are persisted in `organizers` with `events.organizer_id`.
 * Legacy free-text `events.organizer` remains for unresolved import/display fallback.
 * Team membership and ownership remain deferred.
 */

export type OrganizerVerificationStatus = 'unverified' | 'pending' | 'verified';

export type OrganizerTeamRole =
  | 'owner'
  | 'admin'
  | 'editor'
  | 'promoter'
  | 'viewer';

export interface OrganizerFoundation {
  id: string;
  displayName: string;
  slug: string;
  verificationStatus: OrganizerVerificationStatus;
  createdBy: string;
}

export interface OrganizerMembershipFoundation {
  organizerId: string;
  userId: string;
  role: OrganizerTeamRole;
}
