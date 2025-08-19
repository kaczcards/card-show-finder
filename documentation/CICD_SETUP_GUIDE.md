# CI/CD Setup Guide  
Card-Show-Finder · July 2025  

Welcome! This document walks you through **everything** needed to bring the new GitHub Actions-based pipeline online— from creating secrets to running your first production deployment.

---

## 1 · Pipeline Overview

| Workflow file | Purpose | Triggers |
|---------------|---------|----------|
| `.github/workflows/ci.yml` | Continuous Integration – lint, type-check, unit & DB tests, Detox E2E, build verification, notifications | `push` / `pull_request` to `main` or `develop` |
| `.github/workflows/cd.yml` | Continuous Deployment – environment detection, DB validation, EAS build & submit, OTA update, release creation, notifications | `push` to `main`/`develop`, every Git tag `v*.*.*`, manual dispatch |
| `.github/workflows/security.yml` | Security Scanning – dependency, secret, static-code, DB & mobile security scans, weekly report | Weekly cron, `push`, `pull_request`, manual dispatch |

---

## 2 · Required Secrets

Add these **repository** (or **environment**) secrets under  
`Settings → Secrets and variables → Actions`.

| Secret | Description |
|--------|-------------|
| `EXPO_TOKEN` | Expo access token with Build + Submit scopes |
| `EXPO_ACCOUNT_NAME` | Expo **owner slug** (e.g. `kaczcards`) |
| `APPLE_ID` | Apple developer e-mail |
| `APPLE_TEAM_ID` | 10-char Apple Team ID |
| `ASC_APP_ID` | Numeric App Store Connect App ID |
| `ANDROID_SERVICE_ACCOUNT_KEY` (file) | Google Play JSON key (upload as “secret file”) |
| `SLACK_WEBHOOK_URL` | Incoming webhook for build alerts |
| `MAIL_SERVER`,`MAIL_PORT`,`MAIL_USERNAME`,`MAIL_PASSWORD`,`NOTIFICATION_EMAIL` | SMTP creds for email alerts |
| `GITLEAKS_LICENSE` (optional) | License for Gitleaks Pro |
| Public env secrets: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`, `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`, `EXPO_PUBLIC_SENTRY_DSN` |

_Best practices: rotate tokens every 90 days, never echo secrets in logs._

---

## 3 · Setting Up Secrets

1. **Repository → Settings → Secrets and variables → Actions**  
2. Click **“New secret”** (or **“Add secret (file)”** for JSON key).  
3. Name must exactly match the table above.  
4. Paste / upload value → **Add secret**.  
5. For environment-specific values select the Environment tab (`development`, `staging`, `production`) and repeat.

---

## 4 · First-Run Checklist

1. **Branch protection** – require status checks (`ci`) before merge to `main`.  
2. **Expo EAS** – ensure the Expo project is owned by `EXPO_ACCOUNT_NAME` and you’ve run `eas build:configure`.  
3. **Google Play & App Store** – service accounts added, app records exist.  
4. **Native folders** – if you choose the Prebuild workflow, add `/ios` and `/android` to `.gitignore` (see `PROJECT_HEALTH_CLEANUP.md`).  

---

## 5 · Testing the Workflows

### 5.1 CI

```bash
# Push a feature branch or open a PR
git checkout -b feat/try-ci
touch ci-test.txt && git add . && git commit -m "ci: test"
git push -u origin feat/try-ci
```

☑️ Actions tab → **CI Pipeline** should start.  
✅ Expect jobs: *Lint and Type Check*, *Unit Tests*, *Database Tests*, *E2E Tests*, *Build Verification*, *Notify*.

### 5.2 CD

```bash
# Merge to develop for a staging deploy
git checkout develop
git merge feat/try-ci && git push
```

• Workflow `cd.yml` detects branch = `development` profile.  
• At the end, check Slack/email for ✅/❌.

### 5.3 Production Release

```bash
# Tag a semantic version
git checkout main
git pull
git tag v1.2.0
git push --tags
```

Triggers `cd.yml` with `production` profile **and** creates a GitHub Release.

### 5.4 Security Scan (full)

Manual kick:

```
Actions → Security Scanning → Run workflow → Input: full-scan=true
```

---

## 6 · Common Issues & Fixes

| Symptom | Likely Cause | Resolution |
|---------|--------------|------------|
| `❌ 401 Unauthorized` on `eas build` | `EXPO_TOKEN` missing/wrong scope | Regenerate token, update secret |
| `APPLE_EAS_AUTH_ERROR` | 2FA / App Store key not set | Use App Store API Key or set Fastlane session |
| `Cannot find android-service-account.json` | File secret not uploaded | Create secret **file** with correct name |
| CI fails at Detox build on macOS | Xcode cache stale | Re-run job, or bump cache key in `ci.yml` |
| CD workflow: “profile not found” | `eas.json` profile mis-named | Ensure `development`, `staging`, `production` keys exist |
| Slack step `invalid_webhook` | Webhook URL revoked | Re-enable app in Slack & update secret |
| Security scan marks failure but build passed | High severity CVE in deps | Review `reports/` artifact, patch or ignore CVE |
| GitHub release step denied | Missing `GITHUB_TOKEN` perms | Ensure default token has `contents:write` (default) |

---

## 7 · Maintenance Tips

1. **Update Node & Expo CLI versions** in workflows quarterly.  
2. **Rotate secrets** – schedule calendar reminders.  
3. **Monitor GH Security tab** – Dependabot & CodeQL alerts.  
4. **Review EAS build costs** – ensure caches hit (`cacheDefaultPaths: true`).  
5. **Archive old artifacts** – GitHub retains for 90 days by default.  

---

## 8 · Need Help?

* Expo CI/CD – https://docs.expo.dev/eas/
* GitHub Actions – https://docs.github.com/actions
* Slack Webhooks – https://api.slack.com/messaging/webhooks
* Supabase – https://supabase.com/docs  
Feel free to open an issue or ping `@kaczcards` in Slack!
