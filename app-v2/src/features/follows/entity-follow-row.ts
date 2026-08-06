export type FollowEntityType = 'organizer' | 'venue' | 'artist';

export interface EntityFollowRow {
  id: string;
  user_id: string;
  entity_type: FollowEntityType;
  entity_id: string;
  followed_at: string;
  created_at: string;
}
