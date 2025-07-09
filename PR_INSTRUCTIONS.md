# How to Create the Pull Request (PR)

Follow these steps to open a PR for the **Show Organizer Series** feature branch.

---

## 1  Prerequisites

- Local branch pushed: `feature/show-organizer-roles`
- All CI checks passing locally (`npm run lint`, tests, etc.).
- You have permission to open PRs in `kaczcards/card-show-finder`.

---

## 2  Open the PR on GitHub

1. **Navigate to the repository**

   ```
   https://github.com/kaczcards/card-show-finder
   ```

2. If GitHub has detected the new branch you will see a **“Compare & pull request”** banner.  
   • Click **“Compare & pull request”** – *or* –  
   • Manually select **“Pull requests” → “New pull request”**, then choose:

   | Base | Compare |
   |------|---------|
   | `main` | `feature/show-organizer-roles` |

3. Verify the diff looks correct (mostly files under `db_migrations/` and `supabase/functions/`).

---

## 3  Fill in PR Details

| Field | What to enter |
|-------|---------------|
| **Title** | `Show Organizer Series: Recurring Show Support` |
| **Description** | Copy-paste the block below (edit if needed). |

```
### Overview
Implements the *Show Organizer Series* feature set, replacing legacy `parent_show_id` logic with a dedicated `show_series` table. Adds per-show broadcast quotas, updated Edge Functions, and one-off data migration scripts.

### What’s Included
- `show_organizer_series_implementation.sql` – core schema & helper functions
- Updated Edge Functions (`send-broadcast`, `reset-broadcast-quotas`)
- Scripts: `execute_show_organizer_series_migration.js`, `migrate_shows_to_series.js`
- README with migration/testing steps

### Checklist
- [ ] SQL migration tested in local Supabase project
- [ ] Data migration script completed without errors
- [ ] Edge Functions deployed & tested (`supabase functions deploy ...`)
- [ ] Mobile app works against new schema
```

| Field | Recommended value |
|-------|-------------------|
| **Reviewers** | `@kaczcards/maintainers` |
| **Labels** | `feature`, `backend`, `database` |
| **Project / Milestone** | *Choose current sprint or release* |

---

## 4  Create the PR

- Click **“Create pull request”**.
- Wait for GitHub Actions to run. Confirm all checks pass.

---

## 5  Post-Creation Checklist

- [ ] Respond to review comments promptly.
- [ ] Once **approved** and **CI green**, merge with **“Squash & merge”**.
- [ ] After merge, run the migration in production and deploy Edge Functions.

---

Happy shipping! 🎉
