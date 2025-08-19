# PR: UX Enhancements – Location Feedback & Interaction Reliability  
*(Droid-assisted pull-request)*

---

## Overview  
This PR bundles two high-impact usability improvements:

1. Contextual **toast notifications** that explain how the app determines/changes location.  
2. **“View Details” button reliability** upgrades – bigger touch-targets, debouncing, and visual feedback.

Together they reduce user confusion, prevent accidental double-navigations, and align the UI with mobile accessibility guidelines.

---

## 1. Location Toast Notifications  
### What’s New  
* Success/info/warning/error toasts configured globally.  
* Map & profile flows now surface non-intrusive messages when:  
  * GPS location is used.  
  * GPS fails ⇒ home ZIP fallback.  
  * No location available ⇒ prompt to set ZIP.  
  * User updates **Home ZIP** in profile (map recenters).  

### Technical Notes  
* Added `toastUtils.ts` with helper functions (`showGpsLocationToast`, `showLocationFailedToast`, `showLocationChangedToast`, etc.).  
* `App.tsx` now registers custom toast types (`success`, `info`, `warning`, `error`).  
* Integrated calls in `MapScreen.tsx` and `supabaseAuthService.ts`.

### Test Checklist  
1. **GPS Enabled:** launch map → “Using current location: <City>” toast.  
2. **GPS Denied / ZIP Fallback:** deny permission → warning toast with ZIP.  
3. **No GPS & No ZIP:** expect error toast and USA-center fallback.  
4. **Profile ZIP Change:** edit profile ZIP → info toast “Map centered on #####”.

---

## 2. “View Details” Button Reliability  
### What’s New  
* **Map callout button**  
  * Enlarged to 44 px min height (Apple) / 48 dp (Android).  
  * Debounced navigation prevents duplicate screens.  
  * Pressed-state style + “Opening…” text for feedback.  
* **MVP Dealer rows** in Show Detail  
  * Entire row is now a single touch target.  
  * Same debouncing & pressed-state visuals.  

### Technical Notes  
* State‐driven debounce (`isNavigating`, `pressedShowId/DealerId`).  
* `TouchableOpacity` `activeOpacity={0.7}` for consistent feedback.  
* Refactored styles for larger hit zones.

### Test Checklist  
1. **Map Callout:** single tap opens ShowDetail once; rapid double-tap still opens once.  
2. **Dealer Row:** tap anywhere on MVP dealer row opens DealerDetail once; double-tap guarded.  
3. Verify pressed visual (darker blue / light-blue row) and rebound after ~300 ms.  
4. Hit-area meets accessibility touch target guidelines.

---

## How to Review  
1. Pull branch `task-8-social-media-links`.  
2. Run `npm install` (toast lib already added).  
3. Test scenarios above on both iOS & Android simulators/devices.  
4. Confirm no regressions in navigation or existing toast flows.

---

*Generated with assistance from Factory Droid to streamline repetitive tasks and enforce consistency.*  
