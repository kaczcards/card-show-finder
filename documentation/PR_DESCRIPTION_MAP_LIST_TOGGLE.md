# Pull Request: List ↔ Map Toggle (Phase 4)

## Overview  
This PR completes **Phase 4 – Navigation & Overall UX** of the Map View Enhancement Roadmap.  
A new **tabbed interface** lets users switch instantly between the traditional _list_ view and the enhanced _map_ view while **sharing the same filters, location and scroll state**. This delivers a cohesive discovery experience without forcing users to navigate away or re-select filters.

---

## Detailed Breakdown of Changes

| Area | Change |
|------|--------|
| **`src/screens/Home/HomeTabsScreen.tsx`** | • **New container component** built with `@react-navigation/material-top-tabs`.<br>• Manages shared state (`filters`, `userLocation`, _active tab_) and persists filters via `AsyncStorage`.<br>• Injects props into `HomeScreen` and `MapScreen` so both views stay in sync. |
| **`src/screens/Home/HomeScreen.tsx`** | • Refactored to accept optional props (`customFilters`, `onFilterChange`, `onShowPress`, `userLocation`).<br>• Maintains backward compatibility: if no props are supplied it behaves exactly as before (stand-alone list). |
| **`src/screens/Map/MapScreen.tsx`** | • Added support for optional props to allow external filter / navigation control.<br>• Honors an initial user location provided by parent container and syncs filter updates back up. |
| **`src/screens/Home/index.ts`** | • Default export now points to **`HomeTabsScreen`** to expose the new list/map toggle.<br>• Still exports `HomeScreen` separately for legacy imports. |
| **Navigation** | No structural changes required; `MainTabNavigator` continues to reference `Home` which now renders `HomeTabsScreen`. |
| **State Persistence** | • Filters are saved to `AsyncStorage`; switching tabs or reopening the app restores prior selections. |

---

## User-Experience Improvements
1. **One-Tap View Toggle** – Users can swipe or tap between “List” and “Map” tabs without losing context.  
2. **Zero Re-filtering** – Radius, date range, categories, etc. persist across both views and sessions.  
3. **Shared Location Context** – Current GPS / ZIP location is resolved once and reused, avoiding duplicate permission prompts.  
4. **Consistent Styling** – Tab bar matches brand colours (#007AFF active, #666 inactive) and elevates above content for clarity.

---

## Testing Instructions for Reviewers

### Prerequisites
```
git checkout feature/map-list-toggle
yarn            # or npm install – no new native deps
npx expo start
```

### Functional Tests
| Scenario | Steps | Expected Result |
|----------|-------|-----------------|
| **Toggle Works** | Open app → Home tab → switch between “List” & “Map” | Same results set shown; no reload flashes. |
| **Filter Sync** | In List view tap **Filters** → change radius/date | Map view immediately reflects new pins; banner shows correct radius. |
| **State Persistence** | Apply filters → close app (⌘Q / swipe away) → reopen | Selected tab & filters restored. |
| **Navigation to Detail** | Tap a show in either tab | `ShowDetail` screen opens; back returns to originating tab. |
| **Permissions** | Deny location then use tabs | Alerts behave as in previous phases; no crashes. |

### Regression Checks
- **Standalone Import**: `import { HomeScreen } from 'screens/Home'` still renders list view correctly in isolation.
- Other tabs (Collection, Badges, etc.) unaffected.

---

## Backward Compatibility / Rollback Notes
* No database or API contract changes.  
* `HomeScreen` remains export-able and functional on its own.  
* If the toggle interface causes issues it can be rolled back by changing **one line** in `src/screens/Home/index.ts` to export `HomeScreen` as default.  
* All new code is additive or gated behind optional props.

---

Thank you for reviewing. Please focus on the new tab behaviour and shared-state logic. Feedback is appreciated!
