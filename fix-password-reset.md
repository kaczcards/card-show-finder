# Fix Password Reset Email Issue

## Problem
The password reset functionality isn't sending emails because:

1. **Wrong redirect URL**: Currently using `cardshowfinder://reset-password` (mobile deep link)
2. **Should use website URL**: `https://csfinderapp.com/reset-password`
3. **Supabase email configuration** may need to be set up

## Solution

### Step 1: Fix the Redirect URL in Code

In `src/services/supabaseAuthService.ts`, update the `_resetPassword` function:

```typescript
export const _resetPassword = async (email: string): Promise<void> => {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://csfinderapp.com/reset-password',
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

### Step 2: Configure Supabase Email Settings

1. **Go to your Supabase Dashboard**
2. **Navigate to**: Authentication → Settings → Email Templates
3. **Configure the following:**

   **Site URL**: `https://csfinderapp.com`
   
   **Redirect URLs**: Add these allowed URLs:
   - `https://csfinderapp.com/**`
   - `https://www.csfinderapp.com/**`
   - `cardshowfinder://**` (for mobile app)

### Step 3: Email Template Configuration

**Reset Password Template** should redirect to:
```
https://csfinderapp.com/reset-password?access_token={{ .Token }}&type=recovery
```

### Step 4: SMTP Configuration (if needed)

If emails still aren't sending, you might need to configure custom SMTP:

1. **Go to**: Authentication → Settings → SMTP Settings
2. **Configure your email service** (Gmail, SendGrid, etc.)
3. **Test the configuration**

### Step 5: Website Password Reset Page

Make sure `https://csfinderapp.com/reset-password` exists and can:
1. Extract the `access_token` from URL parameters
2. Call the Supabase `updateUser()` method with new password
3. Redirect back to the mobile app or show success

## Testing

After making these changes:

1. **Test in development**: Try password reset with your email
2. **Check email delivery**: Look in spam folder if needed  
3. **Verify redirect**: Make sure the website reset page works
4. **Test end-to-end**: Complete the full password reset flow

## Common Issues

- **Email in spam**: Check spam/junk folders
- **Wrong site URL**: Must match exactly in Supabase settings
- **CORS issues**: Ensure redirect URLs are whitelisted
- **Missing website**: The reset page must exist at csfinderapp.com