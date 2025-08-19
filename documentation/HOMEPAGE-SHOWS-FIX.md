# Fix Guide: Homepage Shows Not Displaying  

**File:** `HOMEPAGE-SHOWS-FIX.md`  
**Date:** 2025-07-14  

---

## 1 • Problem Statement  
After integrating the Organizer Dashboard the home screen stopped listing upcoming shows.  
Typical symptoms:  

* Zero shows returned although the badge *“X found”* displays a positive number.  
* Console error:  

```
ERROR [HomeScreen] Failed to fetch emergency shows: [TypeError: Cannot convert undefined value to object]
```  

* Newly-created shows (zip `46060`, start within next 30 days, ≤ 25 mi) never appear.

---

## 2 • Root Cause  

| Layer | Issue |
|-------|-------|
| SQL RPC `get_paginated_shows` |  • Incorrect **date overlap** logic (excluded same-day shows)  <br>• Skipped rows that lacked perfect coordinate data  <br>• GROUP BY ambiguity when new columns were added |
| Client fallback | Emergency fetch tried to map `coordinates.coordinates` even when `coordinates` was `null`, throwing the *TypeError* above. |

Because the RPC failed to return rows, the hook **`useInfiniteShows`** surfaced an empty array and the UI fell back to the buggy emergency path.

---

## 3 • Solution Overview  

1. **Database migration** `20250714010000_fix_homepage_show_display.sql`  
   * Re-implements `get_paginated_shows` with:  
     * Robust *date-range overlap* (`start_date <= end AND end_date >= start`).  
     * Safe handling when placeholder coordinates `(0,0)` are supplied.  
     * Optional radius filter is **skipped** when device location is missing.  
     * Distance computed only when valid coords exist.  
   * Adds rich debug JSON to diagnose future edge cases.  

2. **Backend code** (`showService.ts`)  
   * Normalises RPC payloads, guarding against `{ error: … }` objects.  
   * Maps latitude/longitude even if they come from the JSONB helper fields.  
   * Removes “undefined → object” crash in emergency path.  

3. **UI** (`HomeScreen.tsx`)  
   * Sanitises coordinate extraction before building the emergency list.  

---

## 4 • How to Apply the Fix  

### 4.1 Prerequisites  
* Supabase CLI ≥ 1.160  
* Your project `ref` (found in **Project Settings → API**).  
* Local Postgres service running for CLI migrations.

### 4.2 Automatic Method (recommended)  

```bash
# From repo root
./apply-homepage-fix.sh
```

The script will:  

1. Prompt for your Supabase `project-ref`.  
2. Push the SQL migration.  
3. Verify that `get_paginated_shows` exists.

### 4.3 Manual Method  

```bash
# 1. Login once
supabase login

# 2. Push the migration
supabase db push \
  --file supabase/migrations/20250714010000_fix_homepage_show_display.sql \
  --project-ref <YOUR_PROJECT_REF>

# 3. Confirm function
supabase db query \
  --project-ref <YOUR_PROJECT_REF> \
  "select proname from pg_proc where proname='get_paginated_shows';"
```

---

## 5 • Testing Checklist  

1. **Restart** the Expo app / reload Metro.  
2. On Home screen:  
   - Enter **ZIP 46060** as home location.  
   - Default radius **25 mi** / date range **next 30 days**.  
3. Verify **5 shows** appear: 3 legacy + 2 new organizer shows.  
4. Change radius to **10 mi** → count should decrease appropriately.  
5. Inspect device logs – *no* `TypeError` or fallback warnings should appear.  
6. Run the Organizer Dashboard again, create a show starting tomorrow → it shows on home within seconds (pull-to-refresh).  

---

## 6 • Rollback  

If any issue arises:

```bash
-- Remove only the new function
DROP FUNCTION IF EXISTS public.get_paginated_shows;
-- Re-apply previous stable version
\i supabase/migrations/20250713070000_fix_paginated_shows_final.sql
```

---

## 7 • Additional Notes  

* The migration **grants** execute rights to `authenticated, anon` roles automatically.  
* Debug JSON is returned in the RPC payload under the `debug` key; clients ignore it.  
* Fallback logic remains in place but should never trigger; monitor logs for `[showService] get_paginated_shows RPC failed`.

---

### ✅  Fix complete. Happy collecting!
