# PR: Extend User Schema for Subscription & Account Types

## Summary
This pull-request introduces first-class support for **paid account tiers** (Dealer, Organizer) by extending the user schema in Supabase and wiring the new fields throughout the React Native mobile app.  
The change adds `account_type`, `subscription_status`, and `subscription_expiry` columns, updates the TypeScript `User` interface, and propagates the data through the Auth Context and Supabase service layer.

---

## Key Features

| Area | Change |
|------|--------|
| **Database Schema** | `db_migrations/user_account_subscription.sql` adds:<br>• `account_type` (`collector` \| `dealer` \| `organizer`) – *default `collector`*<br>• `subscription_status` (`active` \| `expired` \| `none`) – *default `none`*<br>• `subscription_expiry` (`timestamptz`) – *nullable*<br>Indexes + column comments included. |
| **TypeScript Types** | `src/types/index.ts` → `User` interface now includes `accountType`, `subscriptionStatus`, `subscriptionExpiry`. |
| **Auth Flow** | `src/contexts/AuthContext.tsx` maps the new columns into in-memory `User` objects on login, registration, and session refresh. |
| **Service Layer** | `src/services/supabaseAuthService.ts` reads/writes the new fields during registration, login, profile updates, and helper functions. |
| **Branching** | New branch `feature/extend-user-schema` branched off `feature/update-logo` to keep concerns isolated. |

---

## How to Run the Migration

### Supabase SQL Editor (recommended)
1. Open your Supabase project ➜ **SQL Editor**.  
2. Create a new query tab and paste the contents of `db_migrations/user_account_subscription.sql`.  
3. Click **RUN**.  
4. Verify the `profiles` table now contains the three new columns.

### CLI / CI Pipeline
```bash
psql "$SUPABASE_DB_URL" -f db_migrations/user_account_subscription.sql
```

> **No back-fill needed** — existing users default to  
> `account_type = 'collector'`, `subscription_status = 'none'`, `subscription_expiry = NULL`.

---

## Testing Instructions

1. **Fresh Registration**  
   • `npx expo start` → Register a new user.  
   • Inspect Supabase → New columns show default values.

2. **Existing User Sign-in**  
   • Log in with a pre-migration account.  
   • App loads with no errors; new fields visible in network inspector / Supabase row.

3. **Upgrade Flow**  
   • Via profile screen or Postman, update profile to:  
     `accountType = 'dealer'`, `subscriptionStatus = 'active'`, `subscriptionExpiry = <future date>`.  
   • Restart app → AuthContext reflects the changes.

4. **Regression Pass**  
   • Favouriting shows, reviews, collection screens, etc. continue to work unchanged.

---

## Verification Checklist

- [x] SQL migration applies without error on staging.
- [x] New TypeScript types compile & pass `tsc --noEmit`.
- [x] Expo app launches on iOS & Android simulators/devices.
- [x] Automated tests pass (`npm test`).
- [x] ESLint & Prettier show no new violations.

---

## Notes

*Snake_case* is now the canonical naming convention for new DB columns.  
The existing `role` column continues to drive feature gates; the new `account_type` purely labels a user’s subscription tier.

This PR was assisted by Factory Code Droid and is ready for review. 🚀
