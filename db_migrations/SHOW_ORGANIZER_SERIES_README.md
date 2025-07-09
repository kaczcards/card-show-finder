# Show Organizer – Series Implementation

This README documents the **Show Organizer Series** feature set: what changed in the database, why the new files exist, how to run the migration safely, how to test it, and what new end-user capabilities the backend now unlocks.

---

## 1  Overview

The legacy `parent_show_id` approach has been **replaced** by a dedicated `show_series` table that groups every occurrence of a recurring card show under one permanent identifier.  
With this change an organizer can “claim” the series once and automatically own every past & future instance, while reviews, ratings, and messaging quotas are now tracked at the series level.

---

## 2  File Guide

| File | Purpose |
|------|---------|
| **`show_organizer_series_implementation.sql`** | The primary DDL/DML migration: creates `show_series`, links `shows` & `reviews`, adds organizer broadcast quotas, new RLS, helper SQL functions (`claim_show_series`, `send_broadcast_message`, etc.). |
| **`execute_show_organizer_series_migration.js`** | Node script that uploads the SQL file via the Supabase `pg_query` RPC, then runs a suite of verification checks to confirm all key objects were created. |
| **`migrate_shows_to_series.js`** | One-off data migration that: 1) detects recurring shows, 2) inserts matching `show_series` rows, 3) rewires `shows` and `reviews` to point at the series, 4) assigns existing organizers, 5) seeds quota columns. |
| **Edge Function `send-broadcast`** *(updated)* | Accepts `broadcastType = "pre_show" | "post_show"` and enforces per-show quotas stored in `profiles.pre_show_broadcasts_remaining` / `post_show_broadcasts_remaining`. Logs each send in `broadcast_logs`. |
| **Edge Function `reset-broadcast-quotas`** *(updated)* | Resets an organizer’s quotas to **2 pre-show + 1 post-show** either nightly (cron) or immediately after a given show via `?show_id=<uuid>`. |
| **This README** | Step-by-step instructions & background. |

---

## 3  Migration Workflow

> ⚠️ Always test on a staging project first.

1. **Create .env** with `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` (service-role).
2. **Run the core migration**  
   ```bash
   cd db_migrations
   node execute_show_organizer_series_migration.js
   ```
   The script uploads `show_organizer_series_implementation.sql`, then prints a pass/fail report.
3. **Back-fill existing data**  
   ```bash
   node migrate_shows_to_series.js
   ```
   • Creates series, links shows & reviews, sets quotas.  
   • Review console summary for any errors.
4. **Deploy / update Edge Functions**  
   ```bash
   supabase functions deploy send-broadcast
   supabase functions deploy reset-broadcast-quotas
   ```
5. **(Optional) Schedule quota resets**  
   ```bash
   supabase functions schedule create nightly_quota_reset \
     --function reset-broadcast-quotas \
     --schedule "0 4 * * *" \
     --description "Reset quotas after each show day"
   ```

Rollback? Revert the SQL migration and restore a DB snapshot.

---

## 4  Testing Checklist

| What to test | Steps |
|--------------|-------|
| **Schema exists** | `select * from show_series limit 1;` etc. |
| **Claim flow** | Call `select claim_show_series('<series_id>','<organizer_id>');` then ensure `organizer_id` set. |
| **Review aggregation** | Insert reviews for two dated shows in same series → run `get_series_review_stats()` should include both. |
| **Pre-show quota** | Organizer sends two `pre_show` broadcasts → third attempt returns 429 with `QUOTA_EXCEEDED`. |
| **Post-show quota** | After show date passes, run `reset-broadcast-quotas?show_id=` → quotas reset to 2/1. |
| **RLS** | Try updating series as non-organizer → should fail. |

Edge Function endpoints can be invoked with curl or Postman using a valid organizer JWT.

---

## 5  User-Facing Features Enabled

1. **Claim This Show** – An organizer presses “Claim” once and gains edit rights & messaging power for the whole recurring series.
2. **Persistent Reviews** – Review list on any show date now shows the full historic feed; average rating and count reflect all occurrences.
3. **Organizer Replies** – Organizers can publicly reply to any review linked to their series.
4. **Targeted Broadcasts** – 2 announcements before each show + 1 follow-up after, delivered to dealers/attendees, with automatic quota enforcement.
5. **Automatic Quota Reset** – Quotas clear after each show ends, no manual intervention.

---

Happy shipping!
