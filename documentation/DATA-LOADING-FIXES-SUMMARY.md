# Data-Loading & Dynamic-Content Fixes – Summary  
_Last updated: 07 Jul 2025 – branch `fix-data-loading-issues`_

This document details all changes that resolve the “Data Loading & Dynamic Content” bugs reported for Card Show Finder.

---

## 1 · Overview

| Area | Problem | Resolution |
|------|---------|------------|
| Homepage list | Shows never refreshed; filters inert | Re-engineered data pipeline with robust fetch, state & filter handling |
| Map view | Hard-coded test markers | Connected to live show feed & unified filter/state with Home |
| Filters | UI present but non-functional | Functional bottom-sheet, active-pill display, reset, persistence |
| 30-day / 25-mile default | Not enforced | Defaults applied on first load and whenever filters reset |
| Image & hours on detail | Placeholder & “Text must be <Text>” error | Defensive rendering & hour-string util |

---

## 2 · Key Features Added

* **Centralised `showService.getShows()`**  
  – Supports geo-radius RPC, date window, fee, categories & feature arrays.  
* **Filter Sheet (`<FilterSheet />`)**  
  – Radius, date range, max fee, features, categories  
  – Animated bottom-sheet, drag-down to dismiss, Apply / Reset.  
* **Smart Refresh Strategies**  
  1. **Pull-to-refresh** (`RefreshControl`)  
  2. **Foreground refresh** (`AppState` listener)  
  3. **Focus refresh** (`useFocusEffect`)  

* **Error & Empty States**  
  – Banner style alerts, loaders, graceful offline handling.  
* **Active-filter Pills & Counters** for instant feedback.  

---

## 3 · Screen-Specific Changes

### 3.1  Homepage (`HomeScreen.tsx`)
* Replaced fixed query with **location-aware filterable fetch**.  
* Fetch flow:
  1. Resolve ZIP ➜ lat/lng (`locationService.getZipCodeCoordinates`)  
  2. Build `ShowFilters` (+radius, date window etc.)  
  3. Call `showService.getShows()`  
* Added:
  * Pull-to-refresh
  * Loader & error banner
  * Active filter display + reset button
  * AppState “come-to-foreground” auto reload
  * Show count label

### 3.2  Map (`MapScreen.tsx`)
* Dropped test data; now reuses **showService** with identical filters.  
* Location flow:
  * Permission check ➜ current GPS ➜ fallback to ZIP ➜ fallback US centre.  
* Added:
  * Clustered loading overlay, error & empty overlays
  * Pull-to-refresh
  * Center-on-user FAB
  * Active filter banner with reset

### 3.3  Show Detail (`ShowDetailScreen.tsx`)
* **Image logic**: falls back to stock photo when `image_url` absent.  
* **Time formatting**: unified `start_time` / `end_time` / legacy `time`.  
* Removed `<Text>` warning by ensuring strings inside `<Text>`.

---

## 4 · Filter Logic

| Filter | Implementation |
|--------|----------------|
| Radius | `filters.radius` (25/50/100/200 mi) → PostGIS RPC |
| Date window | `startDate` default **today**, `endDate` default **+30d** |
| Max Entry Fee | Optional numeric constraint |
| Features & Categories | Stored as arrays, passed to RPC / overlap query |

All filters now **sync** between Home & Map and persist for session.

---

## 5 · User-Facing Improvements

* Instant visual feedback (loader, count, pills).
* Clear offline & server-error messages.
* Consistent results between list & map.
* Placeholder assets remove “No Image Available” blank.

---

## 6 · Developer Notes

* Branch: `fix-data-loading-issues`
* Affects: `HomeScreen.tsx`, `MapScreen.tsx`, `ShowDetailScreen.tsx`, `showService.ts`, `locationService.ts`
* Depends on previously merged authentication fixes (`fix-authentication-issues`).
* New npm deps: _none_ (NetInfo & dotenv already added).

---

## 7 · Testing Checklist

1. Launch app → list shows within 30 days & 25 mi.  
2. Tap **Filters**, set distance 50 mi → list & map update.  
3. Pull-to-refresh on both screens → latest data.  
4. Background app ≥5 s → foreground → auto reload.  
5. Toggle offline mode → attempt refresh → error banner shown.  
6. Open show without `image_url` → stock image appears, no red-box.  

_All checks green ➜ ready for QA sign-off._

---

## 8 · Merge-Conflict Resolution Notes ( `main` ⇄ `fix-data-loading-issues` )

While rebasing the **`fix-data-loading-issues`** branch onto the updated `main`
branch 7 textual conflicts surfaced – only **two** required manual edits:

| File | Key Conflict | Resolution | Preserved Logic |
|------|--------------|------------|-----------------|
| `src/screens/Home/HomeScreen.tsx` | Both branches introduced new filter state & persistence code. | – **Unified** the two code paths.<br>– Chose the enhanced *local + prop* filter model from the feature branch.<br>– Retained `AsyncStorage` persistence and *active-filter badge*.<br>– Re-hooked `fetchData()` to trigger automatically via `useEffect`. | • `defaultFilters` definition (from main).<br>• `FilterChips` / preset modal (from feature branch). |
| `src/screens/Map/MapScreen.tsx` | Large divergence: test-marker prototype vs. live cluster implementation. | – **Removed** temporary hard-coded shows.<br>– Kept **live** `getShows` pipeline & `MapShowCluster` integration.<br>– Consolidated location-fallback chain (GPS ➜ ZIP ➜ US centre). | • Cluster rendering + region handling (feature).<br>• New error / empty / loading overlays (feature). |

Remaining 5 conflicts were trivial (package-lock, import strips, etc.) and
resolved by favouring `main` where functionality overlapped.

**Result:**  
The merged branch keeps all new data-loading capabilities while remaining
compatible with freshly-merged theme, badge-system and messaging updates from
`main`.

---

## 9 · SQL Hot-Fix – Exclude Historical Shows

During QA we discovered that **expired / historical shows** were still returned
by the `find_filtered_shows` PostGIS RPC even when the client supplied a
`startDate` of **today** and an `endDate` +30 days.  

### Root Cause  
The original SQL contained:

```sql
AND (start_date IS NULL OR shows.start_date >= start_date)
AND (end_date   IS NULL OR shows.end_date   <= end_date)
```

If the _caller_ passed **`NULL`** for `start_date` (which can happen when the
filter object is built incorrectly) the first predicate collapses to `TRUE`,
so any show – even one that ended last year – satisfied the condition as long
as its **status = 'ACTIVE'** flag had not been cleaned up.

### Fix  
We recreated the function in `db_migrations/fix_show_date_filtering.sql`
(included in this branch).  The new logic adds:

```sql
-- Always exclude shows that have fully completed
AND shows.end_date >= NOW()
```

This single guard guarantees that only current or future events are returned,
irrespective of the optional `start_date` parameter.  The migration drops the
old function and re-creates it with identical signature, so **no client-side
code changes are required**.

### Verification Steps
1. Apply migration on Supabase (`psql < fix_show_date_filtering.sql` or via
   Dashboard → SQL Editor).  
2. Call the RPC manually:

```sql
select id, title, start_date, end_date
from find_filtered_shows(
  center_lat := 40.0772,
  center_lng := -85.9259,
  radius_miles := 25,
  start_date := null,
  end_date   := null
);
```

Only shows whose `end_date >= now()` are returned. Older records are
excluded.  
3. Re-run the mobile app – homepage & map no longer display past events.
