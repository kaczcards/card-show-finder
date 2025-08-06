# Detox CI Pipeline – Device Configuration Fix

_Last updated: 2025-08-06_

## 1  Problem Statement

Our GitHub Actions **E2E** job (`npm run test:e2e:minimal`) failed with:

```
DetoxRuntimeError: Failed to find a device by type = "iPhone 15" and by OS = "iOS 18.5"
```

Root cause:

* The original **`.detoxrc.js`** & **`.detoxrc.minimal.js`** pinned **both** the
  device _and_ an explicit iOS runtime (`os: "iOS 18.5"`).
* The macOS runners used in GitHub Actions did **not** have that exact runtime
  installed, so `applesimutils` could not allocate a simulator and Detox
  aborted before any tests ran.

## 2  Solution Overview

1. **Remove explicit OS version**  
   Leaving the `os` field undefined lets Detox pick _any_ installed runtime that
   matches the requested device type.

2. **Select a device that exists on _all_ runners**  
   We use **`iPhone 15`** (present on every current Xcode 15/16 image).  
   Two additional fall-backs (`iPhone 14`, `iPhone 13`) are declared but not used
   by default—handy if GitHub downgrades or custom runners lag behind.

3. **Add a helper script** – `scripts/check-simulators.js`  
   Prints the full list of available simulators and validates our Detox config
   so we can spot incompatibilities _before_ tests run.

The fix is 100 % configuration-only: **no native rebuilds or code changes
required**.

## 3  Configuration Changes

### 3.1 `.detoxrc.js`

```diff
-device: {
-  type: 'iPhone 15',
-  os: 'iOS 18.5'
-}
+device: {
+  type: 'iPhone 15'        // no explicit OS
+}
+
+// ↓ optional fall-backs
+'simulatorLegacy':  { device: { type: 'iPhone 14' } }
+'simulatorLegacy2': { device: { type: 'iPhone 13' } }
```

### 3.2 `.detoxrc.minimal.js`

Same update: removed `os`, set `type: 'iPhone 15'`.

### 3.3 Helper Script

`scripts/check-simulators.js` (new):

* Runs `xcrun simctl list devices --json`
* Groups output by device/OS
* Verifies every device in Detox config exists
* Suggests alternative devices when mismatches found

Run it any time:

```bash
node scripts/check-simulators.js
```

> CI step **“Validate E2E configuration”** already executes this script.

## 4  Impact on CI

* **E2E job now succeeds** on both `macos-13` and `macos-14` runners.
* No workflow YAML changes were necessary; existing cache keys still work.
* Build times unchanged.

## 5  Developer Workflow

1. **Locally**

   ```bash
   # After Xcode update or switching toolchains
   brew install applesimutils   # if not installed
   npx detox clean-framework-cache
   node scripts/check-simulators.js
   npm run test:e2e:basic        # quick connectivity test
   ```

2. **Updating device type**

   *If GitHub ships newer images where `iPhone 15` disappears:*

   ```bash
   # Find another ubiquitous device
   node scripts/check-simulators.js
   # Edit .detoxrc.js / .detoxrc.minimal.js
   ```

3. **Pinning OS version (rarely recommended)**  
   Only do this for reproducibility in local runs; never commit the
   `os:` field to `main` or CI will likely break on the next Xcode refresh.

## 6  Troubleshooting Guide

| Symptom                                            | Checklist                                                                 |
|----------------------------------------------------|---------------------------------------------------------------------------|
| `Failed to find a device …`                        | • Run `node scripts/check-simulators.js` <br>• Confirm device exists      |
| Detox hangs on *“Installing app”*                  | • Run `xcrun simctl erase all` locally <br>• Ensure pod install succeeded |
| Simulator boots then immediately shuts down        | • Clean build (`detox clean-framework-cache`) <br>• Re-run build step     |
| CI job times out before tests start                | • Verify `ios.build` path in `.detoxrc.js` <br>• Check cache restore logs |

If issues persist, append `--loglevel verbose` to your Detox command and
attach the log when opening an issue.

## 7  References

* Detox docs – Device configuration  
  https://wix.github.io/Detox/docs/configuration/device
* GitHub Actions – macOS runner images  
  https://github.com/actions/runner-images
* applesimutils – CLI used internally by Detox  
  https://github.com/wix/AppleSimulatorUtils
