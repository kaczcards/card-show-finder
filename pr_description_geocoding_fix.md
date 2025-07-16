# PR: Fix Missing Coordinates on Newly-Created Shows (Geocoding Patch)  
*Droid-assisted pull-request*

---

## 1. The Bug

When organisers created a show via **Add Show**, the app saved all textual fields but never translated the street address into latitude/longitude.  
Supabase therefore stored `NULL` for `latitude` and `longitude` and PostgreSQL’s PostGIS defaulted both to **0,0**.  
Because multiple “coordinate-less” shows shared that (0, 0) placeholder, the Map screen:

* Skipped them during distance queries (`nearby_shows` RPC ignores 0,0)  
* Layered several shows on a single invisible pin near the Gulf of Guinea  
* Left organisers puzzled as to why their new show never appeared

---

## 2. The Fix

1. **AddShowScreen.tsx**  
   • Builds the full address string and calls `locationService.geocodeAddress(address)` before inserting.  
   • Aborts with a helpful alert if geocoding fails.  
   • On success injects `latitude` & `longitude` into the `shows` insert payload.

2. **locationService.ts** already contained `geocodeAddress`; no changes required.

_No schema changes or extra libraries were needed._

---

## 3. How to Test

1. **Happy Path**  
   1. In the Organizer flow, create a new show with a real address.  
   2. After “Success” dialog, open Map → ensure a new pin appears at the correct location.  
   3. Click the pin → Show Detail opens and displays the correct title.

2. **Database Verification**  
   * In Supabase SQL runner:  
     ```sql
     select title, latitude, longitude
     from shows
     order by created_at desc
     limit 1;
     ```  
     → The new row should have non-null lat/lng distinct from 0,0.

3. **Bad Address Handling**  
   1. Enter an obviously invalid address (e.g., “asdf qwerty”).  
   2. Tap **Create Show** → Alert should read “Address Not Found” and the show is **not** saved.

4. **Regression Sweep**  
   * Editing existing shows still works (Edit flow stub unchanged).  
   * Map clustering & toasts continue to function.

---

## 4. Notes

*This is a Droid-assisted PR generated with Factory to automate repetitive boilerplate and ensure consistent documentation.*  
