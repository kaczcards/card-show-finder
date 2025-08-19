# PR: Improve Reliability & Accessibility of “View Details” Buttons

## 1. What Was Implemented
This PR tightens up every user interaction that opens a detail screen:

* **Map Callout – “View Details”**
  * Enlarged hit-area and minimum height (44 px) per Apple/Google guidelines.
  * Added pressed-state styling and subtle scale animation for feedback.
  * Introduced a lightweight debounce that prevents duplicate navigations caused by rapid taps.

* **Dealers List – MVP Dealer rows**
  * Entire dealer row is now a single touch target rather than just the name text.
  * Applied the same debounce / pressed-state visual feedback.
  * Increased vertical & horizontal padding to meet the 48 × 48 dp Android guideline.

## 2. Why It Matters (User Experience)
Before this change users occasionally:

* Had to tap multiple times to open a show or dealer profile.
* Triggered **double navigations** that stacked the same screen twice.
* Missed the small text link (especially on larger phones or with screen protectors).

Improving touch targets and adding debouncing:

* Reduces frustration and perceived lag.
* Eliminates accidental duplicate screens that could break the back-stack.
* Meets accessibility recommendations for users with motor impairments.

## 3. Summary of Technical Changes
| Area | File | Key Changes |
| ---- | ---- | ----------- |
| Map Callout | `src/components/MapShowCluster/MapShowCluster.tsx` | • `navigateToShow()` wrapped in `useCallback` with `isNavigating` guard & 50 ms delay<br>• `pressedShowId` state to style “Opening…” button<br>• Increased padding / minHeight / hit-area sizes |
| Dealers List | `src/screens/ShowDetail/components/DealersList.tsx` | • `handleViewDealerDetails()` debounced with `isNavigating` + pressed IDs<br>• Row made fully touchable (`TouchableOpacity` wraps info + icons)<br>• Added visual pressed styles and bigger padding |
| Styling | same files | Larger buttons, darker pressed colours, activeOpacity 0.7 for uniform feedback |

No new dependencies, no breaking API changes.

## 4. Testing Requirements
1. **Map Show Callout**
   1. Tap “View Details” once → ShowDetail opens exactly once.
   2. Rapid-double-tap → still opens only once.
   3. Observe blue button darkens & text changes to “Opening…” momentarily.

2. **Dealers List**
   1. Scroll to MVP dealer; tap anywhere on the row → DealerDetail modal opens.
   2. Double-tap quickly → modal opens once.
   3. Verify row highlights light-blue while pressed.

3. **Hit-Area & Accessibility**
   * Use React Native debugger or Accessibility Inspector to confirm touch targets ≥ 44 × 44 (⌀ 48 dp on Android).

4. **Regression**
   * Non-MVP dealer rows remain non-clickable.
   * Back navigation behaves as expected; no duplicate screens in stack.

Happy to tweak the copy or styles if you have any feedback! 🎉
