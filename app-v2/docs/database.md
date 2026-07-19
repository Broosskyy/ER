# Database Schema

Migration: `supabase/migrations/20260719000000_initial_schema.sql`

## Tables

### events
| Column | Type | Notes |
|---|---|---|
| id | text PK | |
| title | text | required |
| subtitle | text | optional |
| description | text | |
| genre_id | text FK → genres | |
| venue_id | text FK → venues | |
| city_id | text FK → cities | |
| artist_id | text FK → artists | |
| source_id | text FK → sources | |
| collection_id | text FK → collections | |
| start_date | timestamptz | |
| end_date | timestamptz | optional |
| ticket_url | text | |
| image_url | text | |
| status | text | draft, review, published, archived, deleted |
| created_at / updated_at | timestamptz | |

### genres
id, name, slug, icon, color, active, sort_order

### cities
id, name, slug, country, active

### venues
id, name, address, city_id, latitude, longitude, website, instagram

### artists
id, name, spotify, instagram, website

### collections
id, title, slug, description, cover, active, sort_order

### sources
id, name, type, website, trust_score, active

## Storage Buckets

- `events`
- `artists`
- `venues`
- `collections`

## Row Level Security

| Role | Access |
|---|---|
| Anonymous | Read published events + active reference data |
| Authenticated | Full CRUD (editor/admin refinement in Sprint 12) |

## Status Lifecycle

```
draft → review → published → archived
                    ↓
                 deleted
```

## Apply Migration

```bash
supabase db push
```

Or run the SQL file in the Supabase SQL editor.
