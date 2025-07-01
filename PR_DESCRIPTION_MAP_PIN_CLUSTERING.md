# Pull Request: Map Pin Clustering (Phase 3)

## Overview  
This PR delivers **Phase 3 – Pin Clustering** from the Map View Enhancement Roadmap.  
Using `react-native-maps-super-cluster`, map markers are now intelligently grouped into interactive clusters that expand as the user zooms, dramatically improving map readability and performance when many shows are displayed.

---

## Detailed Breakdown of Changes

| Area | Description |
|------|-------------|
| **Dependencies** | • Added **react-native-maps-super-cluster @ 1.6.0** and supporting spatial libs. |
| **`src/components/MapShowCluster/`** | • **New component** encapsulating the clustered `MapView`.<br>• Renders clusters with count badge & individual markers with rich call-outs.<br>• Converts `Show` objects into cluster-friendly points.<br>• Exposes props for region control, callbacks, & UX toggles. |
| **`src/components/MapShowCluster/index.ts`** | Barrel export for cleaner imports. |
| **`src/screens/Map/MapScreen.tsx`** | • Replaced raw `MapView` + markers with `<MapShowCluster>`.<br>• Managed `currentRegion` state & forwarded region changes to the clusterer.<br>• Updated “Center on User” logic to animate the clustered map.<br>• Removed now-unused inline marker rendering code. |
| **`package.json / yarn.lock`** | Added new dependencies; lock-file updated automatically. |

---

## User Experience Improvements
1. **Decluttered Map** – Dense areas now show a single, easily readable cluster badge instead of dozens of overlapping pins.  
2. **Smooth Exploration** – Tapping a cluster zooms in smoothly to reveal underlying shows; spiral visualization prevents overlap.  
3. **Performance Boost** – Rendering hundreds of shows is now far more efficient, keeping frame rates high on mid-range devices.  
4. **Consistency** – Cluster colour and typography match the existing brand palette (#007AFF) for a seamless UI.

---

## Testing Instructions for Reviewers

### Prerequisites
1. `git checkout feature/map-pin-clustering`
2. `yarn` or `npm install` (new deps)
3. `npx expo start` in a device/emulator with location permissions enabled.

### Functional Tests
| Scenario | Steps | Expected Result |
|----------|-------|-----------------|
| **Clusters Appear** | Launch app → Map tab at default zoom | Nearby shows grouped into numbered blue circles. |
| **Cluster Expansion** | Tap a cluster | Map zooms & either reveals sub-clusters or individual show pins. |
| **Spiral Rendering** | Zoom in fully on tightly packed markers | Pins spiral out so each is selectable; no overlap. |
| **Call-out Integrity** | Tap an individual pin | Custom call-out appears with title, date, address & “View Details” button. |
| **Center on User** | Tap “locate” button | Map animates to user; clustering still works at new zoom level. |
| **Performance Check** | Pan across high-density regions | No noticeable lag; FPS remains smooth. |

### Regression Tests
- Filter sheet still filters results correctly.
- Home list view remains unaffected.
- No crashes when permissions are denied.

---

## Notes & Next Steps
*Phase 4 – Navigation Toggle* (switching between list & map views) will be addressed in a **separate PR**, keeping this change set focused on clustering functionality.

Thank you for reviewing! Feedback is welcome.
