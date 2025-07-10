# MVP Dealer Display Fix – Implementation & PR Guide  

These instructions explain how to finish the **MVP Dealer display** fix, authenticate with GitHub CLI, open the pull-request, and verify the change works on both iOS & Android.

---

## 1 · Prerequisites  

| Tool | Version | Notes |
|------|---------|-------|
| Git | latest | `git --version` |
| GitHub CLI (`gh`) | ≥ 2.0 | `gh --version` |
| Node.js | 18 LTS or 20 LTS | app build |
| Expo CLI | bundled (`npx expo`) | dev server |
| iOS Simulator / Android Emulator | latest | testing |

---

## 2 · Pull the Fix Branch Locally  

```bash
# From project root
git fetch origin
git checkout fix/mvp-dealer-display
```

The branch contains **one code change** in  
`src/screens/ShowDetail/ShowDetailScreen.tsx`:

```diff
- .or('role.eq.MVP_DEALER,role.eq.DEALER');
+ .or('role.eq.mvp_dealer,role.eq.dealer');  // roles stored lowercase
```

Nothing else was modified.

---

## 3 · Authenticate with GitHub CLI  

If you have not used `gh` before:

```bash
gh auth login
```

Choose:  

1. **GitHub.com**  
2. **HTTPS**  
3. **Paste an authentication token** – your browser opens, grant the
   requested scopes and copy the token back.  
4. Confirm; you should see “Logged in as \<your-username\>”.

Verify:

```bash
gh auth status   # should show green ✅
```

---

## 4 · Create / Finalise the Pull Request  

The branch is already pushed. Create the PR:

```bash
# In repo root (branch fix/mvp-dealer-display)
gh pr create \
  --base main \
  --title "Fix MVP Dealer display in Show Detail screen" \
  --body-file pr_description.md
```

If you prefer interactive mode simply run `gh pr create` and answer the prompts.

The PR description file **`pr_description.md`** is committed with a
detailed template (problem → root cause → solution → test plan).  
After creation, open the link printed by `gh` and mark reviewers.

---

## 5 · Manual Testing Checklist  

1. **Login as an MVP Dealer**  
   *Role must be `mvp_dealer` in `profiles.role`.*

2. **Register for any upcoming show**  
   - Dealer ➝ *Show Participation* screen ➝ Register.

3. **Open Show Detail** for that show.  
   ✓ Dealer appears as `Name (MVP)` in *Participating Dealers*.  
   ✓ Name is blue & tappable → opens Dealer modal.  
   ✓ “Message” button visible.

4. **Login as a regular Dealer** (`dealer` role), repeat steps 2-3.  
   ✓ Dealer listed **without** “(MVP)” tag or Message button.

5. Smoke-test on both platforms  

```bash
npx expo start -c
# press i  (iOS simulator)
# press a  (Android emulator)
```

---

## 6 · Troubleshooting  

| Symptom | Fix |
|---------|-----|
| `gh: command not found` | Install GH CLI: `brew install gh` / `winget install GitHub.cli` |
| `gh auth login` loops | Delete old token: `gh auth logout` then repeat login |
| Dealer still missing | Check DB: `select id, role from profiles where id = '<userId>';` – must be lowercase `mvp_dealer` |
| Expo build fails | Run `npm install`, clear cache `expo start -c` |

---

## 7 · Merge & Deploy  

Once tests pass and the PR is approved:

```bash
# On main (after merge)
git pull origin main
eas build --profile preview --platform all   # optional CI/CD preview
```

No migrations or environment changes are required.

---

Happy fixing 🚀
