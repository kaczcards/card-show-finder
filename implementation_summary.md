# Card Show Finder – Recurring Shows Implementation Summary

Welcome!  
This document walks you through **everything we added or changed** to support recurring (“monthly”, “quarterly”, etc.) card shows in one easy-to-read place.  
If you are new to Supabase, SQL, or React Native, read each section in order and you’ll know what’s going on. 🚀

---

## 1. Database (Schema) Changes

| Table | New / Updated columns | Why |
|-------|-----------------------|-----|
| **`show_series`** (NEW) | `id`, `name`, `organizer_id`, `description`, `created_at` | Represents the *parent* entity for a recurring show (e.g., **“Noblesville Card Show”**). |
| **`shows`** | `series_id` (FK → `show_series.id`) | Links every individual date to its parent series. |
| **`reviews`** | **Re-created** so each review stores **`series_id`** (not `show_id`). | Lets us aggregate star ratings across all dates of the series. |
| **`profiles`** | `pre_show_broadcasts_remaining` (_int_, default 2)  <br> `post_show_broadcasts_remaining` (_int_, default 1) | Tracks how many bulk messages an organizer can still send **before** or **after** a show. |

Row-Level Security (RLS) policies were updated/added so:
* Anyone can read `show_series` and `reviews`.
* Only an organizer can modify their own series or their own reviews.

---

## 2. One-Time **Data Migration** (`db_migrations/data_migration_series.sql`)

What it does, step-by-step:

1. **Groups** existing rows in `shows` by *title + location + address* to decide which ones belong to the same series.  
2. **Creates** one `show_series` record per group and remembers the new `series_id`.
3. **Updates** every old `shows` row with this `series_id`.
4. **Moves reviews**: for each old `reviews.show_id` it copies the review to the new table with the correct `series_id`. (If a user reviewed several dates, we keep the most recent one.)
5. **Calculates** `average_rating` + `review_count` for every series.
6. **Backs up** the original reviews to `reviews_backup_before_series_migration`.

Run it once after the schema migration (see “How to run migrations” below).

---

## 3. Backend / Edge Functions (Supabase)

| Function | Path | Purpose |
|----------|------|---------|
| **`claim_show_series`** | `supabase/functions/claim_show_series` | Lets a user with role **`show_organizer`** claim an unclaimed series (sets `organizer_id`). RLS prevents others from hijacking it. |
| **`send_broadcast_message`** | `supabase/functions/send_broadcast_message` | Sends a bulk message to attendees / favorites of a show or entire series. Checks & decrements the correct quota column before sending. |
| **`reset-broadcast-quotas`** (scheduled) | `supabase/functions/reset-broadcast-quotas` | Runs daily; finds shows that *just ended* and resets the organizer’s quotas back to 2 / 1 for the next show cycle. |
| **Transaction helpers** | `db_migrations/transaction_helpers.sql` | Adds `begin_transaction() / commit_transaction() / rollback_transaction()` so Edge Functions can run multi-step DB actions safely. |
| **Shared CORS** | `supabase/functions/_shared/cors.ts` | Standard CORS headers reused by all functions. |

Environment requirements:
```
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY (for scheduled job)
```

---

## 4. Mobile App Updates (React Native / Expo)

### Type & Model Changes
* `Show` now has optional `seriesId`.
* Added new `ShowSeries` interface.
* `Review` uses `seriesId` instead of `showId`.
* `User` gained the two quota fields.

### New / Updated Code
* **`src/services/showSeriesService.ts`**  
  Wrapper for listing series, claiming, sending broadcasts, etc.
* **`ReviewForm`** component: prop renamed to `seriesId`.
* **`ShowDetailScreen`**:  
  * Shows “Part of the \<series name\>” badge, series-level star rating, and aggregated reviews list.  
  * Organizer can **claim the series** or open the **Broadcast** modal.  
  * Review modal now creates a series review.
* **Navigation / Context** untouched – all changes are local to this screen & service.

---

## 5. How to Run Everything (Dev)

1. **Migrate schema**  
   ```bash
   supabase db push  # applies *.sql in db_migrations
   ```
2. **Run data migration** (once)  
   ```bash
   supabase db execute db_migrations/data_migration_series.sql
   ```
3. **Deploy Edge Functions**  
   ```bash
   supabase functions deploy claim_show_series
   supabase functions deploy send_broadcast_message
   supabase functions deploy reset-broadcast-quotas
   ```
4. **Start the app**  
   ```bash
   npm start        # or expo start
   ```
5. Test the flow: open a show ➜ see series badge ➜ leave a review ➜ claim series ➜ send broadcast.

---

## 6. Production Checklist

1. **Backup DB** in Supabase dashboard.
2. Apply **schema** + **data** migrations (same commands as dev).
3. `supabase functions deploy ...` (service-role key required).
4. Release new mobile build (build & submit).

---

## 7. What’s Still TODO

* Refactor other screens (Map, My Shows, Organizer Dashboard) to use `seriesId`.
* Automated Jest tests for:
  * `showSeriesService`
  * Edge Function responses
  * RLS policies (via Supabase test runner)
* Seed script to retro-claim series for existing organizers (optional).

---

### FAQ (Beginner Friendly)

**Q: Why did we move reviews to `series_id`?**  
> Users want to see a show’s reputation over time; no one wants to hunt for reviews date-by-date.

**Q: What if a show only happens once?**  
> It still gets a `show_series` row; there’s just one date inside it.

**Q: Where do the quotas reset numbers (2 & 1) come from?**  
> Product decision: organizers get **2** blasts in the weeks **before** an event, and **1** follow-up afterwards.

---

Happy coding & collecting! 🎉
