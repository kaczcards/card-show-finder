# Database Migration Execution Plan
_File: `db_migrations/migration_execution_plan.md`_

---

## 1&nbsp;&nbsp;Purpose & Importance  
Running the SQL migrations in `db_migrations/` brings your Supabase database schema in line with the current codebase so that:

* Front-end and service-layer queries no longer fail due to missing columns or tables.  
* New functionality (dealer booth details, subscription tracking, profile images, collection features, etc.) works as designed.  
* You enter production with a **single source of truth** and avoid “works-on-my-machine” bugs.

---

## 2&nbsp;&nbsp;Prerequisites  

| # | Requirement | Why |
|---|-------------|-----|
| 1 | **Full database backup** (pg_dump or Supabase “Backups” UI) | Enables rollback if anything goes wrong. |
| 2 | Supabase project owner or SQL Editor access | Needed to execute DDL statements. |
| 3 | Apply all pending **Auth** migrations first (if any) | Some tables reference `auth.users`. |
| 4 | Empty or test data environment **or** scheduled maintenance window | DDL locks tables; safest when traffic is low. |
| 5 | Confirm `uuid-ossp` extension enabled | Several scripts rely on `uuid_generate_v4()`. |

---

## 3&nbsp;&nbsp;Migration Order  

Run the scripts **in this exact order** to satisfy dependencies:

| Step | Script | Purpose |
|------|--------|---------|
| 1 | `all_lowercase_setup.sql` **_or_** `bare_minimum_setup.sql` | Creates base tables (`shows`, `profiles`, etc.). Use _one_ of them, not both. |
| 2 | `dealer_show_participation.sql` | Adds dealer-specific columns (`card_types`, `status`, …) to `show_participants`. |
| 3 | `user_account_subscription.sql` | Adds `account_type`, `subscription_status`, `subscription_expiry` to `profiles`. |
| 4 | `profile_image_url.sql` (new) | Adds `profile_image_url` to `profiles`. |
| 5 | Optional domain scripts:<br/>• `collection_schema.sql` or `collection_schema_fixed.sql`<br/>• `storage_setup.sql` or `minimal_storage_setup.sql`<br/>• Badge or other feature scripts | Only if you intend to enable these features before launch. |

**Why this order?**  
Each script either creates new tables or augments existing ones. Running them out of order may reference non-existent columns or violate constraints.

---

## 4&nbsp;&nbsp;Executing a Migration in Supabase SQL Editor  

1. **Open** your Supabase project → **SQL Editor**.  
2. **Create new query**, paste the entire contents of the script.  
3. **Preview** (Supabase shows which statements will run).  
4. **Click “Run”**.  
5. Wait until you see “_COMMIT_” and “_Success_”.  
6. **Document** the timestamp & script name in your change log.

_Repeat for each script in the order table above._

---

## 5&nbsp;&nbsp;Verification After Each Script  

Run the corresponding check immediately:

| Script | Verification Query | Expected Result |
|--------|-------------------|-----------------|
| `bare_minimum_setup.sql` | `SELECT COUNT(*) FROM show_participants;` | Query runs (table exists). |
| `dealer_show_participation.sql` | `SELECT column_name FROM information_schema.columns WHERE table_name='show_participants' AND column_name='card_types';` | Returns `card_types`. |
| `user_account_subscription.sql` | `SELECT account_type, subscription_status FROM profiles LIMIT 1;` | Columns exist (values may be NULL). |
| `profile_image_url.sql` | `SELECT column_name FROM information_schema.columns WHERE table_name='profiles' AND column_name='profile_image_url';` | Returns `profile_image_url`. |

For optional scripts, run similar `information_schema.columns` checks.

---

## 6&nbsp;&nbsp;Troubleshooting Tips  

| Symptom | Likely Cause | Resolution |
|---------|--------------|------------|
| “column … already exists” | Script previously run | Safe to ignore _or_ comment out duplicate `ADD COLUMN`. |
| “relation … does not exist” | Running augmentation before base table | Re-run scripts in correct order. |
| Query window hangs | Large table lock | Re-run during off-peak hours or add `LOCK TABLE … NOWAIT` to detect locks early. |
| RLS policy errors | Policies referencing columns not yet created | Ensure policy-adding SQL is placed **after** the related `ALTER TABLE`. |
| `uuid_generate_v4` undefined | Missing extension | `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";` then re-run script. |

---

## 7&nbsp;&nbsp;Post-Migration Tasks  

1. **Clear Supabase PostgREST cache**  
   * In Project → API settings → click “_Reload Schema_”.  
2. **Redeploy / restart** your backend & mobile app (Expo) so new columns are requested.  
3. **Seed test data** covering new columns (`status`, `profile_image_url`, etc.).  
4. **Run automated tests & smoke tests** (dealer registration, show detail view, etc.).  
5. **Update monitoring dashboards** for new tables/columns.  
6. **Tag Git commit & DB schema version** (e.g., `v1.0-production-ready`).  
7. **Backup again** post-migration for a clean restore point.  

---

### Final Reminder  

Perform all migrations **first in a staging environment**.  
Only migrate production after you have verified:

* All queries in the app execute without errors.  
* New features relying on these columns behave correctly.  
* Backups are stored safely off-site.  

Following this plan ensures your database is fully aligned with the application code, eliminating the runtime errors encountered during testing and preparing your product for a smooth production launch.
