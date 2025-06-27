# Deployment Summary

This document recaps the two production issues discovered in Card Show Finder, explains the fixes now committed on branch **`fix-favorites-auth-check`**, and lists the exact steps to roll them out.

---

## 1 · Issues Encountered

| # | Symptom (User-facing) | Root Cause |
|---|-----------------------|-----------|
| 1 | Tapping **Save**/heart on any show pops **“Sign In Required → Please sign in to save favorites.”** even when logged-in. | `ShowDetailScreen` accessed auth context incorrectly. `user` was `undefined`, so the guard triggered every time. |
| 2 | Opening **My Shows** displays a red error: `relation "public.reviews" does not exist`. | Front-end expects a `public.reviews` table; schema created `public.show_reviews` instead. |

---

## 2 · Fixes Implemented

| Area | File / Script | What Changed |
|------|---------------|--------------|
| Favorites auth | `src/screens/ShowDetail/ShowDetailScreen.tsx` | • Use full `authContext` → `authContext.authState.user`.<br>• Added fallback to Supabase session.<br>• Extra logging + resilient `toggleFavorite` helper.<br>• No UI/feature regressions (MVP dealers, broadcast, etc.). |
| Reviews table | `fix-reviews-table.sql` | • If `show_reviews` exists ⇒ create **view** `public.reviews` mapping to it.<br>• Else create `public.reviews` table with same columns + RLS.<br>• Grants & policies added for `authenticated` + `anon`. |

_All code & SQL live on branch **`fix-favorites-auth-check`**._

---

## 3 · Deployment Overview

### Code

1. **Merge / pull** the branch:

   ```bash
   git checkout main
   git pull origin main   # if already merged  
   # or  
   git fetch origin fix-favorites-auth-check
   git merge origin/fix-favorites-auth-check
   ```

2. **Install & restart**:

   ```bash
   npm install
   npx expo start -c      # clears cache
   ```

3. Smoke-test favourites, My Shows, MVP dealers.

### Database

1. Open Supabase → SQL Editor.  
2. Paste entire `fix-reviews-table.sql` → Run.  
3. Verify:

   ```sql
   select * from public.reviews limit 1;
   ```

   No “relation … does not exist” error.

### OTA or Store Builds

* For Expo Go & EAS Update: publish a new update after merging.  
* For store binaries: increment build and submit (no native changes).

---

## 4 · Post-Deployment Checklist

- [ ] Favourite / unfavourite show while logged-in – works silently.  
- [ ] Try same action while logged-out – alert appears.  
- [ ] Open **My Shows** – no SQL error, past/upcoming lists render.  
- [ ] Create a review – record saved in `public.reviews`.  
- [ ] Monitor Supabase logs for new errors.

---

## 5 · Next Steps

1. **Delete** backup `.tsx.bak` variant once new screen confirmed stable.  
2. Schedule nightly job to run `public.generate_review_requests()` (badge/notification logic).  
3. Consider renaming `show_reviews` → `reviews` in schema to drop compatibility view later.

---

**Deployment owner:** Kevin  
**ETA:** ~15 min (SQL) + OTA push  
Questions? DM @Engineering. 🚀
