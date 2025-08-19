# Pull Request: Fix Map Filter Button Position & Copy

## 1 · Problem Statement  
On the **Map** screen two issues harmed usability:  

1. The floating **Filter** button was absolutely-positioned and **overlapped** the information text box.  
2. The information text read *“Showing shows within 25 miles”* – a bit wordy and still clipped by the button.

Both problems reduced clarity and tappable area for a core discovery feature.

## 2 · Technical Solution  
1. **Removed absolute positioning** from the filter button (`position`, `top`, `left` removed).  
2. **Placed the button inside the same flex row** (`filterInfoContainer`) that hosts the info text so Flexbox handles layout.  
3. **Added `marginLeft: 10`** to `filterButton` for breathing room between text and button.  
4. **Re-worded the info text** from  
   `Showing shows within 25 miles` → **`Default: shows 25 miles`** (concise & descriptive).  
5. Maintained existing shadows, border radius and brand styling to preserve visual identity.

| File | Key Changes |
|------|-------------|
| `src/screens/Map/MapScreen.tsx` | – button style updated & moved, spacing added, **copy updated** |

## 3 · Before / After

|   | **Before** | **After** |
|---|------------|-----------|
| Screenshot | ![overlap_before](docs/images/overlap_before.png) | ![overlap_after](docs/images/overlap_after.png) |
| UX | Button **covers** part of text “Showing shows within … miles”. | Button and text sit **side-by-side**; text now reads “Default: shows 25 miles”. |
| Copy | Verbose copy, partially hidden. | Concise copy, fully visible. |

## 4 · Impact on User Experience  
* Restores a **clear, unobstructed filter button** critical for narrowing search results.  
* **Concise default text** informs users of the search radius without clutter.  
* Prevents accidental taps on hidden areas and improves visual hierarchy on all devices.  
* Aligns with accessibility guidelines (spacing ≥ 8 dp between interactive elements).  

## 5 · Testing Details  
### Manual Smoke Tests  
| Scenario | Device | Result |
|----------|--------|--------|
| Default Map view | iPhone 14 (iOS 17) | Proper layout, new copy visible |
| Default Map view | Pixel 6 (Android 14) | Proper layout, new copy visible |
| Tapping Filter | Both | Opens filter sheet |
| Orientation change | Both | Layout adapts, no overlap |

### Regression Checks  
* Verified *My Location* floating button still works.  
* Verified cluster markers and callouts unaffected.

## 6 · Visual Improvement Explanation  
Using **Flexbox** (`flexDirection: 'row'`, `justifyContent: 'space-between'`) avoids brittle absolute coordinates and scales gracefully. The text change shortens the label while clearly communicating the default search radius.

## 7 · No Breaking Changes  
* **Pure UI adjustment** – no business logic, navigation or API changes.  
* Safe to deploy via OTA; rollback is simple reversion.

---

### ✅ Ready for Review  
This PR resolves a high-priority usability issue by fixing element overlap **and** improving copy clarity. Please review and merge.  
