/**
 * Organizer domain foundation (ER-005.4) — planning types only.
 *
 * Organizers are not yet persisted. Pipeline/import use free-text `organizer`.
 * Future: dedicated `organizers` table + membership + team roles.
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
