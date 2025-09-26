# Shows Table Schema Documentation

This document provides comprehensive information about the `shows` table in the Supabase database, including all field definitions, data types, constraints, and usage examples.

## Table Overview

The `shows` table stores information about trading card shows and events. It is the central table for show data in the Card Show Finder application.

**Table Name**: `public.shows`
**Primary Key**: `id` (UUID)
**Owner**: `postgres`

## Field Definitions

### Core Identity Fields

| Field | Data Type | Constraints | Default | Description |
|-------|-----------|-------------|---------|-------------|
| `id` | `uuid` | NOT NULL, PRIMARY KEY | `extensions.uuid_generate_v4()` | Unique identifier for each show |
| `title` | `text` | NOT NULL | - | Show name/title (e.g., "Dallas Card Show") |
| `status` | `text` | - | `'ACTIVE'` | Show status (ACTIVE, CANCELLED, POSTPONED, etc.) |

### Location and Venue Fields

| Field | Data Type | Constraints | Default | Description |
|-------|-----------|-------------|---------|-------------|
| `location` | `text` | NOT NULL | - | City and state (e.g., "Dallas, TX") |
| `address` | `text` | NOT NULL | - | Full street address of venue |
| `coordinates` | `public.geography(Point,4326)` | - | - | PostGIS geography point for spatial queries |

### Date and Time Fields

| Field | Data Type | Constraints | Default | Description |
|-------|-----------|-------------|---------|-------------|
| `start_date` | `timestamp with time zone` | NOT NULL | - | Show start date and time |
| `end_date` | `timestamp with time zone` | NOT NULL | - | Show end date and time |
| `created_at` | `timestamp with time zone` | - | `now()` | Record creation timestamp |
| `updated_at` | `timestamp with time zone` | - | `now()` | Record last update timestamp |

### Financial and Rating Fields

| Field | Data Type | Constraints | Default | Description |
|-------|-----------|-------------|---------|-------------|
| `entry_fee` | `numeric(10,2)` | - | - | Entry fee in dollars (nullable for free shows) |
| `rating` | `numeric(2,1)` | - | - | Show rating from 0.0 to 5.0 |

### Content and Media Fields

| Field | Data Type | Constraints | Default | Description |
|-------|-----------|-------------|---------|-------------|
| `description` | `text` | - | - | Detailed show description |
| `image_url` | `text` | - | - | URL to show promotional image |

### Relationship Fields

| Field | Data Type | Constraints | Default | Description |
|-------|-----------|-------------|---------|-------------|
| `organizer_id` | `uuid` | FOREIGN KEY | - | References `profiles.id` of show organizer |
| `series_id` | `uuid` | FOREIGN KEY | - | References `show_series.id` if part of series |

### Structured Data Fields

| Field | Data Type | Constraints | Default | Description |
|-------|-----------|-------------|---------|-------------|
| `features` | `jsonb` | - | `'{}'::jsonb` | Show features (parking, food, WiFi, etc.) |
| `categories` | `text[]` | - | `'{}'::text[]` | Show categories (sports, pokemon, magic, etc.) |

## Data Type Details

### UUID Fields
- **Format**: Standard UUID v4 format (e.g., `123e4567-e89b-12d3-a456-426614174000`)
- **Generation**: Auto-generated using `extensions.uuid_generate_v4()`
- **Usage**: Primary keys and foreign key relationships

### Text Fields
- **Encoding**: UTF-8
- **Length**: Variable length, no explicit limit
- **Null Handling**: NOT NULL fields must have non-empty values

### Numeric Fields
- **entry_fee**: `numeric(10,2)` - Up to 10 digits total, 2 decimal places (e.g., `99999999.99`)
- **rating**: `numeric(2,1)` - Up to 2 digits total, 1 decimal place (e.g., `5.0`)

### Timestamp Fields
- **Format**: ISO 8601 with timezone (e.g., `2025-01-15T10:00:00+00:00`)
- **Timezone**: Stored with timezone information
- **Default**: `now()` function for audit fields

### Geography Field (coordinates)
- **SRID**: 4326 (WGS84 - World Geodetic System 1984)
- **Type**: Point geometry for latitude/longitude coordinates
- **Format**: PostGIS geography type for accurate distance calculations
- **Usage**: Spatial queries, distance-based filtering

### JSONB Field (features)
- **Format**: Binary JSON for efficient queries and indexing
- **Structure**: Key-value pairs for show features
- **Example**:
  ```json
  {
    "parking": true,
    "food_available": true,
    "wifi": false,
    "air_conditioning": true,
    "wheelchair_accessible": true
  }
  ```

### Array Field (categories)
- **Type**: Array of text values
- **Usage**: Multiple category assignment per show
- **Example**: `['sports_cards', 'pokemon', 'magic_the_gathering']`

## Common Query Patterns

### Inserting a New Show
```sql
INSERT INTO public.shows (
  title, location, address, start_date, end_date, 
  entry_fee, description, coordinates, organizer_id,
  features, categories
) VALUES (
  'Dallas Card Show',
  'Dallas, TX',
  '123 Main St, Dallas, TX 75201',
  '2025-02-15T09:00:00-06:00',
  '2025-02-15T17:00:00-06:00',
  5.00,
  'Family-friendly card show featuring sports cards and Pokemon',
  ST_SetSRID(ST_MakePoint(-96.7970, 32.7767), 4326)::geography,
  '123e4567-e89b-12d3-a456-426614174000',
  '{"parking": true, "food_available": true}',
  ARRAY['sports_cards', 'pokemon']
);
```

### Spatial Queries (Finding Nearby Shows)
```sql
SELECT *, 
  ST_Distance(
    coordinates::geography,
    ST_SetSRID(ST_MakePoint(-96.7970, 32.7767), 4326)::geography
  ) / 1609.34 AS distance_miles
FROM public.shows
WHERE ST_DWithin(
  coordinates::geography,
  ST_SetSRID(ST_MakePoint(-96.7970, 32.7767), 4326)::geography,
  25 * 1609.34  -- 25 miles in meters
)
AND status = 'ACTIVE'
AND start_date >= CURRENT_DATE
ORDER BY distance_miles;
```

### Feature-Based Filtering
```sql
SELECT *
FROM public.shows
WHERE features @> '{"parking": true, "food_available": true}'
AND categories && ARRAY['pokemon', 'magic_the_gathering']
AND entry_fee <= 10.00;
```

## Validation Rules

### Coordinate Validation
- Latitude: -90.0 to 90.0
- Longitude: -180.0 to 180.0
- Not at (0,0) "Null Island"

### Date Validation
- `end_date` should be >= `start_date`
- `start_date` should be in the future for new shows

### Rating Validation
- Range: 0.0 to 5.0
- One decimal place precision

### Entry Fee Validation
- Non-negative values only
- Maximum: $99,999,999.99

## Index Recommendations

The following indexes are recommended for optimal query performance:

1. **Spatial Index**: `coordinates` (PostGIS GIST index)
2. **Date Range Index**: `(start_date, end_date)`
3. **Status Filter Index**: `status`
4. **Organizer Lookup Index**: `organizer_id`
5. **JSONB Index**: `features` using GIN
6. **Array Index**: `categories` using GIN

## Security and Permissions

Row Level Security (RLS) is enabled on this table with the following policies:

- **Public Read**: Anyone can view active shows
- **Organizer Write**: Only show organizers can modify their own shows
- **Admin Full Access**: Admins have full CRUD permissions

## Related Tables

- `profiles`: Organizer information (`organizer_id` → `profiles.id`)
- `show_series`: Series grouping (`series_id` → `show_series.id`)
- `user_favorite_shows`: User favorites (`shows.id` → `user_favorite_shows.show_id`)
- `show_participants`: Show participants (`shows.id` → `show_participants.showid`)
- `reviews`: Show reviews (`shows.id` → `reviews.show_id`)

## API Functions

The following RPC functions work with the shows table:

- `get_paginated_shows()`: Fetch shows with spatial and filter criteria
- `get_show_details_by_id()`: Get detailed show information
- `create_show_with_coordinates()`: Create a new show with validated coordinates

## Notes for Developers

1. **Always use PostGIS functions** for coordinate operations to ensure accuracy
2. **Include timezone information** in all datetime operations
3. **Validate coordinates** before insertion to prevent invalid geography points
4. **Use JSONB operators** (`@>`, `?`, `?&`, `?|`) for efficient feature queries
5. **Consider array overlap operators** (`&&`) for category filtering
6. **Handle NULL values** appropriately, especially for optional fields like `entry_fee` and `rating`

## Migration History

This table has been modified by the following key migrations:

- Initial creation: Basic show structure
- `20240710_update_nearby_shows_function.sql`: Added spatial query capabilities
- `20250722000000_canonical_database_consolidation.sql`: Standardized structure and policies
- Various migrations: Added features, categories, and other enhancements

---

*Last updated: 2025-09-26*
*Version: 1.0*