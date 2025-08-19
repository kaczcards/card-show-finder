# WANT_LISTS_FIX_DEPLOYMENT.md  
Attendee Want Lists – Deployment Guide
------------------------------------------------

## 1. What Was Fixed
* Service layer (`showWantListService.ts`) now pulls attendee IDs from **`user_favorite_shows`** (heart-action) instead of `planned_attendance`.
* Added filters:
  * Upcoming shows only (`start_date >= now()`).
  * Exclude other MVP Dealers / Organizers from attendee list.
* Result: MVP Dealers and Show Organizers can finally see want lists for attendees/dealers who favourited the same upcoming shows.

---

## 2. How to Test

1. **Seed data (app UI)**
   1. Log in as an *Attendee*.
   2. ★ Heart an upcoming show that your MVP Dealer/Organizer account is linked to.
   3. Go to **Profile › My Collection** and save a non-empty want list.

2. **Verify as Privileged User**
   1. Log in as the *MVP Dealer* (in `show_participants`) **or** the *Show Organizer* (owner of the show).
   2. Open **Profile › My Collection**.
   3. The “Attendee Want Lists” section should display the attendee card:
      * Name & role badge  
      * Show title/date/location  
      * Want-list text  
      * Updated timestamp

3. **Edge checks**
   * Remove the attendee’s heart → card disappears on refresh.
   * Empty or `[INVENTORY]` lists never appear.

---

## 3. Pull-Request Creation Steps

```bash
# 1 – Ensure branch is up to date
git checkout fix-show-creation-coordinates
git pull origin fix-show-creation-coordinates

# 2 – Push (already done, commit 0e04023)
git push origin fix-show-creation-coordinates

# 3 – Create PR (GitHub UI or CLI)
gh pr create \
  --base main \
  --head fix-show-creation-coordinates \
  --title "fix: display attendee want lists for MVP Dealers/Organizers" \
  --body-file WANT_LISTS_TROUBLESHOOTING_SUMMARY.md
```

Review -> merge -> deploy Expo OTA / rebuild as required.

---

## 4. Expected Behavior After Merge

| Role | Screen | Result |
|------|--------|--------|
| MVP Dealer | Profile › My Collection | List of attendee/dealer want lists for all **upcoming** shows they participate in. |
| Show Organizer | same | Lists for shows they organize. |
| Regular Attendee / Dealer | same | Unchanged – editor only, no attendee lists. |

Empty-state message appears only when **no attendee has both favourited the show *and* written a want list**, not because of a bug.

Deployment complete 🚀
