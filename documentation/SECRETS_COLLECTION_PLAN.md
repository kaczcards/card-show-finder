# Secrets Collection Plan
Card-Show-Finder • July 2025  

> Goal: gather **ALL** missing secrets so the CI/CD pipeline runs green on the next push.  
> Work through the checkpoints in order – every step unblocks the next.

---

## 0. Preparation

1. **Permissions**  
   • GitHub repo admin rights  
   • Expo account owner access  
   • Stripe “Developer” role  
   • Apple Developer “App Manager” role  
   • Google Play Console “Release manager” role
2. **Who does what**  
   | Role | Person | Responsibility |
   |------|--------|----------------|
   | DevOps lead | _you_ | GitHub / CI secrets |
   | Mobile lead | _you_ | Expo & OTA |
   | Finance / Billing | — | Stripe keys |
   | iOS release manager | — | Apple credentials |
3. **Reference links**  
   • Expo tokens → https://expo.dev/accounts/&lt;user&gt;/settings/access-tokens  
   • Stripe keys → https://dashboard.stripe.com/apikeys  
   • Stripe webhooks → Developers → Webhooks  
   • Apple IDs → https://appstoreconnect.apple.com  
   • Apple team ID → App Store Connect → Membership  
   • Google JSON key → Play Console → API Access

---

## 1. High-Priority Secrets (blockers)

| # | Secret | Where to obtain it | Actions |
|---|--------|--------------------|---------|
| 1 | **EXPO_TOKEN** | Expo Dashboard → Settings → Access Tokens | • Scope: **Owner + Build + Submit**<br>• Copy 40-char token<br>• Add to `.env` and GitHub ➜ `EXPO_TOKEN` |
| 2 | **EXPO_ACCOUNT_NAME** | Expo dashboard URL (`/accounts/<slug>`) | • Exact lowercase slug<br>• Add env & GitHub secret |
| 3 | **STRIPE_SECRET_KEY** | Stripe → Developers → API keys → Secret key | • Starts with `sk_live_…` (prod) or `sk_test_…` (staging)<br>• Add env & GitHub secret |
| 4 | **STRIPE_PUBLISHABLE_KEY** | Stripe → Developers → API keys → Publishable key | • `pk_live_…` or `pk_test_…`<br>• Add env & GitHub |
| 5 | **STRIPE_WEBHOOK_SECRET** | Stripe → Developers → Webhooks → Your endpoint → **Signing secret** | • Click endpoint → “Reveal”<br>• Copy `whsec_…`<br>• Add env & GitHub |
| 6 | **APPLE_ID** | Apple Developer / App Store Connect | • Email of the account used for automatic submit<br>• Add GitHub secret |
| 7 | **APPLE_TEAM_ID** | App Store Connect → Membership | • 10-char identifier (e.g. `ABCDE12345`)<br>• Add GitHub secret |
| 8 | **ASC_APP_ID** | App Store Connect → App Information → Apple ID | • Numeric (e.g. `1234567890`)<br>• Add GitHub secret |

**Completion check**  
```bash
node scripts/audit-secrets.js --github
# High-priority section should show ✓ for .env and GitHub
```

---

## 2. Android Play Store File Secret

| Secret (file) | Where | Steps |
|---------------|-------|-------|
| **ANDROID_SERVICE_ACCOUNT_KEY** | Play Console → API access → Service accounts | 1 “Create key” → JSON<br>2 Save as `android-service-account.json` locally<br>3 GitHub Settings ➜ Secrets ➜ **Add secret (file)** ➜ name = `ANDROID_SERVICE_ACCOUNT_KEY` |

---

## 3. Medium-Priority Secrets (nice-to-have)

| Secret | Purpose | Collection steps |
|--------|---------|------------------|
| `SLACK_WEBHOOK_URL` | Build alerts | Slack → Apps → Incoming Webhooks → Add App |
| `MAIL_SERVER` `MAIL_PORT` `MAIL_USERNAME` `MAIL_PASSWORD` `NOTIFICATION_EMAIL` | Failure e-mails | From SMTP provider (SendGrid, SES, etc.) |
| `MFA_ENCRYPTION_KEY` | Edge Function encryption | `openssl rand -base64 32` |

---

## 4. Low-Priority / Optional

| Secret | Notes |
|--------|-------|
| `GITLEAKS_LICENSE` | Only if you have Gitleaks Pro for advanced secret scanning |

---

## 5. Update `.env` for Local Development

Copy `.env.example` ➜ `.env` and fill values:  

```env
EXPO_TOKEN=<token>
EXPO_ACCOUNT_NAME=<slug>
EXPO_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon>
SUPABASE_SERVICE_KEY=<service_role>
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=<maps>
EXPO_PUBLIC_SENTRY_DSN=<dsn>
STRIPE_SECRET_KEY=<sk_>
STRIPE_PUBLISHABLE_KEY=<pk_>
STRIPE_WEBHOOK_SECRET=<whsec_>
MFA_ENCRYPTION_KEY=<32byte>
```

---

## 6. Final Validation

1. `node scripts/audit-secrets.js --github` → **✓ All required secrets configured!**  
2. Push `docs: add secrets` commit to **develop** – verify CI passes.  
3. Merge to **main** → verify CD workflow triggers build & (staging) OTA.  
4. Tag `v1.0.0` when staging is green to create first production release.

---

### 📅 Rotation Schedule

| Secret | Rotate | Owner |
|--------|--------|-------|
| Expo token | 90 days | Mobile lead |
| Stripe secret key | 180 days | Finance |
| Supabase service key | 180 days | DevOps |
| Apple credentials | 180 days | iOS release manager |

Add calendar reminders and document in the repo wiki.

---

**You’re done!**  
Once this checklist is complete, every commit will lint, test, build and (if on main) ship to the stores with zero manual effort. 🎉
