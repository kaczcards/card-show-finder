# 📦 Card Show Finder – Database & Edge Function Deployment Guide

A **beginner-friendly, copy-paste** checklist for getting the new **recurring-shows** backend running in **any** Supabase project (local or production).

---

## 0. What You’ll Need

| Tool | Why you need it | Install |
|------|-----------------|---------|
| **Supabase CLI** | Runs migrations & deploys Edge Functions | `npm i -g supabase` |
| **Git** | Pull the latest code | <https://git-scm.com> |
| **Node 16+** | Required by the CLI & functions | <https://nodejs.org> |

You also need:

* Your **Supabase project URL** & **Anon** and **Service Role** keys (find them in Project → Settings → API).
* A terminal (macOS Terminal, Windows PowerShell, etc.).

---

## 1. Pull the latest code

```bash
git checkout main
git pull
# Switch to the branch that contains the migrations
git checkout implement-show-claiming-functionality
```

---

## 2. Set your environment variables

Create a file called `.env.local` in the project root:

```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key   # needed for scheduled job
```

The Supabase CLI will automatically pick these up.

---

## 3. (Optional) Start Supabase locally

Skip this if you only work against the hosted project.

```bash
supabase start
```

This spins up Postgres + the Supabase stack on `localhost:54321`.

---

## 4. Run the **schema** migrations

```bash
# Runs every *.sql inside /db_migrations in alphabetical order
supabase db push
```

You should see logs ending with:

```
Transaction helper functions created successfully
```

No errors? Great → go to the next step.

---

## 5. Run the **data** migration script  
(one-time operation)

```bash
supabase db execute db_migrations/data_migration_series.sql
```

Watch for:

```
Data migration completed successfully!
```

👀  **If you see errors**: stop here and fix them before continuing.

---

## 6. Verify in the dashboard (2 min)

1. Open Supabase → Table Editor.  
2. You should now see new tables:  
   * `show_series` (populated)  
   * `reviews` pointing to `series_id`  
3. Spot-check a few rows: each show now has a `series_id`.

Looks good? Proceed.

---

## 7. Deploy the Edge Functions

```bash
# One-off claim
supabase functions deploy claim_show_series

# Broadcast messaging
supabase functions deploy send_broadcast_message

# Scheduled quota reset
supabase functions deploy reset-broadcast-quotas
```

The CLI prints the public URL for each function. Copy them somewhere safe—your mobile app calls these.

---

## 8. (Production only) Schedule the quota reset

In the Supabase dashboard:

1. **Edge Functions → Schedule**  
2. Add a **CRON** entry:  
   ```
   Function:  reset-broadcast-quotas
   Schedule:  0 6 * * *      # every day at 06:00 UTC
   ```

---

## 9. Rollback plan (safety net)

* A table `reviews_backup_before_series_migration` was created automatically.
* To undo, restore that data and set `shows.series_id = NULL`, then drop `show_series`.  
  (In practice you’ll never need this, but it’s nice to know.)

---

## 10. Next steps

1. **Run the app** (`npm start` or `expo start`) and click around:
   * Show Detail screen displays series badge & combined reviews.
   * Organizer can *Claim* and send a *Broadcast*.
2. Update any remaining queries that still reference `show_id`.
3. Merge the branch into `main` once you’re happy.

---

## 🔄 Quick-Reference Commands

```bash
# Apply schema migrations
supabase db push

# Apply the one-time data migration
supabase db execute db_migrations/data_migration_series.sql

# Deploy / update an Edge Function
supabase functions deploy <function-name>

# View deployed functions & their URLs
supabase functions list
```

---

### Need help?

* **Supabase CLI docs:** <https://supabase.com/docs/guides/cli>
* **Community Discord:** `#help` channel  
* Or open an issue in the GitHub repo.

Happy shipping! 🚀
