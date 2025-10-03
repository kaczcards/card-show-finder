# Complete Password Reset Solution

## Problem Analysis

1. **Query parameters updated** ✅ - ResetPasswordScreen now handles `access_token` parameter
2. **Device redirecting to app** ❌ - iOS/Android recognizes `csfinderapp.com` as app domain and opens app instead of browser
3. **App routing to wrong screen** - Link opens email verification instead of password reset

## Root Cause

Your device has Universal Links (iOS) or App Links (Android) configured for `csfinderapp.com`, so any URL with that domain automatically opens the app instead of staying in the browser.

## Solutions (Pick One)

### Option 1: Use Different Domain (Recommended)

Change password reset to use a subdomain that won't trigger app opening:

```typescript
// In supabaseAuthService.ts
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

**Pros:** Simple, works immediately
**Cons:** Requires setting up subdomain

### Option 2: Update Deep Link Configuration

Update the app's deep link handling to properly route password reset URLs:

```typescript
// In RootNavigator.tsx
const linking = {
  prefixes: [
    'cardshowfinder://',
    'https://csfinderapp.com', // Add this to handle website URLs
  ],
  config: {
    screens: {
      // Auth flow - nested in AuthNavigator
      Auth: {
        screens: {
          ResetPassword: {
            path: 'reset-password',
            parse: {
              access_token: (access_token: string) => access_token,
              type: (type: string) => type,
            },
          },
        },
      },
    },
  },
};
```

**Pros:** Uses existing domain
**Cons:** More complex configuration

### Option 3: Handle Password Reset in App (Current Implementation)

Keep the current setup but ensure the app properly handles the password reset flow:

1. ✅ **ResetPasswordScreen updated** to handle `access_token`
2. **Update navigation** to ensure proper routing
3. **Set Supabase auth session** when handling the token

## Recommended Implementation (Option 1)

The easiest solution is to use a different domain for password resets:

1. **Update the redirect URL:**
   ```typescript
   redirectTo: 'https://passwordreset.csfinderapp.com/reset'
   ```

2. **Create a simple web page** at that URL that:
   - Extracts the `access_token` from URL parameters
   - Shows a password reset form
   - Calls Supabase's `updateUser()` method
   - Shows success/failure messages

3. **Alternative quick fix:**
   ```typescript
   redirectTo: 'https://csfinderapp.com/password-reset?web=1&force_browser=1'
   ```

## Testing Steps

1. **Update the redirect URL** in supabaseAuthService.ts
2. **Test password reset** - check if it stays in browser
3. **If still opens app**, use subdomain approach
4. **Verify password reset works** end-to-end

## Current Status

- ✅ ResetPasswordScreen handles `access_token` parameter
- ✅ Query parameters added to bypass app redirect 
- ❌ Device still opens app instead of browser
- ❌ Password reset flow incomplete

## Next Steps

1. Try the subdomain approach
2. Test if it stays in browser
3. Create simple web password reset page
4. Complete the password reset flow