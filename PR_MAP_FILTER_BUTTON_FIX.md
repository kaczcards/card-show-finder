# Pull Request: Fix Map Filter Button Positioning Overlap

## 1 · Problem Statement  
On the **Map** screen the floating *Filter* button was absolutely-positioned near the top-left corner.  
Because of that placement it **overlapped the informational text box** (“Showing shows within … miles”), making both the text and the button hard to read and tap. This UI collision degraded usability of a core discovery feature and looked unpolished on small-screen devices.

## 2 · Technical Solution  
1. **Removed absolute positioning** from the filter button (`position`, `top`, `left` were deleted).  
2. **Placed the button inside the same flex row** (`filterInfoContainer`) that already hosts the info text, letting Flexbox handle layout.  
3. **Added `marginLeft: 10`** to `filterButton` to create clear separation from the text.  
4. Kept existing shadow, border radius and brand styling so the visual identity remains intact.

| File | Key Changes |
|------|-------------|
| `src/screens/Map/MapScreen.tsx` | – button style updated, **moved into flex row**, spacing added |

## 3 · Before / After

|   | **Before** | **After** |
|---|------------|-----------|
| Screenshot | ![overlap_before](docs/images/overlap_before.png) | ![overlap_after](docs/images/overlap_after.png) |
| UX | Button sits **on top of** text box – obscures content and shrinks tap area. | Button and text sit **side-by-side**, each fully visible and tappable. |

## 4 · Impact on User Experience  
* Restores a **clear, unobstructed filter button**, critical for narrowing search results.  
* Prevents accidental taps on hidden area of the button/text.  
* Improves visual hierarchy and overall polish, especially on devices ≤ 5.5″.  
* Aligns with accessibility guidelines by ensuring a minimum 8 dp gap between interactive elements.

## 5 · Testing Details  
### Manual Smoke Tests  
| Scenario | Device | Result |
|----------|--------|--------|
| Default Map view | iPhone 14 (iOS 17) | Button aligned, no overlap |
| Default Map view | Pixel 6 (Android 14) | Button aligned, no overlap |
| Tapping Filter | Both | Opens filter sheet as expected |
| Orientation change | Both | Layout adapts, no overlap |

### Regression Checks  
* Verified *My Location* floating button still works.  
* Verified cluster markers and callouts unaffected.  

## 6 · Visual Improvement Explanation  
The change leverages **Flexbox** (`flexDirection: 'row'`, `justifyContent: 'space-between'`) so the text and button naturally share horizontal space. This avoids brittle absolute coordinates and scales gracefully across screen sizes. The added left margin creates visual breathing room without introducing additional containers.

## 7 · No Breaking Changes  
* **Pure UI adjustment** – no business logic, navigation or API changes.  
* No impacts to state management, data fetching, database, or build scripts.  
* Safe to deploy via OTA; roll-back is simply reverting this commit.

---

### ✅ Ready for Review  
This fix resolves a high-priority usability issue, enhancing the discovery experience without side effects. Please review and merge.
