# 📧 Supabase Email Template Configuration

## Problem Fixed
You were using the same URL (`csfinderapp.com/reset-password`) for both:
- ❌ Email verification (new signups)
- ❌ Password resets

Now separated into:
- ✅ `csfinderapp.com/verify` - For email verification
- ✅ `csfinderapp.com/reset-password` - For password resets

---

## 🔧 What Was Changed in Code

### Files Updated:
1. **`src/services/supabaseAuthService.ts`** (2 locations):
   - `_signUp()` function - Line 117
   - `_registerUser()` function - Line 200
   - Changed: `emailRedirectTo: 'https://csfinderapp.com/verify'`

2. **New file created: `website-verify.html`**
   - Upload to: `https://csfinderapp.com/verify/index.html`
   - Beautiful email verification success page

---

## 🌐 Supabase Dashboard Configuration

### Step 1: Update Email Templates

1. **Go to Supabase Dashboard:**
   - https://supabase.com/dashboard/project/zmfqzegykwyrrvrpwylf/auth/templates

2. **Configure "Confirm signup" Email Template:**
   
   Click on **"Confirm signup"** template and update:
   
   **Subject:**
   ```
   Confirm your email - Card Show Finder
   ```
   
   **Email Body (HTML):**
   ```html
   <h2>Welcome to Card Show Finder!</h2>
   <p>Thanks for signing up! Please confirm your email address to get started.</p>
   <p><a href="{{ .ConfirmationURL }}">Confirm your email</a></p>
   <p>Or copy and paste this URL into your browser:</p>
   <p>{{ .ConfirmationURL }}</p>
   <p>This link will expire in 24 hours.</p>
   ```

3. **Verify "Magic Link" Template (if used):**
   
   Click on **"Magic Link"** and ensure it's correct (optional).

4. **Verify "Change Email Address" Template:**
   
   Click on **"Change Email Address"** (uses confirm URL too).

5. **Password Reset Template (should already be correct):**
   
   Click on **"Reset Password"** and verify it uses the reset-password URL.

---

## 🔗 Update URL Configuration

### Step 2: Set Redirect URLs in Supabase Auth Settings

1. **Go to Auth Settings:**
   - https://supabase.com/dashboard/project/zmfqzegykwyrrvrpwylf/auth/url-configuration

2. **Add Redirect URLs:**
   
   In the **"Redirect URLs"** section, add both:
   ```
   https://csfinderapp.com/verify
   https://csfinderapp.com/verify/
   https://csfinderapp.com/reset-password
   https://csfinderapp.com/reset-password/
   ```

3. **Site URL (if needed):**
   
   Set to your main domain:
   ```
   https://csfinderapp.com
   ```

4. **Click "Save"**

---

## 📤 Upload Website Pages

### Step 3: Upload Both HTML Pages to Your Website

1. **Email Verification Page:**
   ```
   Upload: website-verify.html
   To: https://csfinderapp.com/verify/index.html
   ```

2. **Password Reset Page (already done):**
   ```
   Upload: website-reset-password.html
   To: https://csfinderapp.com/reset-password/index.html
   ```

---

## ✅ How It Works Now

### New User Registration Flow:
1. User signs up in app
2. App calls `signUp()` with `emailRedirectTo: 'https://csfinderapp.com/verify'`
3. User receives **"Confirm signup"** email
4. Email contains link to: `https://csfinderapp.com/verify?token=...`
5. User clicks link → Redirected to verify page
6. Page shows: "Email Verified! ✓"
7. User returns to app → Auto-detected and granted access

### Password Reset Flow:
1. User clicks "Forgot Password?" in app
2. App calls `resetPasswordForEmail()` with `redirectTo: 'https://csfinderapp.com/reset-password/'`
3. User receives **"Reset Password"** email
4. Email contains link to: `https://csfinderapp.com/reset-password?token=...`
5. User clicks link → Redirected to reset password page
6. User enters new password → Success
7. User returns to app → Login with new password

---

## 🧪 Testing

### Test Email Verification:
1. Register a new user with fresh email
2. Check email for "Confirm your email" message
3. Click link → Should go to `csfinderapp.com/verify`
4. Should see success message with checkmark
5. Return to app → Automatically granted access

### Test Password Reset:
1. Click "Forgot Password?" in app
2. Enter email
3. Check email for "Reset your password" message
4. Click link → Should go to `csfinderapp.com/reset-password`
5. Enter new password → Success
6. Login to app with new password

---

## 🚨 Important Notes

### Email Template Variables:
- `{{ .ConfirmationURL }}` - For email verification (signup)
- `{{ .Token }}` - Raw token if you need to build custom URLs
- `{{ .TokenHash }}` - Token hash for security

### URL Configuration:
- Supabase will **automatically append** the token to your redirect URL
- Example: `https://csfinderapp.com/verify` becomes `https://csfinderapp.com/verify?token=abc123...`
- Your HTML pages handle parsing the token from the URL

### Security:
- Tokens expire after 24 hours (default)
- Tokens are single-use
- Both pages use your anon key (safe for public use)

---

## 📝 Supabase Email Settings Summary

After configuration, you should have:

| Email Type | Template Name | Redirect URL |
|------------|---------------|--------------|
| New Signup | Confirm signup | `https://csfinderapp.com/verify` |
| Password Reset | Reset Password | `https://csfinderapp.com/reset-password` |
| Magic Link (optional) | Magic Link | `https://csfinderapp.com/verify` |
| Email Change | Change Email Address | `https://csfinderapp.com/verify` |

---

## 🔄 Deploy Updated Code

After uploading the verify page and updating Supabase:

```bash
cd /Users/kevin/card-show-finder

# Stage changes
git add src/services/supabaseAuthService.ts
git add website-verify.html
git add SUPABASE-EMAIL-SETUP.md

# Commit
git commit -m "fix: separate email verification and password reset URLs

- Update signup to use csfinderapp.com/verify
- Keep password reset using csfinderapp.com/reset-password
- Add new email verification page
- Update Supabase email template configuration docs"

# Push
git push origin main

# Publish OTA update
npx expo publish --release-channel production
```

---

## ✅ Checklist

Before going live, verify:

- [ ] `website-verify.html` uploaded to `csfinderapp.com/verify/`
- [ ] `website-reset-password.html` uploaded to `csfinderapp.com/reset-password/`
- [ ] Supabase "Confirm signup" template updated
- [ ] Supabase redirect URLs added (both verify and reset-password)
- [ ] Code changes committed and pushed to GitHub
- [ ] OTA update published
- [ ] Test new user registration → Email verification
- [ ] Test password reset flow

---

**All set!** Your email flows are now properly separated! 🎉
