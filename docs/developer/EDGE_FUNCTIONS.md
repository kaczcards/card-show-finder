# Supabase Edge Functions API Reference

Edge Functions extend the backend with server-side TypeScript that cannot be expressed efficiently in pure SQL.  
Source code lives in **`supabase/functions/`** and is deployed via `scripts/deploy-edge-functions.sh`.

| Function | Purpose |
|----------|---------|
| `send-broadcast` | Send mass message from Organizer / MVP Dealer to a role-based audience with **quota enforcement**. |
| `claim_show_series` | Allows organizers to claim ownership of an unclaimed recurring series. |
| `reset-broadcast-quotas` | Nightly CRON job that resets message-quota counters in `broadcast_quotas`. |
| `scraper-agent` | Scheduled crawler that ingests raw show data from public websites into a holding table. |
| `data-processor` | Post-scrape transformer that validates & upserts cleaned shows into the live `shows` table. |

Each section documents **endpoint**, **input**, **output**, and **auth requirements**.

---

## 1 · `send-broadcast`

`POST https://[YOUR_PROJECT].functions.supabase.co/send-broadcast`

### Headers
```
Authorization: Bearer <user.jwt>
Content-Type: application/json
```

### Request Body
```json
{
  "sender_id": "uuid",            // required – Supabase user ID
  "show_id": "uuid",              // required – target show (needed for quotas)
  "recipient_roles": ["attendee"],// required – lowercase role names
  "message": "Free grading ends at 5 PM!",  // required
  "is_pre_show": true             // optional override for testing
}
```

### Response
| Field | Type | Notes |
|-------|------|-------|
| `success` | `boolean` | `true` when insert succeeds |
| `conversation_id` | `uuid` | New conversation containing the announcement |
| `quota_remaining` | `object` | `{ "pre_show": number, "post_show": number }` |
| `message` | `string` | Human-readable status / error |

### Auth & Business Rules
* **Roles**  
  * `show_organizer` – may target any roles (`attendee`, `dealer`, `mvp_dealer`).  
  * `mvp_dealer` – may target **attendees only** and must be registered for the show.
* **Quotas** – `broadcast_quotas` table tracks **2** pre-show + **1** post-show messages per organizer per show.
* All inputs are validated & HTML stripped; messages >1000 chars are truncated.

---

## 2 · `claim_show_series`

`POST https://[YOUR_PROJECT].functions.supabase.co/claim_show_series`

### Headers
```
Authorization: Bearer <user.jwt>
Content-Type: application/json
```

### Request Body
```json
{
  "seriesId": "uuid"   // required – target show_series.id
}
```

### Response
| Field | Type | Notes |
|-------|------|-------|
| `message` | `string` | Success / error text |
| `series` | `object` | Updated series row `{ id, name, organizer_id }` |
| `error` | `string` | Present only when `series` is null |

### Auth & Business Rules
* Caller **must** be authenticated and have role `show_organizer`.
* Fails with **409 Conflict** if the series is already claimed.
* On success sets `show_series.organizer_id = caller.id`.

---

## 3 · `reset-broadcast-quotas`

`POST https://[YOUR_PROJECT].functions.supabase.co/reset-broadcast-quotas`

> **Invocation**: Scheduled daily at `03:00 UTC` by the Supabase scheduler.

### Headers
_No user headers required – runs with **service-role key** inside the scheduler container._

### Request Body
```json
{}   // empty
```

### Response
| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | True when quotas updated |
| `rows_reset` | `integer` | Number of `broadcast_quotas` rows reset |
| `message` | `string` | Info / error text |

### Logic
* Sets `pre_show_remaining = 2`, `post_show_remaining = 1` for **all** rows.
* Updates `last_updated` timestamp.
* Idempotent – safe to run multiple times.

---

## 4 · `scraper-agent`

`POST https://[YOUR_PROJECT].functions.supabase.co/scraper-agent`

> **Invocation**: Scheduled **hourly**. Can also be run ad-hoc for debugging.

### Headers
_No user headers – invoked by scheduler with service-role key._

### Request Body
```json
{
  "mode": "full" // "full" (default) scrapes all sources, "single" limits to one URL (dev only)
}
```

### Response
| Field | Type | Notes |
|-------|------|-------|
| `success` | `boolean` | |
| `source_count` | `integer` | Number of websites scraped |
| `shows_found` | `integer` | Raw show rows inserted into holding table |
| `message` | `string` | Status text |

### Logic & Tables
* Fetches HTML / RSS feeds from configured sources list.
* Extracted rows are inserted into **`holding_shows_raw`** (staging table) with minimal validation.
* Does **not** touch production `shows` table – hand-off to **`data-processor`**.

---

## 5 · `data-processor`

`POST https://[YOUR_PROJECT].functions.supabase.co/data-processor`

> **Invocation**: Triggered by `scraper-agent` completion or manually.

### Headers
_No auth required when invoked via internal chain; manual calls must use service-role key._

### Request Body
```json
{
  "dry_run": false  // when true validates but does not write to production
}
```

### Response
| Field | Type | Notes |
|-------|------|-------|
| `success` | `boolean` | |
| `validated` | `integer` | Raw rows checked |
| `inserted` | `integer` | New shows upserted to `shows` |
| `duplicates` | `integer` | Rows skipped as existing |
| `message` | `string` | Details / error text |

### Processing Steps
1. Reads rows from `holding_shows_raw` created within last 2 h.  
2. Validates required fields (title, dates, address).  
3. Geocodes address → lat/lng (Google Maps).  
4. If `dry_run = false`, upserts into `shows` (detects dupes by **title + start_date + city**).  
5. Marks processed rows with `processed_at` timestamp.

---

## Error Handling (All Functions)

* Returns **4xx** for client errors (`400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`, `409 Conflict`).  
* Returns **5xx** for unexpected server errors with `message` detailing cause (never includes stack traces in production).

---

_Last updated: **2025-07-10** – commit `ab52d9c`_  
Add a new section whenever you create or modify an Edge Function.
