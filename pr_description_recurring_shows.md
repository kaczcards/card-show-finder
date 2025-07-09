# ✨ Recurring Shows & Organizer Messaging – Major Backend & App Upgrade

## Overview
This PR introduces **recurring show series** to Card Show Finder.  
Instead of treating every show date as a separate entity, a new parent table – `show_series` – groups all instances of the same card show (e.g. *“Noblesville Card Show”*).  

Key goals:
* Aggregate ratings & reviews across multiple dates  
* Let an organizer **claim the series once** and manage all future dates  
* Provide built-in broadcast quotas so organizers can message attendees without spam

---

## 🔨 What’s Changed

| Area | Change |
|------|--------|
| **Database (schema)** | • New `show_series` table <br>• `shows.series_id` foreign key <br>• Re-created `reviews` to reference `series_id` <br>• Added `pre_show_broadcasts_remaining` (default 2) & `post_show_broadcasts_remaining` (default 1) to `profiles` |
| **Data migration** | One-time script (`data_migration_series.sql`) <br>• Groups existing shows into series <br>• Updates all `shows` and `reviews` with `series_id` <br>• Calculates `average_rating` / `review_count` for each series |
| **Edge Functions** | • `claim_show_series` – organizers claim an unclaimed series <br>• `send_broadcast_message` – bulk message to attendees/favorites, quota-checked <br>• `reset-broadcast-quotas` – daily job resets quotas after a show ends |
| **App Code** | • `ShowDetailScreen` now displays series badge, combined rating & reviews <br>• New `showSeriesService` for series queries, claiming & broadcast <br>• `ReviewForm` now posts to `seriesId` |
| **Utilities** | Transaction helper SQL functions for safe multi-step logic in Edge Functions |
| **Docs** | Implementation & migration instructions added |

---

## 🌟 Benefits

* **Unified reputation:** Users see one rating stream per recurring show, leading to more trustworthy scores.  
* **Simple organizer workflow:** Claim once, manage forever; no more per-date claiming.  
* **Controlled communication:** Pre/post-show quotas curb spam yet keep attendees informed.  
* **Foundation for growth:** Opens path to season passes, recurring reminders, analytics, etc.

---

## 🧪 How to Test

1. **Run migrations:** `supabase db push && supabase db execute db_migrations/data_migration_series.sql`  
2. **Open the app:**  
   * Show detail page should display *“Part of the XYZ Series”* badge.  
   * Reviews list shows combined reviews from previous dates.  
3. **Claim flow:**  
   * Log in as a *show_organizer* test user.  
   * Tap **“Claim This Show Series”** → should set `organizer_id`.  
4. **Broadcast flow:**  
   * From the same screen tap **Broadcast** → send message → quota decrements.  
5. **Quota reset:**  
   * Manually run `supabase functions invoke reset-broadcast-quotas` and confirm quotas reset for organizers of shows that ended yesterday.

---

## ✅ Pull-Request Checklist

- [x] Schema migration added  
- [x] Data migration script **idempotent** & backed up original reviews  
- [x] RLS reviewed for `show_series` & `reviews`  
- [x] Edge functions deployed & tested locally  
- [x] App builds and displays series info without regression  
- [x] Documentation: `implementation_summary.md`, `migration_instructions.md`  

---

### Breaking Changes
* Old `reviews.show_id` is **deprecated** – all queries must use `series_id`. A full code search was completed, but please review any feature branches.

---

### Related Issues
Closes #48, closes #72  
*(Adds groundwork for #91 – recurring-show analytics dashboard.)*

---

Happy reviewing! 🎉
