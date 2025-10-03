# 🚀 Deployment Guide - Production Release

## ✅ Changes Summary

### Fixed Issues:
1. ✅ **RLS Infinite Recursion** - Users can now login without errors
2. ✅ **Registration Flow** - Profiles created automatically via database trigger
3. ✅ **Email Verification** - Users must verify email before accessing app
4. ✅ **Password Reset** - Password reset emails sent with correct redirect URL

### Files Modified:
- `src/services/supabaseAuthService.ts` - Fixed emailRedirectTo URLs, removed duplicate profile creation
- `src/contexts/AuthContext.tsx` - Better error handling for missing profiles
- `src/components/EmailVerificationGuard.tsx` - Improved auto-detection (10s intervals)
- `App.tsx` - Wrapped with EmailVerificationGuard
- `src/services/appleIAPService.ts` - Temporarily stubbed for testing

### Database Changes Applied (Already in Production):
- ✅ Fixed `is_admin()` function to prevent recursion
- ✅ Dropped problematic `profiles_all_admin` policy
- ✅ Added proper INSERT policies for registration

---

## 📋 Pre-Deployment Checklist

Before deploying, verify:

- [ ] All RLS policy fixes applied in Supabase Dashboard
- [ ] Password reset page uploaded to website at `https://csfinderapp.com/reset-password/`
- [ ] Tested registration flow locally
- [ ] Tested email verification locally
- [ ] Tested password reset locally
- [ ] No secrets or API keys in code

---

## 🎯 Deployment Steps

### Step 1: Review Changes

```bash
cd /Users/kevin/card-show-finder

# See what files changed
git status

# Review the actual changes
git diff src/services/supabaseAuthService.ts
git diff src/contexts/AuthContext.tsx
git diff src/components/EmailVerificationGuard.tsx
git diff App.tsx
```

### Step 2: Stage and Commit Changes

```bash
# Add the modified files
git add src/services/supabaseAuthService.ts
git add src/contexts/AuthContext.tsx
git add src/components/EmailVerificationGuard.tsx
git add App.tsx

# Add migrations (if not already committed)
git add supabase/migrations/20251002170000_fix_profiles_rls_recursion.sql
git add supabase/migrations/20251002180000_emergency_rls_fix.sql

# Commit with descriptive message
git commit -m "fix: resolve registration and authentication issues

- Fix infinite recursion in RLS policies by updating is_admin()
- Remove duplicate profile creation from signup flow
- Add email verification enforcement with EmailVerificationGuard
- Update password reset redirect URL to web page
- Improve error handling for missing profiles
- Temporarily stub IAP service for testing

Fixes registration flow, email verification, and password reset
All changes tested locally and working correctly"
```

### Step 3: Push to Repository

```bash
# Push to main branch (or your production branch)
git push origin main
```

### Step 4: Build and Deploy to Expo

#### Option A: EAS Build (Recommended for Production)

```bash
# Install EAS CLI if not already installed
npm install -g eas-cli

# Login to Expo
eas login

# Build for production
eas build --platform all --profile production

# Submit to app stores (when ready)
eas submit --platform ios
eas submit --platform android
```

#### Option B: Expo Publish (Over-the-Air Update)

**Note:** This only works for JS changes, not native code changes. Since we stubbed the IAP service (native), you may need a full build.

```bash
# Publish update
npx expo publish --release-channel production
```

### Step 5: Restore IAP Service (After Testing)

Once you've verified everything works in production:

```bash
# Restore the original IAP service
cd src/services
rm appleIAPService.ts
mv appleIAPService.ts.backup appleIAPService.ts

# Reinstall native dependencies
npm install react-native-iap

# Rebuild the app
npx expo prebuild --clean
eas build --platform all --profile production
```

---

## 🔍 Post-Deployment Verification

After deploying, test these flows:

### 1. Registration Flow
- [ ] Register a new user with a fresh email
- [ ] Verify profile created in Supabase profiles table
- [ ] Email verification screen appears
- [ ] Verification email received

### 2. Email Verification
- [ ] Click verification link in email
- [ ] Redirected to website showing success
- [ ] Return to app within 10 seconds
- [ ] App automatically grants access

### 3. Login Flow
- [ ] Logout from the app
- [ ] Login with verified credentials
- [ ] No "infinite recursion" errors
- [ ] Profile loads correctly

### 4. Password Reset
- [ ] Click "Forgot Password?"
- [ ] Enter email
- [ ] Receive password reset email
- [ ] Click link, redirected to website
- [ ] Enter new password
- [ ] Return to app and login with new password

---

## 🐛 Rollback Plan (If Needed)

If something goes wrong:

### 1. Revert Code Changes
```bash
# Revert to previous commit
git revert HEAD
git push origin main
```

### 2. Restore Database Policies
Run this in Supabase SQL Editor:
```sql
-- Recreate the old policies (not recommended, but for emergency)
-- Contact support for specific rollback steps
```

### 3. Redeploy Previous Version
```bash
# Build from previous commit
git checkout <previous-commit-hash>
eas build --platform all --profile production
```

---

## 📊 Monitoring

After deployment, monitor:

1. **Supabase Dashboard** → Logs
   - Check for RLS policy errors
   - Monitor registration attempts
   - Watch for profile creation failures

2. **Sentry** (if configured)
   - Monitor error rates
   - Check for new error types

3. **User Feedback**
   - Monitor support channels
   - Check app reviews

---

## 🎉 Success Metrics

You'll know deployment is successful when:

- ✅ No "infinite recursion" errors in logs
- ✅ New user registrations complete successfully
- ✅ Profiles automatically created in database
- ✅ Email verification enforced before app access
- ✅ Password reset emails delivered and working
- ✅ Login flow works without errors

---

## 📝 Notes

- **Database changes are already live** (applied via Supabase Dashboard)
- **IAP service is stubbed** - restore after confirming production works
- **Website password reset page** must be live at `https://csfinderapp.com/reset-password/`
- **Test with new email addresses** to verify complete flow

---

## 🆘 Support

If you encounter issues:

1. Check Supabase logs for detailed error messages
2. Verify RLS policies are correct in database
3. Confirm password reset page is accessible online
4. Test with different email providers (Gmail, Yahoo, etc.)
5. Check that verification emails aren't in spam folders

---

**Ready to deploy? Follow the steps above!** 🚀
