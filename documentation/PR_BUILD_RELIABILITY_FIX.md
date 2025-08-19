# PR: Build Reliability — Hermes Standardisation & Native-Module Stability  

## Overview  
This PR removes the long-standing *“Hermes vs JSC”* mismatch that caused
sporadic native-module crashes, CI flakiness and “cannot find XXX”
runtime errors.  
It **standardises the JavaScript engine to Hermes on both iOS and
Android**, aligns *new-architecture* flags and adds an end-to-end cleanup
script so every developer and CI job builds from a known-good state.

## Key Problems Fixed  
| Issue | Before | After |
|-------|--------|-------|
| Engine mismatch | iOS → Hermes  •  Android → JSC | **Both platforms use Hermes** |
| Metro conflict | `hermesEnabled: true` forced, but Android disabled Hermes | Metro no longer overrides build-time engine |
| New Architecture flags | `newArchEnabled=true` (Android) vs `false` (iOS) | **Unified:** `false` everywhere for stability |
| Cache drift | Stale Pods / Gradle / Metro cache frequently broke clean clones | **`fix-build-reliability.sh`** wipes & regenerates native projects |

## What Changed  
### 1 · Configuration Files  
* **`android/gradle.properties`**  
  * `hermesEnabled=true`  
  * `newArchEnabled=false`
* **`ios/Podfile.properties.json`**  
  ```json
  {
    "expo.jsEngine": "hermes",
    "newArchEnabled": "false",
    "EX_DEV_CLIENT_NETWORK_INSPECTOR": "true"
  }
  ```
* **`metro.config.js`** – removed hard-coded `hermesEnabled` transformer flag.

### 2 · Utilities  
* **`fix-build-reliability.sh`**  
  * One-click script that  
    1. Backs up configs  
    2. Applies the settings above  
    3. Clears Watchman / Metro / Gradle / Pods / DerivedData caches  
    4. Runs `expo prebuild --clean`, `pod install`, `./gradlew clean`

### 3 · Documentation  
* **`BUILD_RELIABILITY_FIX.md`** – step-by-step manual guide, common error
  table, rollback instructions and CI notes.

## How to Test  
1. `./fix-build-reliability.sh` (answer *y* when asked to reinstall node-modules).  
2. **iOS:** `npx expo run:ios` – first Metro line should read `Running Hermes`.  
3. **Android:** `npx expo run:android` – Logcat shows `Hermes has started`.  
4. Run smoke tests: `npm run test:e2e` – all should pass locally.  
5. Confirm app navigation, messaging and maps function normally.

## Roll-out Plan  
1. **Merge** -> triggers CI pipeline (EAS) which now prebuilds with Hermes.  
2. **Staging QA** – run Detox smoke batch.  
3. **Production builds** via EAS `production` profile (no config changes
   required).  
4. Monitor Sentry for any `JSC` keyword (should be none).  

## Back-out Procedure  
1. Revert this PR.  
2. Run `fix-build-reliability.sh` **again**, choose *rollback* option
   (script restores backed-up configs).  
3. `expo prebuild --clean` to regenerate native projects.

## Checklist  
- [x] Hermes enabled & verified on both platforms  
- [x] NewArch flag aligned  
- [x] CI green on iOS & Android build + test jobs  
- [x] Documentation updated  
- [x] Rollback instructions included  

---

*Happy building – no more “native module not found” surprises!*  
