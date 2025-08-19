# Migration: Add `favorite_shows_count` Column to `profiles`

This migration introduces a new integer column `favorite_shows_count` to the `profiles` table.  
The column stores the running total of shows a user has favourited and is automatically maintained by database triggers (`increment_favorite_count` / `decrement_favorite_count`).  
Adding the column eliminates expensive aggregate queries on every page load and prevents the “column does not exist” errors currently seen in the mobile app.

---

## 1. Prerequisites
1. You must be an **Owner** or **DB Admin** of the Supabase project.
2. The table `user_favorite_shows` (join-table) and its favourite-count triggers (`increment_favorite_count`, `decrement_favorite_count`) must already exist.  
   _If you followed the July 10 migration these are already in place._

---

## 2. Applying the Migration in Supabase Dashboard (SQL editor)

1. **Open the project** in your Supabase dashboard.  
2. In the left-hand menu select **SQL Editor** ➜ **New Query**.
3. Copy-and-paste the SQL below into the query window:

```sql
-- Add favourite counter column if it does not yet exist
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS favorite_shows_count INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.profiles.favorite_shows_count IS
'Count of shows favourited by this user. Automatically maintained by triggers.';

-- Back-fill counts for existing users
UPDATE public.profiles p
SET    favorite_shows_count = COALESCE(c.count, 0)
FROM   (SELECT user_id, COUNT(*) AS count
        FROM   public.user_favorite_shows
        GROUP  BY user_id) AS c
WHERE  p.id = c.user_id;
```

4. Click **Run**. Supabase will report `ALTER TABLE` and `UPDATE <n>` on success.
5. **Verify**:  
   - Go to **Table Editor** → `profiles` → **Columns** and confirm `favorite_shows_count` appears with default `0`.  
   - Browse a few profile rows; values should match the number of favourites.

---

## 3. (Optional) Applying via CLI / migration file

If you manage migrations via git, add the file  
`supabase/migrations/20250715010000_add_favorite_shows_count.sql` with the same SQL.  
Run `supabase db push` (local) or commit & deploy through your CI pipeline.

---

## 4. Rollback Instructions

If required, you can remove the column:

```sql
ALTER TABLE public.profiles
DROP COLUMN IF EXISTS favorite_shows_count;
```

_⚠️  Removing the column will break any app version that expects it._

---

## 5. Release Checklist
- [ ] Migration applied in **Production**, **Staging**, and **Local** DBs.
- [ ] Mobile app updated to latest commit (`favorite_shows_count` logic).
- [ ] Smoke-test: favourite / unfavourite a show and verify count increments / decrements in **profiles** table.
