# Stripe Webhook Setup & Configuration Guide

Card Show Finder – Production Playbook  
_Last updated: 2025-07-18_

---

## 0. Overview

Stripe webhooks keep our backend in sync with Stripe’s billing engine.  
The **`stripe-webhook`** Supabase Edge Function receives events such as `payment_intent.succeeded` or `customer.subscription.updated` and updates:

* `profiles` – user roles, subscription status, payment status  
* `payments` – transaction history  
* `subscriptions` – active subscription records  
* `webhook_logs` – audit log of every event processed  

Follow this guide **end-to-end** to deploy, connect and test the webhook pipeline.

---

## 1. Prerequisites

| Tool / Account | Version / Notes |
|----------------|-----------------|
| Supabase CLI   | ≥ **1.162.0** (`supabase --version`) |
| Stripe Account | Production **and** Test mode enabled |
| Node.js        | 18 LTS or 20 LTS (local testing helpers) |
| git access     | Push rights to `supabase/functions` branch |
| Secrets        | `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` |

> **Naming convention** – we keep all Stripe-related secrets _un-prefixed_  
> because they are consumed **only** by Edge Functions (never shipped to mobile).

---

## 2. Deploying the Edge Function

### 2.1 Prepare environment variables

Add the following to **`supabase/.env`** (or dashboard → Project Settings → Functions → Environment Variables).

```
STRIPE_SECRET_KEY=sk_live_…
STRIPE_PUBLISHABLE_KEY=pk_live_…
STRIPE_WEBHOOK_SECRET=whsec_…   # leave blank for now – filled after step 3
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role>
```

> _Never commit real secrets – use `.env` and Supabase dashboard._

### 2.2 Ensure database tables & RLS

Run the migration included in  
`supabase/migrations/20250719000000_create_stripe_webhook_tables.sql`

```bash
supabase db push
```

Verify tables exist:

```sql
select table_name
from information_schema.tables
where table_name in ('webhook_logs','customers','subscriptions');
```

### 2.3 Deploy the function

```bash
# From repository root
supabase functions deploy stripe-webhook --project-ref <project-ref>
```

Confirm green status:

```bash
supabase functions list
# └── stripe-webhook        deployed   v1
```

Copy the **invoke URL** – looks like  
`https://<project-ref>.functions.supabase.co/stripe-webhook`

Keep this handy for Stripe dashboard.

---

## 3. Configuring Webhooks in Stripe Dashboard

1. **Dashboard → Developers → Webhooks → “Add endpoint”**  
2. **Endpoint URL** – paste the invoke URL obtained above  
3. **Version** – leave default (latest)  
4. **Events to send**  
   - `payment_intent.succeeded`  
   - `payment_intent.payment_failed`  
   - `checkout.session.completed`  
   - `customer.subscription.created`  
   - `customer.subscription.updated`  
   - `customer.subscription.deleted`  
   - `invoice.paid`  
   - `invoice.payment_failed`

   (Add more as business logic evolves.)  
5. Click **Add endpoint** – Stripe shows a **Signing secret** (`whsec_…`).  
6. Paste that secret into **STRIPE_WEBHOOK_SECRET** in Supabase environment → _Save & Restart_ functions.

> Ensure **Test Mode** and **Live Mode** each have their own endpoint & secret.

---

## 4. Testing the Webhook

### 4.1 Using Stripe CLI (preferred)

```bash
stripe login            # browser auth once
stripe listen --events \
  payment_intent.succeeded,payment_intent.payment_failed,\
  checkout.session.completed,customer.subscription.created,\
  customer.subscription.updated,customer.subscription.deleted,\
  invoice.paid,invoice.payment_failed \
  --forward-to https://<project-ref>.functions.supabase.co/stripe-webhook
```

Trigger a test:

```bash
stripe trigger payment_intent.succeeded
```

Expected:

* CLI prints `✔  POST /stripe-webhook [200]`
* Row appears in `webhook_logs` with status **success**

### 4.2 Using Dashboard “Send test webhook”

Dashboard → your endpoint → **Send test webhook** → choose event type.

### 4.3 Verifying database effects

```sql
select * from webhook_logs order by created_at desc limit 1;
select * from payments order by created_at desc limit 1;
```

Rows should reflect the test event.

---

## 5. Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| `401 Unauthorized` in function logs | Missing/invalid `SUPABASE_SERVICE_ROLE_KEY` | Re-set secret in env → Deploy |
| `400 Invalid signature` | Wrong `STRIPE_WEBHOOK_SECRET` | Copy correct secret for the **mode** (test vs live) |
| Function returns `500` | Code error processing event | Check `webhook_logs.error_message`, review function logs, open issue |
| Payments table not updated | Event type not handled | Ensure event is in Stripe dashboard **and** switch statement |
| Duplicate rows | Stripe retrying (no 2xx) | Make function **idempotent** (we insert by `event_id`) – already implemented |

View logs:

```bash
supabase functions logs stripe-webhook --project-ref <project-ref>
```

---

## 6. Security Best Practices

1. **Signature verification** – every event is validated with `stripe.webhooks.constructEvent`.
2. **Service-role key isolation** – Edge Function uses service role; RLS policies restrict external access.
3. **Least-privilege secrets** – Secrets stored in Supabase Function env (server-side only).
4. **Idempotency** – `event_id` primary key in `webhook_logs` prevents double processing.
5. **HTTPS only** – Supabase functions enforce TLS; never use `http://` endpoints.
6. **Separate test & live webhooks** – keep data clean and avoid cross-pollution.
7. **Monitor & alert** – add Slack alerts (see GitHub Actions) when `webhook_logs.status = error`.
8. **Rotate keys** – Stripe webhook secret & API keys every 90 days.

---

## 7. Maintenance Checklist

| Frequency | Task |
|-----------|------|
| Weekly | Check `webhook_logs` for errors |
| Monthly | Trigger manual test event via Stripe CLI |
| Quarterly | Rotate Stripe secrets & verify function redeploy |
| Before release | Ensure new Stripe products/prices have `planId` metadata |

---

## 8. Reference Links

* Supabase Edge Functions → https://supabase.com/docs/guides/functions
* Stripe Webhooks → https://stripe.com/docs/webhooks
* Stripe CLI → https://stripe.com/docs/stripe-cli
* Postman Webhook Testing → https://learning.postman.com/docs/designing-and-developing-your-api/receiving-webhooks/

---

_You’re all set – webhooks are now live and keeping your database in perfect sync with Stripe!_  
**Happy collecting & billing 🚀**
