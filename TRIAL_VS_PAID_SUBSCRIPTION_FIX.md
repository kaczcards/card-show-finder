# Trial vs Paid Subscription Fix – Deployment Guide  
_File: **TRIAL_VS_PAID_SUBSCRIPTION_FIX.md**_

---

## 1 · Problem Summary 💥
Free-trial messaging was shown even to **pre-paid Annual/Monthly subscribers** because:
1. UI decided a user is “in trial” solely on **“< 7 days left”** logic.  
2. Database had **no field** differentiating trial users from paid users.  
3. Payment flow did **not** mark users as “paid”; thus every prepaid account still appeared as a trial that ended in 7 days, encouraging cancellations before billing.

Result → Confusing dashboard + potential abuse of free trial.

---

## 2 · Solution Overview 🛠️
A new **`payment_status`** column is added to `public.profiles` with values:
- `trial` – within free-trial window  
- `paid` – completed payment, active subscription  
- `none` – collectors / expired

Core logic changes:
1. **Service layer** introduces `isInTrialPeriod()` to decide trial vs paid.
2. All successful payment flows set `payment_status = 'paid'`.
3. UI reads `isTrialPeriod` / `isPaid` flags to show:
   • “Trial Ends In” **only** for real trials  
   • “Subscription Ends In” for paid users (no badge)

---

## 3 · Database Migration Steps 📑
Run the SQL below in Supabase SQL Editor (or include in migrations).

```sql
-- 3.1  Add column & constraints
ALTER TABLE public.profiles
ADD COLUMN payment_status VARCHAR(20) NOT NULL DEFAULT 'none'
CHECK (payment_status IN ('trial','paid','none'));

CREATE INDEX idx_profiles_payment_status ON public.profiles(payment_status);

COMMENT ON COLUMN public.profiles.payment_status
  IS 'trial = free trial, paid = active paid subscription, none = no sub';

-- 3.2  Back-fill existing data
UPDATE public.profiles
SET payment_status = 'paid'
WHERE subscription_status = 'active'
  AND account_type IN ('dealer','organizer');

UPDATE public.profiles
SET payment_status = 'trial'
WHERE subscription_status = 'active'
  AND account_type IN ('dealer','organizer')
  AND subscription_expiry < (NOW() + INTERVAL '7 days')
  AND payment_status = 'none';
```

> ✔ After execution verify:  
> `SELECT payment_status, COUNT(*) FROM public.profiles GROUP BY 1;`

---

## 4 · Code Changes Summary 📝
| File | Key Updates |
|------|-------------|
| `db_migrations/add_payment_status_field.sql` | Adds `payment_status` column & indices |
| `src/types/index.ts` | Adds `paymentStatus` to `User` type |
| `src/services/subscriptionService.ts` | • `isInTrialPeriod()` helper<br>• `getSubscriptionDetails()` returns `isTrialPeriod`, `isPaid`<br>• Payment/cancel flows update `payment_status` |
| `src/services/stripePaymentService.ts` | Sets `payment_status = 'paid'` after successful charge |
| `src/screens/Profile/SubscriptionScreen.tsx` | UI now displays Trial vs Subscription labels & badge based on new flags |
| Tests | `test-payment-status-fix.js` validates logic for trial/paid/legacy users |

_No breaking API changes – only new optional column._

---

## 5 · Testing Steps ✅
1. **DB migration**  
   • Apply SQL, confirm column exists & default is `none`.

2. **Unit tests**  
   • Run `npm run test-payment-status-fix` – all tests should PASS.

3. **Manual QA**  
   | Scenario | Expected UI |
   |----------|-------------|
   | New user starts 7-day trial | “Trial Ends In: 7 days” badge |
   | User prepays Annual plan | “Subscription Ends In: 365 days” no badge |
   | Legacy user with <7 days remaining (no payment_status) | Treated as trial, badge shows |
   | User cancels during trial | Account downgrades to collector immediately |
   | User cancels paid sub | Status “Expired”, retains access until expiry |

4. **Edge-case checks**  
   • Force subscription expiry via DB – verify status flips to “Expired” and `payment_status` resets to `none`.

---

## 6 · Expected User Experience After Deployment 🎉
• **Paid subscribers** see clear “Subscription Ends In” message with correct remaining days – no confusing trial badge.  
• **Trial users** still enjoy 7-day grace period with obvious countdown badge.  
• Attempted abuse (cancel before charge) is mitigated – badge disappears once payment processed.  
• Support burden reduced; churn-reducing clarity added to dashboard.

---

### Deployment Checklist ✔
1. [ ] **Backup DB**  
2. [ ] Execute migration SQL in production  
3. [ ] Deploy backend & mobile/web apps containing logic/UI changes  
4. [ ] Smoke-test scenarios above with test accounts  
5. [ ] Announce update in release notes  

_Once all steps are complete, confusion between trial and paid periods is eliminated._  
