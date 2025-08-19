# Social Media Icons – Implementation Guide  
`File: SOCIAL_MEDIA_ICONS_README.md`

---

## 1  Why the Change?
The app previously used generic Ionicons (`cart-outline`, `pricetag-outline`) for Whatnot & eBay links.  
To improve brand recognition we:

1. Added **official, on-brand logos** (SVG + PNG, transparent).
2. Created a **re-usable React-Native component** (`SocialIcon`) that encapsulates common sizing, touch-targets and accessibility.
3. Replaced Ionicon references in UI (Map call-outs, Profile screen, etc.).

---

## 2  Asset Overview

| Platform | Files (inside `assets/images/social/`) | Default icon size |
|----------|-----------------------------------------|-------------------|
| Whatnot  | `whatnot-logo.svg` `whatnot-logo.png`   | 20 × 20 px (1×), 40 × 40 px container |
| eBay     | `ebay-logo.svg` `ebay-logo.png`         | 20 × 20 px (1×), 40 × 40 px container |

All files use transparent backgrounds and official brand colours:
* Whatnot `#FF001F`
* eBay    `#E53238 / #0064D2 / #F5AF02 / #86B817`

> Tip: Add `@2x` / `@3x` PNGs if you need razor-sharp raster icons on very high-dpi devices.

---

## 3  The `SocialIcon` Component

```
src/components/ui/SocialIcon.tsx
```

Key points  
• Prop `platform` – `'facebook' | 'instagram' | 'twitter' | 'whatnot' | 'ebay'`  
• Prop `size` – icon edge length in px (default `20`)  
• Fully touchable: wraps icon in a `TouchableOpacity` using existing 40 × 40 container style.  
• Press callback via `onPress` (same signature as `TouchableOpacity`).  
• Falls back to Ionicons or remote PNG URLs for platforms that don’t yet ship custom assets.  

---

## 4  Code Changes

| File | Summary |
|------|---------|
| `assets/images/social/*` | Added SVG + PNG logos. |
| `src/components/ui/SocialIcon.tsx` | New component. |
| `src/components/ui/index.ts` | Re-export `SocialIcon`. |
| `src/components/MapShowCluster/MapShowCluster.tsx` | Replaced Ionicons with `<SocialIcon platform="whatnot|ebay" />`. |
| `src/screens/Profile/ProfileScreen.tsx` | Same replacement in the Social Links section. |

No other functional code paths were touched.

---

## 5  How to Use

```tsx
import SocialIcon from '@/components/ui/SocialIcon';

// minimal
<SocialIcon
  platform="whatnot"
  onPress={() => openUrl('https://whatnot.com/user/myshop')}
/>

// custom size & no grey background
<SocialIcon
  platform="ebay"
  size={28}
  style={{ backgroundColor: 'transparent' }}
  onPress={() => openUrl('https://ebay.com/usr/mystore')}
/>
```

---

## 6  Adding Another Platform

1. Drop `brandX-logo.svg` & `brandX-logo.png` in `assets/images/social/`.
2. Extend `SocialPlatform` union and `getImageSource()` / `getPlatformColor()` maps inside `SocialIcon.tsx`.
3. Replace legacy Ionicons in UI with new `<SocialIcon platform="brandX" … />`.

---

## 7  Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| **Blank square** instead of icon | Wrong asset path / filename typo | Verify file exists and matches `require()` path. |
| **Red ❌ “Unable to resolve module …png”** on bundler start | Metro cache stale | `npx expo start -c` or `npm start -- --reset-cache`. |
| **Icons mis-aligned / blurry** | Using SVG in RN older than 0.71 or missing `react-native-svg` | Use PNG fallbacks or add `react-native-svg` & `react-native-svg-transformer`. |
| **Press not registering** | Over-ridden `style` missing width/height | Ensure wrapper style still contains `width`, `height`, `justifyContent`, `alignItems`. |
| **Need high-dpi clarity** | Only 1× PNG provided | Add `*-logo@2x.png` (40×40) & `*-logo@3x.png` (60×60); RN auto-picks based on screen dpi. |

---

## 8  Credits & Licensing

Logos are trademarks of their respective companies.  
Usage here is purely as **link icons** pointing to user-supplied profiles/stores.  
Verify compliance with each platform’s brand guidelines before shipping to production.

---

Happy coding 🚀
