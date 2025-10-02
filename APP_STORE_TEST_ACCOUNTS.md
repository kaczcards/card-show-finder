# App Store Testing Accounts - Card Show Finder v1.0.5

## 🤖 Google Play Store Testing

### Primary Test Account
- **Email**: `cardshowfinder.tester@gmail.com`
- **Purpose**: Internal testing and Play Store review
- **Location**: United States
- **Device**: Android 10+ recommended

### Test Scenarios for Google Play Review
1. **Installation & First Launch**
   - Install from Play Store
   - Grant location permissions when prompted
   - Complete initial app setup/onboarding

2. **Core Functionality**
   - Search for card shows near test location
   - View show details and location on map
   - Save/favorite shows to user profile
   - Test search filters and sorting

3. **Premium Features (If Applicable)**
   - Test subscription flow (without completing purchase)
   - Verify subscription benefits and features
   - Test MVP Dealer and Show Organizer features

4. **Edge Cases**
   - Test with location services disabled
   - Test with poor network connectivity
   - Test app background/foreground transitions

---

## 🍎 Apple App Store Testing

### Primary Test Account (Sandbox)
- **Apple ID**: `cardshowfinder.ios.tester@icloud.com`
- **Purpose**: App Store review and TestFlight testing
- **Country**: United States
- **Device**: iOS 15+ recommended

### Test Scenarios for App Store Review
1. **Installation & Permissions**
   - Install from App Store/TestFlight
   - Grant location permissions (required for core functionality)
   - Grant push notification permissions
   - Test camera permissions (if QR code scanning is used)

2. **Core App Flow**
   - Complete user registration/authentication
   - Search for nearby card shows
   - View show details and navigate to location
   - Add shows to favorites/saved list
   - Test map integration and directions

3. **Subscription Testing (Sandbox)**
   - Navigate to subscription offers
   - Test MVP Dealer subscription flow
   - Test Show Organizer subscription flow
   - Verify subscription benefits unlock properly
   - Test subscription management/cancellation

4. **iOS-Specific Features**
   - Apple Sign-In integration (if implemented)
   - iOS location services integration
   - Push notification delivery
   - App backgrounding and state restoration

---

## 🔐 Security Notes

- **Never commit these credentials to version control**
- Store test account credentials securely (password manager recommended)
- Use these accounts ONLY for testing purposes
- Reset passwords regularly
- Disable accounts when testing is complete

---

## 📝 Reviewer Instructions

### For Google Play Review Team:
```
Test Account: cardshowfinder.tester@gmail.com
Password: [Secure password to be provided]

To test the app:
1. Install the app from Play Store
2. Allow location permissions when prompted
3. Search for "card shows" or "trading card events" near your location
4. Tap on any show to view details and location
5. Test the favorites/saved shows functionality
6. For subscription testing, navigate to premium features (testing only - no payment required)

Note: This app helps trading card collectors find local shows and events. Location permission is essential for core functionality.
```

### For Apple App Store Review Team:
```
Test Account: cardshowfinder.ios.tester@icloud.com
Password: [Secure password to be provided]

To test the app:
1. Install from App Store using the test account
2. Grant location permissions (required for finding nearby shows)
3. Search for card shows in your area
4. View show details, dates, and locations
5. Test adding shows to favorites
6. For in-app subscriptions, use iOS Sandbox environment (no real charges)

Note: This is a trading card show discovery app. Location services are required to display relevant local events.
```

---

## ✅ Pre-Submission Checklist

### Google Play Store
- [ ] Test account created and verified
- [ ] Internal testing track configured
- [ ] Test APK uploaded and tested
- [ ] All required permissions documented
- [ ] Subscription testing completed (if applicable)
- [ ] Privacy policy and terms of service links verified

### Apple App Store
- [ ] Sandbox tester account created in App Store Connect
- [ ] TestFlight build uploaded and tested
- [ ] All iOS permissions properly configured
- [ ] Subscription testing completed in sandbox
- [ ] App Store metadata and screenshots prepared
- [ ] Privacy policy and terms compliance verified

---

## 🎯 Version 1.0.5 Focus Areas

This release focuses on **logo and branding improvements**:
- Test that the new transparent logo displays properly
- Verify logo appears correctly on login screen
- Confirm orange brand accent is visible
- Test logo on various screen sizes and orientations
- Ensure no visual regressions from logo update

---

*Document created for Card Show Finder v1.0.5 deployment*
*Last updated: $(date)*