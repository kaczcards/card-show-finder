# 🛠️ Migration Instructions – Recurring Shows & Organizer Dashboard

These steps walk you through **upgrading an existing Card Show Finder backend + mobile app** to the new recurring-shows architecture and Organizer Dashboard.

---

## 1. Prerequisites

1. PostgreSQL ≥ 14 (matching Supabase default)  
2. Supabase CLI ≥ 1.161  
3. Access to:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (for deploying functions & scheduled jobs)

Create a **database backup** before proceeding:

```bash
pg_dump $DATABASE_URL -Fc -f pre_recurring_shows.backup
```

---

## 2. Update Environment Variables

Add the service-role key (if not present) to every environment where Edge Functions run.

```bash
# .env or Supabase dashboard → Project Settings → Environment Variables
SUPABASE_SERVICE_ROLE_KEY=PASTE_YOURS_HERE
```

---

## 3. Apply DB Schema Changes

### 3-A. Local development

```bash
cd card-show-finder

# Run the structural migration
psql $DATABASE_URL -f db_migrations/recurring_shows_schema.sql
```

### 3-B. Staging / Production

We recommend psql over the web UI to preserve indexes & constraints:

```bash
psql $DATABASE_URL \
     -v ON_ERROR_STOP=1 \
     -f db_migrations/recurring_shows_schema.sql
```

**What the script does**

1. Creates `show_series` table + indexes  
2. Adds `series_id` FK column to `shows` (nullable)  
3. Re-creates `reviews` table with `series_id` + triggers  
4. Adds broadcast-quota columns to `profiles`  
5. Updates RLS policies

---

## 4. Run the Data Migration

The second script groups historical shows into series and recalculates aggregates.

```bash
psql $DATABASE_URL -f db_migrations/data_migration_series.sql
```

Idempotent: running twice will be a no-op (checks for existing `series_id`).

---

## 5. Deploy Edge Functions

```bash
# Authenticate once
supabase login

# Move into Supabase functions folder
cd supabase/functions

# Deploy individual functions
supabase functions deploy claim_show_series
supabase functions deploy send_broadcast_message
supabase functions deploy reset-broadcast-quotas
```

### 5-A. Schedule the Quota Reset Job

In the Supabase dashboard → **Edge Functions → Schedules**:

- **Function**: `reset-broadcast-quotas`  
- **Cron**: `0 0 * * *` (runs daily at 00:00 UTC)  
- **JWT Secret**: leave default

---

## 6. Rebuild & Release the Mobile App

### 6-A. Install dependencies

```bash
cd card-show-finder
npm install        # or yarn
```

### 6-B. Build / OTA update

Expo EAS OTA (JS-only):

```bash
eas update --branch production
```

Native build (if binary change):

```bash
eas build -p ios   # repeat for android
```

Users will see a new **Organizer** tab after the update.

---

## 7. Post-Migration Verification

1. **Series creation**  
   ```sql
   SELECT COUNT(*) FROM show_series;
   ```
   Expect > 0 rows (one per grouped show).

2. **Shows linked**  
   ```sql
   SELECT COUNT(*) FROM shows WHERE series_id IS NULL;
   ```
   Should drop significantly; a few single-instance shows may stay NULL.

3. **Organizer claim flow**  
   - Log in as test organizer → Claim a new series → `show_series.organizer_id` set.

4. **Broadcast quota**  
   - Call `send_broadcast_message` twice (pre-show) → third call returns 429.

5. **Mobile UI**  
   - Open Show Detail → “Part of the **XYZ Series**” badge visible.  
   - Organizer Dashboard metrics load without error.

---

## 8. Rollback Strategy

If needed, restore the backup and redeploy old functions:

```bash
dropdb $DATABASE_NAME     # ⚠️ destructive
createdb $DATABASE_NAME
pg_restore -d $DATABASE_NAME pre_recurring_shows.backup
```

Edge Functions are versioned; redeploy previous commit tags.

---

## 9. Troubleshooting

| Symptom | Fix |
|---------|-----|
| `function error 429 – quota exceeded` | Wait for daily reset or manually increment quota in `profiles`. |
| `cannot find column series_id` | Migration script not executed; re-run step 3. |
| Mobile app shows blank dashboard | Confirm you rebuilt with latest `OrganizerNavigator` and `MainTabNavigator`. |
| Error `new row violates row-level security` | Make sure auth JWT in Edge Function uses the **service-role** key. |

---

## 10. Next Steps

* Build **Series Detail** & **Broadcast History** screens (issues #237 / #238).  
* Monitor logs for slow queries on new tables; add indexes as needed.  
* Evaluate switching to **luxon** for recurrence handling (DST-safe).

---

✅ **Migration complete – welcome to recurring shows!**
