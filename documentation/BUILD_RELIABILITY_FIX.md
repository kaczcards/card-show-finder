# Build Reliability Fix & Hermes Standardisation Guide  
Card-Show-Finder · July 2025

---

## 1. Goal

Eliminate sporadic “native module could not be found” and Hermes/JSC
mismatches by **standardising the JavaScript engine and build flags
_across both iOS and Android_**.

We will:

1. Adopt **Hermes** on both platforms (recommended by Expo 53 / RN 0.79).
2. Align new-architecture flags.
3. Clear all platform caches & rebuild.
4. Document troubleshooting & rollback.

---

## 2. Quick-Start (TL;DR)

```bash
# 1 · standardise settings
echo "hermesEnabled=true" >> android/gradle.properties
jq '.["expo.jsEngine"]="hermes"' ios/Podfile.properties.json | sponge ios/Podfile.properties.json
jq '.["newArchEnabled"]="false"'  android/gradle.properties | sponge android/gradle.properties

# 2 · clean everything
rm -rf ios/Pods ios/build android/.gradle android/app/build .expo .gradle
watchman watch-del-all || true
npm run clean          # expo start -c (clears Metro cache)

# 3 · regenerate native projects
npx expo prebuild --clean

# 4 · iOS
cd ios && pod install && cd ..
npx expo run:ios

# 5 · Android
cd android && ./gradlew clean && cd ..
npx expo run:android
```

If both apps launch, commit the config changes and push to CI.

---

## 3. Detailed Configuration Steps

### 3.1 Android

| File | Change | Why |
|------|--------|-----|
| **android/gradle.properties** | `hermesEnabled=true` | ensures Gradle includes `hermes-android` instead of JSC |
|    〃                         | `newArchEnabled=false` *(for now)* | avoids TurboModules / Fabric instability |
| **android/app/build.gradle** | No code change required— the React Native Gradle plugin already adds Hermes if `hermesEnabled=true`. Verify the clause: `if (hermesEnabled.toBoolean()) implementation("com.facebook.react:hermes-android")` | |

### 3.2 iOS

| File | Change | Note |
|------|--------|------|
| **ios/Podfile.properties.json** | `"expo.jsEngine": "hermes"` | Expo autolinking reads this flag |
|    〃                           | `"newArchEnabled": "false"` | keep parity with Android |
| **ios/Podfile** | No edit required — `use_react_native!( :hermes_enabled => … )` already delegates to the json value | |

After editing, run:

```bash
cd ios && pod deintegrate && pod install && cd ..
```

### 3.3 Metro

`metro.config.js` currently forces `hermesEnabled: true`.  
That’s now redundant but harmless; leave as-is or remove the key to fall
back on build-time engine detection.

---

## 4. Cache & Build Clean-Up

Order matters— a stale cache is the #1 source of “cannot find XXX” and
ABI mismatches.

1. **Watchman / Metro**  
   `watchman watch-del-all && rm -rf $TMPDIR/metro-*`
2. **Node Modules**  
   `rm -rf node_modules && npm i`
3. **Expo Prebuild**  
   `npx expo prebuild --clean` (regenerates android & ios folders)
4. **Pods / Gradle**  
   - iOS: `cd ios && pod install --repo-update && cd ..`  
   - Android: `cd android && ./gradlew clean && cd ..`
5. **Derived Data (Xcode)**  
   `rm -rf ~/Library/Developer/Xcode/DerivedData/*`

---

## 5. CI / EAS Build Changes

1. **EAS .json** – ensure `jsEngine` is omitted (Expo picks Hermes by default).
2. Add a step before native build jobs:

```yaml
- name: Prebuild & verify JS engine
  run: |
    npx expo prebuild --clean --non-interactive
    cat android/gradle.properties | grep hermesEnabled=true
```

3. Cache busting: include
   `~/.gradle`, `~/.expo`, `/Users/runner/Library/Caches/CocoaPods`.

---

## 6. Common Errors & Fixes

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| `ReferenceError: Property 'Intl' doesn't exist` | Running JSC on one platform | Confirm `hermesEnabled=true` everywhere |
| `Cannot load native module RNReanimated` | Incompatible version compiled against different engine | `npx expo install react-native-reanimated@latest && expo prebuild --clean` |
| Xcode linker error `duplicate symbol _hermes...` | Hermes linked twice | Remove manual `pod 'React-hermes'` lines; rely on `use_react_native!` |
| Android `DexArchiveMergerException` | Mixed Hermes & JSC bytecode | `./gradlew clean` then rebuild |

---

## 7. Verification Checklist

1. **Metro logs** show `Running Hermes` on first bundle line.
2. **Android Studio Logcat** contains `Hermes has started`.
3. **Xcode debug console** prints `HermesVMRuntime enabled`.
4. Run Detox smoke tests (`npm run test:e2e`) – should pass on both sims.
5. Play Store / TestFlight build succeeds via CI.

---

## 8. Rollback Plan

If unexpected regressions appear:

1. Edit `android/gradle.properties` → `hermesEnabled=false`
2. Edit `ios/Podfile.properties.json` → `"expo.jsEngine": "jsc"`
3. `npx expo prebuild --clean` and rebuild apps.

---

## 9. Future Work

- Re-enable **new architecture** (`newArchEnabled=true`) once TurboModules
  reach stable on React Native ≥ 0.80.
- Monitor React Native upgrade notes for Hermes flags removal.
- Automate engine consistency check in lint workflow.

---

### ✅ Outcome

With the above steps applied, both platforms share a single JavaScript
engine & build configuration, eliminating mismatched ABI crashes and
restoring deterministic builds in CI and on developer machines.
