# Push & PR Guide (`push-instructions.md`)

A step-by-step checklist for getting your local branch **onto GitHub** and opening a **pull request** (PR) – including how to authenticate and what to do if `git push` fails.

---

## 1&nbsp;– Prerequisites

| Tool | Version (recommended) | Purpose |
|------|-----------------------|---------|
| `git` | ≥ 2.30 | version control |
| `gh` (GitHub CLI) | ≥ 2.0 | optional – streamlines auth & PR creation |
| Browser | Any modern | completes OAuth device-code flow |

Make sure you are **inside your repo folder** (e.g. `cd card-show-finder`).

---

## 2&nbsp;– Configure Git Identity (once per machine)

```bash
git config --global user.name  "Your Name"
git config --global user.email "you@example.com"
```

---

## 3&nbsp;– Authenticate with GitHub

### Option A – GitHub CLI (recommended)

```bash
# launches a one-time browser login
gh auth login --web
# verify
gh auth status
```

If the CLI shows you a device code (e.g. `C021-4876`) copy it, open the
displayed URL, paste the code, and authorise.

### Option B – Personal Access Token (PAT)

1.  Visit **GitHub → Settings → Developer Settings → Personal access tokens**  
    Create a classic PAT with the `repo` scope.
2.  Store the token securely (password manager / macOS Keychain).
3.  The first time Git prompts for a password when pushing, paste the token instead.

> **Tip:** Enable Git credential helper so you only log in once:  
> `git config --global credential.helper cache` (or `store`, or OS-specific helper).

---

## 4&nbsp;– Create & Check Your Branch

```bash
# create a feature/fix branch if you haven’t already
git checkout -b fix-favorites-auth-check
# stage and commit your changes
git add .
git commit -m "Fix authentication check in show favorites functionality"
```

Verify:

```bash
git status       # should show “nothing to commit, working tree clean”
git log -1       # confirm your commit message
```

---

## 5&nbsp;– Push the Branch

```bash
# first push (sets upstream)
git push -u origin fix-favorites-auth-check
```

### If `git push` Fails

| Error message | Likely Cause | Fix |
|---------------|--------------|-----|
| `fatal: Authentication failed` | Not logged in / bad PAT | Re-run **Step 3** (auth). |
| `error: failed to push some refs` | Remote has new commits | Run:<br>`git pull --rebase origin main`<br>Resolve conflicts, then:<br>`git push --force-with-lease` |
| `permission denied (publickey)` | SSH key not added | Add your SSH key to GitHub or use HTTPS+PAT. |

**Checklist**

```bash
# 1. verify origin URL (https or ssh)
git remote -v

# 2. ensure you’re authenticated
gh auth status            # or test: gh repo view

# 3. pull & rebase if remote changed
git pull --rebase origin main

# 4. retry push
git push -u origin fix-favorites-auth-check
```

---

## 6&nbsp;– Open the Pull Request

### Option A – GitHub Web UI

1. Navigate to **https://github.com/kaczcards/card-show-finder**.  
2. GitHub shows a yellow banner: **“Compare & pull request.”** Click it.  
3. Fill in PR title & description (see template below).  
4. Choose **base:** `main` – **compare:** `fix-favorites-auth-check`.  
5. Click **“Create pull request.”**

### Option B – GitHub CLI

```bash
gh pr create \
  --base main \
  --head fix-favorites-auth-check \
  --title "Fix authentication check in show favorites functionality" \
  --body "See details in the PR description."
```

---

## 7&nbsp;– Suggested PR Message

```
## Problem
Users saw “Sign In Required” when favoriting shows despite being logged in.

## Root Cause
ShowDetailScreen accessed AuthContext incorrectly; user was undefined.

## Solution
Use `authState.user` and update role check logic.

## Testing
Verified favorite/unfavorite with Attendee, Dealer, MVP Dealer, Organizer.

Closes #<issue-number>
```

---

## 8&nbsp;– After PR Creation

1. Add reviewers / team as needed.  
2. Wait for CI checks to pass.  
3. **Squash & merge** after approval.  
4. Delete the feature branch on GitHub (optional).

---

### Quick Reference

```bash
# One-liner to push **and** open PR (CLI)
git push -u origin fix-favorites-auth-check && \
gh pr create --fill
```

Happy pushing! 🚀
