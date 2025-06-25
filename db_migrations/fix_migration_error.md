# Fixing Migration Error & Recommended Migration Sequence  
_File: `db_migrations/fix_migration_error.md`_

---

## 1  Why the Error Occurred
When you executed **`all_lowercase_setup.sql`** the SQL parser stopped at a line that begins with

```
DECLARE
```

`DECLARE` is only valid **inside** a PL/pgSQL block (`CREATE FUNCTION … AS $$ … BEGIN … DECLARE`).  
In `all_lowercase_setup.sql` that `DECLARE` appears outside such a block, so PostgreSQL returns:

```
ERROR:  42601: syntax error at or near "DECLARE"
```

---

## 2  Recommended Fix  
Instead of repairing the large *all-in-one* script, use the already-tested,
minimal script **`bare_minimum_setup.sql`** and then layer the feature-specific
migrations on top.

Advantages  
* No unsupported `DECLARE` statements – pure DDL.  
* Creates only the core tables you really need.  
* Easier to reason about and roll back.

---

## 3  Working Migration Sequence

| Step | Script | Purpose |
|------|--------|---------|
| 1 | **`bare_minimum_setup.sql`** | Core tables (`user_cards`, `want_lists`, `show_participants`, etc.). |
| 2 | **`dealer_show_participation.sql`** | Adds dealer-specific columns (card_types, specialty, status …). |
| 3 | **`user_account_subscription.sql`** | Adds subscription fields to `profiles`. |
| 4 | **`profile_image_url.sql`** | Adds `profile_image_url` column to `profiles`. |
| 5 | _Optional_ scripts (collection, storage, badges) | Only if those features will be live at launch. |

---

## 4  Execution Steps for Each Script

1. **Open** Supabase → SQL Editor.  
2. **Create new query**, paste the **entire** script.  
3. **Run**. Wait for “Success” (or “COMMIT”).  
4. **Proceed to verification** (Section&nbsp;5).  
5. Repeat for the next script in the table.

_Note:_ All scripts are idempotent – running twice will not harm the schema.

---

## 5  Verification Queries

Run the indicated query **immediately after** each script finishes.

| Script | Verification Query | Expected Result |
|--------|-------------------|-----------------|
| `bare_minimum_setup.sql` | `SELECT 1 FROM user_cards LIMIT 1;` | Returns 1 row (or 0 rows if empty) – proves table exists. |
| `dealer_show_participation.sql` | `SELECT column_name FROM information_schema.columns WHERE table_name='show_participants' AND column_name='card_types';` | Returns `card_types`. |
| `user_account_subscription.sql` | `SELECT account_type, subscription_status FROM profiles LIMIT 1;` | Columns exist (values may be `NULL`). |
| `profile_image_url.sql` | `SELECT column_name FROM information_schema.columns WHERE table_name='profiles' AND column_name='profile_image_url';` | Returns `profile_image_url`. |

If a query returns **0 rows**, the migration did not apply – re-run the script or inspect the error output.

---

## 6  Post-Migration Checklist

1. **Reload** schema cache in Supabase → _API_ → **Reload**.  
2. **Restart** your Expo dev server so updated columns are fetched.  
3. **Seed sample data** (dealer participation, profile images) for testing.  
4. **Run the app** → open a show → confirm dealer list loads without errors.  
5. **Backup** the database once again; tag this snapshot as _“pre-launch schema”_.

You are now ready to continue with final QA and move toward a production launch with a schema that matches the application code.  
