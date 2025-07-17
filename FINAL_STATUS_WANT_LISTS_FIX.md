# FINAL_STATUS_WANT_LISTS_FIX.md
Attendee Want‐Lists Feature — Final Status
==========================================

## 1 · Issue Resolved
The empty “Attendee Want Lists” screen for MVP Dealers/Show Organizers was traced to the service layer querying the wrong table.  
Fix implemented in `showWantListService.ts`:

* Replaced `planned_attendance` with **`user_favorite_shows`** (the table written when a user ★ hearts a show).
* Added filter `shows.start_date ≥ NOW()` to ignore past shows.
* Excluded other MVP Dealers/Organizers from attendee results.

Code is merged in branch `fix-show-creation-coordinates` and pushed.

## 2 · Debugging Results
Live debug using the IDs you supplied:

| Item | Result |
|------|--------|
| MVP Dealer `e4548d0e-f89c-4a86-9c8d-a0a297e2cb4d` | ✅ Registered for 4 shows, incl. upcoming ones |
| Attendee `49ced7c8-b18a-4a56-8893-908b9c12d422` | ❌ **0** rows in `user_favorite_shows`<br>❌ **0** rows in `want_lists` |
| Overlap calculation | 0 shows in common ⇒ service returns empty list |

Conclusion: the software is now correct; the user flow never produced the necessary data so nothing appeared.

## 3 · What Must Exist for Lists to Render
1. **Upcoming Show** – `shows.start_date` today or future.  
2. **MVP Dealer / Organizer Participation** – row in `show_participants` or `shows.organizer_id`.  
3. **Attendee/Dealer Favorite** – row in `user_favorite_shows` for the same show.  
4. **Want List** – non-empty text in `want_lists` for that user (not starting with `[INVENTORY]`).

If any row is missing the list is empty by design.

## 4 · Next Steps for Acceptance Test
1. Log in as attendee **49ced7c8…** (or any attendee).  
   a. Open an *upcoming* show that the MVP Dealer is registered for.  
   b. Tap ★ **heart**.  
   c. Go to **Profile › My Collection** → create a want list (plain text).  
2. Log in as MVP Dealer **e4548d0e…**.  
   a. Refresh **Profile › My Collection**.  
   b. The attendee’s list card should now appear.  
3. Remove any prerequisite row to confirm the card disappears.

## 5 · Confirmation
• Unit simulation and full SQL trace both returned want-list rows once the four prerequisite rows were inserted.  
• Old logic ( `planned_attendance` ) returns 0 rows; new logic returns correct rows.  
**Therefore the defect is fixed; only real data input is required for verification.**

_Status: ✅ Fix complete — ready for QA with proper test data._
