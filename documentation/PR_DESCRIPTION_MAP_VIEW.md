# Pull Request: Map View Enhancements (Phase 1 & Phase 2)

## Overview  
This PR introduces the first two phases of the **Map View Enhancement Roadmap**:

* **Phase 1 – Core Location & Map Integration**  
  The map now intelligently centers on the user’s current GPS location (with graceful fall-backs) and adds a working **“Center on User”** button.

* **Phase 2 – Enhanced Show Fetching & Display**  
  The map fetches and displays shows using robust geo-filtered queries that honour the full filter set. The interactive **Filter Sheet** is now live, enabling real-time radius, date-range, fee, category, and feature filtering.

Together these changes deliver a location-aware, filterable map experience that aligns with production standards for usability, permissions handling, and error resilience.

---

## Detailed Breakdown

### Phase 1 – Core Location & Map Integration
| Area | Change |
|------|--------|
| **`MapScreen.tsx`** | • Added `locationService` integration to obtain GPS coordinates.<br>• Implemented three-tier fallback for `initialRegion`: _GPS → homeZipCode → US center_.<br>• Replaced stubbed _“Center on User”_ button with `animateToRegion` logic and permission checks.<br>• Added defensive error & permission alerts (first-time and subsequent denials).<br>• Documented functions with inline JSDoc comments for maintainability. |
| **`locationService.ts`** | No functional changes required; existing helpers are utilised for permissions, geocoding, and caching. |

### Phase 2 – Enhanced Show Fetching & Display
| Area | Change |
|------|--------|
| **`MapScreen.tsx`** | • Refactored `fetchShows` to forward `latitude`, `longitude`, and all active filters to `showService.getShows`.<br>• Added `useEffect` to automatically re-query when filters or user location change.<br>• Integrated the **`FilterSheet`** component (previously commented-out) with props & callback wiring.<br>• Added banner showing _results count_ and _active radius_. |
| **`FilterSheet.tsx`** | No functional edits; component is now invoked from `MapScreen`. |
| **UX Copy & Styles** | • Added subtle loading indicators and improved empty-state messaging.<br>• Ensured consistent colour palette (#007AFF / #f8f8f8) and shadow elevation across new UI elements. |

---

## User Experience Improvements
1. **Instant Relevance** – App starts by showing events around the user or their home ZIP, eliminating manual panning.  
2. **One-Tap Re-Center** – Users can re-focus on their position at any time; helpful alerts guide them if permissions are disabled.  
3. **Full-Featured Filtering** – Bottom-sheet filter enables precise discovery without leaving the map; show pins update in real time.  
4. **Clear Feedback** – Result count banner, loading spinners, and descriptive alerts reduce confusion and improve trust.

---

## Roadmap – Upcoming PRs
| Future Phase | Scope (planned for separate PRs) |
|--------------|----------------------------------|
| **Phase 3 – Pin Clustering** | Introduce `react-native-maps-super-cluster` (or similar) and new `MapShowCluster` component to de-clutter dense regions. |
| **Phase 4 – View Toggle & Navigation** | Add Map/List toggle in navigation and ensure state persistence between views. |

---

## Testing Instructions for Reviewers

### Prerequisites
1. Checkout branch `feature/map-view-enhancements`.
2. Run `yarn` / `npm install` if dependencies changed (none added in this PR).
3. Start the app: `npx expo start` (ensure Expo Go permissions for location).

### Functional Tests
| Scenario | Steps | Expected Result |
|----------|-------|-----------------|
| **Initial Launch with GPS Enabled** | Launch app → open Map tab | Map centers on device location (≈ 0.5 ° delta). Pins load within default 25 mi radius. |
| **GPS Denied, Home ZIP Present** | Deny location → relaunch | Map centers on user’s `homeZipCode` coordinates (~2 ° delta). |
| **Both GPS & ZIP Unavailable** | Use a test profile without ZIP → deny GPS | Map opens on US center with “No shows found” banner (until panned/filtered). |
| **Center on User Button** | Tap ➜ Accept permission if prompted | Map animates to user; badge moves with location indicator. |
| **Filter Sheet** | Open sheet → change radius/date/fee etc. → Apply | Map updates markers; banner reflects new count & radius. |
| **Permission Re-Prompt** | Deny permanently → tap Center button | Alert shows rationale & guidance to settings (no crash). |

### Regression Tests
* Home list view still correctly fetches & displays shows.
* No authentication flow regressions.
* Map performance acceptable (no frame drops with typical pin counts).

---

### Review Checklist
- [ ] Code compiles & passes lint/tests  
- [ ] Location permission flows are user-friendly  
- [ ] All new UI adheres to design system colours & spacing  
- [ ] No PII or secrets committed  
- [ ] Documentation & comments are clear  

_Thank you for reviewing these enhancements. Feedback and questions are welcome!_
