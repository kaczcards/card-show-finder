# Project Health Cleanup Guide  
Card-Show-Finder · July 2025  

Expo Doctor reported a handful of **non-critical** warnings after the Hermes
standardisation work.  
These do **not** block builds but tidying them up will keep CI, EAS Build and
new-developer onboarding friction-free.

---

## 1 · Remove Extra Lock Files

| Warning | Why it matters |
|---------|----------------|
| “Multiple lock files detected (pnpm-lock.yaml, yarn.lock)” | EAS Build and most CI flows infer the package manager from the *first* lock file they find. Extra files can cause dependency drift. |

**Fix**

```bash
# keep *one* lock file that matches your package manager (npm by default)
git rm pnpm-lock.yaml yarn.lock           # remove extras
npm install                               # regenerate package-lock.json if needed
git add package-lock.json
git commit -m "chore: remove extra lock files"
```

---

## 2 · Resolve App-Config Schema Errors

| Field | Issue | Quick Fix |
|-------|-------|-----------|
| `Android.adaptiveIcon.foregroundImage` | Image must be square (1024×1024). Current: 1024×1536 | Replace with square PNG |
| `Splash.image` | File content is PNG but filename is .jpg | Rename to `.png` **or** convert to JPEG |
| `icon` | Must be square (1024×1024). Current: 1024×1536 | Resize & overwrite `./assets/icon.png` |

After updating assets:

```bash
# verify images
npx expo-optimize
```

---

## 3 · Consolidate `app.json` vs `app.config.js`

*Warning*: “You have an app.json file in your project, but your app.config.js is not using the values from it.”

**Fix options**

1. **Preferred** – delete `app.json`, keep only the dynamic
   `app.config.js`:
   ```bash
   git rm app.json
   ```
2. Or **merge** static values into `app.config.js` and reference via
   `export default { ... }`.

Commit the cleaned configuration.

---

## 4 · Native Folders & Prebuild Sync

Warning: “android/ios folders present ‑ EAS Build will not sync certain
config fields.”

Because the project is **prebuild (CNG)** these folders should be ignored
by Git to let EAS regenerate them.

```bash
echo "/android" >> .gitignore
echo "/ios"     >> .gitignore
git add .gitignore
git commit -m "chore: ignore native folders for CNG workflow"
```

If you require full-native edits, keep the folders but remember that
fields like `icon`, `orientation`, `plugins` in `app.config.js` will **not**
auto-sync – update native code manually.

---

## 5 · Unknown Packages in React-Native Directory

Warning: “No metadata available: lodash, react-native-vector-icons”

This is informational only.  
Silence it by adding the setting to **package.json**:

```jsonc
{
  // ...
  "expo": {
    "doctor": {
      "reactNativeDirectoryCheck": {
        "listUnknownPackages": false
      }
    }
  }
}
```

Commit the change:

```bash
git add package.json
git commit -m "chore: suppress RN Directory unknown package warnings"
```

---

## Verification

```bash
npx expo-doctor --fix-dependencies
```

Expected output: **All checks passed**.

---

### ✅ Outcome

Following this guide will bring the project to a **clean Expo Doctor
state**, eliminating minor CI annoyances and ensuring predictable builds
for every contributor.
