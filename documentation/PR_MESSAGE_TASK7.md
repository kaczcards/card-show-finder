# ✨ Task 7 – Re-organise “My Collection” page, MVP upgrade tease & bug fixes

## Overview
This PR completes **Task 7** by:
1. Re-ordering the Collection screen for dealers/organisers  
2. Adding a “What I Sell” inventory editor  
3. Introducing an MVP upgrade tease **with a working hyperlink**  
4. Persisting dealer inventory without new tables  
5. Fixing navigation & incorrect role display issues

## What Changed
| Area | Change |
|------|--------|
| **UI / Layout** | • “What I Sell” editor now renders **above** “My Want List”.<br>• Clean orange info banner teasing MVP upgrade for regular dealers only. |
| **Hyperlink** | • Banner text now includes _Tap to upgrade now_ link → navigates via nested route `My Profile > SubscriptionScreen`. |
| **Navigation** | • Fixed `NAVIGATE` error by providing parent tab + nested screen when calling `navigation.navigate`. |
| **Inventory Storage** | • Re-used existing `want_lists` table – rows prefixed with `[INVENTORY]` indicate dealer inventory.<br>• Upsert & fetch logic added; no schema migration required. |
| **Profile Role Bug** | • Corrected display so regular dealers (e.g. `7d792f27-9112-4837-926f-42e4eb1f0577`) show **Dealer**, not MVP Dealer. |
| **Code Cleanup** | • Removed DEV-only debug panel and toggle.<br>• Added robust error + loading states. |

## Files Touched (high-level)
* `src/screens/Collection/CollectionScreen.tsx`
* `src/navigation/ProfileNavigator.tsx` (already contained `SubscriptionScreen`)
* `src/screens/Profile/ProfileScreen.tsx`
* `src/services/collectionService.ts`

## Testing Checklist
1. **Attendee account**  
   • Only “My Want List” visible.  
2. **Regular Dealer**  
   • “What I Sell” editor ➜ MVP tease banner ➜ Want List.  
   • Tap _Tap to upgrade now_ ➜ lands on Subscription screen.  
   • Save inventory, refresh app – content persists.  
3. **MVP Dealer**  
   • “What I Sell” editor ➜ Want List (no tease).  
4. **Organizer**  
   • Same as MVP dealer.  
5. **Role Display**  
   • Profile page shows correct badge text for each role.  
6. **Regression**  
   • No debug UI present in production builds.

## Migration / Deployment
No DB migrations needed – inventory stored in `want_lists` with a simple prefix.

---

Ready for review 🙌
