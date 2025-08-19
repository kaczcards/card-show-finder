# Fix: Show Creation Crash (`TypeError: undefined is not a function`)

## 1. Problem Statement
When a **Show Organizer** attempted to create a new show the app crashed with:

```
TypeError: undefined is not a function
```

Root cause:
* `src/screens/Organizer/AddShowScreen.tsx` tried to call `supabase.sql\`` — an API that **does not exist** in `@supabase/supabase-js` v2.x.
* This call was intended to convert latitude / longitude to a PostGIS `geography(point)` using `ST_SetSRID(ST_Point())`, but because the method is undefined the insert failed before reaching the database.

## 2. Solution Overview
1. **Removed the invalid `supabase.sql` tag**.
2. **Switched to Well-Known Text (WKT) strings** for coordinates:  
   `POINT(<longitude> <latitude>)`  
   Postgres automatically casts this text to a `geography(point)` column.
3. Added a **lightweight geocoding helper** (Nominatim) directly in the screen to avoid the broken import.
4. Preserved and refined:
   * Pre-submit address validation
   * Geocoding accuracy checks
   * Friendly, specific error messages
5. Hardened database error handling with code-aware messages (23502, 23505, 42883).

## 3. Technical Details
| Area | Before | After |
|------|--------|-------|
| Coordinate insertion | ``supabase.sql\`ST_SetSRID(ST_Point(${lng}, ${lat}), 4326)::geography\``` | ``coordinates: \`POINT(${lng} ${lat})\``` |
| Geocoder import | `import { geocodeAddress } from '../../services/locationService'` (caused bundling issues) | Inline async `geocodeAddress()` util using OpenStreetMap |
| Error handling | Generic `alert(error.message)` | Granular handling of Postgres codes + user guidance |
| Validation | Basic required-field checks | • State regex<br>• ZIP regex (5 or 5+4)<br>• PO Box prevention |

## 4. Testing Approach
* **Manual flows**
  1. Login as organizer → Add Show  
     ✔️ Show saved without crash  
     ✔️ Coordinates present in DB (`SELECT ST_AsText(coordinates)` returns POINT)
  2. Enter invalid state/ZIP → Validation message shown, save blocked.
  3. Force Postgres RLS/NULL violations → Custom error copy displayed.

* **Database sanity check**  
  Inserted a test record with WKT, queried back, confirmed `ST_X/ST_Y` match original lat/lng (tolerance < 0.0001).

* **Regression**  
  Verified existing map & list screens still render newly created show pins.

## 5. Impact
* **Stability** – Eliminates a hard crash during a primary workflow.
* **Data Integrity** – Ensures all shows carry valid PostGIS coordinates, enabling accurate spatial queries.
* **User Experience** – Clear guidance replaces cryptic errors; address mistakes caught early.
* **No breaking API changes** – Only internal screen logic touched.

## 6. Files Changed
| File | Purpose |
|------|---------|
| `src/screens/Organizer/AddShowScreen.tsx` | • Replace `supabase.sql` with WKT string<br>• Inline geocoder<br>• Enhanced validation & error handling |

---

> _“Create Show” now works flawlessly for organizers; data flows to PostGIS in the correct format and the app is production-ready for this path._
