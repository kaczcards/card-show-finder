# PR: Fix Homepage Shows Display After Organizer Dashboard Integration

## 🛑 Problem Statement
After merging the initial **Show Organizer Dashboard** work the Home screen stopped listing upcoming shows.

*  Zip code **46060** should currently display **5** shows (3 existing + 2 newly-created by an organizer).  
*  Instead the list is empty while the badge still shows a positive “found” count.  
*  Console error during the emergency fallback:
  ```
  ERROR [HomeScreen] Failed to fetch emergency shows:
  [TypeError: Cannot convert undefined value to object]
  ```

## 🔍 Root Cause
| Layer | Issue |
|-------|-------|
| **SQL RPC `get_paginated_shows`** |  • Date-range logic excluded shows that start *and* end inside the period<br>• Radius filter failed when placeholder coordinates (0,0) were supplied<br>• GROUP BY ambiguity after adding new columns |
| **React Native Fallback** |  Emergency path tried to de-reference `coordinates.coordinates` when `coordinates` was `null`, throwing the TypeError and short-circuiting rendering |

## ✅ Solution Overview
1. **New SQL migration** `20250714010000_fix_homepage_show_display.sql`
   * Re-implements `get_paginated_shows` with:
     * Robust *date-overlap* test
     * Skips distance filter when coordinates ≈ 0,0 (device location unavailable)
     * Safe latitude/longitude extraction in the JSON payload
     * Adds optional `status` param (defaults `ACTIVE`)
     * Debug blob returned under `"debug"` for future tracing
2. **showService.ts**
   * Normalises RPC payloads, guards against `{ error: … }`
   * Maps coordinates from either explicit lat/lng or PostGIS object
   * Removes crash in emergency fallback
3. **HomeScreen.tsx**
   * Sanitises coordinate extraction in emergency fetch
4. **Utility script** `apply-homepage-fix.sh`
   * One-click push of the migration & verification
5. **Docs** `HOMEPAGE-SHOWS-FIX.md`
   * End-to-end explanation, testing checklist, rollback steps

## 🔨 Files Added / Changed
```
supabase/migrations/20250714010000_fix_homepage_show_display.sql
src/services/showService.ts
src/screens/Home/HomeScreen.tsx
apply-homepage-fix.sh
HOMEPAGE-SHOWS-FIX.md
```

## 🧪 Testing Instructions
1. **Apply migration**  
   ```bash
   ./apply-homepage-fix.sh   # or push SQL manually
   ```
2. **Restart** the Expo app / reload Metro.
3. Set home ZIP **46060** in Profile (or sign in with an account already using it).
4. On Home screen expect **5** shows with default filters (25 mi, next 30 days).
5. Narrow radius to **10 mi** → count decreases appropriately.
6. Switch roles to Show Organizer, create a new show inside range → pull-to-refresh, show appears.
7. Watch logs – no `[TypeError ...]`, no RPC failures.

## 📝 Notes
* Migration auto-grants EXECUTE to `authenticated, anon`.  
* Existing emergency fallbacks kept for resilience but no longer trigger.  
* Debug JSON from RPC is ignored client-side yet handy for future diagnostics.

---

### 🚀 Ready to merge
This PR restores the core discovery experience and unblocks production rollout. 