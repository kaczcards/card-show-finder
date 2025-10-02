# Critical Production Fixes - Implementation Plan

## Issues to Fix

### 1. **User Registration Email Verification Issues** ✅ HIGH PRIORITY
- **Problem**: Users can access app without email verification, data persistence issues
- **Solution**: 
  - Implement forced email verification flow
  - Add email verification status checking on app launch
  - Ensure user data (firstName, homeZipCode) persists correctly
  - Add periodic reminders for unverified accounts

### 2. **Password Reset Not Working** ✅ HIGH PRIORITY  
- **Problem**: Reset password function not updating user passwords
- **Solution**:
  - Fix token handling in ResetPasswordScreen
  - Update password reset service calls
  - Test end-to-end reset flow

### 3. **MVP Dealer Custom Display Name** ✅ HIGH PRIORITY
- **Problem**: Only firstName shows for dealers, need custom display names
- **Solution**:
  - Add display_name field to profiles table
  - Add display name input to dealer registration/profile
  - Update show participant displays to use display_name

### 4. **Booth Info Page Not Scrollable** ✅ HIGH PRIORITY
- **Problem**: DealerDetailModal content not scrollable, poor formatting
- **Solution**:
  - Wrap modal content in ScrollView
  - Fix two-column layout issue
  - Improve text formatting and readability

### 5. **Search Missing MVP Dealer Booth Content** ✅ HIGH PRIORITY
- **Problem**: FilterSheet search doesn't include dealer booth information
- **Solution**:
  - Modify search query to include booth_info, specialty, notable_items
  - Update RPC function to search dealer participation data
  - Test search functionality with dealer content

### 6. **My Collection Text Input Cursor Jumping** ✅ HIGH PRIORITY
- **Problem**: Text input losing focus after each character
- **Solution**:
  - Fix TextInput key/ref handling
  - Ensure proper state management for controlled input
  - Test multiline text input behavior

## Implementation Steps

1. ✅ **Branch Creation**: Create feature branch for fixes
2. ✅ **Database Changes**: Add display_name field if needed
3. ✅ **Auth Service Updates**: Fix email verification handling
4. ✅ **UI Component Fixes**: Fix modal scrolling, text inputs
5. ✅ **Search Functionality**: Update search to include dealer content  
6. ✅ **Testing**: Local testing with Expo dev client
7. ✅ **Preview Build**: Create EAS preview build for device testing
8. ✅ **Production Build**: Create production builds for app stores
9. ✅ **Store Submission**: Submit to Apple App Store and Google Play

## Expected Timeline
- Development: 2-3 hours
- Testing: 1 hour
- Build & Deploy: 1 hour
- **Total**: 4-5 hours to production

## Testing Checklist
- [ ] Registration with email verification
- [ ] Password reset end-to-end
- [ ] MVP dealer display names
- [ ] Booth info modal scrolling  
- [ ] Search includes dealer content
- [ ] Collection text input works properly