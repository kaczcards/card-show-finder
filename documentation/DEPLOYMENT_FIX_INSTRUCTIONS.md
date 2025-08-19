# Deployment Fix Instructions (Android Keystore Issue)

_Last updated: 2025-08-06_

## 1  Root-Cause Analysis

• **What we see in CI**

```
✔ Using remote Android credentials (Expo server)
Generating a new Keystore is not supported in --non-interactive mode
Error: build command failed.
```

• **Why it keeps happening**

1. The CD workflow resolves the **preview** environment but calls the **staging** build profile (or vice-versa).  
2. The selected build profile (`preview`, `staging`, `production`) points to **remote** credentials, yet **no Android keystore is stored on EAS** for that profile.  
3. When EAS CLI runs in `--non-interactive` mode it cannot prompt to _create_ a keystore, so the build aborts.

ℹ️  The development profile usually works because a keystore was configured there months ago; other profiles never had a keystore uploaded.

---

## 2  Immediate Fix Options

| Option | When to use | Effort | Risk |
|--------|-------------|--------|------|
| **A. Merge the open PR** (`fix/detox-device-configuration`) | You are ready to merge to `main` | seconds | None – workflow & `eas.json` already corrected |
| **B. Configure Android credentials manually on EAS** | You cannot merge yet (e.g. pending review) | 5 – 10 min | Minimal – one-time keystore upload |

---

## 3  Configure Android Credentials on EAS (Option B)

> Requires: `eas-cli` ≥ 1.25, Expo account owner or admin rights.

1. **Login**

   ```bash
   eas login
   ```

2. **Select the project**

   ```bash
   cd card-show-finder
   ```

3. **Set environment variables**

   ```bash
   export EXPO_TOKEN=<your-expo-access-token>
   ```

4. **Launch interactive credentials manager**

   ```bash
   eas credentials
   # or: eas credentials:manage --platform android
   ```

5. **Create / upload keystore**

   In the menu choose:

   ```
   ✔ Android ▸ Select build profile
   ❯ staging
   ```

   Then:

   ```
   ❯ Upload existing keystore
   ```

   Supply:

   * `keystore.jks` file path  
   * Keystore password  
   * Key alias  
   * Key password  

   _(If you do **not** have an existing keystore, choose “Generate a new keystore” in interactive mode **once**, save the downloaded file, then repeat the upload for other profiles.)_

6. **Repeat for every profile**

   Run the same steps for `preview`, `production`, and any custom profiles so each points to the **same** keystore.

---

## 4  Verify the Fix

1. **List credentials**

   ```bash
   eas credentials:list --platform android
   ```

   You should see one entry per profile showing a keystore hash.

2. **Dry-run build locally**

   ```bash
   eas build --platform android --profile preview --non-interactive --local
   ```

   The CLI should **skip** keystore generation and proceed to Gradle.

3. **Re-run CI/CD workflow**

   Push any commit or manually trigger the _Continuous Deployment_ workflow.  
   The _“Build app with EAS”_ step should now pass.

---

## 5  Temporary Workaround (if you cannot upload credentials now)

Add this one-off step **before** the EAS build in `.github/workflows/cd.yml`:

```yaml
- name: Force Android build to development profile
  run: echo "USE_DEV_PROFILE_FOR_ANDROID=true" >> $GITHUB_ENV
```

The workflow will:

* Build iOS with the requested profile (`staging`, `preview`, …)
* Build **Android** with the `development` profile where credentials already exist

**Drawback:** All internal testers will receive a “development” variant until proper credentials are configured.

---

## 6  Next Steps After Fixing

1. **Remove the workaround** (if added) and rely on normal profiles.  
2. **Rotate keystore password** & store it in your secret manager (`ANDROID_KEYSTORE_PASSWORD`).  
3. **Document the credentials** location & access policy in `SECURITY.md`.  
4. **Enable auto-submission** – once builds succeed consistently, uncomment the `eas submit` step for Android.  
5. **Audit other profiles** – ensure iOS credentials & environment variables are present for every profile.

---

### Need Help?

* Expo docs – [Android credentials](https://docs.expo.dev/build/android/#android-credentials)  
* Expo CLI support: `npx eas credentials -h`  
* Contact DevOps on Slack `#mobile-ci` channel.
