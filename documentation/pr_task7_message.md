# ✨ Task 7 – Re-organise **My Collection** page & add MVP upgrade tease

## What’s inside
This PR finishes Task 7 by:
1. Re-ordering the **My Collection** screen so dealers/organisers see  
   • “What I Sell” (inventory editor)  
   • MVP upgrade tease (regular dealers only)  
   • “My Want List” editor  
2. Persisting dealer inventory in the existing `want_lists` table (`type = 'inventory'`) – avoids the missing table error.
3. Fixing the runtime error and layout glitch affecting MVP Dealers.

---

## Key changes
| Area | Change |
|------|--------|
| **UI / Layout** | • Added dealer inventory editor at top of screen.<br>• Added conditional MVP tease banner for **dealer** accounts.<br>• Title updated to “My Collection”. |
| **Role logic** | • Components rendered based on `UserRole` (`DEALER`, `MVP_DEALER`, `SHOW_ORGANIZER`, `ATTENDEE`). |
| **Data layer** | • Re-used `want_lists` table with new `type` column (`'want'` / `'inventory'`).<br>• `collectionService.getUserWantList` now filters by `type` for backward compatibility.<br>• Inventory saved via `upsert` on (`user_id`, `type`). |
| **Error handling** | • Graceful handling & retry UI when inventory fetch fails.<br>• Loading / disabled states for save button. |
| **Bug fix** | • Removed reference to non-existent `dealer_inventories` table (error `42P01`).<br>• MVP Dealers now see correct component order. |

---

## How to test
1. Sign in as **Dealer** (non-MVP):  
   • “What I Sell” editor appears first.  
   • Tease banner prompts upgrade.  
   • Want List editor below.  
   • Save inventory → alert “Success”.
2. Sign in as **MVP Dealer / Organiser**:  
   • “What I Sell” editor (no tease).  
   • Want List below.  
3. Sign in as **Attendee**: only Want List is visible.
4. Validate inventory persists (refresh app) and no console errors.
