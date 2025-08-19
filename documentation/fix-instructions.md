# Fix Instructions

These steps deploy **both** fixes required to resolve:

1. “Sign In Required” error when saving a show to favourites  
   → _React-Native change in `src/screens/ShowDetail/ShowDetailScreen.tsx`_  
2. “relation `public.reviews` does not exist” on **My Shows** page  
   → _SQL script `fix-reviews-table.sql` that creates a `reviews` view/table_

---

## 1 · Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Git | ≥ 2.30 | commit & pull code |
| Node / Expo | see **package.json** | rebuild the app |
| Supabase SQL access | owner or admin | run migration script |

---

## 2 · Update the Mobile App

1. Pull the branch that includes the fix (or merge if already on `main`):

   ```bash
   git checkout main
   git pull origin main
   # or
   git fetch origin fix-favorites-auth-check
   git merge origin/fix-favorites-auth-check
   ```

2. Verify the patch file is present:

   ```
   ls src/screens/ShowDetail/ShowDetailScreen.tsx
   # file should show a commit date matching the fix
   ```

3. **Install dependencies & restart Metro** (clean cache):

   ```bash
   npm install
   npx expo start -c
   ```

4. Test on a device/emulator:

   * Log in as any role (Attendee, Dealer, MVP Dealer, Organizer).  
   * Open a show ⇒ tap **Save** → heart icon toggles without alert.  
   * Quit & relaunch app → favourite persists.

### 2 a · Apply the Code Patch (only if you pulled **main** without the fix)

If you checked out **main** before the `ShowDetailScreen` authentication
changes were merged you can apply the patch directly instead of merging the
whole branch:

```bash
# ensure you are on a throw-away feature branch
git checkout -b apply-auth-fix

# apply the patch file that lives in the repo root
git apply authentication-fix.patch

# confirm the file changed
git status            # ShowDetailScreen.tsx should be ‘modified’

# run the app to verify the Save/Favourite button now works
npm install
npx expo start -c

# commit & push if everything looks good
git commit -am "Apply favourites authentication patch"
git push -u origin apply-auth-fix
```

_Skip this subsection if you have already merged or rebased onto the
`fix-favorites-auth-check` branch._

---

## 3 · Apply the Database Patch

> Run once in **Supabase → SQL Editor** (or psql).

1. Open **`fix-reviews-table.sql`** found in the repo root.
2. Copy entire contents → paste into a new query window.
3. Click **Run**.  
   Successful output shows either:

   ```
   NOTICE:  Successfully created "reviews" view ...
   ```
   _or_
   ```
   NOTICE:  Successfully created "reviews" table with RLS policies
   ```

4. **Verify**

   ```sql
   select * from public.reviews limit 1;
   ```

   • Query executes (may return 0 rows).  
   • No `relation "public.reviews" does not exist` error.

---

## 4 · Smoke Test

1. In the app, navigate to **My Shows**.  
   • No red error overlay.  
   • Past shows list renders (or empty-state message).

2. Create a new review (Past Show → ✏️ icon).  
   • Submits successfully.  
   • Record appears in `public.reviews`.

3. Favourite / unfavourite multiple shows while logged in/out to ensure alerts appear **only** when unauthenticated.

---

## 5 · Rollback Instructions

* **Code** – simply checkout the previous commit and rebuild.  
* **DB** – drop the view/table:

  ```sql
  drop view if exists public.reviews cascade;
  drop table if exists public.reviews cascade;
  ```

  (Re-run original `show_reviews` migration if needed.)

---

## 6 · Commit & Push

If you applied the code changes locally:

```bash
git add src/screens/ShowDetail/ShowDetailScreen.tsx fix-reviews-table.sql
git commit -m "Fix favourites auth & add reviews compatibility view"
git push origin <your-branch>
# open PR → merge → deploy OTA or rebuild app store binaries
```

---

### 🎉  Both fixes are now live.
