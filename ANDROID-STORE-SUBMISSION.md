# 🤖 Android Google Play Store Submission Guide

## Overview

Since you're using Expo/EAS, submitting to Google Play Store is automated and easy!

---

## 🚀 Quick Start (After Build Completes)

Once your `eas build --platform android` finishes:

### Option 1: Automated Submission (Easiest)
```bash
eas submit --platform android --profile production
```

That's it! EAS handles everything automatically.

### Option 2: Manual Upload
1. Download the `.aab` file from EAS
2. Upload to Google Play Console manually

---

## 📋 Prerequisites

### 1. Google Play Developer Account

**If you don't have one:**
- Go to: https://play.google.com/console
- Sign up (one-time $25 fee)
- Complete account setup

**If you already have one:**
- Make sure you're logged in
- Have your app created in the console

---

## 🔧 First-Time Setup

### Step 1: Create App in Google Play Console

1. **Go to Google Play Console:**
   - https://play.google.com/console

2. **Create App:**
   - Click "Create app"
   - App name: "Card Show Finder"
   - Default language: English
   - App type: App
   - Free or Paid: (your choice)
   - Accept policies

3. **Complete Store Listing:**
   - App details
   - Graphics (icon, screenshots, feature graphic)
   - Categorization
   - Contact details
   - Privacy policy URL

---

## 🔑 Setup EAS Submit (One-Time)

### Option A: Let EAS Handle Everything (Recommended)

```bash
cd /Users/kevin/card-show-finder

# EAS will guide you through setup
eas submit --platform android --profile production
```

**EAS will:**
- ✅ Create a service account automatically
- ✅ Set up permissions
- ✅ Handle signing
- ✅ Upload your build

### Option B: Manual Service Account Setup

If you want more control:

1. **Create Service Account:**
   - Google Cloud Console: https://console.cloud.google.com
   - Create project (if needed)
   - Enable Google Play Developer API
   - Create service account
   - Download JSON key

2. **Grant Permissions:**
   - Go to Google Play Console
   - Settings → API access
   - Link your service account
   - Grant "Release Manager" permissions

3. **Configure EAS:**
   ```bash
   # Add to eas.json
   {
     "submit": {
       "production": {
         "android": {
           "serviceAccountKeyPath": "./google-service-account.json",
           "track": "internal"
         }
       }
     }
   }
   ```

---

## 🎯 Submission Process

### Step 1: Wait for Build to Complete

Your build is running now. Wait for:
```
✔ Build finished
  Build ID: abc123...
  Download: https://expo.dev/artifacts/...
```

### Step 2: Submit to Google Play

```bash
cd /Users/kevin/card-show-finder

# Submit the latest build
eas submit --platform android --profile production
```

**Interactive prompts will ask:**
- Which build to submit? (select the latest)
- Which track? (internal, alpha, beta, production)
- Release notes?

### Step 3: Choose Release Track

| Track | Purpose | Review Time | Audience |
|-------|---------|-------------|----------|
| **Internal** | Quick testing | Minutes | Up to 100 testers |
| **Alpha** | Early testing | Minutes | Unlimited testers |
| **Beta** | Pre-release | ~1-2 hours | Unlimited testers |
| **Production** | Public release | 1-7 days | Everyone |

**Recommended for first submission:** Start with **Internal** or **Alpha** to test first.

---

## 📱 Release Tracks Explained

### Internal Testing (Start Here)
```bash
eas submit --platform android --profile production
# Select: Internal testing track
```

**Benefits:**
- ✅ Instant approval (no Google review)
- ✅ Test with up to 100 users
- ✅ Perfect for verifying IAP, auth fixes
- ✅ Can promote to production later

**Setup:**
1. Google Play Console → Testing → Internal testing
2. Create email list of testers
3. Share the testing link with them

### Alpha/Beta Testing
```bash
eas submit --platform android --profile production
# Select: Alpha or Beta track
```

**Benefits:**
- ✅ Quick approval (~1-2 hours)
- ✅ Unlimited testers
- ✅ Collect feedback before public release
- ✅ Phased rollout capability

### Production Release
```bash
eas submit --platform android --profile production
# Select: Production track
```

**Review time:** 1-7 days (usually 24-48 hours)

---

## 🔄 Phased Rollout (Production)

When releasing to production, use phased rollout:

1. **Start at 20%:**
   - Release to 20% of users
   - Monitor for crashes/errors
   - Wait 24-48 hours

2. **Increase to 50%:**
   - If no issues, increase to 50%
   - Monitor again
   - Wait 24 hours

3. **Full Release (100%):**
   - Complete rollout to all users

**How to set:**
- Google Play Console → Production release
- "Manage rollout" → Set percentage

---

## 📝 Release Notes Template

When submitting, you'll need release notes:

```
What's New in v1.0.X:

Bug Fixes:
• Fixed user registration and authentication issues
• Improved email verification flow  
• Enhanced password reset functionality
• Resolved profile creation errors

Improvements:
• Better error handling throughout the app
• Improved app stability and performance
• Enhanced user experience

Note: Please update to this version for the best experience!
```

---

## 🧪 Testing Your Production Build

### After Submitting to Internal Track:

1. **Access the Build:**
   - Go to Google Play Console
   - Testing → Internal testing
   - Copy the "Opt-in URL"

2. **Share with Testers:**
   - Send URL to your email/team
   - They click "Become a tester"
   - Install from Play Store (shows as testing version)

3. **Test Everything:**
   - ✅ Registration flow
   - ✅ Email verification  
   - ✅ Login
   - ✅ Password reset
   - ✅ **IAP subscriptions** (critical!)
   - ✅ All app features

---

## 💳 Testing IAP on Android

### Setup Test Accounts:

1. **Google Play Console:**
   - Settings → License testing
   - Add test Gmail accounts

2. **Test Purchases:**
   - These accounts can make "test purchases"
   - No real money charged
   - Full purchase flow tested

### Test Subscription Flow:
- View subscription plans in app
- Initiate purchase
- Google Play payment sheet appears
- Complete "purchase" (fake payment)
- Verify subscription activated in app
- Check profile updated in Supabase

---

## 🔄 Update Process (After First Release)

### For Future Updates:

```bash
# 1. Build new version
eas build --platform android --profile production

# 2. Submit to chosen track
eas submit --platform android --profile production

# 3. Select track (internal/alpha/beta/production)
# 4. Enter release notes
# 5. Done!
```

**Version management:**
- EAS auto-increments version code
- Update version name in `app.json` manually

---

## 📊 Submission Timeline

| Step | Time |
|------|------|
| **EAS build completes** | 0 min (starting point) |
| **Run eas submit** | 2 min |
| **Upload to Google** | 5 min |
| **Internal/Alpha review** | ~10 min |
| **Beta review** | 1-2 hours |
| **Production review** | 1-7 days |

---

## 🚨 Common Issues & Solutions

### Issue: "Service account not found"
**Solution:**
```bash
# Let EAS create it automatically
eas submit --platform android
# Follow the prompts to set up service account
```

### Issue: "App not found in Play Console"
**Solution:**
- Create the app in Google Play Console first
- Make sure package name matches (`app.json`)

### Issue: "Build not found"
**Solution:**
```bash
# List your builds
eas build:list --platform android

# Submit specific build
eas submit --platform android --id BUILD_ID
```

### Issue: "Version code conflict"
**Solution:**
- EAS auto-increments version code
- If conflict, increment manually in `app.json`

---

## 📱 Android vs iOS Differences

| Aspect | iOS (App Store) | Android (Play Store) |
|--------|-----------------|---------------------|
| **Review time** | 24-48 hours | Minutes to hours |
| **Testing tracks** | TestFlight only | Internal/Alpha/Beta/Production |
| **Phased rollout** | Manual | Built-in percentage control |
| **Account cost** | $99/year | $25 one-time |
| **Approval strictness** | Strict | More lenient |

---

## ✅ Recommended Workflow

### For Your First Android Release:

```bash
# 1. After build completes (~30 min from now)
eas submit --platform android --profile production

# 2. Choose "Internal testing" track
# This gives instant access for testing

# 3. Test thoroughly:
#    - Install on Android device
#    - Test registration, auth, IAP
#    - Verify all fixes work

# 4. If everything works, promote to Production:
#    Google Play Console → Internal testing → Promote to Production

# 5. Set phased rollout (20% → 50% → 100%)

# 6. Monitor and respond to reviews
```

---

## 🎯 Your Current Status

Right now:
- ✅ Authentication fixes committed
- ✅ IAP service restored  
- 🔄 **EAS build running** (~25 min remaining)

Next steps:
1. ⏳ **Wait for build** to complete
2. 🚀 **Run:** `eas submit --platform android`
3. 🧪 **Test** on Internal track
4. 📤 **Promote** to Production
5. 🎉 **Live** on Play Store!

---

## 💡 Pro Tips

1. **Always test on Internal track first** - catches issues before public release
2. **Use phased rollout** for production - safer than full release
3. **Monitor crash reports** in Play Console after release
4. **Respond to reviews** - improves rating and user trust
5. **Update regularly** - keeps users engaged

---

## 📚 Resources

- **EAS Submit Docs:** https://docs.expo.dev/submit/android/
- **Google Play Console:** https://play.google.com/console
- **Android App Signing:** https://developer.android.com/studio/publish/app-signing

---

**Once your build finishes, just run:**
```bash
eas submit --platform android --profile production
```

**That's it!** EAS makes Android deployment super easy! 🚀
