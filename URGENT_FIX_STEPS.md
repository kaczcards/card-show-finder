# 🚑 URGENT FIX STEPS  
_stop the “infinite recursion detected in policy for relation `show_participants`” error_

---

## Who should do this?
A Supabase project admin (or anyone with SQL-editor access).

---

## What you need
1. The SQL script `fix-rls-infinite-recursion-v2.sql`  
   • It lives in the repo root (same branch as this guide).  
   • The script is **idempotent** – it can be run multiple times safely.  
2. Supabase Dashboard access.

---

## Step-by-Step (≈ 60 seconds)

1. **Sign in to Supabase**  
   Open `https://app.supabase.com` and select your project.

2. **Open the SQL Editor**  
   In the left sidebar click **SQL Editor → New query**.

3. **Paste the entire contents of `fix-rls-infinite-recursion-v2.sql`**  
   (Copy it from the repository, then paste into the SQL window.)

4. **Run the script**  
   Click **Run** (►).  
   You should see a series of “NOTICE: Dropped policy …” messages followed by  
   `NOTICE: === RLS Policy Fix Complete ===`.

5. **Confirm the fix**  
   In the same SQL window, run:  
   ```
   select * from show_participants limit 5;
   ```  
   • If rows appear (even an empty result) **without error**, the recursion loop is fixed.  
   • If you still see the recursion error, run the script again to be sure it executed.

6. **Restart the app**  
   • Expo dev: press **r** to reload.  
   • Production build: close & reopen the app (or deploy an OTA update).

That’s it – the “infinite recursion” crashes are gone.  
A broader, role-specific policy refinement can be applied later, but this hot-fix unblocks all users immediately.
