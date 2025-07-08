# How to Create the Pull Request (PR) Manually

Follow these quick steps to open your PR on GitHub and share the new **recurring-shows database schema** work.

---

## 1. Open the Compare & PR Page

1. Go to the repository in your browser  
   `https://github.com/kaczcards/card-show-finder`
2. GitHub usually shows a yellow banner saying **“Compare & pull request”** for recently pushed branches.  
   • If you see it, click that button and skip to **Step 3**.  
   • If you don’t, click **“Pull requests”** in the top menu, then **“New pull request”**.

---

## 2. Select Branches to Compare

| Field            | Value to choose                              |
|------------------|----------------------------------------------|
| **base:**        | `main` (this is the branch you want to merge **into**) |
| **compare:**     | `implement-show-claiming-functionality` (the branch you just pushed) |

GitHub will show the commits and file changes.  
If everything looks correct, click **“Create pull request”**.

---

## 3. Fill Out the PR Form

Copy-paste (or adapt) the following:

### Title
```
Implement database schema for recurring shows (show_series) and organizer quotas
```

### Description
```
This PR introduces the new database architecture for recurring card shows:

### Key changes
- **show_series** table: core identity for recurring shows.
- Added **series_id** FK to `shows`.
- Re-created **reviews** table to reference `series_id` (one rating stream per series).
- Added `pre_show_broadcasts_remaining` and `post_show_broadcasts_remaining` columns to `profiles`.
- Added full migration script: `db_migrations/recurring_shows_schema.sql`.
- Updated TypeScript types and ReviewForm component to match the new schema.

### Why
Allows organizers to claim a single recurring show entity, aggregate reviews, and manage broadcast quotas.

---

✅  Please review and merge when ready.  
```


---

## 4. Create the PR

Click **“Create pull request”** (green button).  
That’s it! GitHub will take care of the rest and show your PR for review.

---

### Need to edit later?

1. Open the PR page.
2. Click the **“⋯”** menu or **“Edit”** button near the title.
3. Update the title or description, then click **“Save”**.

Happy coding! :tada:
