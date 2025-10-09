# Password Reset Debugging Guide

## Quick Fixes

### Option 1: Set Password Directly in Supabase (Fastest!)

1. Go to: https://app.supabase.com/project/zmfqzegykwyrrvrpwylf/auth/users
2. Find your user: `84ec4c75-1c32-46f6-b0bb-7930869a4c81`
3. Click the three dots next to the user
4. Select "Send Password Reset Email" or "Reset Password"
5. Check your email for the link

### Option 2: Update Password via SQL

```sql
-- Set a new password directly (replace 'YourNewPassword123')
UPDATE auth.users
SET 
  encrypted_password = crypt('YourNewPassword123', gen_salt('bf')),
  updated_at = now()
WHERE id = '84ec4c75-1c32-46f6-b0bb-7930869a4c81';
```

---

## Investigation Checklist

### 1. Check Site URL Configuration

**Go to**: https://app.supabase.com/project/zmfqzegykwyrrvrpwylf/auth/url-configuration

**Site URL should be**:
- Local: `http://localhost:3000`
- Production: `https://your-app.vercel.app`

### 2. Check Redirect URLs

**Should include**:
```
http://localhost:3000/**
http://localhost:3000/auth/callback
http://localhost:3000/auth/reset-password
https://your-app.vercel.app/**
https://your-app.vercel.app/auth/callback
https://your-app.vercel.app/auth/reset-password
```

### 3. Check Email Template

**Go to**: https://app.supabase.com/project/zmfqzegykwyrrvrpwylf/auth/templates

**Reset Password template should have**:
```html
<p>Follow this link to reset your password:</p>
<p><a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery">Reset Password</a></p>
```

Or:
```html
<p><a href="{{ .ConfirmationURL }}">Reset Password</a></p>
```

### 4. What's in the Reset Email?

Copy the reset link from your email and check:

**Good link examples**:
```
http://localhost:3000/auth/callback?token_hash=abc123&type=recovery
http://localhost:3000/auth/confirm?token_hash=abc123&type=recovery
```

**Bad link examples**:
```
https://zmfqzegykwyrrvrpwylf.supabase.co/... (wrong domain)
http://localhost:3000/... (missing token_hash)
```

---

## New Files Added

I just created these files to handle password reset properly:

1. **`app/auth/callback/route.ts`**
   - Handles auth callbacks from Supabase
   - Processes password reset tokens
   - Redirects to reset password page

2. **`app/auth/reset-password/page.tsx`**
   - UI for entering new password
   - Validates password strength
   - Updates password in Supabase

---

## How Password Reset Works Now

1. **User requests reset** → email sent with link
2. **User clicks link** → goes to `/auth/callback?token_hash=...&type=recovery`
3. **Callback handler** verifies token → redirects to `/auth/reset-password`
4. **Reset page** shows form → user enters new password
5. **Password updated** → redirect to login

---

## Testing the New Flow

### Local Development:

1. **Make sure Site URL is set to**: `http://localhost:3000`
2. **Start your dev server**:
   ```bash
   cd card-show-admin
   npm run dev
   ```
3. **Go to login page**: http://localhost:3000/login
4. **Request password reset** (add forgot password link to login if needed)
5. **Check email** and click the reset link
6. **Should redirect to**: http://localhost:3000/auth/reset-password
7. **Enter new password** and submit

### Production:

1. **Deploy to Vercel first**
2. **Update Site URL to**: `https://your-app.vercel.app`
3. **Add redirect URLs** for your Vercel domain
4. **Test the flow**

---

## Common Issues & Solutions

### Issue: "Invalid token" or "Token expired"

**Solution**: Tokens expire after 1 hour. Request a new reset email.

### Issue: Link goes to 404

**Solution**: 
- Check Site URL in Supabase settings
- Make sure it matches where you're running the app
- Add redirect URLs for your domain

### Issue: Link goes to Supabase URL instead of your app

**Solution**:
- Update the email template to use `{{ .SiteURL }}`
- Don't use `{{ .ConfirmationURL }}` (goes to Supabase)

### Issue: "Redirect URL not allowed"

**Solution**:
- Add your callback URLs to "Redirect URLs" in Supabase Auth settings
- Use wildcards: `http://localhost:3000/**`

---

## Quick Test Without Email

You can test the password update directly:

1. **Get a session token manually**:
   ```bash
   # In browser console after logging in
   const { data } = await supabase.auth.getSession()
   console.log(data.session.access_token)
   ```

2. **Update password via API**:
   ```bash
   curl -X PUT 'https://zmfqzegykwyrrvrpwylf.supabase.co/auth/v1/user' \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"password": "NewPassword123"}'
   ```

---

## Need More Help?

1. Check what the reset link looks like in your email
2. Try the SQL password update as a temporary fix
3. Verify your Supabase Auth settings match the checklist above
4. Let me know the exact error message you're getting

---

## What Changed

### New Files:
1. **`app/api/auth/reset-password/route.ts`** - API endpoint for admin password reset
2. **`app/auth/callback/route.ts`** - Handles auth callbacks and password reset tokens
3. **`app/auth/reset-password/page.tsx`** - UI for entering new password
4. **`app/login/page.tsx`** - Updated with "Forgot Password" feature

### Environment Variables:
- Added `NEXT_PUBLIC_SITE_URL` for dynamic redirect URLs

### How It's Different:
- **Mobile app** uses `supabaseAuthService.resetPassword()` with hardcoded redirect
- **Admin dashboard** uses `/api/auth/reset-password` with dynamic redirect
- Both use the same Supabase Auth but with different redirect URLs
- No conflicts because redirect URLs are set per API call

---

## Commit These Files

Don't forget to commit the new auth handler files:

```bash
cd /Users/kevin/card-show-finder
git add card-show-admin/
git commit -m "Add admin dashboard password reset with dual-flow support"
git push
```
