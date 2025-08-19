# Pull Request: Remove **“Message MVP Dealer”** Button from Booth Info Pop-Up

---

## 1 · Why Is This Button Being Removed?

The **“Message MVP Dealer”** button currently appears in the booth-information pop-up, yet the direct messaging workflow for dealers is **not implemented in production**.  
Keeping a non-functional call-to-action:

* Confuses users who expect a working chat feature  
* Generates support tickets (“button does nothing”)  
* Undermines trust in new monetisation features

Removing the button **until the messaging release is ready** preserves a clean, predictable user experience.

---

## 2 · Technical Changes

| File | Key Update |
|------|------------|
| `src/components/DealerDetailModal.tsx` | • **Deleted** the entire “Message” `<TouchableOpacity>` section<br>• **Removed** `handleMessageDealer` function & `CommonActions` / `useNavigation` imports<br>• **Deleted** related StyleSheet entries (`messageButton`, `messageButtonIcon`, `messageButtonText`) |

*Total diff:* 50 lines removed, _0_ added – **pure deletion**, no new dependencies.

---

## 3 · User-Experience Impact

| Before | After |
|--------|-------|
| Pop-up shows **green “Message MVP Dealer”** button that opens nothing → user confusion. | Pop-up now shows only booth details. No dead-end actions. |

Benefits  
✔ Eliminates broken pathway – fewer frustrated taps  
✔ Keeps focus on available booth information  
✔ Sets accurate expectations until full dealer messaging ships

---

## 4 · Testing & Verification

### Manual Smoke Tests
1. Open Map → tap dealer pin → tap booth info pop-up  
   * ✅ Button **absent**; layout intact.  
2. Open same pop-up for multiple dealers & shows  
   * ✅ No visual regressions (spacing, shadows, scroll).  
3. Navigate back & forth between screens  
   * ✅ No crashes; modal life-cycle unaffected.

### Regression Checks
* Other modal actions (close, scroll) work as before.  
* No console or Metro warnings for missing navigation props.  
* TS compiler passes for the modified file.

---

## 5 · Advantages of Removing Non-Functional UI

* **Clarity:** Users see only features that truly work.  
* **Trust:** Avoids perception of “broken” or unfinished functionality.  
* **Focus:** UI stays lean, emphasising implemented value.  
* **Iteration:** Team can re-introduce the button with full chat logic in the future without legacy hacks.

---

## 6 · Safe Deployment Considerations

* **JavaScript-only change** – OTA update or next store build is sufficient.  
* **No DB / API / navigation routes altered.**  
* Rollback is trivial: revert commit and republish bundle.  
* CI should pass (lint & tests unaffected).

---

### ✅ Ready to Merge

This PR removes a non-functional feature, preventing user confusion and maintaining a polished UX while we finalise full dealer messaging.  
