# Card Show Finder – Recurring Shows Schema Update  
*(Branch: `implement-show-claiming-functionality`)*

## Why this change?
Many real-world card shows happen **regularly (monthly, quarterly, etc.)**.  
Treating every date as a totally separate “show” made it hard to:

* let an organizer “claim” the show once,
* collect reviews in one place, and
* send announcements to attendees.

So we introduced a **parent object** called **`show_series`** that represents the recurring show itself and links all its individual dates (events) together.

---

## What we actually changed

| Area | What we did | Why it matters |
|------|-------------|----------------|
| **Folder cleanup** | Deleted `card-show-finder-fix`, `card-show-finder-fixed`, `card-show-finder-new` | Removes confusion – we now work in a single project folder. |
| **Database migration** (`db_migrations/recurring_shows_schema.sql`) | • Created **`show_series`** table.<br>• Added `series_id` FK column to **`shows`**.<br>• Re-created **`reviews`** table so each review points to `series_id` (no more per-date reviews).<br>• Added two quota columns to **`profiles`**:<br>  `pre_show_broadcasts_remaining` (default 2)<br>  `post_show_broadcasts_remaining` (default 1) | Gives us the new data structure in Supabase and organizer messaging limits. |
| **Row-Level Security (RLS)** | Added friendly SELECT / INSERT / UPDATE / DELETE policies for `show_series` and `reviews`. | Keeps data secure while letting the right users modify their own content. |
| **TypeScript models** (`src/types/index.ts`) | • New **`ShowSeries`** interface.<br>• `Review` now stores `seriesId` (was `showId`).<br>• `User` interface now includes the two broadcast-quota fields. | Keeps the front-end type-safe with the new schema. |
| **UI component tweak** (`src/components/ReviewForm.tsx`) | Prop changed from `showId` → `seriesId`. | Matches the new review model. |
| **Git history** | Committed and pushed everything to branch `implement-show-claiming-functionality`. | Ready for PR & code review. |
| **PR helper** | Added **`pr_instructions.md`** explaining how to open the pull request (since GH CLI wasn’t logged in). | Makes it easy for a beginner to finish the PR. |

---

## How to apply the migration (once merged)

1. **Pull** the latest `main` after the PR is merged.
2. In your terminal, go to the project root and run:

   ```
   supabase db reset  # or supabase db push
   ```

   This will run `recurring_shows_schema.sql` and update your local Supabase database.  
   (If using the hosted project, run the migration in the Supabase dashboard instead.)

> **Tip:** Always back up production data first.

---

## What still needs to be done

| Priority | Task | Notes |
|----------|------|-------|
| 🔜 | **Update API queries** so all places that used `show_id` now use `series_id`. | Search for `shows()` / `reviews()` calls in codebase. |
| 🔜 | **Update UI screens** (ShowDetail, OrganizerDashboard, etc.) to display series-level reviews and info. | Components still assume single-date logic. |
| 🔜 | **Broadcast quota logic** – decrease the correct counter when an organizer sends a message. | Columns are there; code not yet implemented. |
| 🔜 | **Run the migration on staging / production**. | Follow the *How to apply* steps. |
| 🪄 | **Seed initial `show_series` rows** for existing shows. | Script needed to group past events. |
| 🧪 | **Add tests** for new queries and organizer permissions. | Jest & Supabase mocks. |
| 🎨 | **Polish UI wording** (e.g. “This series has 4.5★ from 87 reviews”). | After data is wired up. |

---

## Next steps for you (beginner-friendly)

1. **Finish the PR**  
   Follow `pr_instructions.md` and open the pull request on GitHub.

2. **Run the migration locally**  
   Make sure your dev database updates without errors.

3. **Click around the app**  
   Most screens will still work, but review features may break until we update queries.

4. **Tackle the “What still needs to be done” list**  
   Focus on one bullet at a time. Commit small, descriptive changes.

5. **Ask for help when stuck**  
   Post questions in the repo discussions or Slack – we’re here to help!

Happy coding and welcome to the new **Recurring Shows** world! 🚀
