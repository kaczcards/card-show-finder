# Card Show Finder — Coordinate & Home-Screen Fix Summary

## 1  Issues Discovered

| # | Category | Description | Impact |
|---|----------|-------------|--------|
| 1 | **Data quality** | 0 % of **ACTIVE** shows had coordinates in valid `POINT(lon lat)` format; 68 % had **no** coordinates; 32 % stored as raw WKB hex. | Spatial RPCs returned empty sets ⇒ Home page showed no nearby shows. |
| 2 | **UX fallback** | HomeScreen stopped after first 25-mile query. | Users with no nearby shows saw an empty list instead of broader results. |
| 3 | **Observability** | Minimal logging around geo queries & filters. | Hard to diagnose when queries returned 0 rows. |

## 2  Fixes Implemented

### 2.1 Codebase

* **`src/services/showService.ts`**
  * Added defensive logging (input coords, filters, row counts).
  * Added fallback from `find_filtered_shows` → `find_shows_within_radius` → basic query.
* **`src/screens/Home/HomeScreen.tsx`**
  * Added detailed location-resolution logs.
  * Automatic *second pass* with a 100-mile radius if 25-mile query returns 0 rows.
  * User-friendly alert when nothing found even after expansion.

### 2.2 Diagnostic / Utility Scripts  *(kept in `scripts/`)*

| Script | Purpose |
|--------|---------|
| `check-show-coordinates.js` | Audits every show and classifies coordinates as **valid / invalid / missing**. |
| `test-db-functions.js` | Sanity checks both RPCs with sample coords & date range. |
| `test-other-locations.js` | Sweeps 10 US metros × 25/100 mi radii to spot coverage gaps. |
| `test-la-shows.js` | Demonstrates HomeScreen expansion logic with live data. |

### 2.3 SQL Data Repair

* **`fix-show-coordinates-sql.sql`**
  * Converts WKB-hex rows to proper `POINT`.
  * Bulk-adds coordinates for Indiana shows (city-level accuracy).
  * Provides before/after diagnostics & exemplar radius query.
  * Wrapped in `BEGIN … COMMIT` for safe rollback.

## 3  Applying the SQL Patch

1. Open Supabase → **SQL Editor**.
2. Copy-paste the entire contents of `fix-show-coordinates-sql.sql`.
3. Press **RUN**.  
   *Review the output of the verification queries printed near the bottom.*
4. If counts look correct (`remaining_shows_with_wkb_hex = 0`, `remaining_shows_missing_coordinates = 0`) press **COMMIT**; otherwise click **ROLLBACK** and investigate.

> 🔒 The script only touches `public.shows` rows where `coordinates` are null or malformed—safe for production.

## 4  Evidence of Testing

### 4.1 Coordinate Audit (before fix)

```
Total shows: 40
Active shows: 27
Shows with valid coordinates: 0 (0%)
Shows missing coordinates: 27 (68%)
Shows with invalid (WKB) coordinates: 13 (32%)
```

### 4.2 RPC Smoke-test (before fix)

```
find_shows_within_radius (Indy, 25 mi)  → 0 rows
find_filtered_shows     (Indy, 25 mi)  → 0 rows
```

### 4.3 RPC Smoke-test (after data fix)

```
find_shows_within_radius (Indy, 25 mi)  → 12 rows
find_filtered_shows     (Indy, 25 mi, next 30d) → 8 rows
```

### 4.4 HomeScreen Logs (device)

```
[HomeScreen] getShows() returned 0 show(s)
[HomeScreen] No shows with default radius – retrying with 100 miles
[HomeScreen] Expanded radius fetch returned 8 show(s)
```

### 4.5 Metro Sweep Summary

| Metro | 25 mi | 100 mi |
|-------|------:|-------:|
| Indianapolis | 8 | 15 |
| Los Angeles  | 1 | 1 |
| Chicago      | 1 | 1 |
| …others      | 0 | 0 |

## 5  Recommendations

1. **Enforce data integrity**  
   * Add NOT NULL & CHECK constraints on `coordinates`; reject inserts without valid `POINT`.
2. **Automated geocoding**  
   * Introduce a server-side function (Supabase Edge Function) that geocodes `location` on insert/update.
3. **Background back-fill**  
   * Run `check-show-coordinates.js` nightly; alert on anomalies.
4. **UX polish**  
   * Surface radius expansion in UI (“Expanded search to 100 mi” banner).
5. **Default radius**  
   * Consider 50 mi default for rural ZIPs to reduce empty first queries.

---

*Document generated — 19 Jun 2025*  
