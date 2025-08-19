# PR: Stripe Webhook Implementation & Billing Hardening

## 1 · Summary of Changes
This PR introduces a **complete server-side billing pipeline** that keeps Supabase in perfect sync with Stripe.  
Key capabilities shipped:

| Capability | Outcome |
| ----------- | ------- |
| **Edge Function `stripe-webhook`** | Receives & verifies Stripe events, updates profiles, subscriptions & payments tables, logs every event |
| **Edge Function `create-payment-intent` (v2)** | Generates PaymentIntents with rich metadata (`userId`, `planId`) and ensures customer creation |
| **DB Schema** | Adds `customers`, `subscriptions`, `webhook_logs` tables + helper functions + RLS |
| **Migrations** | `20250719000000_create_stripe_webhook_tables.sql` – one-shot SQL migration |
| **Docs** | `docs/STRIPE_WEBHOOK_SETUP.md` – step-by-step deployment & troubleshooting guide |
| **Env** | `.env.example` updated with Stripe secrets & explanations |

Together these pieces enable:

* Real-time role upgrades/downgrades for MVP Dealers & Show Organizers  
* Accurate payment history & audit trail  
* Idempotent, secure, monitorable webhook processing

---

## 2 · Components Added / Modified
### Added
1. **`supabase/functions/stripe-webhook/index.ts`** – verifies signatures, handles 8 core event types, writes to DB, logs success/error.
2. **`supabase/functions/create-payment-intent/index.ts` (new version)** – now attaches metadata & creates customers.
3. **`supabase/migrations/20250719000000_create_stripe_webhook_tables.sql`** – schema, indexes, RLS, helper functions.
4. **`docs/STRIPE_WEBHOOK_SETUP.md`** – end-to-end operational guide.
5. **`supabase/functions/_shared/cors.ts`** – shared CORS headers util.

### Updated
1. **`.env.example`** – Stripe secret, publishable key, webhook secret placeholders.
2. **`package.json`** – no runtime change but Stripe dependencies already present.

---

## 3 · Testing Performed
| Test | Tool / Method | Result |
| ---- | ------------- | ------ |
| **Signature Validation** | Stripe CLI → `trigger payment_intent.succeeded` | 200 OK, `webhook_logs.status=success` |
| **Payment Success Flow** | Mobile app (test mode) → purchase `mvp-dealer-monthly` | `profiles.role` → *mvp_dealer*, `payments.status=succeeded` |
| **Subscription Lifecycle** | Stripe CLI triggers `customer.subscription.*` | RLS-safe updates in `subscriptions`, expiry correct |
| **Payment Failure** | `stripe trigger payment_intent.payment_failed` | `payments.status=failed`, profile untouched |
| **Invoice Events** | `stripe trigger invoice.paid` / `invoice.payment_failed` | `subscriptions.status` toggles active ↔ past_due |
| **Idempotency** | Replay same event ID | Second insert ignored (`event_id` PK) |
| **RLS** | pgTAP suite | No unauthorized reads/writes detected |

_All tests run in **Test Mode** + staging Supabase project._

---

## 4 · Deployment Instructions
1. **Run Migration**
   ```bash
   supabase db push
   ```
2. **Set Secrets** in Supabase Dashboard → Functions → Env  
   ```
   STRIPE_SECRET_KEY=
   STRIPE_PUBLISHABLE_KEY=
   STRIPE_WEBHOOK_SECRET=   # leave blank, fill after Stripe step
   SUPABASE_SERVICE_ROLE_KEY=
   SUPABASE_URL=https://<project-ref>.supabase.co
   ```
3. **Deploy Functions**
   ```bash
   supabase functions deploy create-payment-intent
   supabase functions deploy stripe-webhook
   ```
4. **Configure Webhook** in Stripe Dashboard  
   • Endpoint URL: `https://<project-ref>.functions.supabase.co/stripe-webhook`  
   • Select listed events → Save → Copy **Signing secret** → paste into `STRIPE_WEBHOOK_SECRET` → **Save & Restart** functions.
5. **Smoke Test**
   ```bash
   stripe trigger payment_intent.succeeded
   # Expect 200 OK in CLI & row in webhook_logs
   ```
6. **Update Mobile Env** – add `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`.

Detailed walkthrough in `docs/STRIPE_WEBHOOK_SETUP.md`.

---

## 5 · Security Considerations
* **HMAC Verification** – every event verified with `stripe.webhooks.constructEvent`.
* **Least-Privilege Keys** – Stripe secret & signing secret live only in Function env, never in client bundle.
* **Row-Level Security** – service-role policy lets function write; users can only read their own subs.
* **Idempotency & Replay Protection** – `event_id` primary key in `webhook_logs`.
* **Audit Trail** – full event payload stored (JSONB) + error messages.
* **Secrets Rotation** – doc section & scheduled reminder.
* **CORS** – central header util, OPTIONS pre-flight handled.

---

## 6 · Backward Compatibility
* Existing payment sheet flow **continues to work**; only server side enhanced.  
* No breaking changes to mobile APIs – added tables are additive.  
* RLS rules maintain previous access patterns.

---

## 7 · Open Follow-Ups
* Add GitHub Action to alert on `webhook_logs.status = error`.
* Consider rate limiting `stripe-webhook` endpoint if abuse observed.
* Implement customer portal link for self-serve subscription management.

---

### Ready for review 🚀
Please pay extra attention to:
1. **Secrets correctly set in each environment**  
2. **One-shot migration execution** on production  
3. **Dashboard webhook points to production URL (Live mode)**

Once merged & deployed, billing will be fully automated and fraud-resistant.  
Thank you for reviewing!
