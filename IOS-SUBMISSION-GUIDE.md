# 📱 iOS App Store Submission Guide

## Overview

**Good news:** Unlike Android, iOS can be submitted automatically via EAS on the first upload! No manual upload required.

---

## 🚀 Quick Start - iOS Submission

```bash
cd /Users/kevin/card-show-finder

# Submit to Apple App Store
eas submit --platform ios --profile production
```

**That's it!** EAS handles everything for you.

---

## 📋 Prerequisites

### 1. Apple Developer Account ($99/year)

**If you don't have one:**
1. Go to: https://developer.apple.com/programs/
2. Click "Enroll"
3. Pay $99/year fee
4. Complete enrollment (takes 24-48 hours to approve)

**If you already have one:**
- Make sure it's active and paid
- You'll need your Apple ID credentials

---

## 🎯 Complete iOS Submission Process

### Step 1: Run EAS Submit

```bash
cd /Users/kevin/card-show-finder
eas submit --platform ios --profile production
```

### Step 2: Answer the Prompts

#### Prompt 1: "What would you like to submit?"
**Answer:** Select **"Select a build from EAS"** (first option)

#### Prompt 2: "Which build would you like to submit?"
**Answer:** Select the **iOS build** with:
- Platform: iOS
- Status: finished
- Commit: "fix: restore IAP service for production build"

#### Prompt 3: "Apple ID:"
**Answer:** Your Apple Developer account email

#### Prompt 4: "Password for Apple ID:"
**Answer:** Your Apple ID password
- Or use app-specific password if you have 2FA enabled
- To create app-specific password: https://appleid.apple.com → Security → App-Specific Passwords

#### Prompt 5: "App Store Connect API Key" (Optional)
**Answer:** Press Enter to skip (use Apple ID instead)

#### Prompt 6: "Bundle identifier"
**Answer:** Should auto-detect from your build (e.g., `com.yourcompany.cardshowfinder`)

---

## 📲 What Happens After Submission

### Automatic Process:

1. **EAS uploads** your `.ipa` file to App Store Connect
2. **Processing** (~5-10 minutes)
3. **TestFlight available** immediately
4. **Ready for App Store review submission**

---

## 🧪 Testing on TestFlight

### Step 1: Access TestFlight

1. **Go to:** https://appstoreconnect.apple.com
2. **Sign in** with your Apple ID
3. **Select:** Your app
4. **Click:** TestFlight tab

### Step 2: Add Internal Testers

1. **Click:** "Internal Testing" 
2. **Click:** "+" to add testers
3. **Add:** Your email and team members (up to 100)
4. **Save**

### Step 3: Install on iPhone

1. **Install TestFlight app** from App Store (if not already installed)
2. **Open email** invitation
3. **Click:** "View in TestFlight"
4. **Install** the app
5. **Test everything:**
   - ✅ Registration
   - ✅ Email verification
   - ✅ Login
   - ✅ Password reset
   - ✅ **IAP subscriptions** (CRITICAL!)
   - ✅ All features

---

## 📝 Prepare App Store Listing

While testing, complete your App Store Connect listing:

### Step 1: Go to App Store Connect

1. **Go to:** https://appstoreconnect.apple.com
2. **Click:** "My Apps"
3. **Click:** Your app (or "+" to create if first time)

### Step 2: Fill in App Information

#### App Information:
- **Name:** Card Show Finder
- **Primary Language:** English (US)
- **Bundle ID:** (auto-filled)
- **SKU:** cardshowfinder (unique identifier)

#### Privacy Policy:
- **URL:** https://csfinderapp.com/privacy
- Required by Apple

#### App Category:
- **Primary:** Lifestyle or Events
- **Secondary:** (optional)

#### Content Rights:
- Select appropriate options

---

### Step 3: Complete Version Information

Go to: App Store → [Your App] → Version (e.g., 1.0.0)

#### What's New in This Version:
```
Welcome to Card Show Finder!

Discover and attend sports card and trading card shows with ease.

• Find card shows and events near you
• Interactive map with show locations
• Detailed event information and directions
• Connect with dealers and organizers
• Mark shows as favorites
• Track your attendance history
• Email verification for security
• Subscription options for dealers/organizers
• Easy password reset

Download now and never miss another card show!
```

#### Promotional Text (Optional):
```
Find card shows near you, connect with dealers, and never miss a trading card event!
```

#### Description:
```
Card Show Finder is your ultimate companion for discovering and attending sports card and trading card shows.

FEATURES:

Find Shows Near You
• Discover card shows and events in your area
• Interactive map view with filters
• Get directions to any show
• See dates, times, and locations

Connect with the Community
• Find dealers and organizers
• Connect with other collectors
• Track your favorite shows
• Build your attendance history

Stay Updated
• Get notifications about upcoming events
• Email verification for security
• Easy password reset
• Sync across devices

For Dealers & Organizers
• Subscription options available
• List your shows and events
• Connect with collectors
• Manage your presence in the community

Whether you're a collector looking for shows, a dealer wanting to connect with customers, or an organizer promoting events, Card Show Finder brings the trading card community together.

Perfect for:
• Baseball card collectors
• Sports card dealers
• Pokemon card enthusiasts
• Trading card game players
• Card show organizers
• Collectible enthusiasts

Download Card Show Finder today and never miss another card show!
```

#### Keywords (100 characters max):
```
card shows,trading cards,sports cards,collectibles,dealers,collectors,events,card shop,baseball
```

#### Support URL:
```
https://csfinderapp.com/support
```

#### Marketing URL (Optional):
```
https://csfinderapp.com
```

---

### Step 4: Upload Screenshots

**Required sizes:**
- **6.7" (iPhone 14 Pro Max):** 1290 x 2796 pixels
- **6.5" (iPhone 11 Pro Max):** 1242 x 2688 pixels
- **5.5" (iPhone 8 Plus):** 1242 x 2208 pixels

**Minimum:** 3-10 screenshots per size

**Where to get screenshots:**
1. Run app in iOS Simulator (large size)
2. Take screenshots of key screens
3. Or use device to capture
4. Upload in App Store Connect

**Key screens to capture:**
- Map view with shows
- Show details page
- User profile/account
- Subscription options (if applicable)
- Registration/login screens

---

### Step 5: App Review Information

#### Contact Information:
- **First Name:** Your name
- **Last Name:** Your name
- **Phone:** Your phone
- **Email:** Your support email

#### Demo Account (If app requires login):
- **Username:** demo@example.com (create a test account)
- **Password:** TestPassword123
- **Notes:** Any special instructions for reviewers

#### Notes:
```
Card Show Finder helps users discover and attend trading card shows and events.

Key features:
- Users can browse card shows on an interactive map
- Email verification is required for account security
- Subscription options available for dealers and organizers via in-app purchase
- All data stored securely in Supabase database

Demo account provided for testing. Please note that email verification is required but the demo account is already verified.
```

---

### Step 6: Age Rating

Complete the questionnaire:
- **Violence:** None
- **Sexual Content:** None  
- **Profanity:** None
- **Gambling:** None
- **Horror/Fear:** None
- **Alcohol/Tobacco/Drugs:** None
- **Mature/Suggestive Themes:** None
- **Medical/Treatment Information:** None

**Result:** Likely 4+ or 9+ rating

---

### Step 7: App Icon

- **Size:** 1024 x 1024 pixels
- **Format:** PNG (no transparency)
- **Upload** in App Store Connect

---

## ✅ Submit for App Store Review

Once everything is complete:

### Step 1: Add Build

1. **In App Store Connect:**
   - Go to: App Store → [Version] → Build
2. **Click:** "+ Add Build"
3. **Select:** Your uploaded build
4. **Click:** "Done"

### Step 2: Review Everything

Check all sections have green checkmarks:
- ✅ App Information
- ✅ Pricing and Availability
- ✅ App Privacy
- ✅ Version Information
- ✅ Build added
- ✅ Screenshots uploaded
- ✅ App icon uploaded

### Step 3: Submit for Review

1. **Click:** "Submit for Review" (top right)
2. **Answer questions:**
   - Export Compliance: Usually "No" for most apps
   - Content Rights: Confirm you have rights
   - Advertising Identifier: Select appropriate option
3. **Click:** "Submit"

---

## ⏱️ Review Timeline

| Step | Time |
|------|------|
| **Upload to App Store Connect** | 5-10 min |
| **TestFlight available** | Immediate |
| **Waiting for Review** | 24-48 hours |
| **In Review** | 1-24 hours |
| **Ready for Sale** | Immediate after approval |

**Total:** Usually 1-3 days for first submission

---

## 🧪 Testing IAP on iOS

### Setup Sandbox Testing:

1. **App Store Connect:**
   - Users and Access → Sandbox Testers
   - Click "+" to add tester
   - Create test Apple ID (doesn't need to be real)

2. **On iPhone:**
   - Settings → App Store → Sandbox Account
   - Sign in with test Apple ID

3. **Test in app:**
   - Open TestFlight build
   - Go to subscriptions
   - Try to purchase
   - Apple shows "Sandbox Environment"
   - Complete test purchase (no charge)
   - Verify subscription activates

---

## 🔄 Update Process (Future)

For future updates:

```bash
# 1. Build new version
eas build --platform ios --profile production

# 2. Submit to App Store
eas submit --platform ios --profile production

# 3. Update version info in App Store Connect
# 4. Submit for review again
```

---

## 🚨 Common Rejection Reasons & Solutions

### Rejection: "App crashes on launch"
**Solution:** 
- Test thoroughly on TestFlight first
- Check logs in App Store Connect
- Fix crash and resubmit

### Rejection: "Missing demo account"
**Solution:**
- Provide valid demo credentials
- Ensure account works and is verified

### Rejection: "Incomplete metadata"
**Solution:**
- Fill in all required fields
- Add all required screenshots
- Include privacy policy URL

### Rejection: "IAP issues"
**Solution:**
- Test IAP thoroughly in sandbox
- Ensure IAP products are configured in App Store Connect
- Provide clear descriptions of what users get

### Rejection: "Guideline violation"
**Solution:**
- Read the specific guideline cited
- Make necessary changes
- Respond to reviewer with explanation

---

## 💰 App Pricing & Availability

### Pricing:
1. **Go to:** App Store Connect → Pricing and Availability
2. **Select:** Free or Paid
3. **If free:** Users download for free (IAP for subscriptions)
4. **If paid:** Set price tier

### Availability:
- **Countries:** Select all or specific countries
- **Pre-order:** Optional

---

## 📊 iOS vs Android Comparison

| Aspect | iOS (App Store) | Android (Play Store) |
|--------|-----------------|---------------------|
| **First submission** | Automated via EAS | Manual upload required |
| **Review time** | 24-48 hours | 1-7 days (production) |
| **Testing** | TestFlight | Internal/Alpha/Beta tracks |
| **Account cost** | $99/year | $25 one-time |
| **Approval strictness** | Very strict | More lenient |
| **IAP testing** | Sandbox accounts | License testing |
| **Submission** | `eas submit --platform ios` | `eas submit --platform android` |

---

## ✅ Checklist

Before submitting:
- [x] iOS build completed
- [ ] Apple Developer account active ($99/year)
- [ ] Run `eas submit --platform ios`
- [ ] Build uploaded to App Store Connect
- [ ] Tested on TestFlight

App Store Connect setup:
- [ ] App created in App Store Connect
- [ ] App information completed
- [ ] Version information filled
- [ ] Description and keywords added
- [ ] Screenshots uploaded (all required sizes)
- [ ] App icon uploaded (1024x1024)
- [ ] Privacy policy URL provided
- [ ] Age rating completed
- [ ] Demo account provided (if needed)
- [ ] Build added to version

Submit for review:
- [ ] All sections have green checkmarks
- [ ] Clicked "Submit for Review"
- [ ] Answered export compliance questions
- [ ] Confirmed content rights

After approval:
- [ ] Test final app from App Store
- [ ] Monitor crash reports
- [ ] Respond to user reviews
- [ ] Monitor IAP revenue

---

## 🎯 Quick Command Reference

```bash
# Submit to App Store
eas submit --platform ios --profile production

# Check build status
eas build:list --platform ios

# View build details
eas build:view BUILD_ID
```

---

## 📞 Support Resources

- **App Store Connect:** https://appstoreconnect.apple.com
- **TestFlight:** https://appstoreconnect.apple.com (TestFlight tab)
- **Developer Portal:** https://developer.apple.com
- **App Review Guidelines:** https://developer.apple.com/app-store/review/guidelines/
- **EAS Submit Docs:** https://docs.expo.dev/submit/ios/

---

## 🎯 Your Current Status

**Right now:**
- ✅ iOS build completed
- ✅ Android submitted to Play Store
- 🔄 **Next: Submit iOS**

**Run this command:**
```bash
eas submit --platform ios --profile production
```

**Then:** Complete App Store Connect listing while Apple reviews

**Timeline:** Live in App Store in 1-3 days!

---

**Ready to submit to iOS? Run the command above!** 🚀
