# Secrets Setup Guide  
Card-Show-Finder – July 2025  

> Follow this checklist once and your CI/CD pipeline will spring to life on every
> commit, build and deploy your apps, and alert you when something breaks.

---

## 1  Overview

The repository already contains full **CI (`ci.yml`)**, **CD (`cd.yml`)** and
**Security (`security.yml`)** workflows.  
All three expect secrets that are **not yet present** in GitHub ➜ *Settings* ➜
*Secrets and variables* ➜ **Actions**.

The table below lists every secret, its purpose, and whether it is **Required
🟢** (pipeline will fail without it) or **Optional 🟡** (enables extra
features).  Secrets are grouped by service in recommended creation order.

| # | Secret Name | Service / Step | Priority |
|---|-------------|----------------|----------|
| 1 | `EXPO_TOKEN` | EAS builds & OTA | 🟢 |
| 2 | `EXPO_ACCOUNT_NAME` | Slack & OTA URLs | 🟢 |
| 3 | `EXPO_PUBLIC_SUPABASE_URL` | Mobile env | 🟢 |
| 4 | `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Mobile env | 🟢 |
| 5 | `SUPABASE_SERVICE_KEY` | DB migrations | 🟢 |
| 6 | `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | Maps SDK | 🟢 |
| 7 | `EXPO_PUBLIC_SENTRY_DSN` | Crash reporting | 🟢 |
| 8 | `STRIPE_SECRET_KEY` | Stripe Edge Fn | 🟢 |
| 9 | `STRIPE_PUBLISHABLE_KEY` | Mobile payments | 🟢 |
| 10 | `STRIPE_WEBHOOK_SECRET` | Stripe webhook | 🟢 |
| 11 | `APPLE_ID` | iOS submit | 🟢 |
| 12 | `APPLE_TEAM_ID` | iOS submit | 🟢 |
| 13 | `ASC_APP_ID` | iOS submit | 🟢 |
| 14 | **File secret** `ANDROID_SERVICE_ACCOUNT_KEY` | Play Store submit | 🟢 |
| 15 | `SLACK_WEBHOOK_URL` | Build alerts | 🟡 |
| 16 | `MAIL_SERVER` `MAIL_PORT` `MAIL_USERNAME` `MAIL_PASSWORD` `NOTIFICATION_EMAIL` | Failure e-mails | 🟡 |
| 17 | `MFA_ENCRYPTION_KEY` | MFA Edge Fn | 🟡 |
| 18 | `GITLEAKS_LICENSE` | Pro secret scan | 🟡 |

---

## 2  Prerequisites

1. **Admin access** to the GitHub repository.  
2. All keys / JSON files downloaded locally.  
3. Expo project already configured with `eas build:configure`.

---

## 3  Step-by-Step Configuration

### 3.1  Open the Secrets Panel

1. GitHub repo ➜ **Settings**  
2. Left sidebar ➜ **Secrets and variables ➜ Actions**  

*Screenshot 1:* `docs/images/secrets-panel.png`

---

### 3.2  Add Text-Based Secrets

For each secret in the table:

1. Click **New repository secret**.  
2. **Name** = exact identifier (e.g., `EXPO_TOKEN`).  
3. **Value** = paste the token / key.  
4. **Add secret**.  

> Tip — keep the *“Add another”* checkbox ticked to stay on the page.

*Screenshot 2:* `docs/images/add-secret-modal.png`

---

### 3.3  Upload the Android Service-Account JSON (file secret)

1. On same page select **“Add secret (file)”**.  
2. Name it **`ANDROID_SERVICE_ACCOUNT_KEY`**.  
3. Browse ➜ choose `android-service-account.json`.  
4. **Add secret**.

*Screenshot 3:* `docs/images/upload-file-secret.png`

---

### 3.4  Environment vs Repository Secrets (optional)

If you want stricter control:

1. Create **Environments** named `development`, `staging`, `production`.  
2. Add environment-specific keys (e.g., production Stripe keys).  
3. Workflows already read environment secrets automatically.

---

### 3.5  Verify Secrets Locally (optional)

```bash
# Verify Expo token
EXPO_TOKEN=your-token npx eas whoami
# Verify Android key
jq '.client_email' android-service-account.json
```

No error ➜ key is valid.

---

## 4  Kick the Pipeline

1. **Create a tiny commit** (`docs: trigger ci`) and push to **develop**.  
2. **Actions ➜ CI Pipeline** should start.  
3. Check that **Lint**, **Unit-tests**, **DB tests**, **E2E tests** and
   **Build verification** all receive the secrets (logs will show
   `***` masked strings).  

If everything is green ✅ you are done!  

---

## 5  Troubleshooting Table

| Stage | Error Snippet | Likely Cause | Quick Fix |
|-------|---------------|--------------|-----------|
| `eas build` → 401 | “Missing Access Token” | `EXPO_TOKEN` wrong scope / typo | Regenerate token (Owner ▸ Build ▸ Submit) |
| `eas submit` (iOS) | ITMS-90164 | Invalid `APPLE_TEAM_ID` / 2FA | Double-check team, switch to App-Store API key |
| `eas submit` (Android) | “service-account.json not found” | File secret not uploaded | Re-add as **file** secret with correct name |
| Slack step | `invalid_webhook` | URL revoked or pasted wrong | Re-enable Incoming Webhooks, copy fresh URL |
| Email step | `535 Auth failed` | SMTP creds bad or port blocked | Use API key auth, open port 465 or 587 |
| Security scan fails | `high severity CVE` | Legit vulnerability | Update dependency or ignore via CodeQL config |
| Secrets printed | plain text in logs | `echo $SECRET` in a script | Remove direct echo, pipe through `jq -r '."foo"'` |

---

## 6  Maintenance & Rotation

| Secret | Rotate Every |
|--------|--------------|
| `EXPO_TOKEN` | 90 days |
| Apple App-Store key | 180 days |
| Stripe keys | Regenerate only if compromised |
| Supabase Service key | 180 days |
| SMTP / Slack | 90 days |

Add calendar reminders or use GitHub Secret Scanner alerts.

---

## 7  Next Steps

1. Protect **`main`** branch ➜ require **CI** status checks.  
2. Merge **develop ➜ main** once staging deploy is green.  
3. Tag `v1.0.0` to trigger first production build & release.

Happy shipping 🚀  
