# 🚑 Immediate Deployment Fix Guide  
### Resolving the “Generating a new Keystore is not supported in --non-interactive mode” error

_Last updated: 2025-08-06_

---

## 1  Root-Cause Summary

| Symptom | Explanation |
|---------|-------------|
| • Logs show **“Using remote Android credentials (Expo server)”** but immediately fail with **“Generating a new Keystore is not supported in --non-interactive mode.”** | The Android keystore **record exists** on EAS but is **corrupted, incomplete, or not linked** to the current build profile. When the CLI can’t find a usable keystore **in non-interactive mode** it attempts to create a new one and aborts. |

**Bottom line:** the keystore entry stored on Expo’s servers for the affected profile(s) is unusable. We must re-upload or regenerate it.

---

## 2  Prerequisites

1. **Expo CLI/EAS CLI** ≥ 1.25 installed locally  
   ```bash
   npm install -g eas-cli
   ```
2. **Expo account owner** (or role that can manage credentials).  
3. **EXPO_TOKEN** set (or log in interactively):  
   ```bash
   export EXPO_TOKEN=<your-expo-access-token>
   ```

---

## 3  Step-by-Step Fix (Recommended)

### 3.1 List current Android credentials

```bash
eas credentials:list --platform android
```

Look for an **entry per build profile** (`development`, `preview`, `staging`, `production`).  
If a profile is **missing** or shows **❌  Keystore not found**, that’s the cause.

### 3.2 Choose a repair path

| Path | When to use |
|------|-------------|
| **A) Upload existing keystore** | You possess the `keystore.jks` previously used in Play Console |
| **B) Generate new keystore** | You have no valid keystore or wish to rotate credentials |

---

### 3.3 Path A  Upload existing keystore

1. Run interactive manager:
   ```bash
   eas credentials:manage --platform android
   ```
2. Select the **build profile** that fails (e.g. `staging`).  
3. Choose **“Upload existing keystore”**.  
4. Provide:
   * Path to `keystore.jks`
   * Keystore password
   * Key alias
   * Key password
5. **Repeat** for every other profile that appears broken (`preview`, `production`, …).  
   You can reuse the _same_ keystore for all profiles.

---

### 3.4 Path B  Generate a new keystore

1. Backup any old keystore (if it exists).  
2. Run:
   ```bash
   eas credentials:manage --platform android
   ```
3. Select the failing profile (e.g. `staging`).  
4. Choose **“Generate new keystore”**.  
   The CLI will:
   * Create a keystore
   * Upload it to EAS
   * Save a copy locally (`keystore.jks`) – **store it safely!**
5. **Repeat** generation or **upload the same file** for every profile that needs it.  
6. **Update Play Console**: if you generated a brand-new keystore **and your app is already in production**, you must [upload the new upload certificate](https://docs.expo.dev/build/android/#how-to-update-upload-certificate) in Play Console before publishing again.

---

## 4  Verify Credentials

Run:

```bash
eas credentials:list --platform android
```

You should see a ✅  Keystore hash for **each profile**.

---

## 5  Smoke-Test the Fix

### 5.1 Dry-run build locally (optional)

```bash
eas build --platform android --profile staging --non-interactive --local
```

The build should progress into Gradle without the keystore error.

### 5.2 Trigger CI again

Push an empty commit or re-run the failed GitHub Actions job.  
The step should now pass:

```
🤖  Building Android app with profile: staging
✔  Using remote Android credentials (Expo server)
...
✅  Build succeeded
```

---

## 6  Alternative: Temporary Local Credentials (Last Resort)

If you **cannot** manipulate remote credentials right now:

1. Create a keystore locally  
   ```bash
   keytool -genkeypair -v \
     -keystore tmp.jks -storepass tempPass \
     -alias upload -keypass tempPass \
     -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Add these two steps **before** the `eas build` step in your workflow:

```yaml
- name: Inject local keystore
  run: |
    echo "$BASE64_KEYSTORE" | base64 -d > ./tmp.jks
    eas credentials:sync --platform android \
      --local-credential-source tmp.jks \
      --key-alias upload \
      --key-password tempPass \
      --keystore-password tempPass
  env:
    BASE64_KEYSTORE: ${{ secrets.BASE64_KEYSTORE }}
```

3. Store the **base64-encoded keystore** in GitHub Secrets (`BASE64_KEYSTORE`).  
4. Remove this workaround once remote credentials are fixed.

---

## 7  Post-Fix Cleanup & Best Practices

1. **Rotate passwords** after uploading/regenerating a keystore.  
2. Store keystore files and passwords in a secure secrets vault.  
3. Document credential locations in `SECURITY.md`.  
4. Enable *auto-submission* once builds are green.  
5. Periodically run:  
   ```bash
   eas credentials:list --platform android
   ```  
   to audit that all profiles remain healthy.

---

## 8  Quick Checklist

- [ ] Ran `eas credentials:list` – saw missing/corrupted keystore  
- [ ] Uploaded **or** generated a keystore for every profile  
- [ ] Verified hashes appear for each profile  
- [ ] Triggered CI – build passes the keystore step  
- [ ] Documented and secured keystore files/passwords  

---

### Need Help?

• Expo Docs – _Android credentials_  
  https://docs.expo.dev/build/android/#android-credentials  

• Expo Discord – `#eas-build` channel  

• DevOps contact – @your-devops-on-call  

Good luck – you should be back in deployment shape within minutes! 🚀
