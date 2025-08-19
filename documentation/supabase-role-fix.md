# Fix for Role Case Sensitivity Issue

This document explains how to fix the issue with role case sensitivity in the Card Show Finder app.

## Problem Description

The app is experiencing two related issues:
1. When upgrading a user to MVP Dealer tier, the role is not being properly synced with the subscription status
2. Even when the subscription is active, the booth information for a show is blank

The root cause is a case sensitivity mismatch between:
- The user roles stored in the database (lowercase: `dealer`, `mvp_dealer`)
- The UserRole enum in the TypeScript code (uppercase: `DEALER`, `MVP_DEALER`)

## Solution

To fix this issue, two changes are needed:

### 1. Database Fix - Standardize Role Case

Run the following SQL query in the Supabase SQL Editor:

```sql
-- Update all roles in the profiles table to uppercase
UPDATE public.profiles
SET role = UPPER(role)
WHERE role IS NOT NULL AND role != UPPER(role);

-- Verify the result
SELECT DISTINCT role FROM public.profiles;
```

### 2. Application Fix - Case-Insensitive Role Comparison

The `dealerService.ts` file has been updated to handle both uppercase and lowercase role values by adding a `normalizeRole` function that converts any role string to the proper UserRole enum value.

## Testing

After applying these fixes:

1. Check that users with active dealer subscriptions have the `MVP_DEALER` role in the database
2. Log in as a user with an active subscription and verify they're shown as "MVP Dealer"
3. Register for a show and check that the booth information is saved and displayed correctly
4. Edit booth information and verify changes are saved

These changes ensure that all roles are consistently handled throughout the application, regardless of how they're stored in the database.
