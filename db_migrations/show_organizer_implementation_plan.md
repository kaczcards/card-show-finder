# Show Organizer Phase 1 – Migration Implementation Plan
*(db_migrations/show_organizer_implementation_plan.md)*

---

## 1  Purpose

This document accompanies **`show_organizer_phase1.sql`** and explains **what** the migration does and **how** to run it safely.

Phase 1 introduces the database foundations required for Show Organizer functionality:

* Recurring-show relationships (parent / child)  
* Flexible per-show metadata (`extra_details`)  
* Review‐response support (organizer JSONB replies already exist)  
* Broadcast-message quota & logging  
* Secure RPC helpers and RLS policies

---

## 2  Schema Changes

| Table | Change | Notes |
|-------|--------|-------|
| `public.shows` | `parent_show_id UUID NULL`<br>`is_series_parent BOOLEAN DEFAULT FALSE`<br>`extra_details JSONB DEFAULT '{}'` | Enables recurring-series linking & flexible fields. |
| `public.profiles` | `broadcast_message_count INT DEFAULT 0`<br>`last_broadcast_reset_date TIMESTAMPTZ NULL` | Monthly broadcast quota tracking. |
| `public.broadcast_logs` *(new)* | `id UUID PK`<br>`organizer_id UUID FK → profiles(id)`<br>`show_id UUID FK → shows(id)`<br>`message_content TEXT (≤1000)`<br>`recipients TEXT[]`<br>`sent_at TIMESTAMPTZ` | Full audit of outgoing broadcasts. |
| Indexes | `shows_parent_show_id_idx`, `broadcast_logs_organizer_id_idx`, `broadcast_logs_show_id_idx`, `broadcast_logs_sent_at_idx` | Performance for common queries. |

---

## 3  Database Functions

| Function | Description |
|----------|-------------|
| `claim_show(show_id, organizer_id)` | Assigns ownership; cascades to children if the show is a series parent. |
| `get_aggregate_review_score(series_parent_id)` | Returns `average_rating` + `total_reviews` across parent + children. |
| `reset_broadcast_count(p_organizer_id)` | Resets monthly quota at first call each month. |

All are `SECURITY DEFINER` and executable by the `authenticated` role.

---

## 4  Row-Level Security (RLS)

* **`public.shows`** – Organizers may `UPDATE` only their own rows.  
* **`public.reviews`** – Organizer may `UPDATE organizer_response` for reviews of their shows (`is_show_organizer_for_review()` helper).  
* **`public.broadcast_logs`** – Organizer may `INSERT`/`SELECT` rows where `organizer_id = auth.uid()`.  

---

## 5  Running the Migration

1. Ensure you are on a safe branch (e.g. `feature/show-organizer-phase1`).  
2. Create/verify `.env` with:

   ```
   SUPABASE_URL=...
   SUPABASE_SERVICE_KEY=...   # service-role
   ```

3. Execute:

   ```bash
   cd db_migrations
   node execute_show_organizer_migration.js
   ```

   The script:

   * Uploads `show_organizer_phase1.sql` via the `pg_query` RPC.  
   * Verifies columns, tables, indexes, and functions.  
   * Logs any errors.

---

## 6  Post-Migration Manual Steps (⚠)

### 6.1 Recurring Series

* Identify each recurring show "parent".  
  ```sql
  UPDATE public.shows
  SET is_series_parent = TRUE
  WHERE id IN ('<parent-uuid1>', '<parent-uuid2>');
  ```
* Link child records:  
  ```sql
  UPDATE public.shows
  SET parent_show_id = '<parent-uuid1>'
  WHERE id IN ('<child-uuidA>', '<child-uuidB>');
  ```

### 6.2 Claimed Shows

If any `organizer_id` values already exist, confirm they are legitimate; otherwise `UPDATE … SET organizer_id = NULL` so organizers can reclaim through the new flow.

### 6.3 Review Back-Fill (optional)

If legacy organizer replies exist elsewhere, convert them to the JSONB structure:

```sql
UPDATE public.reviews
SET organizer_response = jsonb_build_object(
        'comment', legacy_reply_text,
        'date', NOW()
)
WHERE organizer_response IS NULL
  AND legacy_reply_text IS NOT NULL;
```

### 6.4 Quota Reset

If importing historical broadcast logs, remember to adjust `broadcast_message_count` and `last_broadcast_reset_date` accordingly.

---

## 7  Rollback Strategy

* **DDL**: Drop added columns & table, or restore from snapshot.
* **Functions**: `DROP FUNCTION IF EXISTS claim_show, get_aggregate_review_score, reset_broadcast_count;`
* **RLS**: Remove policies with `DROP POLICY …`.  
* **Data**: Review backups before rollback.

---

## 8  Next Steps (Phase 2 Preview)

* UI components for organizer dashboard (React Native).  
* Broadcast delivery (push / email) integration.  
* Payment tier enforcement on broadcast quotas.  
* Analytics on show view counts & review stats.

---

_Revision 1 – saved on implementation branch `feature/show-organizer-phase1`._
