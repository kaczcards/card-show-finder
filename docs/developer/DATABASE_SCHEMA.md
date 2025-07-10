# Database Schema Reference

> **Status**: _Initial draft – covers primary tables used in production.  \
> Update this file whenever migrations create / alter tables._

This document describes every **user-facing** table in the Card Show Finder Supabase PostgreSQL database.  
Secrets, keys and internal service-role credentials are **redacted** or replaced with placeholders.

---

## Conventions

* `uuid` primary keys unless noted  
* `TIMESTAMP WITH TIME ZONE` (`timestamptz`) for all temporal data  
* Table / column names are `snake_case`  
* **Row-Level Security (RLS)** is enabled on every table; policies are summarised below each table

---

## Table Index

| Table | Purpose |
|-------|---------|
| [`profiles`](#profiles) | Extended user profile linked 1-to-1 with Supabase `auth.users` |
| [`shows`](#shows) | Individual card-show events (one-off) |
| [`zip_codes`](#zip_codes) | Cached geolocation of ZIP codes for radius queries |
| [`broadcast_quotas`](#broadcast_quotas) | Remaining pre/post-show message credits for organizers |
| [`show_series`](#show_series) | Groups recurring shows under a single brand |
| [`show_participants`](#show_participants) | Dealers / attendees registered for a show |
| [`conversations`](#conversations) | Direct / group / show chat threads |
| [`conversation_participants`](#conversation_participants) | Users belonging to a conversation & their unread counts |
| [`messages`](#messages) | Chat messages with read receipts |
| *(dozens more utility tables live in `db_migrations/` – add here when promoted to production)* |

---

### `profiles`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | **PK**; equals `auth.users.id` |
| `email` | `text` | Convenience duplicate of auth email |
| `first_name` | `text` | Optional |
| `last_name` | `text` | Optional |
| `home_zip_code` | `text` | Used as fallback search centre |
| `role` | `text` | Enum-ish: `attendee`, `dealer`, `mvp_dealer`, `show_organizer`, `admin` |
| `favorite_shows` | `uuid[]` | Array of show IDs starred by user |
| `attended_shows` | `uuid[]` | History for badge system |
| `phone_number` | `text` | Visible to organizers (opt-in) |
| `profile_image_url` | `text` | Public avatar in Storage |
| `created_at` | `timestamptz` | Defaults `now()` |
| `updated_at` | `timestamptz` | Triggers keep in sync |

RLS  
* `SELECT`: everyone (public profiles)  
* `UPDATE` / `DELETE`: `id = auth.uid()`  
* `INSERT`: allowed during sign-up trigger

---

### `shows`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | **PK** |
| `title` | `text` | Show name |
| `location` | `text` | Venue heading (city, hall) |
| `address` | `text` | Full postal address |
| `start_date` | `timestamptz` | Inclusive |
| `end_date` | `timestamptz` | Inclusive |
| `entry_fee` | `numeric(10,2)` | Null = free |
| `description` | `text` | Markdown allowed |
| `image_url` | `text` | Storage public URL |
| `rating` | `numeric(2,1)` | Avg from reviews |
| `coordinates` | `geography(Point)` | PostGIS for radius queries |
| `status` | `text` | `active`, `upcoming`, `completed`, `cancelled` |
| `organizer_id` | `uuid` | FK → `auth.users.id` (nullable) |
| `features` | `jsonb` | Arbitrary flags (`on_site_grading`, …) |
| `categories` | `text[]` | e.g. `{sports,pokemon}` |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

Indexes  
* `GIST (coordinates)` for spatial search

RLS  
* `SELECT`: everyone  
* `INSERT`: any `authenticated` user (later restricted)  
* `UPDATE/DELETE`: only `organizer_id = auth.uid()`

---

### `zip_codes`

| Column | Type | Description |
|--------|------|-------------|
| `zip_code` | `text` | **PK** |
| `city` | `text` | |
| `state` | `text` | Two-letter |
| `latitude` & `longitude` | `numeric` | Decimal degrees |
| `created_at` | `timestamptz` | Insert timestamp |

RLS  
* `SELECT`: public  
* `INSERT`: any authenticated user (geo-cache writes)

---

### `broadcast_quotas`

| Column | Type | Description |
|--------|------|-------------|
| `organizer_id` | `uuid` | **PK** composite → profile |
| `show_id` | `uuid` | **PK** composite |
| `pre_show_remaining` | `int` | Default **2** |
| `post_show_remaining` | `int` | Default **1** |
| `last_updated` | `timestamptz` | For reset schedule |

RLS  
* Only owner organizer may `SELECT` / `UPDATE`  
* Reset Edge Function (`reset-broadcast-quotas`) runs as service role

---

### `show_series`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` | **PK** |
| `name` | `text` | Series title |
| `description` | `text` | |
| `organizer_id` | `uuid` | Can be `NULL` until claimed |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

RLS  
* `SELECT`: public  
* `UPDATE`: `organizer_id = auth.uid()`  
* `INSERT`: restricted to role `show_organizer`

---

### `show_participants`

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` | **PK** |
| `show_id` | `uuid` | FK → `shows.id` |
| `user_id` | `uuid` | FK → `auth.users.id` |
| `role_at_show` | `text` | `dealer`, `attendee`, `mvp_dealer` |
| `booth_number` | `text` | Dealers only |
| `created_at` | `timestamptz` | |

RLS  
* Row visible where `user_id = auth.uid()` OR user is show organizer

---

### `conversations`

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` | **PK** |
| `type` | `conversation_type` (`direct`,`group`,`show`) | |
| `show_id` | `uuid` | Nullable FK |
| `created_at` | `timestamptz` | |
| `last_message_text` | `text` | Cached preview |
| `last_message_timestamp` | `timestamptz` | Cached sort key |

RLS  
* `SELECT`: allowed if user is in `conversation_participants`  
* `INSERT`: anyone (participants added separately)

---

### `conversation_participants`

| Column | Type | Notes |
|--------|------|-------|
| `conversation_id` | `uuid` | **PK** composite |
| `user_id` | `uuid` | **PK** composite |
| `display_name` | `text` | Snapshot of profile name |
| `photo_url` | `text` | Snapshot avatar |
| `unread_count` | `int` | Server-side badge |
| `joined_at` | `timestamptz` | |

RLS  
* Row visible where `user_id = auth.uid()`

---

### `messages`

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` | **PK** |
| `conversation_id` | `uuid` | FK → `conversations.id` |
| `sender_id` | `uuid` | FK → `auth.users.id` |
| `message_text` | `text` | Sanitised markdown/plain |
| `created_at` | `timestamptz` | |
| `read_by_user_ids` | `uuid[]` | Append-only read receipts |

Indexes  
* `(conversation_id)`  
* `(created_at)` for pagination

RLS  
* `SELECT`: permitted if user in participants  
* `INSERT`: `sender_id = auth.uid()` and user in participants

---

## Helper Enums

| Enum | Values |
|------|--------|
| `conversation_type` | `direct` · `group` · `show` |

---

## Stored Procedures / RPCs (Pointers)

Edge-case business logic lives in SQL or Edge Functions:

* `find_filtered_shows(lat, lng, radius, date_range, filters)` – geospatial + attribute search  
* `create_broadcast_message(...)` – validates roles, inserts system message  
* `get_user_conversations(user_id)` – returns rich threads list  
* `mark_conversation_as_read(...)` – zeroes unread counters

Full details live in **[developer/EDGE_FUNCTIONS.md](EDGE_FUNCTIONS.md)**.

---

_Last regenerated: **[2025-07-10]** – commit `ab52d9c`_  
Run the schema exporter script or update manually after every migration.
