# 🚨 URGENT FIXES REQUIRED

## Current Status
- ✅ Registration works (profile creation fixed)
- ✅ Email verification guard is active
- ✅ Email redirect URL configured in code
- ⚠️ **BLOCKER**: Infinite recursion in RLS policies prevents login
- ⚠️ Email verification detection improved (checks every 10 seconds)

---

## 🔥 CRITICAL: Fix Login Issue (Do This NOW)

### The Problem
Users cannot log in after email verification due to error:
```
infinite recursion detected in policy for relation "profiles"
```

This happens because the `is_admin()` function queries the `profiles` table, which triggers the RLS policy that calls `is_admin()` → infinite loop.

### The Fix

**Go to Supabase Dashboard → SQL Editor** and run this SQL:

```sql
-- URGENT FIX: Apply this in Supabase SQL Editor to fix login
-- This fixes the infinite recursion error

-- Step 1: Drop the problematic policy
DROP POLICY IF EXISTS "profiles_all_admin" ON public.profiles;

-- Step 2: Fix is_admin() to not query profiles table (breaks recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- Don't query profiles - just return false for now
  -- Admin checks can be done via service_role instead
  RETURN FALSE;
END;
$$;

-- Step 3: Ensure we have the INSERT policy for new user registration
DROP POLICY IF EXISTS "profiles_insert_new_user" ON public.profiles;
CREATE POLICY "profiles_insert_new_user"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

-- Step 4: Ensure service_role has full access
DROP POLICY IF EXISTS "profiles_service_role_all" ON public.profiles;
CREATE POLICY "profiles_service_role_all"
ON public.profiles
USING (auth.role() = 'service_role');

-- Verify policies (should show 4 policies)
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;
```

**This SQL is also saved in: `fix-rls-recursion-APPLY-NOW.sql`**

---

## ✅ What's Already Fixed (In Code)

### 1. Registration Profile Creation
- ✅ Removed duplicate profile creation from `supabaseAuthService.ts`
- ✅ Database trigger now handles profile creation
- ✅ Metadata (firstName, lastName, homeZipCode, role) passed correctly

### 2. Email Verification Flow
- ✅ Added `EmailVerificationGuard` wrapper in `App.tsx`
- ✅ Email redirect URL set to `https://csfinderapp.com/reset-password/`
- ✅ Auto-detection improved (checks every 10 seconds, was 30)
- ✅ Properly calls `refreshUserRole()` to update UI

### 3. IAP Service
- ✅ Temporarily stubbed to allow testing without native modules
- 📝 TODO: Restore after production deployment

---

## 🎯 Testing Checklist (After Applying SQL Fix)

### Test Registration Flow:
1. ✅ Register a new user
2. ✅ Profile appears in both `auth.users` and `public.profiles`
3. ✅ Email verification screen appears
4. ✅ Verification email sent with correct link

### Test Email Verification:
1. ⏳ Click verification link in email
2. ⏳ Wait 10 seconds (or click "Resend Email" to force refresh)
3. ⏳ App should automatically detect verification and allow access

### Test Login After Verification:
1. ⏳ Log out
2. ⏳ Log back in
3. ⏳ Should work without "infinite recursion" error

---

## 📋 Next Steps After SQL Fix

1. **Apply the SQL fix above** in Supabase Dashboard
2. **Test the complete flow**:
   - Register → Verify → Access app
   - Logout → Login → Access app
3. **If working**, commit changes:
   ```bash
   git add .
   git commit -m "fix: resolve RLS infinite recursion and improve email verification"
   git push
   ```
4. **Deploy to production** (migrations are already created)
5. **Restore IAP service** when ready:
   ```bash
   cd src/services
   rm appleIAPService.ts
   mv appleIAPService.ts.backup appleIAPService.ts
   npm install react-native-iap
   npx expo prebuild --clean
   ```

---

## 🔧 Supabase Dashboard Configuration

Also verify these settings in Supabase Dashboard:

### 1. Redirect URLs
**Authentication → URL Configuration → Redirect URLs:**
```
https://csfinderapp.com/reset-password/*
https://csfinderapp.com/*
```

### 2. Site URL
**Settings → General → Site URL:**
```
https://csfinderapp.com
```

### 3. Email Template (Optional)
**Authentication → Email Templates → Confirm signup:**

The code already sets `emailRedirectTo`, so the default template should work. But you can verify the link looks like:
```html
<a href="{{ .ConfirmationURL }}">Confirm your email</a>
```

---

## 📁 Files Modified

### App Code:
- `src/services/supabaseAuthService.ts` - Added emailRedirectTo, removed duplicate profile creation
- `src/components/EmailVerificationGuard.tsx` - Improved auto-detection (10s intervals)
- `App.tsx` - Wrapped with EmailVerificationGuard
- `src/services/appleIAPService.ts` - Temporarily stubbed

### Database:
- `supabase/migrations/20251002170000_fix_profiles_rls_recursion.sql` - RLS fix migration
- `fix-rls-recursion-APPLY-NOW.sql` - Quick fix script for SQL editor

---

## ⚡ Quick Recovery Commands

If something goes wrong:

```bash
# Restart Expo dev server
npm start -- --clear

# Check Supabase logs
npx supabase functions logs

# View current RLS policies
# Run in Supabase SQL Editor:
SELECT * FROM pg_policies WHERE tablename = 'profiles';

# Reset local database (CAUTION)
npx supabase db reset
```

---

## 📞 Support

If issues persist:
1. Check Supabase logs for detailed error messages
2. Verify RLS policies were updated correctly
3. Ensure email verification link format is correct
4. Test with a fresh email address
