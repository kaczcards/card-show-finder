# PR: Make Filter Preferences User-Specific

## 🐛 Problem  
Filter preferences (temporary filters and saved presets) created by **User A** remained visible after logging out and signing in as **User B** on the same device.  
This broke data isolation and could expose a user’s personal presets to others.

### Root Cause
1. Both temporary filters and cached presets were stored in AsyncStorage under **global keys**:
   * `homeFilters`
   * `filterPresets`
2. These keys were not cleared on logout, so the next authenticated session loaded whatever was last saved.

## ✅ Solution  
1. **Scoped Storage Keys** – Keys are now generated per‐user:  
   * `homeFilters_<userId>`  
   * `filterPresets_<userId>`
2. **Service Updates**
   * `src/services/filterService.ts`
     * Added helpers `getTempFiltersKey`, `getFilterPresetsKey`.
     * All save/load helpers accept `userId` and use scoped keys.
3. **Consumer Updates**
   * `src/screens/Home/HomeScreen.tsx`
     * Builds the correct key with `authState.user?.id` (falls back to “guest” until login).
   * `src/components/FilterPresetModal.tsx`
     * Guards against missing `userId` and passes it to service calls.
4. **No DB Migration Needed** – Supabase schema & RLS already isolate presets by `user_id`.  
   Local cache is now consistent with server rules.

## 🔄 Files Changed
| File | Key Changes |
| --- | --- |
| `src/services/filterService.ts` | namespaced keys, updated signatures |
| `src/screens/Home/HomeScreen.tsx` | user-scoped key helpers & persistence |
| `src/components/FilterPresetModal.tsx` | validation + userId propagation |

## 🧪 Testing

1. **Regression**  
   a. Log in as **User A** → apply filters, save a preset “My 50 mi”.  
   b. Log out, sign in as **User B** → verify default filters, **no** “My 50 mi” in presets.  
   c. Create a new preset as User B, log out/in as User A → User A sees only own presets.

2. **Guest Mode**  
   Launch app without signing in – filters persist under key `homeFilters_guest`.  
   Once the user registers/logs in, a new scoped key is used.

3. **Data Integrity**  
   Existing presets stored in Supabase remain untouched and correctly load after upgrade.

## ⚙️ Developer Notes
* **Logout cleanup** is no longer critical, but consider purging guest keys on first login to avoid confusion.
* If you rely on the old keys in automated tests, update them accordingly.

## 📅 Changelog
* **Fix** – Prevent sharing filter preferences between user accounts on the same device by namespacing AsyncStorage keys.
