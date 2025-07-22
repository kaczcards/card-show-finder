# GitHub Secrets – Requirements & Configuration Guide  
_for Card Show Finder CI/CD_

> File location: `.github/secrets-requirements.md`  
> Last update: July 2025  

---

## 1  Required Secrets & Descriptions

| Secret Name | Used By | Description / Purpose |
|-------------|---------|-----------------------|
| `EXPO_TOKEN` | All EAS build / update / submit steps | Personal Access Token generated in your Expo account with **Owner**, **Projects**, **Build**, **Submit** scopes. |
| `EXPO_ACCOUNT_NAME` | Slack notifications, OTA URLs | Exact **owner slug** of the Expo account/org (e.g. `kaczcards`). |
| `APPLE_ID` | `eas submit` (iOS) | Apple ID email of the App Store Connect account used for submission. |
| `APPLE_TEAM_ID` | `eas submit` (iOS) | 10-character Apple developer team identifier (e.g. `ABCDE12345`). |
| `ASC_APP_ID` | `eas submit` (iOS) | Numeric Apple Store Connect **App ID** (not bundle id). |
| `ANDROID_SERVICE_ACCOUNT_KEY`<br>(file) | `eas submit` (Android) | JSON service-account key for Google Play. Stored as a secret **file** named `android-service-account.json` in repository root; path referenced by workflow. |
| `SLACK_WEBHOOK_URL` | Slack notification steps | Incoming Webhook URL for your team/channel. |
| `GITHUB_TOKEN` | Auto-provided by GitHub | Used for creating releases & API calls (no action needed). |
| `MAIL_SERVER` | Release email step | SMTP server host (e.g. `smtp.sendgrid.net`). |
| `MAIL_PORT` | Release email step | SMTP port (`465` TLS or `587` STARTTLS). |
| `MAIL_USERNAME` | Release email step | SMTP login user name. |
| `MAIL_PASSWORD` | Release email step | SMTP password or API key. |
| `NOTIFICATION_EMAIL` | Release email step | Comma-separated list of recipients. |
| `GITLEAKS_LICENSE` | Secret-scanning step (optional) | License key for Gitleaks Pro (leave unset if not using Pro). |

_You can store additional environment-specific variables (e.g. API endpoints) as **Environment Secrets** in GitHub if desired._

---

## 2  Obtaining Each Secret

1. **Expo Access Token (`EXPO_TOKEN`)**  
   Expo → Account → **Settings** → Access Tokens → **Create**.  
   • Scope: `All` or _Build_, _Submit_, _Update_.  
   • Copy the 40-character token.

2. **Expo Account Slug (`EXPO_ACCOUNT_NAME`)**  
   The lowercase name visible in your Expo dashboard URL:  
   `https://expo.dev/accounts/<slug>/settings`.

3. **Apple Store Connect Credentials**  
   • `APPLE_ID`: Developer account email.  
   • `APPLE_TEAM_ID`: App Store Connect → Membership.  
   • `ASC_APP_ID`: App Information → **Apple ID** (numeric).

4. **Google Play Service Account Key**  
   Play Console → API access → **Service accounts** → Create key → JSON.  
   Save the file as `android-service-account.json` in the repo root **(never commit!)**.  
   Upload during secret creation as _“Repository secret (file upload)”_.

5. **Slack Webhook**  
   Slack → App Management → **Incoming Webhooks** → Add → choose channel → copy URL.

6. **SMTP / Email Credentials**  
   Provided by email service (SendGrid, SES, Mailgun, etc.).  
   Ensure “Less secure app access” is **disabled** and API-key authentication preferred.

7. **Gitleaks License** (optional)  
   Purchase / retrieve from gitleaks.io dashboard.

---

## 3  Security Considerations & Best Practices

* **Principle of Least Privilege** – Tokens should only have scopes required for automation.  
* **Rotation Policy** – Rotate all CI secrets every **90 days** (Expo tokens weekly in staging).  
* **Restrict Visibility** – Store as **Repository** or **Environment** secrets, never as plain text.  
* **File Secrets** – Use GitHub’s _secret files_ upload for JSON key; workflows download it at runtime.  
* **Audit Logs** – Review *Settings → Security* logs for unauthorized secret access.  
* **Masking** – GitHub automatically masks secrets in logs; avoid `echo $SECRET` in scripts.  
* **Branch Protection** – Require PR reviews & status checks before merging to `main`.

---

## 4  Adding Secrets in GitHub

1. Repository → **Settings** → **Secrets and variables** → **Actions**.  
2. Choose **Repository secrets** (or **Environment secrets** for `development`, `staging`, `production`).  
3. **New secret** → Name exactly as listed, paste value, **Add secret**.  
4. For `ANDROID_SERVICE_ACCOUNT_KEY` select **“Add secret (file)”** and upload JSON.  
5. Repeat for each required secret.

_**Tip:** Environment-level secrets let you enforce branch rules and approval gates._

---

## 5  Testing the Setup

```bash
# Manually trigger the pipeline in GitHub:
Actions → CI/CD Pipeline → Run workflow → choose environment

# Verify:
# • “Setup & Install Dependencies” passes
# • Secrets are masked in logs (********)
# • “Build Development App” completes (on dev branch)
```

Quick smoke-test:

```yaml
- name: Verify Expo token
  run: eas whoami
  env:
    EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}
```

If the step outputs your Expo username the token is valid.

---

## 6  Troubleshooting Common Issues

| Problem | Likely Cause | Fix |
|---------|--------------|-----|
| `❌ 401 Unauthorized` on **eas build** | `EXPO_TOKEN` invalid / missing scope | Regenerate token with proper scopes and update secret. |
| `apple: ITMS-90164` submission error | Wrong `APPLE_TEAM_ID` or 2FA required | Confirm team id; use App Store Connect API key for non-interactive submit. |
| `Cannot find android-service-account.json` | File secret not created or wrong path | Re-upload via “Add secret (file)”, ensure workflow path matches. |
| Slack step fails `invalid_webhook` | Malformed URL or Webhook disabled | Re-enable app in Slack & paste correct URL. |
| Email step: `535 Authentication failed` | SMTP creds wrong / “Less secure” blocked | Use API key auth, whitelist GitHub Actions IPs if required. |
| Secrets printed in logs | Direct `echo $SECRET` command | Remove or pipe through command that strips output. |

---

### Need Help?

* **Expo** – https://docs.expo.dev  
* **EAS CI** – https://docs.expo.dev/eas/  
* **GitHub Actions Secrets** – https://docs.github.com/actions/security-guides/encrypted-secrets  
* **Slack Webhooks** – https://api.slack.com/messaging/webhooks  

---
