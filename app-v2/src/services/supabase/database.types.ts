export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type TableDefinition<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      venues: TableDefinition<{
        id: string;
        name: string;
        address_line: string | null;
        postal_code: string | null;
        city: string | null;
        country_code: string | null;
        latitude: number | null;
        longitude: number | null;
        official_url: string | null;
        created_at: string;
        updated_at: string;
      }>;
      events: TableDefinition<{
        id: string;
        status: string;
        title: string;
        description: string | null;
        starts_at: string | null;
        ends_at: string | null;
        timezone: string | null;
        image_url: string | null;
        official_url: string | null;
        venue_id: string | null;
        organizer_name: string | null;
        created_by: string | null;
        published_at: string | null;
        created_at: string;
        updated_at: string;
      }>;
      event_lineup: TableDefinition<{
        id: string;
        event_id: string;
        billing_name: string;
        billing_role: string;
        sort_order: number;
        created_at: string;
      }>;
      event_genres: TableDefinition<{
        id: string;
        event_id: string;
        genre_key: string;
        display_name: string;
        raw_label: string | null;
        sort_order: number;
        created_at: string;
      }>;
      event_tickets: TableDefinition<{
        id: string;
        event_id: string;
        provider: string | null;
        ticket_url: string | null;
        price_from_minor: number | null;
        currency: string | null;
        sales_status: string | null;
        sort_order: number;
        created_at: string;
        updated_at: string;
      }>;
      event_sources: TableDefinition<{
        id: string;
        event_id: string;
        source_role: string;
        source_url: string | null;
        observed_at: string | null;
        verified_at: string | null;
        content_hash: string | null;
        raw_payload: Json | null;
        created_at: string;
      }>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
