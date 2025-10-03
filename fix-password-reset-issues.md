# Fix Password Reset Deep Link Issue

## Problem Analysis

The password reset is working (email is sent), but has two issues:

1. **Email in spam** - Gmail marking as suspicious 
2. **Deep link redirect** - Opens app instead of website reset page

## Root Cause

The issue is likely that:
- Your mobile device recognizes the app's URL scheme 
- iOS/Android automatically redirect `csfinderapp.com` URLs to your app
- The app doesn't have a password reset screen to handle the deep link

## Solutions

### Option 1: Use Different Domain for Password Reset (Recommended)

Update the password reset to use a subdomain that won't trigger app redirects:

```typescript
export const _resetPassword = async (email: string): Promise<void> => {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://reset.csfinderapp.com/password-reset',
    });
    
    if (error) {
      throw error;
    }
  } catch (error: any) {
    console.error('Error sending password reset:', error.message);
    throw error;
  }
};
```

### Option 2: Handle Deep Link in App

Add a password reset screen in your app to handle the deep link properly.

### Option 3: Use Query Parameter to Bypass App

```typescript
export const _resetPassword = async (email: string): Promise<void> => {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://csfinderapp.com/reset-password?web=true',
    });
    
    if (error) {
      throw error;
    }
  } catch (error: any) {
    console.error('Error sending password reset:', error.message);
    throw error;
  }
};
```

## Fix Email Spam Issue

### 1. Configure Custom SMTP in Supabase

**Go to Supabase Dashboard → Authentication → Settings → SMTP Settings**

Configure with a reputable email service:
- **Gmail SMTP**: smtp.gmail.com
- **SendGrid**: smtp.sendgrid.net  
- **Mailgun**: smtp.mailgun.org

### 2. Update Email Template

**Go to Supabase Dashboard → Authentication → Email Templates → Reset Password**

Update the template to:
```html
<h2>Reset your password</h2>
<p>Click the link below to reset your password for Card Show Finder:</p>
<p><a href="{{ .SiteURL }}/reset-password?access_token={{ .Token }}&type=recovery">Reset Password</a></p>
<p>If you didn't request this, you can safely ignore this email.</p>
<p>This link expires in 1 hour.</p>
```

### 3. Configure Supabase Settings

**Authentication → Settings → General:**
- **Site URL**: `https://csfinderapp.com`
- **Redirect URLs**: 
  - `https://csfinderapp.com/**`
  - `https://reset.csfinderapp.com/**`
  - `cardshowfinder://**`

## Immediate Fix (Quick Solution)

For immediate testing, update the code to use a different domain: