# 🔄 Update Existing iOS App (v1.0.5 → v1.0.6)

## Overview

Since your app is **already live in production at v1.0.5**, this is an UPDATE process, not a new submission. Much simpler!

---

## 🚀 Quick Update Process

### Step 1: Verify Version Number

Your build should already have version **1.0.6** (or higher) since EAS auto-increments.

Check with:
```bash
cd /Users/kevin/card-show-finder
cat app.json | grep version
```

Should show something like:
```json
"version": "1.0.6"
```

If it's still 1.0.5, that's fine - EAS handles the build number internally.

---

### Step 2: Submit to App Store Connect

```bash
cd /Users/kevin/card-show-finder
eas submit --platform ios --profile production
```

**Answer the prompts:**
1. **What would you like to submit?** → Select "Select a build from EAS"
2. **Which build?** → Select your latest iOS build (the one that just finished)
3. **Apple ID:** Your Apple Developer email
4. **Password:** Your Apple ID password (or app-specific password)

**EAS will automatically upload to your existing app!**

---

### Step 3: Go to App Store Connect

1. **Go to:** https://appstoreconnect.apple.com
2. **Sign in**
3. **Click:** "My Apps"
4. **Click:** Card Show Finder

---

### Step 4: Create New Version

1. **In left sidebar, click:** "App Store" tab
2. **Look for:** Your current version (1.0.5) should say "Ready for Sale"
3. **Click:** "+ Version or Platform" (top left)
4. **Select:** "iOS"
5. **Enter:** New version number: **1.0.6** (or whatever version you want)
6. **Click:** "Create"

---

### Step 5: Add What's New

In the new version page:

**What's New in This Version:**
```
Version 1.0.6 - Bug Fixes & Improvements

BUG FIXES:
• Fixed user registration and authentication issues
• Resolved email verification flow
• Enhanced password reset functionality
• Improved profile creation process
• Fixed infinite recursion errors during login

IMPROVEMENTS:
• Better error handling throughout the app
• Improved app stability and performance
• Enhanced security with proper email verification
• More reliable subscription functionality

Thank you for using Card Show Finder! Please update to this version for the best experience.
```

---

### Step 6: Add Build

1. **Scroll to:** "Build" section
2. **Click:** "+ Add Build" (or it might auto-select)
3. **Select:** The build you just uploaded (should show processing or ready)
4. **Wait:** If it says "Processing", wait 5-10 minutes for it to finish

---

### Step 7: Review & Submit

1. **Check:** All sections should have green checkmarks (info, pricing, etc. from previous version)
2. **Click:** "Save" (top right)
3. **Click:** "Submit for Review" (top right)
4. **Answer questions:**
   - **Export Compliance:** Probably same as before (usually "No")
   - **Content Rights:** Yes, you own the rights
   - **Advertising Identifier:** Same as before
5. **Click:** "Submit"

---

## ⏱️ Timeline for Updates

| Step | Time |
|------|------|
| **EAS Upload** | 5-10 min |
| **Build Processing** | 5-10 min |
| **Waiting for Review** | 24-48 hours |
| **In Review** | 1-24 hours |
| **Ready for Sale** | Immediate |

**Total:** Usually 1-3 days (updates often faster than new apps)

---

## 🧪 Optional: Test on TestFlight First

**Recommended:** Test the new build before submitting to App Store:

1. **Go to:** App Store Connect → TestFlight tab
2. **Your uploaded build** should appear automatically
3. **Add testers** (if not already added)
4. **Install via TestFlight** on your device
5. **Test:**
   - ✅ Registration
   - ✅ Email verification
   - ✅ Login
   - ✅ Password reset
   - ✅ Subscriptions
6. **If all works:** Proceed with App Store submission

---

## 📝 What's Different for Updates vs New Apps

| Aspect | New App Submission | Update Submission |
|--------|-------------------|------------------|
| **App Info** | Must fill everything | Already filled ✅ |
| **Screenshots** | Must upload all sizes | Keep existing ✅ |
| **Description** | Must write | Keep or update ✅ |
| **Categories** | Must select | Already set ✅ |
| **Privacy Policy** | Must provide URL | Already provided ✅ |
| **What's New** | N/A | Update this ✅ |
| **Build** | Add first build | Add new build ✅ |
| **Review Time** | 1-3 days | Often faster (1-2 days) |

**Much easier!** Most work is already done.

---

## 🚨 Important Notes

### Version Numbering:
- **Your production app:** v1.0.5
- **Your new build:** Should be v1.0.6 (or higher)
- EAS usually handles this automatically with build numbers

### Don't Worry About:
- ✅ Screenshots (use existing unless you want to update)
- ✅ App description (keep it or update minor details)
- ✅ Keywords (keep existing)
- ✅ App icon (already set)
- ✅ Categories (already set)

### Do Update:
- ✅ "What's New in This Version" (the release notes)
- ✅ Add new build
- ✅ Version number (1.0.6)

---

## 📱 Phased Release (Optional but Recommended)

Consider doing a phased release for safety:

1. **After approval, BEFORE releasing:**
   - Go to: Your version → Phased Release
   - **Enable:** Phased Release for automatic updates
   
2. **Release schedule:**
   - Day 1: 1% of users
   - Day 2: 2% of users
   - Day 3: 5% of users
   - Day 4: 10% of users
   - Day 5: 20% of users
   - Day 6: 50% of users
   - Day 7: 100% of users

3. **Benefits:**
   - Catch issues early with small percentage
   - Can pause rollout if problems detected
   - Less risk than full release

**How to enable:**
- App Store Connect → Version Info → Phased Release → Turn On

---

## ✅ Quick Checklist

- [ ] Build completed with EAS
- [ ] Run `eas submit --platform ios`
- [ ] Build uploaded to App Store Connect
- [ ] Created new version (1.0.6) in App Store Connect
- [ ] Added "What's New" release notes
- [ ] Added new build to version
- [ ] Tested on TestFlight (optional but recommended)
- [ ] Submitted for review
- [ ] Approved by Apple
- [ ] Released to users

---

## 🎯 What Users Will See

### Before Update (v1.0.5):
- ❌ May experience authentication bugs
- ❌ Registration might fail
- ❌ Possible infinite recursion errors

### After Update (v1.0.6):
- ✅ Smooth registration
- ✅ Email verification working correctly
- ✅ No authentication errors
- ✅ Password reset functioning
- ✅ Better overall stability

---

## 💡 Pro Tips

1. **Test on TestFlight first** - Catch issues before production
2. **Use phased release** - Safer rollout
3. **Monitor crash reports** - Check App Store Connect analytics
4. **Respond quickly** - If issues arise, submit hotfix
5. **Communicate** - If major changes, mention in release notes

---

## 🔄 For Future Updates

Every time you have fixes/features:

```bash
# 1. Make code changes
# 2. Test locally
# 3. Commit to git
git add .
git commit -m "fix: your changes"
git push

# 4. Build
eas build --platform ios --profile production

# 5. Submit
eas submit --platform ios --profile production

# 6. Update version in App Store Connect
# 7. Add "What's New"
# 8. Submit for review
```

---

## 🎯 Your Current Status

**Right now:**
- ✅ App live at v1.0.5
- ✅ iOS build completed (v1.0.6)
- ✅ Android submitted
- 🔄 **Next: Submit iOS update**

**Run this:**
```bash
eas submit --platform ios --profile production
```

**Then:** Go to App Store Connect, create v1.0.6, add build, submit!

**Timeline:** Live in 1-3 days (updates often faster than new submissions)

---

**You got this! It's much simpler than the first submission was!** 🚀
