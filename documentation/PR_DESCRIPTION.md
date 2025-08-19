# Fix Homepage Show Display & Show Details Stability

## 🗒️ Overview
This pull request delivers a **full end-to-end repair** for the regression that broke:

1. The *homepage* “Upcoming Shows” list when searching within a 25-mile radius of ZIP 46060.
2. The *Show Details* screen for shows created via the new **Organizer Dashboard** (duplicate dates, missing booth info, and fatal RN error: `Text strings must be rendered within a <Text> component`).

It also introduces hardened tooling (SQL scripts + CLI helpers) so similar issues can be diagnosed and patched much faster in the future.

---

## 🎯 Motivation
While rolling out Organizer features several small but compound problems were merged:

* Coordinate values were parsed incorrectly in the `get_paginated_shows` RPC causing empty results.
* Two emergency hot-fixes added overlapping CTEs which later conflicted (`filtered_shows` / `status` ambiguous).
* The new Organizer flow referenced non-existent profile columns (`username`) and tables (`organizer_show_dealers`).
* Front-end ShowDetail components assumed all data existed and rendered raw strings, triggering React Native runtime errors.

All of this prevented users around 46060 from seeing five valid upcoming shows (3 legacy + 2 organizer shows).  

---

## 🛠️ What’s in This PR

### 1. Database / SQL
| File / Migration | Purpose |
|------------------|---------|
| `20250714010000_fix_homepage_show_display.sql` | Correct distance calc & date filters in **get_paginated_shows** |
| `20250714020000_fix_cte_in_paginated_shows.sql` | Removed overlapping CTE, resolved `relation 'filtered_shows' does not exist` |
| `20250714040000_fix_ambiguous_column_reference.sql` | Qualified all ambiguous columns (`status`, `id`) |
| `fix-all-show-details-issues.sql` / `apply-final-fix.sql` | **Complete rewrite** of **get_show_details_by_id**<br/>• Removes `username` reference<br/>• Guarantees non-null JSON structure<br/>• Adds camel & snake case keys for compatibility<br/>• Includes debug payload |
| Grants | `GRANT EXECUTE` for both `authenticated` and `anon` roles |

### 2. Front-end
* **Ultra-robust components**  
  * `ShowBasicInfo.tsx`  
  * `ShowTimeInfo.tsx`  
  Each now:
  * Wraps every value in `<Text>`
  * Performs exhaustive null / type checks
  * Provides graceful fall-backs (`'Untitled Show'`, `'Location not specified'`, etc.)
  * Handles multi-day date ranges and ISO / HH:MM / free-text time strings
* **ShowHeaderActions.tsx** received minor alignment & color tweaks.
* **showService.ts** and **HomeScreen.tsx** hardened with coordinate guards + verbose logging.

### 3. Tooling
* `final-fix.sh` – one-command database patcher (psql **or** Supabase CLI).
* `quick-db-fix.js` – Node helper that runs the SQL via service key; auto-saves `.sql` if RPC not permitted.
* Diagnostic scripts (`run-show-diagnostics.sh`, etc.) kept for ops troubleshooting.

---

## ✅ Validation Performed
1. **Local device testing** (iOS simulator + Android Pixel 5):
   * Home search (ZIP 46060, 25 mi) returns 5 shows.
   * Opening every show loads details error-free.
   * Organizer show displays booth list, date range, hours, entry fee & share/map buttons.
2. **Edge-case DB checks**
   * Verified `get_show_details_by_id` returns identical shape for:
     * legacy shows (no organizer)
     * shows **without** dealers
     * shows **with** dealers
3. **Unit tests** – 22 new tests around date / time utilities (all green).

---

## 🚀 Deployment / Roll-back
1. Run **one** of:
   ```bash
   ./final-fix.sh          # guided CLI
   # or
   psql < apply-final-fix.sql
   # or
   Supabase SQL editor ➜ paste `apply-final-fix.sql`
   ```
2. `git pull && expo start --clear`
3. Smoke-test homepage & a random Organizer show.

Rollback: `git revert` this commit set + restore the previous versions of the affected SQL functions (all backups are appended at bottom of each migration).

---

## ⚠️ Risks & Mitigations
* **DB function overwrite** – mitigated by automatic backup inside migration + explicit grant recreation.
* **Unexpected nulls** – handled via exhaustive `COALESCE` + front-end fallbacks.
* **Supabase RBAC** – functions created with `SECURITY DEFINER`, identical privileges to prior versions.

---

## 📎 Related Issues / Tickets
* #174 “Homepage shows 0 results after organizer changes”
* #189 “Show details crash for organizer shows”
* Sentry #1022 `Text strings must be rendered within a <Text> component`

---

## 🤝  Credits
Thanks to the ops team for live DB access during triage and the QA team for edge-case datasets. Original SQL bug‐hunting and front-end hardening generated with assistance from **Factory AI**.
