# Pull Request Instructions – Production Messaging System

These steps walk you through **manually** opening a pull-request in the GitHub web interface for the branch `feature/production-messaging-system` that was just pushed.

---

## 1. Prerequisites

1. You have push access to the repository `kaczcards/card-show-finder`.
2. The branch `feature/production-messaging-system` is already on GitHub.
3. You are logged in to GitHub in your browser.

---

## 2. Create the Pull Request

1. Navigate to the repository homepage:  
   `https://github.com/kaczcards/card-show-finder`

2. GitHub should show a yellow banner with  
   **“Compare & pull request”** for `feature/production-messaging-system`.  
   • If you see it – click the **Compare & pull request** button and jump to Step 3.  
   • If you **don’t** see the banner:  
     1. Click **Pull requests** in the repo menu.  
     2. Click the green **New pull request** button.  
     3. In the PR compare selector, set:  
        * **base:** `main`  
        * **compare:** `feature/production-messaging-system`  

3. Verify the diff looks correct (2 000+ additions, new Edge Functions, SQL migration, etc.).

---

## 3. Fill Out the PR Form

Use the template below ‑ copy & paste, then tweak as needed.

### Title
```
feat: production messaging system with role-based permissions
```

### Description
```
## ✨ What’s New
* Full role-based messaging system (DM, broadcast, moderation)
* SQL migration: broadcast_quotas, reported_messages, new RLS
* Supabase Edge Functions: send-broadcast, reset-broadcast-quotas
* Updated RN services + UI (ChatWindow)
* Deployment & rollback docs

## ✅ Acceptance Criteria
- [ ] Migration applies cleanly on staging
- [ ] Edge functions deploy & return 200
- [ ] QA test plan passes (see production-messaging-implementation-plan.md)
- [ ] Feature flag `messaging_v2_enabled` toggled OFF by default

## 📸 Screenshots / Loom
_Add any UI demos here_

## ⛔️ Breaking Changes
None for existing users while flag OFF
```

### Linked Issues
Add “Closes #42” (or the correct issue numbers).

### Labels
Apply:
* `feature`
* `backend`
* `frontend`
* `needs-review`

### Reviewers
Add:
* `@kaczcards/backend-lead`
* `@kaczcards/mobile-lead`
* `@kaczcards/qa`

---

## 4. Create & Await CI

1. Click **Create pull request**.
2. Ensure GitHub Actions / Supabase tests start.
3. If checks fail, push fixes to the same branch – the PR updates automatically.

---

## 5. Post-Merge Checklist (for the merger)

- [ ] Run the SQL migration on **production** during a maintenance window.
- [ ] Deploy both Edge Functions.
- [ ] Schedule the nightly quota reset cron.
- [ ] Release mobile build or OTA update.
- [ ] Gradual flag rollout.

*Happy merging!*  
