# EAS_BUILD_KEYSTORE_FIX.md

## Overview

This guide documents the “💥 Generating a new Keystore is not supported in --non-interactive mode” failure that blocked Android builds in CI, the hot-fix applied in **`.github/workflows/cd-fixed.yml`**, and the **permanent** steps required to repair credentials on Expo (EAS).

Keep this file in the repository root so future maintainers can quickly resolve similar problems.

---

## 1&nbsp;— Root Cause

| Factor | Detail |
| ------ | ------ |
| **Missing / corrupt Android keystore** | The **Android build profile** referenced during CI had no valid keystore on Expo’s servers (or the stored record was corrupted). |
| **`--non-interactive` flag** | GitHub Actions passes `--non-interactive`; when EAS CLI cannot find a usable keystore it tries to *create one interactively* &nbsp;→ error. |
| **Wrong profile selection** | The workflow always chose the `development` profile regardless of branch, masking the fact that `staging` / `preview` never had credentials. |

Result: EAS fell back to keystore generation, which is **blocked in non-interactive mode**, causing an immediate build failure.

---

## 2&nbsp;— Immediate CI Hot-Fix (Already Deployed)

*File: `.github/workflows/cd-fixed.yml`*

1. **Generates a temporary keystore** inside the job (`keytool -genkeypair …`).
2. Injects it via **`.expo/credentials.json`** and updated `gradle.properties`.
3. Forces local usage with  
   `EXPO_USE_LOCAL_CREDENTIALS=1` and `EAS_NO_CREDENTIALS_VALIDATION=1`.
4. Runs the build with `--local` so Expo never attempts to fetch / create remote credentials.

⚠️  This keystore is **throw-away**: suitable only for CI artifacts, **not** for publishing to Google Play.

---

## 3&nbsp;— Long-Term Solution

Upload **real** keystores to Expo and delete the temporary workaround:

1. Each build profile that targets Google Play (`preview`, `staging`, `production`) must have a **valid keystore** stored on EAS.
2. Remove the “Generate temporary keystore for CI” step and the forced-local env vars from the workflow.
3. Re-run the pipeline; builds should pass using **remote** credentials.

---

## 4&nbsp;— Step-by-Step: Setting Up Android Credentials on EAS

> Prerequisite: install `eas-cli` ≥ 3.x and sign in (`eas login` **or** export `EXPO_TOKEN`).

### 4.1  Locate / create a keystore

*Option A: Re-use existing*  
Download the `upload-keystore.jks` you have already used in Google Play Console.

*Option B: Generate new*  
```bash
keytool -genkeypair -v \
  -keystore upload-keystore.jks \
  -alias upload \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass "<storePassword>" -keypass "<keyPassword>" \
  -dname "CN=Card Show Finder, OU=Mobile, O=KaczCards, L=City, S=State, C=US"
```
**Back up** the file + passwords in a secrets vault.

### 4.2  Upload to EAS

Run for **each** profile that needs credentials (replace `staging` as appropriate):

```bash
# interactive credential manager
eas credentials:manage --platform android

# 1️⃣ Choose the expo project
# 2️⃣ Select profile:   ──› "staging"
# 3️⃣ Select action:    ──› "Upload existing keystore"  (or "Generate new")
# 4️⃣ Provide file + passwords
```

Repeat for `preview` and `production`.  
Verify with:

```bash
eas credentials:list --platform android
```

You should see **Keystore hash** lines for every profile.

### 4.3  Synchronise build profile mapping *(optional)*  
If you consolidated profiles, update `eas.json` so each environment uses the correct profile that now has credentials.

---

## 5&nbsp;— Verification Steps

1. **CI Pipeline**
   * Trigger `cd-fixed.yml` after **removing** the temporary keystore block.
   * Expect log line: `✔ Using remote Android credentials (Expo server)`.
   * No `Generating a new Keystore` error.

2. **Local dry-run (optional)**
   ```bash
   eas build --platform android --profile staging --local --non-interactive
   ```
   Build progresses into Gradle without credential errors.

3. **Google Play upload**
   * If you *generated* a new keystore, upload the new **upload certificate** to Play Console (`Settings ➜ App Integrity ➜ Upload key certificate`).  
   * If using the existing keystore, no Play Console changes are needed.

---

## 6&nbsp;— Troubleshooting Matrix

| Symptom | Possible Cause | Fix |
| ------- | -------------- | --- |
| `Generating a new Keystore is not supported …` | No keystore on EAS or wrong profile | Upload / assign keystore; ensure workflow selects correct profile |
| `Keystore hash mismatch in Play Console` | New keystore generated but Play not updated | Upload *upload certificate* to Play Console |
| `Cannot decrypt keystore` | Wrong password entered during upload | Re-upload with correct passwords |
| Build still using *local* credentials | Hot-fix block not removed | Delete temporary-keystore step and related env vars |
| `credentialsSource: remote` ignored | `--local` flag still in workflow | Remove `--local` so EAS uses remote credentials |

---

## 7&nbsp;— Clean-Up Checklist

- [ ] Remove **temporary keystore block** from workflow ✅  
- [ ] Delete env vars forcing local creds (`EXPO_USE_LOCAL_CREDENTIALS`, `EAS_NO_CREDENTIALS_VALIDATION`) ✅  
- [ ] Verify `eas.json` profiles map to correct Expo environments ✅  
- [ ] Store keystore file & passwords in secured storage ✅  
- [ ] Document credential location in `SECURITY.md` ✅  

---

### Need Help?

* Expo Docs – Android credentials  
  https://docs.expo.dev/build/android/#android-credentials
* Expo Discord – `#eas-build`  
* DevOps point-of-contact – @your-devops-on-call

Good luck — happy building! 🚀
