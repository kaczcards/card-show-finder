# 🤖 First-Time Android Manual Upload Guide

## Why Manual Upload is Required

Google Play Store requires the **first submission to be done manually** through their web console. This is a security measure.

**After this first upload, all future updates can use `eas submit` automatically!**

---

## 📋 Step-by-Step Manual Upload Process

### Step 1: Get Your Build File

#### Option A: Download from EAS Dashboard (Easiest)

1. **Go to:** https://expo.dev
2. **Sign in** to your account
3. **Navigate to:** Your project → Builds
4. **Find:** The latest Android production build
5. **Click:** Download button
6. **Save:** The `.aab` file to your computer

#### Option B: Download via Command Line

```bash
cd /Users/kevin/card-show-finder

# List your builds
eas build:list --platform android

# Download specific build (copy the URL from the list)
# Or go to the artifacts URL shown in the build details
```

---

### Step 2: Go to Google Play Console

1. **Open:** https://play.google.com/console
2. **Sign in** with your Google account
3. **Select or create your app**

---

### Step 3: Create App (If First Time)

If you haven't created the app yet:

1. **Click:** "Create app"
2. **Fill in details:**
   - App name: **Card Show Finder**
   - Default language: **English - United States**
   - App or Game: **App**
   - Free or Paid: **Free** (or Paid if you charge for download)
   - Declarations: Check the boxes
3. **Click:** "Create app"

---

### Step 4: Complete Required Setup

Google requires you to complete several sections before you can upload:

#### A. Store Listing (Required)
- **App name:** Card Show Finder
- **Short description:** (max 80 characters)
  ```
  Find card shows, connect with dealers, and never miss a trading card event!
  ```
- **Full description:** (max 4000 characters)
  ```
  Card Show Finder is your ultimate companion for discovering and attending sports card and trading card shows. 

  Features:
  • Find card shows near you
  • Get directions and event details
  • Connect with dealers and organizers
  • Mark shows as favorites
  • Track your attendance
  • Get notifications about upcoming events

  Whether you're a collector, dealer, or organizer, Card Show Finder helps you stay connected to the card show community.
  ```

- **App icon:** Upload your app icon (512x512 PNG)
- **Feature graphic:** Upload (1024x500 PNG)
- **Screenshots:** Upload at least 2 phone screenshots
  - You can use screenshots from your app
  - Or create promotional screenshots

- **App category:** Choose appropriate category
  - Suggested: **Events** or **Lifestyle**

- **Contact details:**
  - Email: Your support email
  - Website: https://csfinderapp.com (optional)
  - Phone: (optional)

- **Privacy policy:** 
  - URL to your privacy policy (required)
  - Example: https://csfinderapp.com/privacy

#### B. Content Rating (Required)
1. **Click:** "Start questionnaire"
2. **Select:** Your app category
3. **Answer questions** about content
4. **Submit** and get your rating

#### C. Target Audience (Required)
1. **Select:** Age groups (probably 13+)
2. **Confirm** no children's content

#### D. App Content (Required)
Complete all declarations:
- Privacy policy ✅
- Ads (do you have ads?) ✅
- Data safety ✅
- Government apps (probably No) ✅

---

### Step 5: Upload Your App Bundle

Now you can upload your build:

1. **In left sidebar, click:** "Production" or "Internal testing" (I recommend starting with Internal testing)

#### For Internal Testing (Recommended First):
1. **Click:** Testing → Internal testing
2. **Click:** "Create new release"
3. **Upload:** Your `.aab` file (drag and drop or click upload)
4. **Wait** for it to process (~2-5 minutes)
5. **Release name:** Will auto-fill (e.g., "1 (1.0.0)")
6. **Release notes:** 
   ```
   Initial release

   Features:
   - Find card shows near you
   - Connect with dealers and organizers  
   - Email verification for security
   - Subscription options for dealers and organizers
   - Password reset functionality
   ```
7. **Click:** "Review release"
8. **Click:** "Start rollout to Internal testing"

#### For Production (After Testing):
1. **Click:** "Production" in left sidebar
2. **Click:** "Create new release"
3. **Upload:** Your `.aab` file
4. **Fill in release details** (same as above)
5. **Click:** "Review release"
6. **Click:** "Start rollout to Production"

---

### Step 6: Wait for Review

| Track | Review Time |
|-------|-------------|
| **Internal testing** | ~10 minutes (usually instant) |
| **Production** | 1-7 days (usually 24-48 hours) |

---

### Step 7: Test Your App (Internal Testing)

1. **Go to:** Testing → Internal testing
2. **Copy:** The testing URL
3. **On your Android device:**
   - Open the URL
   - Click "Become a tester"
   - Install from Play Store
4. **Test everything:**
   - ✅ Registration
   - ✅ Email verification
   - ✅ Login
   - ✅ Password reset
   - ✅ Subscriptions (CRITICAL!)
   - ✅ All features

---

### Step 8: Promote to Production

Once you've tested on Internal track:

1. **Go to:** Internal testing → Releases
2. **Click:** The 3-dot menu on your release
3. **Click:** "Promote release"
4. **Select:** "Production"
5. **Configure rollout:**
   - Start with 20% of users
   - Can increase to 50%, then 100% later
6. **Click:** "Start rollout to Production"

---

## 🔄 Future Updates (After First Upload)

After this first manual upload, all future updates can be automated:

```bash
# Just run this command
eas submit --platform android --profile production

# EAS will handle everything automatically!
```

---

## 🧪 Testing IAP Subscriptions

### Setup License Testing:

1. **Google Play Console:**
   - Settings → License testing
   - Add your Gmail addresses

2. **Test on device:**
   - Install from Internal testing
   - Go to subscriptions in app
   - Try to purchase
   - Google Play shows "This is a test"
   - Complete purchase (no charge)
   - Verify subscription activates

---

## 📊 What Files You Need

### App Bundle (Required)
- **File type:** `.aab` (Android App Bundle)
- **Location:** Downloaded from EAS
- **Size:** Varies (usually 20-50 MB)

### Graphics (Required)
- **App icon:** 512x512 PNG
- **Feature graphic:** 1024x500 PNG  
- **Screenshots:** At least 2, JPG or PNG
  - Phone: 16:9 or 9:16 ratio
  - Recommended: 1080x1920 or 1920x1080

### Text (Required)
- Short description (80 chars max)
- Full description (4000 chars max)
- Privacy policy URL
- Contact email

---

## 🚨 Common Issues

### Error: "You need to use a different package name"
**Solution:** Your package name is already used. Change it in `app.json`:
```json
{
  "expo": {
    "android": {
      "package": "com.yourcompany.cardshowfinder"
    }
  }
}
```
Then rebuild: `eas build --platform android`

### Error: "Upload failed" 
**Solution:** Make sure you're uploading a `.aab` file, not `.apk`

### Error: "This release is not compliant"
**Solution:** Complete all required sections (Store Listing, Content Rating, etc.)

---

## ✅ Checklist

Before uploading:
- [ ] Download `.aab` file from EAS
- [ ] Google Play Console account created ($25 paid)
- [ ] App created in Play Console
- [ ] Store listing completed
- [ ] Content rating completed
- [ ] Target audience set
- [ ] App content declarations completed
- [ ] Privacy policy URL provided

During upload:
- [ ] Choose Internal testing (recommended) or Production
- [ ] Upload `.aab` file
- [ ] Add release notes
- [ ] Review and start rollout

After upload:
- [ ] Test on Internal track
- [ ] Verify all features work
- [ ] Test IAP subscriptions
- [ ] Promote to Production
- [ ] Set phased rollout (20% → 100%)

---

## 📱 App Details Template

Use this for your store listing:

**App Name:**
```
Card Show Finder
```

**Short Description (80 chars):**
```
Find card shows, connect with dealers, never miss a trading card event!
```

**Full Description:**
```
Card Show Finder is your ultimate companion for discovering and attending sports card and trading card shows.

FEATURES:
• Find Shows: Discover card shows near you with detailed information
• Interactive Map: View all shows on an interactive map
• Event Details: Get dates, times, locations, and directions
• Connect: Find dealers and organizers in your area
• Favorites: Save your favorite shows for quick access
• Attendance Tracking: Keep track of shows you've attended
• Notifications: Get notified about upcoming events
• Verified Users: Email verification for security

FOR DEALERS & ORGANIZERS:
• Subscription options available
• List your shows and events
• Connect with collectors
• Manage your presence

Whether you're a collector looking for shows, a dealer wanting to connect with customers, or an organizer promoting events, Card Show Finder brings the trading card community together.

Download now and never miss another card show!
```

**Category:** Events or Lifestyle

**Tags/Keywords:**
```
card shows, trading cards, sports cards, collectibles, card collecting, dealers, collectors, events, card shop, baseball cards, pokemon cards, card conventions
```

---

## 🎯 Quick Summary

1. ✅ **Download** your `.aab` from EAS dashboard
2. 🌐 **Go to** Google Play Console
3. 📝 **Complete** store listing requirements
4. 📤 **Upload** your `.aab` to Internal testing
5. 🧪 **Test** on Android device
6. 🚀 **Promote** to Production
7. 🎉 **Future updates** use `eas submit` automatically!

---

**Start by going to:** https://expo.dev → Your project → Builds → Download the Android `.aab` file

Then go to: https://play.google.com/console

Good luck! 🚀
