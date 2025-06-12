# Banner Image Guide  
Card Show Finder – Register Screen

## 1. What Are We Adding?
The Register screen now supports two decorative marketing banners:

| Position | React Native component | Visual placement |
|----------|-----------------------|------------------|
| Top banner | `<Image source={require('../../assets/top_banner.png')}/>` | Directly **above** the “Create Account” button |
| Bottom banner | `<Image source={require('../../assets/bottom_banner.png')}/>` | Directly **below** the “Already have an account? Login” text |

Both images are referenced from the project’s `assets/` folder.

---

## 2. Image Specifications

| Banner | Recommended Size\* | File Type | File Name |
|--------|--------------------|-----------|-----------|
| Top    | **750 × 150 px**   | PNG (preferred) or JPG | `top_banner.png` |
| Bottom | **750 × 120 px**   | PNG (preferred) or JPG | `bottom_banner.png` |

\*The width-to-height ratio is more important than exact pixel size. React Native scales images across devices; keeping to the suggested aspect ratios (5 : 1 and ~6 : 1) ensures they render crisply without distortion.

### Design Tips
* Use transparent backgrounds if the banner should float over white.
* Keep file size under ~200 KB to avoid slowing initial load.
* Avoid small text—on phones anything under 28 px often becomes unreadable.

---

## 3. File Location & Naming

```text
card-show-finder/
└─ assets/
   ├─ top_banner.png       ← place your top banner here
   └─ bottom_banner.png    ← place your bottom banner here
```

**Important:**  
• Keep the exact filenames (`top_banner.png`, `bottom_banner.png`).  
• If you choose different names or file types, update the imports in `src/screens/RegisterScreen.js` accordingly.

---

## 4. Code References

The banners are already wired into `RegisterScreen.js`:

```tsx
<Image source={require('../../assets/top_banner.png')}  style={styles.banner} />
...
<Image source={require('../../assets/bottom_banner.png')} style={[styles.banner,{marginTop:20}]} />
```

`styles.banner` ensures:

```js
banner: {
  width: '100%',
  height: 150,        // change if your aspect ratio differs
  resizeMode: 'contain',
  marginVertical: 10,
},
```

### Changing Banner Height
If your design is taller or shorter, open _RegisterScreen.js_ and adjust `height` inside `styles.banner`.

---

## 5. Updating the App

1. Drop the final PNG/JPG assets into `assets/`.
2. Run the project:

```bash
npm start       # or expo start
```

3. Load the Register screen on a device / emulator—banners should appear automatically.
4. If the images don’t refresh, clear Metro cache:

```bash
expo start -c
```

---

## 6. Troubleshooting

| Issue | Solution |
|-------|----------|
| Image doesn’t show | Check the filename & path. Remember React Native’s `require` is static—rebuild if you renamed a file. |
| Blurry banner | Provide a 2× or 3× resolution (e.g., 1500×300) while keeping the same aspect ratio. |
| Banner stretches | Ensure the original aspect ratio matches the container height set in `styles.banner`. |

---

Happy branding! These banners complete the updated Register flow text (“The easiest way to find trading card shows near you”) and new role descriptions. If further layout tweaks are needed, edit only `src/screens/RegisterScreen.js`—no other files reference these images.
