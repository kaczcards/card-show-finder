# Password Reset Rate Limit Fix

## Problem
Getting "email rate limit exceeded" when testing password reset functionality.

## Solutions (Choose One)

### Option 1: Increase Rate Limits (Recommended for Production)

**In Supabase Dashboard:**
1. Go to **Authentication > Settings**
2. Find **Rate Limits** section
3. Increase **Email Rate Limit** from 3 to 10 per hour
4. Save settings

### Option 2: Wait for Rate Limit Reset (1 hour)
The rate limit automatically resets after 1 hour. Test again later.

### Option 3: Use Alternative Implementation (If deep links still fail)

Replace the current password reset function with the alternative:

```typescript
// In src/services/supabaseAuthService.ts
export const _resetPassword = async (email: string): Promise<void> => {
  try {
    // Use subdomain that won't trigger app deep links
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://passwordreset.csfinderapp.com/reset',
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

**Note:** This requires setting up a simple web page at that subdomain.

### Option 4: Disable Rate Limits for Testing (Development Only)

**In Supabase Dashboard:**
1. Go to **Authentication > Settings**
2. Set **Email Rate Limit** to 0 (unlimited)
3. **Remember to re-enable for production!**

## Testing Steps

1. **Apply chosen solution**
2. **Wait 1 hour if rate limited**
3. **Test password reset with new user email**
4. **Verify email is received and link works**

## Current Status
- ✅ Password reset URL scheme fixed (cardshowfinder://)
- ❌ Rate limiting blocking during testing
- Need to adjust rate limits for development

## For Apple Submission
Use Option 1 - increase to reasonable production limits (10 per hour).