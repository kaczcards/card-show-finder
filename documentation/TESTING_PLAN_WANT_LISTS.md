# TESTING_PLAN_WANT_LISTS.md
Comprehensive Test Plan – Attendee Want Lists  
------------------------------------------------

## Purpose
Validate that **MVP Dealers** and **Show Organizers** can now see attendee/dealer _want lists_ when:
* They are registered for the same **upcoming** show, and  
* The attendee/dealer has both **hearted** that show and saved a **non-inventory** want list.

---

## 1 · Why the Initial 3-Step Test Failed
| Root Issue | Explanation |
|------------|-------------|
| Past shows | Kevin (MVP dealer) was only linked to shows dated **2025-06-29** and **2025-07-12** – both already past the current date (2025-07-17). The service filters out past shows. |
| No data rows | Test attendee never actually wrote to `user_favorite_shows` or `want_lists`; therefore the query returned zero rows. |
| RLS barriers | Supabase **Row Level Security** blocks inserts/updates from scripts; only the mobile/web UI that runs as the logged-in user can write these rows. |

---

## 2 · What the Debugging Revealed
1. Service logic now **works** when valid rows exist (confirmed with simulated queries).  
2. Strict RLS prevented seed data from being written programmatically, so UI interaction is required.  
3. The absence of upcoming-show participation or attendee favorites returns an **empty state by design**—not a bug.

---

## 3 · Step-by-Step Testing Procedure

### Actors & IDs
| Role | Name | `id` |
|------|------|----------------------------------------------|
| MVP Dealer | Kevin | `84ec4c75-1c32-46f6-b0bb-7930869a4c81` |
| Attendee   | Attend 01 | `090926af-e383-4b74-95fa-d1dd16661e7f` |
| Show (upcoming) | Toy Show – 2025-07-17 | `0873c3d6-de78-49ea-8c7b-f7d3a6e15030` |

> You may substitute any other upcoming show; just keep the IDs consistent through the steps.

### A. Pre-requisites
1. **Ensure show date ≥ today**.  
2. MVP dealer must appear in `show_participants` for that show (UI “Register as Vendor” or admin insert).

### B. Data Creation (UI – required)
1. **Login as Attendee (`0909…e7f`)**  
   a. Navigate to the show detail for **Toy Show** (`0873…5030`).  
   b. Tap the ★ **heart** – this writes a row to `user_favorite_shows`.  
2. **Still as Attendee**  
   a. Go to **Profile › My Collection**.  
   b. Tap **Edit Want List**.  
   c. Enter text **not starting with `[INVENTORY]`**, e.g.  
      “Looking for 2018 Topps Chrome Refractors (Acuna, Soto).”  
   d. Save – writes a row to `want_lists`.  
3. **Login as MVP Dealer (`84ec…a4c81`)**  
   a. Confirm you are registered for **Toy Show** (should already be true).  

### C. Verification
1. Open **Profile › My Collection**.  
2. In the **Attendee Want Lists** section you should now see **one card**:  
   * Attendee name (Attend 01)  
   * Show title, date, location  
   * Want-list text you just saved  
3. Pull-to-refresh – card remains.  

### D. Negative / Edge Tests
| Action | Expected Result |
|--------|-----------------|
| Attendee un-hearts the show | Card disappears after dealer refreshes. |
| Attendee clears list or prefixes with `[INVENTORY]` | Card disappears (filtered). |
| Dealer unregisters from the show | Card disappears for dealer. |

---

## 4 · Expected Outcomes After the Fix
1. Want-list cards appear **immediately** after data prerequisites are met.  
2. Only shows with `start_date ≥ TODAY` are considered.  
3. Results exclude want lists that are empty or tagged `[INVENTORY]`.  
4. Pagination & search filters (if applied in UI) behave as before.

If any step above does **not** match the expectation, rerun the debug script (`debug-want-lists-flow.js`) or inspect the relevant table for missing rows.

---

### Success Criteria
✓ MVP dealer sees at least one attendee/dealer want-list card for an upcoming show they share.  
✓ Removing any one of the prerequisite rows hides the card on next refresh.
