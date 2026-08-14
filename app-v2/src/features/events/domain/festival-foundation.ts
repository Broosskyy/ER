export type VenueType = 'club' | 'open_air' | 'festival' | 'warehouse' | 'other';

export interface FestivalRecord {
  id: string;
  slug: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}
