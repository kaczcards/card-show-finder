# Temporary Android Keystore By-Pass Guide  
_(Card Show Finder CI / EAS Builds)_

## 1. Why You Might Need This
Google Play blocks uploading signed artifacts until certain API-key or listing approvals are complete.  
While waiting you may still want:

* Fresh iOS binaries 📱
* OTA / test updates for Android QA 🧪
* A green CI pipeline ✅

Because EAS Build normally **requires a valid Android keystore**, we provide three temporary work-arounds.

| Scenario | Recommended Option |
| -------- | ----------------- |
| “Just keep CI green, Android not needed” | **A – Skip Android builds** |
| “Need installable APK for QA, don’t care about signing” | **B – Unsigned Debug build** |
| “Have a dev/test keystore on EAS, willing to use it” | **C – Use `development` profile** |

---

## 2. The Three Options

| Option | What It Does | Limitation |
| ------ | ------------ | ---------- |
| **A. Skip Android Build** | iOS builds & OTA continue, Android job is skipped entirely | No APK/AAB produced |
| **B. Debug Build (`debug` profile)** | Produces **unsigned APK** via `:app:assembleDebug` (installable on any device) | Cannot be uploaded to Play Console |
| **C. Development Profile** | Uses existing `development` profile with dev keystore on EAS | APK is signed with dev key, cannot be promoted to production |

---

## 3. Step-by-Step Instructions

### 3.1 Prerequisites

* Repo updated with the fixed **`cd-fixed.yml`** workflow  
  (contains skip logic & debug profile)
* `eas-cli` ≥ 16 locally for manual runs if desired

---

### Option A – Skip Android Builds

1. **Set variable**  
   *GitHub → Repo → Settings → Variables → `SKIP_ANDROID_BUILD`*  
   ```text
   Name:  SKIP_ANDROID_BUILD
   Value: true
   ```
2. Push / re-run pipeline.  
   Log will show:  
   ```
   ⚠️  SKIP_ANDROID_BUILD=true — Android build skipped for this run.
   ```
3. **Disable** by deleting the variable or setting it to `false`.

---

### Option B – Use Debug Profile (Unsigned APK)

1. Ensure `eas.json` contains the `debug` profile (added in earlier commit).  
2. **Manual CI trigger** (recommended):  
   *Actions → cd-fixed → Run workflow → choose environment `development` and add input `profile=debug`*  
   or locally:  
   ```bash
   eas build --platform android --profile debug --local
   ```
3. Artifact: `app-debug.apk` in workflow summary.  
4. **Disable** – simply stop using the `debug` profile.

---

### Option C – Use Development Profile (Dev Keystore)

1. Verify a *non-production* keystore exists on EAS:  
   ```bash
   eas credentials:list --platform android
   ```  
   Ensure `development` shows ✅ *Keystore*.
2. The workflow already falls back to `development` when no staging/production keystore is present.  
   Nothing else to do.
3. Artifact: signed APK (dev key). Good for internal testing.

---

## 4. Enabling / Disabling Matrix

| Action | Skip | Debug | Dev |
| ------ | ---- | ----- | --- |
| **Enable** | `SKIP_ANDROID_BUILD=true` | Choose `debug` profile | Ensure `development` keystore exists |
| **Disable** | Remove/false var | Stop calling `debug` | Upload real prod keystore & switch profile |

---

## 5. What Each Option Produces

| Option | Output File | Installable? | Play Upload? |
| ------ | ----------- | ------------ | ------------ |
| Skip | _None_ | – | – |
| Debug | `app-debug.apk` | Yes (adb / direct) | ❌ |
| Dev  | `app-development.apk` (name varies) | Yes | Internal / closed tracks only |

---

## 6. Switching Back to Normal Builds

1. **Upload production keystore** to EAS for each profile (`staging`, `production`):  
   ```bash
   eas credentials:manage --platform android
   ```  
   Follow prompts to upload or generate.
2. Delete variable `SKIP_ANDROID_BUILD` (if set).
3. Stop using `debug` profile.
4. Merge workflow snippet removal (temporary keystore generation) when comfortable.
5. Trigger a standard build:  
   ```bash
   eas build --platform android --profile production
   ```

---

## 7. Troubleshooting & FAQ

| Symptom | Possible Cause | Fix |
| ------- | -------------- | --- |
| Workflow still tries to build Android after setting `SKIP_ANDROID_BUILD=true` | Variable added as **secret** not **variable** | Use *Variables* or prefix `${{ vars. }}` |
| “Generating a new Keystore is not supported” shows again | `debug`/`development` profile removed its keystore | Re-add keystore or switch to Skip |
| APK installs but crashes on launch | Remember debug build uses *debug* JS bundle; run `expo start --dev-client` or build again | |
| Need AAB for internal testing | Only dev profile can output signed AAB; debug cannot | Use Option C with `gradleCommand :app:bundleRelease` |
| Want to verify which option CI picked | Search logs for: `SKIP_ANDROID_BUILD` or `Building Android app with profile:` | |

---

### Quick Reference Commands

```bash
# Toggle skip (locally):
export SKIP_ANDROID_BUILD=true   # skip
unset  SKIP_ANDROID_BUILD        # restore

# Build unsigned debug APK locally:
eas build --platform android --profile debug --local

# Check credentials
eas credentials:list --platform android
```

---

**Keep this guide in the repo root (`TEMPORARY_ANDROID_BYPASS_OPTIONS.md`) until Google Play approval is complete, then archive it in /docs.** 🚀
