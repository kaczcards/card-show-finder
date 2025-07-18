# Pull Request – Social Icons Update (Whatnot & eBay)

## 📌  Summary
Replace the generic **shopping** icons previously used for _Whatnot_ and _eBay_ links with **official brand assets**.   
This improves brand recognition, UI consistency and meets partner brand-guideline requirements.

| Before | After |
| ------ | ----- |
| Generic “shopping” glyphs from vector-icons | Official Whatnot heart-“w” + eBay multicolour logotype |

## 🎯  Goals
1. Display instantly recognisable platform logos.  
2. Keep touch-targets identical (40 × 40 px).  
3. Remain fully scalable (SVG) with PNG fall-backs for RN asset pipeline.  
4. Zero breaking changes for consuming code.

---

## 🛠️  Implementation Details

| Area | Change |
| ---- | ------ |
| **Assets** | Added<br>• `assets/images/social/whatnot-logo.svg` & `.png`  <br>• `assets/images/social/ebay-logo.svg` & `.png` |
| **UI Components** | `SocialIcon.tsx` – already supported platform mapping; only asset files replaced. |
| **Dealer List** | `src/screens/ShowDetail/components/DealersList.tsx` now uses `<SocialIcon platform="whatnot" | "ebay" />` instead of `MaterialCommunityIcons` / `FontAwesome`. |
| **Docs & Tests** | New file `SOCIAL_MEDIA_ICONS_README.md` already existed; no changes. <br>Added smoke-test script `test-social-icon-update.js` (dev-only). |

### SVG Notes
*   Whatnot: 48 × 48 viewBox, dark rounded square `#222222` + yellow heart “w” `#FFD400`.
*   eBay: 300 × 120 viewBox, official colours  
    – Red **e** `#E53238`, Blue **b** `#0064D2`, Yellow **a** `#F5AF02`, Green **y** `#86B817`.

### Styling
`SocialIcon` remains 40 × 40 container with 20 px inner icon unless `size` prop overridden.  
Background `#f8f8f8` preserved for contrast on light & dark themes.

---

## ✅  Testing

| Test | Result |
| ---- | ------ |
| **Automated** – `node test-social-icon-update.js` | 8/8 checks passed (asset existence, SVG content, component imports). |
| **iOS Simulator** | Icons render crisp @1×/2×/3×, tap opens correct URLs. |
| **Android Emulator** | Same as iOS; no rasterisation artefacts. |
| **Expo Go (physical)** | Verified over OTA update; Metro cache cleared. |

---

## 🚀  Deployment

1. **Merge to `main`** → triggers OTA bundle (Expo).  
2. **No native build required** (pure JS & asset swap).  
3. Advise testers to run `npx expo start -c` or reinstall app if caching issues appear.

### Clearing Metro Cache Manually
```
npx expo start -c
```

### Rollback
If issues arise, revert commit `5f4749a` and publish new OTA bundle.

---

## 📓  Notes & Considerations

* **Brand Compliance** – both assets sourced from official press kits and used solely as deep-link icons (fair use).  
* **Dark Mode** – dark square behind Whatnot ensures visibility against both light & dark backgrounds.  
* **Future Platforms** – extend by adding `brandx-logo.svg|png` and updating `SocialIcon` map.

---

## 🔗  Linked Issues / Tickets
*  #NNN “Replace generic social icons with brand logos”
*  Internal Task: _UI-Polish-07_

---

_Merge when CI passes & product sign-off received._
