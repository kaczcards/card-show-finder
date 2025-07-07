# How to Open the PR for Data-Loading & Dynamic-Content Fixes  
_Branch: **`fix-data-loading-issues`** → Target: **`main`**_

---

## 1 · Sanity-Check the Branch Locally

```bash
git checkout fix-data-loading-issues
git status -s        # expect only the data-loading related files changed
git diff main..fix-data-loading-issues
```

Run the app:

```bash
npm install
npm start            # test Expo / React-Native
```

Key paths changed:

* `src/screens/Home/HomeScreen.tsx`
* `src/screens/Map/MapScreen.tsx`
* `src/screens/ShowDetail/ShowDetailScreen.tsx`

Make sure these screens compile and load without red-box errors.

---

## 2 · Push the Branch (if you haven’t)

```bash
git push -u origin fix-data-loading-issues
```

After pushing, GitHub prints a link like:

```
https://github.com/<org>/card-show-finder/pull/new/fix-data-loading-issues
```

---

## 3 · Open a Pull Request on GitHub

1. Go to your repo → **Pull requests** → **New**.  
2. Set **base:** `main` ← **compare:** `fix-data-loading-issues`.  
3. Copy-paste the template below.

### Suggested PR Title

```
Fix Data Loading & Dynamic Content (Homepage • Filters • Map • Show Detail)
```

### Suggested PR Description

```
## :rocket: What’s Fixed
* Homepage now auto-loads upcoming shows within 30 days / 25 miles of the user’s home ZIP.
* Implemented pull-to-refresh, foreground refresh, and error states.
* Fully-functional filter sheet:
  - Radius, date range, max fee, features, categories
  - Active-filter pills + reset
* Filters now propagate to Map view; test markers removed – live show data rendered.
* Map screen:
  - User-location centering, offline & permission fallbacks
  - Empty & error overlays, loading overlay
* ShowDetail screen:
  - Proper placeholder image logic
  - Correct start/end time rendering (`start_time` / `end_time` / legacy `time`)
* Added extensive UX polish: loaders, counts, alerts, AppState refresh.

## 🧩 Files Touched
- `HomeScreen.tsx` – data pipeline, UI, filters, AppState reload
- `MapScreen.tsx`  – live data, filter integration, location logic
- `ShowDetailScreen.tsx` – image & hours fixes

## ✅ QA Steps
1. Launch the app; home list populates with real shows (check count).
2. Pull-to-refresh reloads list.
3. Tap **Filters** → set radius 50 mi → **Apply** → list/map update & pill shows “50 miles”.
4. Switch to Map tab: markers correspond to same result set.
5. Disable network → refresh → observe graceful error banner.
6. Open any show → image placeholder appears if no image; hours string displays cleanly.
7. Return to foreground → list auto-refetches.

## 🤝 Review Checklist
- [ ] Code compiles on iOS & Android
- [ ] No ESLint errors
- [ ] Expo Go smoke-test passes
- [ ] Manual QA steps above confirmed

Closes #<issue-id>
```

Add reviewers (`@kaczcards/frontend`, `@kaczcards/backend`) and labels (`bug`, `data-loading`, `ready-for-review`).

---

## 4 · CI / Expo Build

Wait for GitHub Actions or EAS build (if configured).  
Fix any red checks, then re-push.

---

## 5 · Merge & Clean-up

After approvals & green checks:

```bash
# On GitHub UI
Merge → Squash & merge

# Local
git checkout main
git pull
git branch -d fix-data-loading-issues
```

---

## 6 · Post-Merge

* Trigger new TestFlight / internal Play Store build.
* Verify data loads in production build.
* Update release notes (“Data loading & map/filter UX overhaul”).

---

## 7 · Handling Merge Conflicts

Should GitHub report **“This branch has conflicts that must be resolved”** during
PR creation:

1. **Fetch & Merge `main` locally**
   ```bash
   git checkout fix-data-loading-issues
   git pull                       # make sure branch is current
   git fetch origin main
   git merge origin/main          # start the merge
   ```

2. **Identify conflicted files**
   ```bash
   git status --short
   # Files marked `UU` (both-modified) need attention
   ```

3. **Resolve each file**
   * **Keep `main`** for parts unrelated to data-loading (e.g. theme tokens).
   * **Keep `fix-data-loading-issues`** for:
     - `src/screens/Home/HomeScreen.tsx`
     - `src/screens/Map/MapScreen.tsx`
     - `src/screens/ShowDetail/ShowDetailScreen.tsx`
   * Remove all `<<<<<<<`, `=======`, `>>>>>>>` markers.

4. **Mark files as resolved & finish merge**
   ```bash
   git add <resolved-file(s)>
   git commit -m "Resolve merge conflicts with main"
   ```

5. **Re-run the app** to confirm it still builds.

6. **Push the updated branch**
   ```bash
   git push
   ```
   The PR will automatically update and conflicts should disappear.

### :tada:  Your Data-Loading fixes are now ready for release!
