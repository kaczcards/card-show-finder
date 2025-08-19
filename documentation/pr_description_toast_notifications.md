# PR: Enhance Location-Based UX with Toast Notifications

## 1. What Was Implemented
This pull-request introduces contextual toast messages that inform users **when and how** the app determines their location.  The new notifications surface in four scenarios:

1. **GPS success** – A brief “Using current location” toast with the detected city/neighborhood.
2. **GPS failure → ZIP fallback** – A warning toast explaining that the home ZIP code is being used instead.
3. **No location available** – An error toast prompting the user to set a home ZIP code.
4. **Profile ZIP change** – After a profile update, a toast confirms that the map has been re-centered on the new ZIP.

## 2. Why It Matters (User Experience)
Prior to this change, the map silently shifted between GPS, ZIP code, or default coordinates, leaving users confused about where results were coming from.  
Explicit, non-intrusive feedback:

* Builds trust—users understand *why* shows appear in a given area.  
* Reduces support questions about “wrong location” behaviour.  
* Encourages users without permissions to grant GPS or set a ZIP, improving data quality.

## 3. Summary of Code Changes
* **`src/utils/toastUtils.ts`**
  * Added helper functions: `showGpsLocationToast`, `showLocationFailedToast`, `showLocationChangedToast`, plus generic success/info/warning/error helpers.

* **`src/services/supabaseAuthService.ts`**
  * Captures previous `homeZipCode` before profile update and triggers `showLocationChangedToast` when the ZIP changes.

* **`src/screens/Map/MapScreen.tsx`**
  * Injected toast calls throughout:
    * Permission denial
    * GPS success
    * GPS failure / ZIP fallback
    * Generic location errors
    * “Locate me” button success/fallback logic

* **No new dependencies** – uses previously added `react-native-toast-message`.

## 4. Testing Requirements
1. **GPS Enabled Path**
   * Launch app with location permissions granted.
   * Observe “Using current location: *<City>*” toast on first map load and when tapping the “locate” button.

2. **GPS Denied Fallback**
   * Revoke location permission or decline prompt.
   * Ensure toast: “Location services unavailable – Using your home ZIP code (#####) instead”.
   * Map should center on stored ZIP.

3. **No GPS & No ZIP**
   * Sign in with a test account lacking `homeZipCode`.
   * Deny GPS permission → expect error toast advising to set ZIP + map falls back to USA center.

4. **Profile ZIP Change**
   * Navigate to profile, change Home ZIP to a new value, save.
   * Verify success toast: “Map centered on ##### – Your location has been updated”.
   * Returning to map should show area around new ZIP.

5. **Regression Sweep**
   * Confirm other toast types (success/error) still render correctly.
   * Run through existing unit & UI test suites—no failures expected.

---
Happy to answer any questions or adjust copy/behavior! 🎉
