# 🤖 Android Submission - Complete Step-by-Step Instructions

## ✅ What You've Already Done:

1. ✅ Built production app with `eas build --platform all`
2. ✅ Downloaded Google service account JSON
3. ✅ Moved it to: `/Users/kevin/card-show-finder/google-service-account.json`

---

## 📋 Complete Submission Process

### Step 1: Submit to Google Play Store

```bash
cd /Users/kevin/card-show-finder
eas submit --platform android --profile production
```

### Step 2: Answer the Prompts

When EAS asks questions, here's what to do:

#### Prompt 1: "What would you like to submit?"
**Answer:** Select "Select a build from EAS" (first option)

#### Prompt 2: "Which build would you like to submit?"
**Answer:** Select the Android build with:
- Status: finished
- Commit: "fix: restore IAP service for production build"

#### Prompt 3: "Path to Google Service Account file:"
**Answer:** Type exactly:
```
google-service-account.json
```
Then press Enter.

#### Prompt 4: "Google Play Service Account JSON"
If it asks again or for confirmation:
**Answer:** 
```
./google-service-account.json
```

#### Prompt 5: "Which track do you want to submit to?"
**Answer:** Choose one:
- `internal` - For quick testing (RECOMMENDED FIRST)
- `alpha` - For broader testing
- `beta` - For pre-release testing
- `production` - For public release

**Recommendation:** Start with `internal` to test everything first.

#### Prompt 6: "Release notes"
**Answer:**
```
Bug Fixes:
- Fixed user registration and authentication issues
- Improved email verification flow
- Enhanced password reset functionality
- Restored subscription functionality

All users should update to this version for the best experience.
```

---

## 🎯 If You Get Errors

### Error: "Service account doesn't have permission"

You need to grant permissions in Google Play Console:

1. **Go to:** https://play.google.com/console
2. **Click:** Setup → API access
3. **Find:** Your service account email (from the JSON file)
4. **Click:** "Grant Access"
5. **Select permissions:**
   - ✅ Admin (all permissions)
   - OR at minimum: View app information, Manage production releases, Manage testing track releases
6. **Click:** "Invite user" or "Apply"

### Error: "App not found"

You need to create the app in Google Play Console first:

1. **Go to:** https://play.google.com/console
2. **Click:** "Create app"
3. **Fill in:**
   - App name: Card Show Finder
   - Default language: English - United States
   - App or Game: App
   - Free or Paid: (your choice)
4. **Check boxes:** Agree to policies
5. **Click:** "Create app"

### Error: "Package name doesn't match"

Check your package name matches:

```bash
# Check app.json
cat app.json | grep packageName
```

The package name in Google Play Console must match exactly.

---

## 🔐 Important: Secure Your Credentials

After submission works, protect your service account file:

```bash
cd /Users/kevin/card-show-finder

# Add to .gitignore
echo "google-service-account.json" >> .gitignore

# Verify it's not tracked
git status | grep google-service-account.json

# If it shows up, don't commit it!
```

**Never commit this file to git!** It contains sensitive credentials.

---

## 📱 After Successful Submission

### If you chose "Internal" track:

1. **Go to:** https://play.google.com/console
2. **Navigate to:** Testing → Internal testing
3. **Copy the testing URL**
4. **Open on Android device** and become a tester
5. **Install and test:**
   - ✅ Registration
   - ✅ Email verification
   - ✅ Login
   - ✅ Password reset
   - ✅ **Subscription purchases** (CRITICAL!)
   - ✅ All app features

### If everything works:

**Promote to Production:**
1. **Go to:** Google Play Console → Internal testing
2. **Click:** "Promote release"
3. **Select:** "Production"
4. **Set rollout:** Start at 20%, then 50%, then 100%
5. **Add release notes**
6. **Click:** "Start rollout to Production"

---

## ⏱️ Timeline

| Step | Time |
|------|------|
| Run `eas submit` | 2 min |
| Upload to Google | 5 min |
| **Internal track approval** | **~10 minutes** |
| **Production track approval** | **1-7 days** |

---

## 🧪 Testing IAP on Android

### Setup Test Purchases:

1. **Google Play Console:**
   - Settings → License testing
   - Add your Gmail account

2. **Test on device:**
   - Install from Internal testing
   - Open app → Go to subscriptions
   - Tap to purchase
   - Google Play shows "This is a test purchase"
   - Complete purchase (no charge)
   - Verify subscription activates in app

---

## ✅ Checklist

Before submitting:
- [x] Build completed successfully
- [x] Google service account JSON downloaded
- [x] JSON file moved to project directory
- [ ] Google Play Console account created
- [ ] App created in Play Console (if first time)
- [ ] Service account permissions granted

During submission:
- [ ] Run `eas submit --platform android`
- [ ] Select correct build
- [ ] Provide service account path
- [ ] Choose release track
- [ ] Add release notes

After submission:
- [ ] Test on Internal track
- [ ] Verify all features work
- [ ] Test IAP subscriptions
- [ ] Promote to Production
- [ ] Monitor crash reports

---

## 🚀 Quick Command Reference

```bash
# Submit to Google Play
eas submit --platform android --profile production

# Check build list
eas build:list --platform android

# Check submission status
# (Check in Google Play Console)

# Re-submit if needed
eas submit --platform android --id BUILD_ID
```

---

## 📞 Need Help?

**Common issues solved:**
- Service account permissions → Grant in Play Console
- App not found → Create app in Play Console first
- Package name mismatch → Update in app.json or Play Console
- JSON file not found → Check path is correct

---

## 🎯 Current Status

**You're here:** About to complete the EAS submit prompts

**Next:** Answer the prompts as described above

**After that:** Test on Internal track, then promote to Production!

---

**Start by typing in the EAS prompt:**
```
google-service-account.json
```

Then follow the prompts! 🚀
