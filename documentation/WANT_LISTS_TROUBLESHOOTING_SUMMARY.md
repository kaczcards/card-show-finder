# Want Lists Troubleshooting Summary
_file: `WANT_LISTS_TROUBLESHOOTING_SUMMARY.md`_

## 1 · Observed Issue
MVP Dealers and Show Organizers reported that the **Attendee Want Lists** section in **Collection › Attendee Want Lists** rendered **blank cards with no content and no errors**, even though test attendees had registered interest in upcoming shows.

---

## 2 · Root Cause
| Area | Problem |
|------|---------|
| Service layer | `src/services/showWantListService.ts` queried **`planned_attendance`** to discover which attendees were going to a dealer/organizer’s show. |
| Reality | Attendees do **not** populate `planned_attendance`; they “heart” shows, creating rows in **`user_favorite_shows`**. <br>Therefore the service did not return any attendee IDs, so no want lists were fetched. |
| Secondary gap | If no attendee has created a want list (`want_lists`) or favorited the show, the list legitimately remains empty – data prerequisites must be met. |

---

## 3 · Fix Implemented
1. **Service Update**  
   • Replaced all references to `planned_attendance` with **`user_favorite_shows`** in:  
   `getWantListsForMvpDealer`, `getWantListsForShowOrganizer`, `getWantListsForShow`.  
   • Added upcoming-show date filter (`shows.start_date >= now()`) so past shows are ignored.  
   • Added role filter to exclude other MVP Dealers / Organizers when collating attendee profiles.

2. **Commit**  
   Branch `fix-show-creation-coordinates` – commit `0e04023`.

_No database migration required – only client-side service logic changed._

---

## 4 · Testing Instructions
Follow the end-to-end flow in **development** or **staging**:

### 4.1 Prepare Data
1. **Attendee user**
   1. Log in as a regular *Attendee* account.
   2. From **Show Detail**, tap the ★ **heart** to add at least one upcoming show to *Favorites* (this writes to `user_favorite_shows`).
   3. Navigate to **Profile › My Collection**.  
      • Enter want-list text (e.g. “Looking for 2018 Topps Chrome RCs”).  
      • Tap **Save**.  
      (Row is written to `want_lists`.)

2. **MVP Dealer (or Show Organizer)**
   1. Ensure this user is **associated with the same show**:  
      • MVP Dealer – must be in `show_participants` for that `showid`.  
      • Organizer – must be `shows.organizer_id = <user_id>`.

### 4.2 Verify in App
1. Log in as the **MVP Dealer / Show Organizer**.
2. Go to **Profile › My Collection**.  
   The **Attendee Want Lists** list should now display a card containing:  
   • Attendee name & role badge  
   • Show title / date / location  
   • Want-list text  
   • Updated timestamp
3. Pull-to-refresh and paginate to confirm loading & infinite scroll.

### 4.3 Negative Checks
- Remove the attendee’s heart/favorite – want list disappears after refresh.  
- Add an empty want list or an inventory list (`[INVENTORY]` prefix) – it should **not** display.

---

## 5 · Data Requirements Matrix

| Table | Required Row | How it’s created |
|-------|--------------|------------------|
| `show_participants` | MVP Dealer row linking **dealer→show** | Dealer “Register as Vendor” / admin insert |
| or `shows.organizer_id` | Organizer owns the show | Show creation or claim |
| `user_favorite_shows` | Attendee **heart**s the same show | ★ Heart button in UI |
| `want_lists` | Attendee (or Dealer) creates **non-inventory** want list | Collection screen “Save” |

If any of these rows are missing, the viewer sees an empty state by design.

---

## 6 · Next Steps & Recommendations
1. **Deploy** the updated service code to production after QA passes.  
2. **Seed demo data** (favorite rows + want lists) in staging so stakeholders can always see a populated list.  
3. **RLS Review** – ensure service-role keys or edge functions can seed data without RLS collisions.  
4. **UX Enhancement** – surface a guided message to privileged users when prerequisites are missing (“Ask attendees to favorite your show and publish a want list to appear here”).  
5. **Analytics** – log when lists are viewed to measure dealer engagement.  
6. **Future** – extend filtering (e.g. by card type) and allow direct chat from want-list card.

---

**Status:** ✅ Issue resolved – want lists now render when data prerequisites are met.
