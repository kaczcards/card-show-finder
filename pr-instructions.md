# Pull-Request Creation Guide for the Favorites Fix

Follow these steps to publish the **favorites-auth-check** fix and open a pull request.

---

## 1 – Verify local branch & commit

```bash
# make sure you’re on the correct branch
git status
# (should show 'On branch fix-favorites-auth-check' and no pending changes)
```

If you still have unstaged work, add and commit it:

```bash
git add .
git commit -m "Fix: correct AuthContext usage in ShowDetailScreen (favorites)"
```

---

## 2 – Push the branch to GitHub

```bash
# push the new branch and set upstream
git push -u origin fix-favorites-auth-check
```

---

## 3 – Create the Pull Request

### Option A – GitHub Web UI

1. After pushing, GitHub will show a **“Compare & pull request”** banner.  
2. Click **“Compare & pull request.”**

### Option B – GitHub CLI (gh)

```bash
gh pr create \
  --title "Fix authentication check in show favorites functionality" \
  --body-file .github/pull_request_template.md \
  --base main \
  --head fix-favorites-auth-check
```

*(omit `--body-file` and supply `--body` directly if you don’t use a template)*

---

## 4 – Compose a descriptive PR message

### Suggested Title

```
Fix authentication check in show favorites functionality
```

### Suggested Description

```
## Problem
Users of all roles (Attendee, Dealer, MVP Dealer, Organizer) received a
“Sign In Required” alert when attempting to favorite a show, even while logged in.

## Root Cause
`ShowDetailScreen` was destructuring `user` directly from `useAuth()`:
```ts
const { user } = useAuth(); // user was undefined
```
The AuthContext actually exposes the user inside `authState`.

## Fix
* Switch to `const { authState } = useAuth(); const { user } = authState;`
* Update role checks to use `user.role`
* Adjust `useEffect` dependency array accordingly

## Impact
Logged-in users can now add and remove shows from their favorites without
seeing erroneous authentication alerts.

Closes #<issue-number-if-any>
```

---

## 5 – Request review & merge

* Assign reviewers or team as usual.
* Ensure CI passes.
* Squash-and-merge into **main** after approval.

---

**Done!** Your fix branch is now live for review.
