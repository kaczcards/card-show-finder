# Replacing the Splash-Screen Image  
Card Show Finder – How to swap in the new logo

Follow these steps any time you need to change the image that appears while the app boots (Expo “splash screen”).

---

## 1. Add the new asset

| Destination | Recommended specs |
|-------------|-------------------|
| `assets/splash-icon.png` (or any name you prefer) | PNG • portrait-oriented • ~1242 × 2208 px (iPhone 8 Plus safe size) • `< 1 MB` |

1. Copy the logo file into `card-show-finder/assets/`.  
2. **Keep the filename lowercase with no spaces.**

> If you want to keep the old image for reference, rename it first, e.g.  
> `mv assets/splash-icon.png assets/splash-icon-backup.png`

---

## 2. Point Expo at the new file

### If you use `app.config.js`

```js
// app.config.js
module.exports = {
  …
  splash: {
    image: './assets/splash-icon.png',   // ← update this line
    resizeMode: 'contain',               // 'contain' keeps full logo visible
    backgroundColor: '#ffffff'           // brand or neutral colour
  },
  …
};
```

### If you use `app.json`

```json
{
  "expo": {
    …
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    }
  }
}
```

You can leave `resizeMode` as **contain** (recommended) or switch to **cover** if you want the image to fill the entire screen.

---

## 3. Clear caches & run locally

Expo often keeps the old asset cached:

```bash
# from repository root
npx expo start -c
```

The `-c` flag clears the Metro bundler cache so the new splash image is bundled.

---

## 4. Commit the change

```bash
git add assets/splash-icon.png app.config.js   # or app.json
git commit -m "Replace splash screen with new Card Show Finder logo"
git push
```

Create a PR and merge as usual.

---

## 5. Build production apps

After merging to your main branch:

```bash
eas build -p ios
eas build -p android
```

or trigger builds in the EAS dashboard. The new splash will appear in TestFlight / Play Store versions.

---

## 6. Troubleshooting

| Symptom | Fix |
|---------|-----|
| Old splash still shows | Make sure you ran `expo start -c` and rebuilt the standalone binaries. |
| Extra white space around logo | Try `resizeMode: 'cover'` **or** enlarge the PNG so it covers the safe area. |
| App crashes on launch | Ensure the image path is correct and the file is <10 MB. Large images can exceed the default memory budget on low-end devices. |

---

### Where else is the logo used?

The authentication screens now import the same file:

```
require('../../../assets/splash-icon.png')
```

By updating the splash asset above, the login & registration pages will automatically reflect the new logo — no extra work required.
