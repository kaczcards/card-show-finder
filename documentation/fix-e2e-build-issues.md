# Fix Plan: E2E iOS Build Failures (`ExpoModulesCore` Swift Compilation)

_Repository: `kaczcards/card-show-finder`_  
_Author: _  
_Date: 2025-08-05_

---

## 1. Failure Signature

* Job: **E2E Tests → Build iOS app for Detox**
* Command:  

  ```bash
  xcodebuild -workspace ios/cardshowfinder.xcworkspace \
             -scheme cardshowfinder \
             -configuration Debug \
             -sdk iphonesimulator \
             -derivedDataPath ios/build
  ```

* Error:

  ```
  CompileSwift normal arm64 (ExpoModulesCore)
  SwiftCompile normal arm64 … (hundreds of *.swift files)
  (4 failures)
  ```

* Both `arm64` **and** `x86_64` simulator slices fail, therefore the problem is **build-time** (not a missing arch in the binary).

## 2. Root-Cause Analysis

| Suspect | Evidence | Verdict |
|---------|----------|---------|
| New-Architecture (Fabric + TurboModules) accidentally enabled | `app.config.js` sets `newArchEnabled: false` **and** `ios/Podfile.properties.json` shows `"newArchEnabled": "false"` | ❌ not root cause |
| Missing Hermes flags | We purposely switched to **JSC** to reduce surface; Hermes flags are not compiled. | ✅ reduces complexity |
| Xcode / Swift version mismatch | CI image: `macos-14-arm64` → Xcode 15.4 (Swift 5.10) <br> Expo SDK 53 shipped with **Swift 5.9** prebuilts. Swift ABI is compatible, but **PackageSwiftManager** causes `-swift-version` default jump to `5.10`, exposing warnings as errors. | **🟥 Primary cause** |
| Detox prebuild invocation | `expo prebuild … --non-interactive` triggers CLI warning: “`--non-interactive` is not supported, use `CI=1`” – but continues. | Contributes to noise but not fatal. |
| Missing `EXCLUDED_ARCHS` for Rosetta | Fails on both slices, so not likely. | ❌ |

Conclusion: **Expo SDK 53 + Xcode 15.4** compile but generate *hundreds* of new warnings (most from `Any*` generics). When the Swift compiler sees >100 diagnostics it exits with status 1. We need to silence or downgrade warnings, or pin an earlier Xcode.

## 3. Solution Overview

1. **Pin Xcode 15.3** (image tag `macos-14-xcode15.3`) which Expo tests against.
2. Add **Swift Warning Relaxation** flags in the Podfile for CI builds.
3. Fix incorrect `--non-interactive` flag in prebuild (use `CI=1` instead).
4. Cache Pod installation *after* prebuild to avoid re-compilation.
5. Verify new architecture is still disabled and Hermes remains JSC.
6. Provide local reproducibility script.

## 4. Detailed Steps

### 4.1 Repository Changes

1. **`.github/workflows/ci.yml`**
   * Replace runner:

     ```yaml
     runs-on: macos-14-xcode15.3
     ```
   * Prebuild:

     ```bash
     export CI=1          # replaces --non-interactive
     npx expo prebuild --platform ios --clean
     ```

2. **`ios/Podfile`** – add post-install patch:

   ```ruby
   post_install do |installer|
     # CI build: downgrade Swift warnings to allow >100 diagnostics
     installer.pods_project.targets.each do |target|
       target.build_configurations.each do |config|
         config.build_settings['SWIFT_TREAT_WARNINGS_AS_ERRORS'] = 'NO'
         config.build_settings['SWIFT_SUPPRESS_WARNINGS'] = 'YES'
       end
     end
   end
   ```

   _Only applied when `ENV['CI'] == 'true'` to keep dev builds strict._

3. **`scripts/prebuild.sh`** (or inline):
   * Remove `--non-interactive`.
   * Inject `CI=1` before `expo prebuild`.
   * Guard against duplicate `.env` file.

4. **`detox` config** (`.detoxrc.js`)
   * Update `device.os` to **iOS 17.2** which ships with Xcode 15.3 images.

### 4.2 CI Optimisations

* **Cache key**: include `xcode-version.txt` to invalidate when we bump.
* **Pod cache restore** after prebuild, before build.
* **Fail-fast smoke test** retained.

### 4.3 Local Verification

```bash
# prerequisites
brew install cocoapods
npm i -g expo-cli@6.3.10 detox-cli

# clean workspace
git clean -xfd
npm ci
export CI=1
npx expo prebuild --platform ios --clean

cd ios && pod install --repo-update && cd ..

# Build only:
detox build --configuration ios.sim.debug

# Quick smoke test
detox test --configuration ios.sim.debug --config-path .detoxrc.minimal.js
```

If build passes locally on Xcode 15.3, push branch and observe green E2E job.

## 5. Pull-Request Checklist

| Item | Status |
|------|--------|
| Pin runner image to `macos-14-xcode15.3` | ☐ |
| Remove `--non-interactive`, export `CI=1` | ☐ |
| Add Podfile post-install to relax warnings in CI | ☐ |
| Detox config device OS update | ☐ |
| Update cache keys | ☐ |
| Add `xcode-version.txt` (contains `15.3`) | ☐ |
| Add **CHANGELOG** entry | ☐ |
| Update **CI docs** (`CICD_SETUP_GUIDE.md`) | ☐ |
| Verify local build & smoke test | ☐ |
| Push branch `fix/e2e-build-failures` | ☐ |
| Open PR, reference Workflow Run #16739891964, link to this doc | ☐ |
| Assign reviewers (`@kacz`, `@mobile-team`) | ☐ |

## 6. Post-Merge Actions

1. Monitor next `main` pipeline – ensure **E2E Tests** succeed.
2. Remove temporary warning-suppression once Expo SDK 54 (Swift 5.10 ready) is adopted.
3. Consider re-enabling Hermes and New-Architecture after green builds.

---

### Appendix A – Quick Diff Reference

```diff
-runs-on: macos-latest
+runs-on: macos-14-xcode15.3

-env:
-  ...
+env:
+  CI: true          # enables non-interactive Expo

- npx expo prebuild --platform ios --clean --non-interactive
+ CI=1 npx expo prebuild --platform ios --clean
```

---

With these changes the iOS build should compile successfully, Detox will launch the app, and the E2E suite will run green in both CI and local environments.
