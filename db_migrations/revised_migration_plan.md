# Revised Migration Plan  
_File: `db_migrations/revised_migration_plan.md`_

---

## 1  Why “already exists” Errors Appear
When you re-run a migration against a database that **already contains some of the objects** (tables, policies, indexes, functions …), PostgreSQL raises errors such as  

```
policy "user_cards_policy" for table "user_cards" already exists
```  

This means:

* A previous script (or manual change) **created the same object**.
* PostgreSQL does **not** allow `CREATE …` for an object that is already present unless you use `IF NOT EXISTS` or drop it first.

The safest strategy is to run **idempotent** scripts that skip objects which exist, and to apply **feature migrations** on top of that minimal base.

---

## 2  New Migration Sequence

| Step | Script | Purpose |
|------|--------|---------|
| 1 | **`safe_schema_setup.sql`** | Creates **only** missing core tables & indexes. Uses `IF NOT EXISTS`, **omits policies** that are already present. |
| 2 | **`dealer_show_participation.sql`** | Adds dealer-specific columns (`card_types`, `specialty`, `status`, …) that the mobile app queries. |
| 3 | **`user_account_subscription.sql`** | Adds `account_type`, `subscription_status`, `subscription_expiry` to `profiles`. |
| 4 | **`profile_image_url.sql`** | Adds `profile_image_url` column to `profiles` – fixes the _profile_image_url does not exist_ error. |
| 5 | Optional scripts (collection, storage, badges) | Only run if those features are needed **before launch**. |

> **Why this order?**  
> *Step&nbsp;1* guarantees all required tables exist without colliding with previously-created policies.  
> *Step&nbsp;2* & *Step&nbsp;4* directly address the runtime errors you’ve seen in dealer functionality and profile loading.

---

## 3  Execution & Verification

Perform each step in the **Supabase SQL Editor** (or psql).  
After you click **Run**, execute the matching verification query.

| Step | Verification Query | Expected Result |
|------|-------------------|-----------------|
| 1. `safe_schema_setup.sql` | `SELECT 1 FROM user_cards LIMIT 1;` | Query runs → table exists. |
| 2. `dealer_show_participation.sql` | `SELECT column_name FROM information_schema.columns WHERE table_name='show_participants' AND column_name='card_types';` | Returns `card_types`. |
| 3. `user_account_subscription.sql` | `SELECT account_type, subscription_status FROM profiles LIMIT 1;` | Columns exist (values may be NULL). |
| 4. `profile_image_url.sql` | `SELECT column_name FROM information_schema.columns WHERE table_name='profiles' AND column_name='profile_image_url';` | Returns `profile_image_url`. |

If a query returns **0 rows** or errors, the migration did not apply – reread the SQL output for the cause.

---

## 4  Troubleshooting Guide

| Symptom | Likely Cause | Resolution |
|---------|--------------|------------|
| `… already exists` | Object created earlier | Edit script to use `DROP … IF EXISTS` **or** wrap in `IF NOT EXISTS`; re-run. |
| `relation … does not exist` | Running feature migration before base tables | Ensure `safe_schema_setup.sql` ran successfully. |
| Script hangs | Table lock from concurrent writes | Re-run during off-peak hours or add `LOCK TABLE … NOWAIT`. |
| `uuid_generate_v4` undefined | Extension missing | `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";` then re-run. |
| RLS policy errors | Policy references non-existent columns | Always run column-adding migrations **before** policy scripts. |
| App still errors after migrations | PostgREST cache stale | In Supabase **API** → click **Reload Schema**, then restart backend/app. |

---

## 5  Post-Migration Checklist

1. **Reload** PostgREST schema cache (`API` → _Reload Schema_).  
2. **Restart** Expo / backend to pick up new columns.  
3. **Seed** test data:  
   * Add a dealer with booth info to a test show.  
   * Upload a profile image URL.  
4. Open the mobile app → **Show Detail** → confirm dealer list loads without errors.  
5. Create a fresh **database backup** tagged _pre-launch_.  

Follow this plan and your schema will be fully aligned with the codebase, eliminating the “column does not exist” errors and preparing your product for a smooth production launch.  
